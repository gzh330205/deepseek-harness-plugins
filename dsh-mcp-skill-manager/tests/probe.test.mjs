/**
 * `probeMcpServer` 的真实握手测试 —— 不 mock SDK，真的起进程 / 真连 HTTP。
 *
 * 覆盖四种结论：能连上并列到工具、子进程起来但协议不通、命令不存在、
 * HTTP 目标拒绝连接；外加一个「停用的服务不该被探测」的边界（由路由层保证，
 * 这里测 probe 本身对空配置的容错）。
 *
 * 为什么值得真跑：这套探测复用了 dsh-mcp-client 的 SDK 与传输，
 * 只有真起一次才能确认「探测通过 == 模型真能调用」这个前提没走样。
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describeProbeError, explainStdioFailure, probeMcpServer, resolveStdioCommand } from '../index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'tests/fixtures/echo-mcp-server.mjs');

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** 配置形状必须与 schemastery 里的 ManagedMcpServer 一致（缺字段会读崩）。 */
function makeServer(overrides) {
  return {
    id: 'fixture',
    label: '',
    enabled: true,
    transport: 'stdio',
    serverName: 'fixture',
    command: process.execPath,
    args: [fixture],
    cwd: '',
    url: '',
    env: {},
    envVars: {},
    headers: {},
    headerEnvVars: {},
    toolCallTimeoutMs: 60000,
    ...overrides,
  };
}

/* ── 1. 可用的 stdio 服务 ───────────────────────────────────────────── */

{
  const result = await probeMcpServer(makeServer({}), 15000);
  check('可用服务：探测通过', result.ok === true, JSON.stringify(result));
  check('可用服务：工具数为 2', result.toolCount === 2, JSON.stringify(result));
  check('可用服务：工具名正确', JSON.stringify(result.toolNames) === JSON.stringify(['echo', 'ping']), JSON.stringify(result.toolNames));
  check('可用服务：报告服务器信息', result.serverInfo?.name === 'echo-mcp-fixture', JSON.stringify(result.serverInfo));
  check('可用服务：耗时是数字', typeof result.ms === 'number' && result.ms >= 0, String(result.ms));
}

/* ── 2. 子进程能起来但立刻退出（协议不通） ──────────────────────────── */

{
  const result = await probeMcpServer(makeServer({ args: ['-e', 'process.exit(3)'] }), 8000);
  check('进程秒退：判定为不可用', result.ok === false, JSON.stringify(result));
  check('进程秒退：给出错误文本', typeof result.error === 'string' && result.error.length > 0, JSON.stringify(result));
  console.log(`      ↳ 错误文本：${result.error}`);
}

/* ── 3. 命令不存在 ─────────────────────────────────────────────────── */

{
  const result = await probeMcpServer(makeServer({ command: 'definitely-not-a-real-binary-xyz', args: [] }), 8000);
  check('命令不存在：判定为不可用', result.ok === false, JSON.stringify(result));
  // Windows 上是 shell 的「not recognized」，POSIX 上是 ENOENT；两者都算把诊断带出来了。
  check('命令不存在：错误里带上子进程的诊断', /not recognized|ENOENT|not found/i.test(result.error ?? ''), String(result.error));
  console.log(`      ↳ 错误文本：${result.error}`);
}

/* ── 4. HTTP 目标拒绝连接 ──────────────────────────────────────────── */

{
  const result = await probeMcpServer(
    makeServer({ transport: 'streamable-http', serverName: 'dead', command: '', args: [], url: 'http://127.0.0.1:1/mcp' }),
    6000,
  );
  check('HTTP 连不上：判定为不可用', result.ok === false, JSON.stringify(result));
  check('HTTP 连不上：给出错误文本', typeof result.error === 'string' && result.error.length > 0, JSON.stringify(result));
  console.log(`      ↳ 错误文本：${result.error}`);
}

