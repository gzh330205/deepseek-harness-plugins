// 「日志里的地址 → 默认浏览器」在宿主半的实现：只放行 http(s)、按平台选命令、
// 子进程必须与宿主脱钩（自带 spawn + detached + unref，不进 Job 容器）。
// 运行：node ./tests/openurl.test.js
import { EventEmitter } from 'node:events';
import { normalizeOpenUrl, openInDefaultBrowser, planOpenUrl } from '../src/host/open.js';

let passed = 0;
const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) passed += 1;
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
};
const eq = (label, actual, expected) => check(label, Object.is(actual, expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);

/* ── 只放行 http(s) ───────────────────────────────────────────────────── */

eq('http 通过', normalizeOpenUrl('http://localhost:5173/'), 'http://localhost:5173/');
eq('https 通过', normalizeOpenUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
eq('补齐末尾斜杠', normalizeOpenUrl('http://localhost:3000'), 'http://localhost:3000/');
eq('去空白', normalizeOpenUrl('  http://localhost:3000/  '), 'http://localhost:3000/');
for (const rejected of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ftp://x.com', 'mailto:a@b.com', 'data:text/html,x', '', '   ', 'not a url']) {
  eq(`拒绝 ${rejected === '' ? '(空串)' : rejected}`, normalizeOpenUrl(rejected), undefined);
}

/* ── 按平台选命令 ─────────────────────────────────────────────────────── */

eq('Windows 走 rundll32（不经 shell，& 不会被 cmd 拆开）', JSON.stringify(planOpenUrl('http://x.com/?a=1&b=2', 'win32')), JSON.stringify(['rundll32.exe', 'url.dll,FileProtocolHandler', 'http://x.com/?a=1&b=2']));
eq('macOS 走 open', JSON.stringify(planOpenUrl('https://x.com/', 'darwin')), JSON.stringify(['open', 'https://x.com/']));
eq('Linux 走 xdg-open', JSON.stringify(planOpenUrl('https://x.com/', 'linux')), JSON.stringify(['xdg-open', 'https://x.com/']));

/* ── 真的交出去：子进程参数、脱钩、失败上报 ───────────────────────────── */

function fakeSpawn(record) {
  return (command, args, options) => {
    Object.assign(record, { command, args, options });
    const child = new EventEmitter();
    child.unref = () => {
      record.unrefed = true;
    };
    process.nextTick(() => child.emit(record.fail === true ? 'error' : 'spawn', record.fail === true ? new Error('spawn ENOENT') : undefined));
    return child;
  };
}

const launched = {};
const opened = await openInDefaultBrowser('  http://localhost:3000/app?a=1&b=2 ', 'win32', fakeSpawn(launched));
eq('返回值是规范化后的地址', opened, 'http://localhost:3000/app?a=1&b=2');
eq('命令交给 rundll32', launched.command, 'rundll32.exe');
eq('参数带上地址', launched.args.at(-1), 'http://localhost:3000/app?a=1&b=2');
check('detached（脱离宿主进程组）', launched.options?.detached === true);
check('stdio 丢弃（不占管道）', launched.options?.stdio === 'ignore');
check('unref（宿主退出不带走浏览器）', launched.unrefed === true);

const failing = { fail: true };
let failure;
try {
  await openInDefaultBrowser('http://localhost:3000/', 'win32', fakeSpawn(failing));
} catch (error) {
  failure = error;
}
check('spawn 失败要 reject（面板才能报出来，而不是点了没反应）', failure instanceof Error, String(failure));

let rejected;
try {
  await openInDefaultBrowser('file:///C:/Windows/System32/calc.exe', 'win32', () => {
    throw new Error('不该被调用');
  });
} catch (error) {
  rejected = error;
}
check('非 http(s) 在 spawn 之前就拒绝', rejected instanceof Error, String(rejected));

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`openurl: ${failures.length} 项失败\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`openurl: ${passed} 项通过`);
