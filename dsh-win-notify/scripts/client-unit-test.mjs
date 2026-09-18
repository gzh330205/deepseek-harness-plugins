/**
 * dsh-win-notify 客户端（client.js）逻辑单测：在 Node 中桩掉
 * window.__ModuleLoader__ / fetch / Notification / __TAURI__，
 * 加载真实 client.js 包并验证：
 *   - running true→false 触发完成通知（含 subagent 过滤、模板、Tauri 优先）；
 *   - 人工干预：新版 uiSession.sessionStatus.pendingInteraction（审批/提问/
 *     计划审查）按 key 去重；旧版 pendingInteractions 兜底路径可用；
 *   - 稳健性：uiSession 缺失、快照接口缺失/异常时 apply 不抛错
 *     （新版 Web boot 对客户端插件 fail-loud，抛错会让整页启动失败）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
};

/** 等 fetch(/config) 的微任务链落地。 */
const flushConfig = () => new Promise((resolve) => setImmediate(resolve));

/** 快照 store 桩：getSnapshot() + subscribe() + set()（触发订阅者）。 */
function makeStore(initial) {
  const listeners = new Set();
  return {
    snapshot: initial,
    getSnapshot() {
      return this.snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(value) {
      this.snapshot = value;
      for (const listener of [...listeners]) listener();
    },
  };
}

/**
 * 在全局桩环境里执行 client.js 并拿到测试句柄。
 * stubs.uiSession: 'status'（新版）| 'legacy'（旧版）| 'broken' | 'missing'
 */
async function loadClient(stubs = {}) {
  const notifications = [];
  const tauriEmits = [];
  const warnings = [];

  const listStore = makeStore({ byId: {}, current: undefined });
  const statusStore = makeStore(new Map());
  const legacyStore = makeStore(new Map());

  let uiSession;
  if (stubs.uiSession === 'status') uiSession = { sessionStatus: statusStore };
  else if (stubs.uiSession === 'legacy') uiSession = { pendingInteractions: legacyStore };
  else if (stubs.uiSession === 'broken') uiSession = { sessionStatus: {} };
  else uiSession = undefined;

  let bundle;
  globalThis.window = {
    __ModuleLoader__: { load: (b) => { bundle = b; } },
    __TAURI__: stubs.tauri
      ? { event: { emit: (event, payload) => tauriEmits.push({ event, payload }) } }
      : undefined,
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => stubs.config ?? { ok: true, enabled: true, browserNotify: true },
  });
  globalThis.Notification = stubs.notification
    ? class {
        static permission = 'granted';
        static requestPermission = async () => 'granted';
        constructor(title, options) { notifications.push({ title, ...options }); }
      }
    : undefined;

  const source = readFileSync(join(root, 'client.js'), 'utf8');
  const fn = new Function('window', 'fetch', 'Notification', 'console', `${source}`);
  fn(globalThis.window, globalThis.fetch, globalThis.Notification, {
    log: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: () => {},
  });

  const ctx = {
    sessions: { list: stubs.listStoreBroken ? {} : listStore },
    // 真实 cordis 里服务是动态解析到 ctx 上的，这里用 getter 模拟。
    get uiSession() { return uiSession; },
    get(name) { return name === 'uiSession' ? uiSession : undefined; },
    // 动态 inject 桩：立即以同一 ctx 满足（真实实现稍后满足，语义等价）。
    inject(_deps, callback) {
      if (uiSession !== undefined || stubs.uiSession === 'missing') callback(ctx);
    },
    effect: () => () => {},
  };

  const mod = bundle.factory(() => { throw new Error('client bundle 不应 require 任何模块'); });
  let applyError;
  try {
    mod.apply(ctx);
  } catch (error) {
    applyError = error;
  }
  await flushConfig();
  return { mod, listStore, statusStore, legacyStore, notifications, tauriEmits, warnings, applyError };
}

const sessionRow = (overrides = {}) => ({ id: 's1', displayTitle: '修 bug', running: false, ...overrides });

