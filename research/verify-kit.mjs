/**
 * 合集端到端验证探针：无头 Chrome 打开 DSH Web，检查「插件合集」是否真的生效。
 *
 * 用法:
 *   TOKEN=$(grep -o 'token=[A-Za-z0-9_-]*' /tmp/suite-host.log | tail -1 | cut -d= -f2)
 *   node research/verify-suite.mjs "http://127.0.0.1:41888/?token=$TOKEN" [waitMs]
 *
 * 注意：DSH Desktop 的实例带一次性壳令牌栅栏（不是 web-auth），自动化读不到，所以
 * 验证请用 CLI 起专用实例：dsh --profile web --host 127.0.0.1 --port 41888 --no-open
 *
 * 校验项：
 *   1. boot 清单：合集锚点 dsh-plugin-kit + 6 个子插件行在，web-auth 不在；
 *   2. 侧栏「插件」面板：6 个子插件不再各自出卡片；
 *   3. 设置 →「插件合集」：出现分区、页签栏无空白页签、面板有内容。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:41729';
const waitMs = Number(process.argv[3] ?? 20000);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9224;
const profile = mkdtempSync(join(tmpdir(), 'dsh-suite-verify-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

async function findTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* chrome 还没起来 */ }
    await sleep(250);
  }
  throw new Error('chrome devtools endpoint 未就绪');
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (message) => {
  const frame = JSON.parse(message.data);
  if (frame.id !== undefined) { pending.get(frame.id)?.(frame); pending.delete(frame.id); return; }
  if (frame.method === 'Runtime.consoleAPICalled') {
    events.push({ kind: `console.${frame.params.type}`, text: (frame.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' ') });
  } else if (frame.method === 'Runtime.exceptionThrown') {
    const d = frame.params.exceptionDetails;
    events.push({ kind: 'exception', text: `${d.text} ${d.exception?.description ?? ''}`.slice(0, 400) });
  }
});

const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) return `ERROR: ${res.result.exceptionDetails.text}`;
  return res.result?.result?.value;
};

const waitFor = async (expression, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await sleep(300);
  }
  console.log(`  ⚠️ 超时未满足：${label}`);
  return false;
};

const clickBy = (matcher) => `(() => {
  const nodes = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="menuitem"],[role="option"]')];
  const hit = nodes.find((n) => ${matcher}(n.getAttribute('aria-label') ?? '', (n.innerText ?? '').trim(), n.getAttribute('title') ?? ''));
  if (!hit) return false;
  hit.click();
  return true;
})()`;

await send('Runtime.enable');
await send('Page.enable');

try {
  const head = await fetch(url, { redirect: 'manual' });
  console.log(`=== 0. HTTP 预检：${head.status} ===`);
  if (head.status === 401) {
    console.log('被拒绝：web-auth 网关请给该行加 disabled 并重启；DSH Desktop 的壳令牌栅栏请改用 CLI 专用实例（dsh --profile web --port <port> --no-open，从日志取带 token 的 URL）。');
    ws.close(); chrome.kill(); process.exit(2);
  }
} catch (error) {
  console.log(`HTTP 预检失败：${error?.message ?? error}`);
}

await send('Page.navigate', { url });
console.log(`=== 1. 页面与 boot 清单（${url.slice(0, 60)}…）===`);
await waitFor('typeof window.__DSH_BOOT__ === "object"', waitMs, '__DSH_BOOT__ 注入');
console.log('  最终 URL:', await evaluate('location.href'));
console.log('  readyState:', await evaluate('document.readyState'));

const bootIds = await evaluate(`(() => {
  const seen = new Set();
  const walk = (value, depth) => {
    if (depth > 4 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    if (typeof value.id === 'string') seen.add(value.id);
    for (const key of ['modules', 'rows', 'entries', 'plugins', 'tabs', 'list']) if (key in value) walk(value[key], depth + 1);
  };
  walk(window.__DSH_BOOT__, 0);
  return JSON.stringify([...seen]);
})()`);
const moduleIds = JSON.parse(bootIds ?? '[]');
const expected = ['dsh-git-panel', 'dsh-run-env-manager', 'dsh-workspace-category-manager', 'dsh-mcp-skill-manager', 'dsh-win-notify', 'dsh-oneway-usage-monitor'];
console.log('  boot id 数:', moduleIds.length);
console.log('  合集锚点行:', JSON.stringify(moduleIds.filter((id) => id.includes('plugin-kit'))));
console.log('  子插件行:', JSON.stringify(expected.filter((id) => moduleIds.includes(id))));
console.log('  web-auth 已移除:', moduleIds.some((id) => id.includes('web-auth')) ? '❌ 仍在' : '✅ 确认');

