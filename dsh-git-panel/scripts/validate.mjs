// 脚手架回归断言：把必须保持的约定写成字面量检查，改坏了直接失败，
// 而不是等插件在 boot 时静默失效。运行：node ./scripts/validate.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const failures = [];
const check = (label, condition) => {
  if (!condition) failures.push(label);
};

const ID = 'dsh-git-panel';
const NAMESPACE = 'git-panel';

/* ── 文件与清单 ───────────────────────────────────────────────────────── */

for (const file of ['package.json', 'cordis.patch.yml', 'index.js', 'lib/client.js', 'src/client/index.ts', 'src/host/routes.js', 'README.md']) {
  check(`缺少文件 ${file}`, existsSync(join(root, file)));
}

const pkg = JSON.parse(read('package.json'));
check('dsh.bundle.patch 必须是 ./cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml');
check('dsh.client.platform 必须是 web', pkg.dsh?.client?.platform === 'web');
check("exports['./client'] 必须指向 ./lib/client.js", pkg.exports?.['./client'] === './lib/client.js');
check('schemastery 必须锁 ~3.18.4（.volatile() 从 3.18.4 才有）', pkg.dependencies?.['@deepseek-ai/schemastery'] === '~3.18.4');
check('客户端 inject 必须声明 sidebar-right 与 session', ['@deepseek-ai/dsh-client-ui-sidebar-right', '@deepseek-ai/dsh-client-ui-session'].every((name) => (pkg.dsh?.client?.inject ?? []).includes(name)));

/* ── 宿主 ─────────────────────────────────────────────────────────────── */

const host = read('index.js');
const hostCode = host.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(`宿主必须声明 SETTINGS_NAMESPACE = '${NAMESPACE}'`, host.includes(`SETTINGS_NAMESPACE = '${NAMESPACE}'`));
// unwrapExports() 遇到 default 会丢掉整个模块命名空间，Config/inject 一起失效。
check('宿主不得写 export default（会吞掉 Config/inject）', !/export\s+default/.test(hostCode));
check('宿主必须导出 apply', /export function apply/.test(host));
check('宿主必须声明 inject', /export const inject/.test(host));
check('宿主必须声明可写的 volatile 配置', (host.match(/\.volatile\(\)/g) ?? []).length >= 4);

const patch = read('cordis.patch.yml');
check(`patch 行 id 必须等于 ${NAMESPACE}`, new RegExp(`id:\\s*${NAMESPACE}\\b`).test(patch));
check(`patch 行 name 必须是 ${ID}`, new RegExp(`name:\\s*${ID}\\b`).test(patch));

/* ── 网络边界：本插件不跑任何联网子命令 ──────────────────────────────── */