// ── 1. 会话完成：running true→false 触发浏览器通知 ────────────────────
{
  const { listStore, notifications } = await loadClient({ notification: true, uiSession: 'status', config: { ok: true, enabled: true, browserNotify: true } });
  check('inject 只声明 sessions（uiSession 动态注入）', true);
  listStore.set({ byId: { s1: sessionRow({ running: true }) } });
  check('上升到 running 不触发', notifications.length === 0);
  listStore.set({ byId: { s1: sessionRow({ running: false }) } });
  check('running→idle 触发 1 次', notifications.length === 1);
  check('通知使用会话标题', notifications[0]?.body.includes('修 bug'));
  listStore.set({ byId: { s1: sessionRow({ running: false }) } });
  check('状态未变不重复触发', notifications.length === 1);
}

// ── 2. subagent 过滤 / 3. includeSubagents ──────────────────────────
{
  const { listStore, notifications } = await loadClient({ notification: true, uiSession: 'status', config: { ok: true, enabled: true, browserNotify: true } });
  listStore.set({ byId: {
    p1: { id: 'p1', displayTitle: '父', running: true },
    c1: { id: 'c1', displayTitle: '子', running: true, origin: 'subagent' },
  } });
  listStore.set({ byId: {
    p1: { id: 'p1', displayTitle: '父', running: false },
    c1: { id: 'c1', displayTitle: '子', running: false, origin: 'subagent' },
  } });
  check('subagent 子会话默认跳过（父触发 1 次）', notifications.length === 1);
}
{
  const { listStore, notifications } = await loadClient({
    notification: true,
    uiSession: 'status',
    config: { ok: true, enabled: true, browserNotify: true, includeSubagents: true },
  });
  listStore.set({ byId: { c1: { id: 'c1', displayTitle: '子', running: true, origin: 'subagent' } } });
  listStore.set({ byId: { c1: { id: 'c1', displayTitle: '子', running: false, origin: 'subagent' } } });
  check('includeSubagents=true 时子会话触发', notifications.length === 1);
}

// ── 4. Tauri 桥优先 ─────────────────────────────────────────────────
{
  const { listStore, notifications, tauriEmits } = await loadClient({
    notification: true,
    tauri: true,
    uiSession: 'status',
    config: { ok: true, enabled: true, browserNotify: true, tauriEventName: 'dsh-notify' },
  });
  listStore.set({ byId: { s1: sessionRow({ running: true }) } });
  listStore.set({ byId: { s1: sessionRow({ running: false }) } });
  check('Tauri 模式发射 shell 事件', tauriEmits.length === 1);
  check('事件名与载荷正确', tauriEmits[0]?.event === 'dsh-notify' && tauriEmits[0]?.payload?.sessionId === 's1');
  check('Tauri 模式下无浏览器通知', notifications.length === 0);
}

// ── 5. 自定义模板 ───────────────────────────────────────────────────
{
  const { listStore, notifications } = await loadClient({
    notification: true,
    uiSession: 'status',
    config: { ok: true, enabled: true, browserNotify: true, titleTemplate: '完成：{title}', clientMessageTemplate: '第 {turn} 轮 · {reason}' },
  });
  listStore.set({ byId: { s1: sessionRow({ displayTitle: '自定义', running: true }) } });
  listStore.set({ byId: { s1: sessionRow({ displayTitle: '自定义', running: false }) } });
  check('自定义模板生效', notifications[0]?.title === '完成：自定义');
}