await waitFor(`document.querySelector('[aria-label="插件"]') !== null`, 20000, '侧栏「插件」入口出现');
await sleep(1500);

console.log('\n=== 2. 侧栏「插件」面板卡片 ===');
const opened = await waitFor(clickBy('(aria, text) => aria === "插件" || text === "插件"'), 8000, '点击「插件」');
if (opened) await sleep(2500);
const cardTitles = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-plugin-group] li')].map((li) => (li.innerText ?? '').split('\\n')[0]).filter(Boolean))`);
console.log('  卡片标题:', cardTitles);
const standalone = expected.filter((name) => JSON.stringify(cardTitles).toLowerCase().includes(name.toLowerCase()));
console.log('  子插件各自出卡的数量（应 0）:', standalone.length, JSON.stringify(standalone));

console.log('\n=== 3. 设置 → 插件合集 ===');
// 侧栏设置入口是 aria-label="设置"；会话工具栏里也有个「桌面设置」文本按钮，
// 只用文本正则可能点错，所以优先精确 aria-label。
let settingsOpened = await waitFor(`(() => {
  const hit = document.querySelector('[aria-label="设置"]') ?? [...document.querySelectorAll('button,[role="button"]')]
    .find((n) => (n.innerText ?? '').trim() === '设置');
  if (!hit) return false; hit.click(); return true;
})()`, 10000, '侧栏设置入口');
if (settingsOpened) await sleep(2000);
const navRows = await evaluate(`JSON.stringify([...document.querySelectorAll('nav button,nav [role="tab"],[class*="nav"] button,[class*="Nav"] button')].map((n) => (n.innerText ?? '').trim()).filter(Boolean))`);
console.log('  设置导航项:', navRows);
const leaked = ['工作区分类', '全局开发环境'].filter((name) => JSON.parse(navRows ?? '[]').includes(name));
console.log('  仍留在顶层导航的已迁移分区（应为 0）:', leaked.length, JSON.stringify(leaked));
// 只在设置导航区域内找「插件合集」——会话工具栏/正文字里也可能出现同样的字，
// 之前就点错过一次（点成了正文里的同名文本）。
const navHit = settingsOpened
  ? await waitFor(`(() => {
      const zones = document.querySelectorAll('nav, [class*="nav"], [class*="Nav"]');
      for (const zone of zones) {
        const hit = [...zone.querySelectorAll('button,[role="button"],[role="tab"],[role="menuitem"],li')]
          .find((n) => (n.innerText ?? '').trim() === '插件合集');
        if (hit) { hit.click(); return true; }
      }
      return false;
    })()`, 8000, '「插件合集」分区（设置导航内）')
  : false;
if (navHit) await sleep(1500);
await sleep(1500);
const detail = await evaluate(`JSON.stringify({
  settingsOpened: ${settingsOpened},
  suiteNavFound: ${navHit},
  suiteRoot: document.querySelector('.ps-suite') !== null,
  suiteTabs: [...document.querySelectorAll('.ps-tab')].map((n) => (n.textContent ?? '').trim()),
  emptySuiteTabs: [...document.querySelectorAll('.ps-tab')].filter((n) => (n.textContent ?? '').trim() === '').length,
  panels: document.querySelectorAll('.ps-panel').length,
  panelText: (document.querySelector('.ps-panel')?.innerText ?? '').slice(0, 120).replace(/\s+/g, ' '),
})`);
console.log('  结果:', detail);
const parsed = JSON.parse(detail ?? '{}');
const expectedTabs = 7;
console.log('\n=== 结论 ===');
console.log('  合集锚点 + 子插件行:', (JSON.parse(bootIds ?? '[]').includes('dsh-plugin-kit') ? '✅' : '❌'), expected.filter((id) => JSON.parse(bootIds ?? '[]').includes(id)).length + '/6');
console.log('  合集分区渲染:', parsed.suiteRoot ? '✅' : '❌');
console.log('  页签数（应 7）:', parsed.suiteTabs?.length, '空白页签:', parsed.emptySuiteTabs);
console.log('  页签:', JSON.stringify(parsed.suiteTabs));
console.log('  已迁移分区不再占顶层导航:', JSON.parse(navRows ?? '[]').some((x) => x === '工作区分类' || x === '全局开发环境') ? '❌ 仍在' : '✅');

console.log('\n=== 4. 合集/守卫相关控制台报错 ===');
const relevant = events.filter((e) => /suite|pluginKit|slot|declared|without inject/i.test(e.text));
if (relevant.length === 0) console.log('  （无）');
for (const event of relevant.slice(0, 12)) console.log(`  [${event.kind}] ${event.text.slice(0, 280)}`);

ws.close();
chrome.kill();
process.exit(0);
