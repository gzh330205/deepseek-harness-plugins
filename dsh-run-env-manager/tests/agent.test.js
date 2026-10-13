// agent 面：实例工具 + 每轮「当前实例」上下文。
//
// 这一层是给模型的入口，用假 registry / 假 store 就能把语义钉死，不需要真起进程：
//   - run_env_get 要带实例状态（模型据此知道「用户已经起来了」，不该再起一个）
//   - run_env_instance 的 start/stop 必须走 operations.js（与面板按钮同一份实现）
//   - run_env_log 要剥掉颜色码，并且 waitForText / waitForReady 要能提前返回、超时要明说
//   - agent-context 在「没实例」时必须返回空串（systemPrompt 会过滤空文本 → 不占 prompt）
//   - 传入的 registry.control 必须被真正使用（否则 start/stop 会绕开注册表的串行化）
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerTools } from '../src/host/tools.js';
import { registerAgentContext, CONTEXT_NAME, CONTEXT_ORDER } from '../src/host/agent-context.js';
import { isLive, runState } from '../src/host/operations.js';

let passed = 0;
const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) passed += 1;
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
};
const eq = (label, actual, expected) => check(label, JSON.stringify(actual) === JSON.stringify(expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);

const root = mkdtempSync(join(tmpdir(), 'run-env-agent-'));

/* ── 假件：registry 只做登记，不 spawn；store 用一份内存工作区 ─────────── */

function makeRegistry(initial = []) {
  const runs = new Map();
  const calls = [];
  for (const run of initial) runs.set(run.id, run);
  return {
    calls,
    control: async (_root, task) => {
      calls.push('control');
      return task();
    },
    get: (_root, id) => runs.get(id),
    list: () => [...runs.values()],
    set: (run) => runs.set(run.id, run),
    async start({ configuration, cwd, env }) {
      calls.push(`start:${configuration.id}`);
      const existing = runs.get(configuration.id);
      if (existing !== undefined && isLive(existing)) return existing; // 与真实 registry 一致：幂等
      const run = {
        id: configuration.id,
        name: configuration.name,
        root,
        command: configuration.command,
        cwd,
        envKeys: Object.keys(env ?? {}).sort(),
        status: 'starting',
        exitCode: null,
        error: undefined,
        url: undefined,
        log: '',
        base: 0,
        startedAt: Date.now(),
      };
      runs.set(run.id, run);
      return run;
    },
    async stop(_root, id) {
      calls.push(`stop:${id}`);
      const run = runs.get(id);
      if (run === undefined) return undefined;
      run.status = 'stopped';
      run.exitCode = 0;
      return run;
    },
    appendLog(run, text) {
      run.log += text;
    },
  };
}

function makeStore(configurations, environments = []) {
  const workspace = { root, bindings: {}, configurations };
  return {
    list: () => ({ environments, defaults: {}, workspaces: [workspace] }),
    findWorkspace: (query) => (query === root ? workspace : undefined),
    saveWorkspace: async () => undefined,
  };
}

/** 捕获 registerTools 注册的定义。 */
function captureTools(ctxExtras = {}) {
  const registered = new Map();
  const ctx = {
    get: (name) => (name === 'tools' ? { register: (definition) => registered.set(definition.name, definition) } : undefined),
    logger: { warn: () => undefined, info: () => undefined },
    ...ctxExtras,
  };
  return { ctx, registered };
}

const exec = { agent: { session: { cwd: root } } };
const logTailChars = () => 200000;

/* ── 1. run_env_get：带实例状态 ────────────────────────────────────── */

const configurations = [
  { id: 'web', name: '前端', type: 'command', command: 'pnpm dev', cwd: root, environment: {}, env: {}, readyWhen: { url: '', timeoutMs: 60000 }, browserUrl: '', tomcat: {} },
  { id: 'api', name: '后端', type: 'command', command: 'mvn spring-boot:run', cwd: root, environment: {}, env: {}, readyWhen: { url: '', timeoutMs: 60000 }, browserUrl: '', tomcat: {} },
];
const store = makeStore(configurations);
const registry = makeRegistry([
  { id: 'web', name: '前端', root, command: 'pnpm dev', cwd: root, status: 'ready', exitCode: null, error: undefined, url: 'http://localhost:5173/', log: 'ready\n', base: 0, startedAt: Date.now() - 3000 },
]);

{
  const { ctx, registered } = captureTools();
  registerTools(ctx, { store, registry, logTailChars });
  eq('注册了四个工具（配置读写 + 实例启停 + 日志）', [...registered.keys()].sort(), ['run_env_get', 'run_env_instance', 'run_env_log', 'run_env_save']);

  const got = await registered.get('run_env_get').execute({}, exec);
  eq('run_env_get：配置都在', got.configurations.map((item) => item.id), ['web', 'api']);
  eq('run_env_get：带实例状态与就绪地址', [got.runs.length, got.runs[0].id, got.runs[0].ready, got.runs[0].url], [1, 'web', true, 'http://localhost:5173/']);
  eq('run_env_get：liveRuns 计数', got.liveRuns, 1);
  check('run_env_get：描述里明确让模型别自己起后台服务', registered.get('run_env_get').description.includes('不要再用 bash 起后台服务'));
  check('run_env_get：note 指向 run_env_instance / run_env_log', got.note.includes('run_env_instance') && got.note.includes('run_env_log'));
}

/* ── 2. run_env_instance：start 走共享操作层且幂等 ───────────────────── */

{
  const { ctx, registered } = captureTools();
  const fresh = makeRegistry();
  registerTools(ctx, { store, registry: fresh, logTailChars });
  const tool = registered.get('run_env_instance');

  const started = await tool.execute({ action: 'start', id: 'web' }, exec);
  eq('instance start：真的调了 registry.start', fresh.calls, ['control', 'start:web']);
  eq('instance start：返回 workspacePath/action/run.status', [started.workspacePath, started.action, started.run.status], [root, 'start', 'starting']);
  eq('instance start：alreadyRunning=false（这一次是新建）', started.alreadyRunning, false);
  check('instance start：说明里告诉模型连哪个地址或怎么等', typeof started.note === 'string' && started.note.length > 0);

  fresh.set({ id: 'web', name: '前端', root, command: 'pnpm dev', cwd: root, status: 'ready', exitCode: null, error: undefined, url: 'http://localhost:5173/', log: '', base: 0, startedAt: Date.now() });
  const again = await tool.execute({ action: 'start', id: 'web' }, exec);
  // 真实 registry 的 start 也是幂等的（直接返回已有实例），所以这里按「实例数没变」断言。
  eq('instance start：已在跑 → 幂等，不重复启动', [again.alreadyRunning, again.run.status, fresh.list().length], [true, 'ready', 1]);
  check('instance start：幂等时说明写明没有重复启动', again.note.includes('没有重复启动'));

  const stopped = await tool.execute({ action: 'stop', id: 'web' }, exec);
  eq('instance stop：走 operations.stopRun', [fresh.calls.includes('stop:web'), stopped.run.status], [true, 'stopped']);

  let missing = '';
  try {
    await tool.execute({ action: 'stop', id: 'nope' }, exec);
  } catch (error) {
    missing = error.message;
  }
  check('instance stop：实例不存在 → 明确报错', missing.includes('没有运行实例'), missing);
}

/* ── 3. run_env_log：剥色 + 等待语义 ────────────────────────────────── */

{
  const { ctx, registered } = captureTools();
  const waiting = makeRegistry([
    { id: 'web', name: '前端', root, command: 'pnpm dev', cwd: root, status: 'starting', exitCode: null, error: undefined, url: undefined, log: '\u001B[32mready\u001B[0m on 5173\n', base: 0, startedAt: Date.now() },
  ]);
  registerTools(ctx, { store, registry: waiting, logTailChars });
  const tool = registered.get('run_env_log');

  const read = await tool.execute({ id: 'web' }, exec);
  eq('log：剥掉 ANSI', read.log, 'ready on 5173\n');
  eq('log：不改状态（没等待时就是当前状态）', read.status, 'starting');

  const matched = await tool.execute({ id: 'web', waitForText: 'on 5173', timeoutMs: 1000 }, exec);
  eq('log：waitForText 命中即返回', [matched.matched, matched.timedOut], [true, false]);

  // 等一个永远不会出现的文字：必须超时返回，而不是挂住。
  const timedOut = await tool.execute({ id: 'web', waitForText: 'never-printed', timeoutMs: 150 }, exec);
  eq('log：等不到就超时并如实说明', [timedOut.timedOut, timedOut.matched], [true, false]);
  check('log：超时说明包含「等待超时」', timedOut.note.includes('等待超时'), timedOut.note);

  // 没配就绪检测地址时等 waitForReady 必然超时：不该硬等，直接说明。
  const noReady = await tool.execute({ id: 'web', waitForReady: true, timeoutMs: 5000 }, exec);
  eq('log：配置没配 readyWhenUrl 时不等「就绪」', [noReady.timedOut ?? null, noReady.waitedMs ?? null], [null, null]);
  check('log：说明里点出「没有配就绪检测地址」', noReady.note.includes('没有配就绪检测地址'), noReady.note);

  // 等待期间实例退出：立刻返回 settled，不空等满超时（配置里有就绪地址）。
  const dying = makeRegistry([
    { id: 'api', name: '后端', root, command: 'x', cwd: root, status: 'starting', exitCode: null, error: undefined, url: undefined, log: 'boom\n', base: 0, startedAt: Date.now() },
  ]);
  const dyingStore = makeStore([
    { ...configurations[0], id: 'api', name: '后端', command: 'x', readyWhen: { url: 'http://127.0.0.1:1/', timeoutMs: 60000 } },
  ]);
  const { ctx: ctx2, registered: reg2 } = captureTools();
  registerTools(ctx2, { store: dyingStore, registry: dying, logTailChars });
  const started = Date.now();
  dying.set({ ...dying.get(root, 'api'), status: 'failed', exitCode: 1 });
  const settled = await reg2.get('run_env_log').execute({ id: 'api', waitForReady: true, timeoutMs: 5000 }, exec);
  eq('log：实例已退出 → 不等满超时，如实返回 settled', [settled.settled, settled.status], [true, 'failed']);
  check('log：提前返回而不是空等', Date.now() - started < 2000, String(Date.now() - started));

  let noRun = '';
  try {
    await reg2.get('run_env_log').execute({ id: 'ghost' }, exec);
  } catch (error) {
    noRun = error.message;
  }
  check('log：实例不存在 → 明确报错并指向启动工具', noRun.includes('没有运行实例') && noRun.includes('run_env_instance'), noRun);
}

/* ── 4. 每轮上下文：没有实例时不占 prompt ───────────────────────────── */

{
  const contexts = [];
  const fakeScope = { systemPrompt: { context: (entry) => { contexts.push(entry); } } };
  const ctx = { inject: (deps, callback) => { eq('上下文：注入 systemPrompt 依赖', deps, ['systemPrompt']); callback(fakeScope); } };
  registerAgentContext(ctx, { render: (query) => (query === root ? 'HAS-RUNS' : '') });

  eq('上下文：注册名与 order', [contexts[0].name, contexts[0].order], [CONTEXT_NAME, CONTEXT_ORDER]);
  eq('上下文：有实例时给出文本', contexts[0].text({ agent: { session: { cwd: root } } }), 'HAS-RUNS');
  eq('上下文：没有 cwd 的 agent（子代理/无会话）→ 空串', contexts[0].text({ agent: {} }), '');
  eq('上下文：求值抛错 → 空串，不打断组装', contexts[0].text({ agent: { session: { cwd: 'boom' } } }), '');
}

/* ── 5. 上下文文案本身：空就空，有就一行 ─────────────────────────────── */

{
  const { renderRunningContext } = await import('../src/host/operations.js');
  const empty = makeRegistry();
  eq('文案：没有实例 → 空串（systemPrompt 会过滤掉）', renderRunningContext(empty, root), '');

  const one = makeRegistry([
    { id: 'web', name: '前端', root, command: 'pnpm dev', cwd: root, status: 'ready', exitCode: null, error: undefined, url: 'http://localhost:5173/', log: '', base: 0, startedAt: Date.now() - 65000 },
  ]);
  const text = renderRunningContext(one, root);
  check('文案：带 id / 状态 / 地址 / 时长', text.includes('web') && text.includes('ready') && text.includes('http://localhost:5173/') && text.includes('1m'), text);
  check('文案：明确要求不要用 bash 再起一个', text.includes('不要用 bash 再起一个后台服务'), text);
  check('文案：只有一行（不换行，避免占多行 prompt）', !text.includes('\n'), text);

  const many = makeRegistry(
    Array.from({ length: 9 }, (_value, index) => ({
      id: `svc-${index}`, name: 'x', root, command: 'x', cwd: root, status: 'running', exitCode: null, error: undefined, url: undefined, log: '', base: 0, startedAt: Date.now(),
    })),
  );
  const capped = renderRunningContext(many, root, { maxInstances: 6 });
  eq('文案：最多列 maxInstances 个，其余折成计数', [capped.includes('svc-0'), capped.includes('svc-6'), capped.includes('另有 3 个')], [true, false, true]);
}

/* ── 6. runState / isLive 的边界 ────────────────────────────────────── */

{
  eq('isLive：starting/running/ready/stopping 都算活着', ['starting', 'running', 'ready', 'stopping'].map((status) => isLive({ status })), [true, true, true, true]);
  eq('isLive：退出态不算', ['stopped', 'failed', 'exited'].map((status) => isLive({ status })), [false, false, false]);
  const state = runState({ id: 'x', name: 'x', root, command: 'x', cwd: root, status: 'ready', exitCode: 0, error: undefined, url: 'http://x/', log: 'abc', startedAt: 1000 }, 6000);
  eq('runState：投影字段齐全', [state.ready, state.url, state.error, state.elapsedMs, state.logChars], [true, 'http://x/', null, 5000, 3]);
}

rmSync(root, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`agent FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`agent OK: ${passed} assertions passed（实例工具 / 等待语义 / 每轮上下文）`);
