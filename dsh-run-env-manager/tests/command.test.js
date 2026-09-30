// 命令怎么交给操作系统：Windows 上「带引号的命令」曾经是坏的，这里把规则钉住。
//
// 真机上量到的两个反例（cmd.exe /d /s /c + Node 的 argv 引号规则叠加的结果）：
//   node.exe -e "process.exit(3)"      → node 收到字符串字面量，退出 0（而不是 3）
//   "D:\..\node.exe" -e "…"            → '"D:\..\node.exe"' is not recognized
// 所以能直接 spawn 的一律直接 spawn，只有 shell 语法或 .cmd 目标才包 cmd。
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasShellSyntax,
  planCommand,
  resolveWindowsExecutable,
  tokenizeWindows,
  withNodeShim,
} from '../src/host/processes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) passed += 1;
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
};

/* ── 1. 引号切分 ────────────────────────────────────────────────────── */

check('普通空格切分', JSON.stringify(tokenizeWindows('pnpm dev --port 3000')) === JSON.stringify(['pnpm', 'dev', '--port', '3000']));
check(
  '引号里的空格保留',
  JSON.stringify(tokenizeWindows('node -e "process.exit(3)"')) === JSON.stringify(['node', '-e', 'process.exit(3)']),
  JSON.stringify(tokenizeWindows('node -e "process.exit(3)"')),
);
check(
  '带空格的绝对路径',
  JSON.stringify(tokenizeWindows('"D:\\Program Files\\nodejs\\node.exe" -v')) === JSON.stringify(['D:\\Program Files\\nodejs\\node.exe', '-v']),
  JSON.stringify(tokenizeWindows('"D:\\Program Files\\nodejs\\node.exe" -v')),
);
check('多余空格不产生空 token', JSON.stringify(tokenizeWindows('  a   b  ')) === JSON.stringify(['a', 'b']));
check('转义引号', JSON.stringify(tokenizeWindows('cmd "a\\"b"')) === JSON.stringify(['cmd', 'a"b']), JSON.stringify(tokenizeWindows('cmd "a\\"b"')));

/* ── 2. 什么时候必须要 shell ────────────────────────────────────────── */

for (const command of ['a && b', 'a || b', 'a | b', 'a > out.txt', 'a < in.txt', 'echo %PATH%']) {
  check(`需要 shell：${command}`, hasShellSyntax(command));
}
for (const command of ['pnpm dev', 'node -e "process.exit(3)"', 'java -jar a.jar']) {
  check(`不需要 shell：${command}`, !hasShellSyntax(command));
}
// 引号内的 `>` `|` `&&` 不是 shell 语法——`=>` 曾经被误判成重定向，把「裸 node + 引号」推给了 cmd。
check('箭头函数不被当成重定向', !hasShellSyntax(`node -e "setInterval(()=>{},1000)"`));
check('引号里的管道不算', !hasShellSyntax('node -e "a|b"'));
check('引号里的 && 不算', !hasShellSyntax('node -e "a && b"'));
check('引号外的管道算', hasShellSyntax('node -e "a" | more'));
check('引号不闭合时交给 shell', hasShellSyntax('node -e "oops'));
check('引号里的 %VAR% 不算展开', !hasShellSyntax('node -e "echo %PATH%"'));

/* ── 3. 可执行文件解析 ──────────────────────────────────────────────── */

const fakePath = join(root, 'tests', 'fixtures-bin');
check('PATH 里找不到就返回 undefined', resolveWindowsExecutable('definitely-not-here-xyz', { PATH: fakePath }) === undefined);
check('非 .exe 的名字不直接执行', resolveWindowsExecutable('node.cmd', { PATH: fakePath }) === undefined);
check('POSIX 走 bash -c', planCommand('pnpm dev', 'linux').argv[0] === 'bash');
check('POSIX via=shell', planCommand('pnpm dev', 'linux').via === 'shell');

/* ── 4. 规划结果 ────────────────────────────────────────────────────── */

const shellPlan = planCommand('a && b', 'win32', { PATH: fakePath });
check('shell 语法 → cmd 包装', shellPlan.argv[0] === 'cmd.exe' && shellPlan.via === 'shell', JSON.stringify(shellPlan.argv));
const cmdPlan = planCommand('npm run build', 'win32', { PATH: fakePath });
check('.cmd 目标（解析不到 .exe）→ 仍然 cmd 包装', cmdPlan.argv[0] === 'cmd.exe' && cmdPlan.via === 'shell', JSON.stringify(cmdPlan.argv));

/* ── 5. 垫片变量：DSH 会剥掉 DSH_*，但 PATH 里的 node.cmd 需要它 ────── */

const nodeExe = 'D:\\VMR SDKs\\versions\\node_versions\\node\\node.exe';
check('CLI/headless：execPath 是 node → 补上变量', withNodeShim({ PATH: 'x' }, nodeExe).DSH_DESKTOP_NODE_EXECUTABLE === nodeExe);
check(
  '桌面端：execPath 是 Electron + ELECTRON_RUN_AS_NODE=1 → 补上变量',
  withNodeShim({ ELECTRON_RUN_AS_NODE: '1' }, 'D:\\Program Files\\DSH Desktop\\DSH Desktop.exe').DSH_DESKTOP_NODE_EXECUTABLE ===
    'D:\\Program Files\\DSH Desktop\\DSH Desktop.exe',
);
check(
  '两头都不是 → 不乱设（避免垫片去启动 GUI 程序）',
  withNodeShim({ PATH: 'x' }, 'D:\\Program Files\\DSH Desktop\\DSH Desktop.exe').DSH_DESKTOP_NODE_EXECUTABLE === undefined,
);
check('已有值不覆盖（配置里显式给的优先）', withNodeShim({ DSH_DESKTOP_NODE_EXECUTABLE: 'custom' }, nodeExe).DSH_DESKTOP_NODE_EXECUTABLE === 'custom');
check('不修改入参对象', (() => { const env = { PATH: 'x' }; withNodeShim(env, nodeExe); return env.DSH_DESKTOP_NODE_EXECUTABLE === undefined; })());

if (failures.length > 0) {
  console.error(`command FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`command OK: ${passed} assertions passed（引号切分 / shell 判定 / 可执行解析 / 垫片变量）`);