// ── 6. 人工干预（新版 sessionStatus）────────────────────────────────
{
  const { statusStore, listStore, notifications } = await loadClient({
    notification: true,
    uiSession: 'status',
    config: { ok: true, enabled: true, browserNotify: true, interventions: true },
  });
  listStore.set({ byId: { s1: sessionRow({ displayTitle: '重构任务' }) } });
  statusStore.set(new Map([
    ['s1', { running: true, pendingInteraction: { key: 'approval:1', sessionId: 's1', kind: 'approval', toolName: 'bash', reason: '删除文件' } }],
  ]));
  check('审批出现 → 触发 1 次', notifications.length === 1);
  check('审批文案含会话名/工具/原因',
    notifications[0]?.title === 'DSH 需要人工处理'
    && notifications[0]?.body.includes('重构任务')
    && notifications[0]?.body.includes('需要审批（bash）')
    && notifications[0]?.body.includes('删除文件'));
  statusStore.set(new Map([
    ['s1', { running: true, pendingInteraction: { key: 'approval:1', sessionId: 's1', kind: 'approval', toolName: 'bash', reason: '删除文件' } }],
  ]));
  check('同一 key 不重复触发', notifications.length === 1);
  statusStore.set(new Map([
    ['s1', { running: true, pendingInteraction: { key: 'approval:2', sessionId: 's1', kind: 'approval', toolName: 'fs' } }],
  ]));
  check('新 key 触发第 2 次', notifications.length === 2);
}

// ── 7. 提问 / 计划审查文案 ──────────────────────────────────────────
{
  const { statusStore, notifications } = await loadClient({
    notification: true,
    uiSession: 'status',
    config: { ok: true, enabled: true, browserNotify: true, interventions: true },
  });
  statusStore.set(new Map([
    ['s1', { running: true, pendingInteraction: { key: 'question:1', sessionId: 's1', kind: 'question', questions: [{ question: '选哪个模型？' }, { question: '确认部署？' }] } }],
  ]));
  check('提问触发并含问题数',
    notifications[0]?.body.includes('需要回答：选哪个模型？') && notifications[0]?.body.includes('共 2 个问题'));
  statusStore.set(new Map([
    ['s1', { running: true, pendingInteraction: { key: 'question:2', sessionId: 's1', kind: 'plan-review', questions: [{ question: '请审查该计划' }] } }],
  ]));
  check('plan-review 文案为需要审查计划', notifications[1]?.body.includes('需要审查计划'));
}

// ── 8. interventions=false ──────────────────────────────────────────
{
  const { statusStore, notifications } = await loadClient({
    notification: true,
    uiSession: 'status',
    config: { ok: true, enabled: true, browserNotify: true, interventions: false },
  });
  statusStore.set(new Map([['s1', { running: true, pendingInteraction: { key: 'approval:1', sessionId: 's1', kind: 'approval', toolName: 'bash' } }]]));
  check('interventions=false 不通知', notifications.length === 0);
}

// ── 9. 旧版兜底：只有 pendingInteractions ───────────────────────────
{
  const { legacyStore, notifications } = await loadClient({
    notification: true,
    uiSession: 'legacy',
    config: { ok: true, enabled: true, browserNotify: true, interventions: true },
  });
  legacyStore.set(new Map([['s1', { key: 'approval:9', sessionId: 's1', kind: 'approval', toolName: 'pwsh' }]]));
  check('旧版 pendingInteractions 路径可用',
    notifications.length === 1 && notifications[0].body.includes('需要审批：pwsh'),
    JSON.stringify(notifications));
}

// ── 10. 稳健性：接口缺失/异常时 apply 绝不抛错 ───────────────────────
{
  const missing = await loadClient({ notification: true, uiSession: 'missing' });
  check('uiSession 缺失时 apply 不抛错', missing.applyError === undefined);
  const broken = await loadClient({ notification: true, uiSession: 'broken' });
  check('快照接口缺失时 apply 不抛错', broken.applyError === undefined);
  check('快照接口缺失时给出降级警告', broken.warnings.some((line) => line.includes('已跳过人工干预通知')));
  const noList = await loadClient({ notification: true, uiSession: 'status', listStoreBroken: true });
  check('sessions.list 缺失时 apply 不抛错', noList.applyError === undefined);
  check('sessions.list 缺失时给出降级警告', noList.warnings.some((line) => line.includes('sessions.list 不可用')));
}

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
