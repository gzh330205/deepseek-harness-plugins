/**
 * CDP 探针：无头 Chrome 加载 DSH Web 页面，抓取控制台错误/异常，
 * 用于诊断客户端插件（dsh-win-notify）在浏览器侧的加载结果。
 *
 * 用法: node research\cdp-probe.mjs <url> [waitMs]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const waitMs = Number(process.argv[3] ?? 15000);
if (!url) throw new Error('usage: node cdp-probe.mjs <url> [waitMs]');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9223;
const profile = mkdtempSync(join(tmpdir(), 'dsh-cdp-'));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (frame.id !== undefined) {
    pending.get(frame.id)?.(frame);
    pending.delete(frame.id);
    return;
  }
  if (frame.method === 'Runtime.consoleAPICalled') {
    const text = (frame.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' ');
    events.push({ kind: `console.${frame.params.type}`, text });
  } else if (frame.method === 'Runtime.exceptionThrown') {
    const d = frame.params.exceptionDetails;
    events.push({ kind: 'exception', text: `${d.text} ${d.exception?.description ?? ''}`.slice(0, 600) });
  } else if (frame.method === 'Log.entryAdded') {
    events.push({ kind: `log.${frame.params.entry.level}`, text: `${frame.params.entry.text} ${frame.params.entry.url ?? ''}`.slice(0, 600) });
  }
});

const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(waitMs);

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) return `ERROR: ${res.result.exceptionDetails.text}`;
  return res.result?.result?.value;
};

console.log('=== console / exceptions ===');
for (const event of events) console.log(`[${event.kind}] ${event.text}`);
console.log('\n=== probes ===');
console.log('title:', await evaluate('document.title'));
console.log('moduleLoader:', await evaluate('typeof window.__ModuleLoader__'));
console.log('bootModules:', await evaluate('Array.isArray(window.__DSH_BOOT__?.modules) ? window.__DSH_BOOT__.modules.length : null'));
console.log('winNotifyRow:', await evaluate('JSON.stringify((window.__DSH_BOOT__?.modules ?? []).find((m) => m.id === "dsh-win-notify") ?? null)'));
console.log('notificationApi:', await evaluate('typeof Notification'));
console.log('tauriBridge:', await evaluate('typeof window.__TAURI__'));
console.log('bodyText:', String(await evaluate('document.body.innerText.slice(0, 400)')).replace(/\s+/g, ' '));

ws.close();
chrome.kill();
process.exit(0);