const hostSources = [];
const walk = (dir) => {
  for (const name of readdirSync(join(root, dir))) {
    const relative = `${dir}/${name}`;
    if (statSync(join(root, relative)).isDirectory()) walk(relative);
    else if (relative.endsWith('.js')) hostSources.push(relative);
  }
};
walk('src/host');
walk('src/shared');
for (const relative of [...hostSources, 'index.js']) {
  const source = read(relative);
  check(
    `${relative} 不应出现联网 git 子命令（fetch/push/pull/clone/remote/submodule）`,
    !/(?:\[|,\s*)['"](?:fetch|push|pull|clone|remote|ls-remote|submodule)['"]/.test(source),
  );
  check(`${relative} 不应直接引用 http/https 客户端`, !/from 'node:https?'/.test(source));
}
check('宿主不接触凭据（不读 ~/.git-credentials / credential helper）', !/credential|\.git-credentials/i.test(hostSources.map((file) => read(file)).join('\n')));

/* ── 客户端 ───────────────────────────────────────────────────────────── */

const clientEntry = read('src/client/index.ts');
check('客户端必须注册 tab 类型', clientEntry.includes('sidebarRightTabs.register'));
check('客户端必须注册 sidebar.right.pane.tab 正文', clientEntry.includes("'sidebar.right.pane.tab'"));
check('客户端 apply 必须有 try/catch 降级', /catch\s*\(/.test(clientEntry));
check('引导卡片必须带图标', /guide:\s*\[/.test(clientEntry) && clientEntry.includes('icon: IconGit'));

const bundle = read('lib/client.js');
check('客户端产物必须带 __ModuleLoader__ 注册头', bundle.includes('__ModuleLoader__.load'));
check(`客户端产物注册 id 必须是包名 ${ID}`, bundle.includes(`"${ID}"`));
check('客户端产物内联了样式', bundle.includes('data-plugin-css') || bundle.includes('dgp'));

/* ── 样式约定：按钮外观必须按白名单加回，不能用黑名单排除 ─────────────── */

const styles = read('src/client/styles.css');
// 注释里专门写了「不要这么做」，所以检查前先去掉注释。
const stylesCode = styles.replace(/\/\*[\s\S]*?\*\//g, '');
// 黑名单写法（`.dgp button:not(.xxx)`）会让每个新增的行内控件（文件名、目录切换、
// 分段控件…）悄悄带上按钮边框——这类回归在无浏览器环境里看不出来，所以钉成断言。
check('样式不得用 `.dgp button:not(...)` 黑名单控制按钮外观', !/\.dgp button:not/.test(stylesCode));
check('样式必须用低优先级的 :where(button) 重置按钮外观', /\.dgp :where\(button\)/.test(stylesCode));
check('样式必须显式声明「有按钮外观」的白名单', /\.dgp-primary,\n\.dgp-more,/.test(stylesCode));

// 同一份 CSS 里同一个选择器只能出现一次：`.dgp-commit` 曾被「提交框」和「提交行」
// 各写一套，叠加之后历史列表整行变成居中的卡片——只有真机截图才看得出来。
// 只查「独占一行的单选择器规则」：共享的白名单规则（`.dgp-primary, .dgp-more, …`）
// 里重复出现同一个类是正常的叠加，不算冲突。
const seenSelectors = new Set();
for (const match of stylesCode.matchAll(/(^|\})([^{}@]+)\{/g)) {
  const selector = match[2].trim();
  if (selector === '' || selector.startsWith('from') || selector.startsWith('to')) continue;
  const parts = selector.split(',').map((part) => part.trim());
  if (parts.length !== 1) continue;
  const simple = parts[0];
  if (simple === '' || simple.includes(':') || simple.includes('[') || simple.startsWith('.')) {
    if (simple.startsWith('.') && seenSelectors.has(simple)) {
      check(`样式类 ${simple} 被定义成两套规则——同名类会互相污染（曾经的 .dgp-commit 就让历史列表变成居中卡片）`, false);
    }
    seenSelectors.add(simple);
  }
}

// 提交图的行高常量必须和 CSS 的行高一致：泳道是按 ROW_HEIGHT 画进 viewBox 再纵向
// 拉伸到行高的，两边数字不一致时相邻行的线会断开（提交图最常见的静默坏法）。
{
  const history = readFileSync(new URL('../src/client/components/HistoryView.tsx', import.meta.url), 'utf8');
  const rowHeight = /const ROW_HEIGHT = (\d+);/.exec(history)?.[1];
  const cssRowHeight = /\.dgp-commititem \{[^}]*min-height: (\d+)px/.exec(stylesCode)?.[1];
  check(
    `提交图行高一致（HistoryView ROW_HEIGHT=${rowHeight} vs .dgp-commititem min-height=${cssRowHeight}）`,
    rowHeight !== undefined && rowHeight === cssRowHeight,
  );
  check('提交图泳道随行高拉伸（preserveAspectRatio=none + non-scaling-stroke）', history.includes('preserveAspectRatio="none"') && history.includes('vectorEffect="non-scaling-stroke"'));
  check('提交图圆点不在 svg 里（拉伸不会把它压成椭圆）', !/<circle[^>]*className=\{?`?dgp-dot/.test(history));

  // 行本身不能有纵向内边距：提交图是 align-self: stretch 铺满行的，行一旦上下留白，
  // 相邻行的泳道之间就会露出断口。纵向留白应放在 .dgp-commitinfo 上。
  const itemPad = /\.dgp-commititem \{[^}]*padding: ([^;]+);/.exec(stylesCode)?.[1]?.trim() ?? '';
  const infoPad = /\.dgp-commitinfo \{[^}]*padding: ([^;]+);/.exec(stylesCode)?.[1]?.trim() ?? '';
  check(`.dgp-commititem 不留纵向内边距（当前 padding: ${itemPad}）`, itemPad.startsWith('0'), itemPad);
  check(`.dgp-commitinfo 承担纵向留白（当前 padding: ${infoPad}）`, /^\d/.test(infoPad) && !infoPad.startsWith('0'), infoPad);
}

/* ── i18n：组件里用到的字面量 key 必须在两套词典里都存在 ───────────────── */

const dictionaries = read('src/client/locales.ts');
const dictKeys = new Set();
for (const match of dictionaries.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z][\w.]*)):\s/gm)) {
  dictKeys.add(match[1] ?? match[2]);
}
const used = new Set();
const clientFiles = [];
const walkClient = (dir) => {
  for (const name of readdirSync(join(root, dir))) {
    const relative = `${dir}/${name}`;
    if (statSync(join(root, relative)).isDirectory()) walkClient(relative);
    else if (/\.tsx?$/.test(relative)) clientFiles.push(relative);
  }
};
walkClient('src/client');
for (const relative of clientFiles) {
  const source = read(relative);
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(match[1]);
}
const missing = [...used].filter((key) => !dictKeys.has(key));
check(`缺少文案 key：${missing.join(', ')}`, missing.length === 0);

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`validate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`validate OK: ${ID} 脚手架约定全部满足（i18n ${used.size} 个 key）`);