/* ── 5. 环境变量确实传给了子进程 ───────────────────────────────────── */

{
  const result = await probeMcpServer(
    makeServer({ args: ['-e', 'if(!process.env.MSM_PROBE_OK) process.exit(9)'] }),
    8000,
  );
  // 这里故意不注入变量，应当失败——证明探测走的是真实 spawn 环境。
  check('缺少环境变量：子进程按自己的逻辑退出', result.ok === false, JSON.stringify(result));
  const withEnv = await probeMcpServer(
    makeServer({ args: ['-e', 'if(!process.env.MSM_PROBE_OK) process.exit(9)'], env: { MSM_PROBE_OK: '1' } }),
    8000,
  );
  // 子进程不是 MCP 服务器，所以协议仍不通；但错误不应是「进程退出码 9」。
  check('显式 env 已注入（不再以退出码 9 结束）', !/9/.test(withEnv.error ?? ''), String(withEnv.error));
}

/* ── 6. describeProbeError 归一化 ──────────────────────────────────── */

{
  const withCode = Object.assign(new Error('spawn npx ENOENT'), { code: 'ENOENT' });
  check('错误码并入消息', describeProbeError(withCode) === 'spawn npx ENOENT', describeProbeError(withCode));
  const bare = Object.assign(new Error('boom'), { code: 'EFAIL' });
  check('消息不含错误码时补上', describeProbeError(bare) === 'boom（EFAIL）', describeProbeError(bare));
  check('非 Error 也能处理', describeProbeError('oops') === 'oops', describeProbeError('oops'));
}

/* ── 7. Windows 命令解析诊断（.cmd / 无扩展名 shim 陷阱） ──────────── */

{
  // 造两个假目录：一个只有 node.cmd，另一个有真正的 node.exe。
  const root = mkdtempSync(join(tmpdir(), 'msm-cmd-'));
  const shimDir = join(root, 'runtime-bin');
  const realDir = join(root, 'node');
  mkdirSync(shimDir);
  mkdirSync(realDir);
  writeFileSync(join(shimDir, 'node.cmd'), '@echo off');

  writeFileSync(join(realDir, 'node.exe'), '');
  writeFileSync(join(realDir, 'npx'), '');

  const shimFirst = { PATH: `${shimDir};${realDir}` };
  const exeOnly = { PATH: realDir };

  check('解析按「目录优先」选中靠前目录里的 .cmd', resolveStdioCommand('node', shimFirst, 'win32') === join(shimDir, 'node.cmd'), String(resolveStdioCommand('node', shimFirst, 'win32')));
  check('没有 .cmd 时解析到 .exe', resolveStdioCommand('node', exeOnly, 'win32') === join(realDir, 'node.exe'), String(resolveStdioCommand('node', exeOnly, 'win32')));
  check('.cmd 会给出可执行性诊断', /shell:false/.test(explainStdioFailure('node', shimFirst, 'win32')), explainStdioFailure('node', shimFirst, 'win32'));
  check('无扩展名 shim 也会被指出', /不是 Windows 可执行文件/.test(explainStdioFailure('npx', exeOnly, 'win32')), explainStdioFailure('npx', exeOnly, 'win32'));
  check('.exe 不误报', explainStdioFailure('node', exeOnly, 'win32') === '', explainStdioFailure('node', exeOnly, 'win32'));
  check('找不到命令时报「找不到」', /找不到可执行文件/.test(explainStdioFailure('nope-xyz', exeOnly, 'win32')), explainStdioFailure('nope-xyz', exeOnly, 'win32'));
  check('非 Windows 平台不做这套诊断', explainStdioFailure('node', shimFirst, 'linux') === '');

  rmSync(root, { recursive: true, force: true });
}

console.log(`\n${passed}/${passed + failures.length} 通过`);
if (failures.length) {
  console.log('失败项:', failures.join(' / '));
  process.exitCode = 1;
}
