/**
 * dsh-win-notify 客户端（client.js）逻辑单测：在 Node 中桩掉
 * window.__ModuleLoader__ / fetch / Notification / __TAURI__，
 * 加载真实 client.js 包并验证：
 *   - running true→false 触发通知；
 *   - 初始快照只做基线（不误报）；
 *   - subagent 子会话默认跳过、includeSubagents=true 时触发；
 *   - Tauri 桥优先，无桥时回退浏览器 Notification（含权限请求）；
 *   - 同一会话不会重复触发；
 *   - /config 端点下发的自定义模板生效。
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

/**
 * 在全局桩环境里执行 client.js 并拿到测试句柄。
 */
async function loadClient(stubs = {}) {
  const listeners = new Set();
  const store = {
    snapshot: { byId: {}, current: undefined },
    getSnapshot() {
      return this.snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      for (const listener of [...listeners]) listener();
    },
    set(byId) {
      this.snapshot = { ...this.snapshot, byId };
    },
  };
  const notifications = [];
  const tauriEmits = [];

  // pending-interactions 快照 store（Map<sessionId, interaction>）。
  const pendingListeners = new Set();
  const pendingStore = {
    snapshot: new Map(),
    getSnapshot() {
      return this.snapshot;
    },
    subscribe(listener) {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
  };
  const pending = {
    set(entries) {
      pendingStore.snapshot = new Map(entries);
      for (const listener of [...pendingListeners]) listener();
    },
  };

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

  // 执行真实 client.js（ModuleLoader CJS 包）。
  const source = readFileSync(join(root, 'client.js'), 'utf8');
  const fn = new Function('window', 'fetch', 'Notification', `${source}`);
  fn(globalThis.window, globalThis.fetch, globalThis.Notification);

  const ctx = {
    sessions: { list: store },
    uiSession: {
      pendingInteractions: {
        getSnapshot: () => pendingStore.snapshot,
        subscribe: (listener) => pendingStore.subscribe(listener),
      },
    },
    effect: () => () => {},
  };
  const mod = bundle.factory(() => { throw new Error('client bundle 不应 require 任何模块'); });
  mod.apply(ctx);

  await flushConfig();
  return { mod, store, notifications, tauriEmits, pending };
}

// ── 1. 无 Tauri：running true→false 触发浏览器通知 ───────────────────
{
  const { store, notifications } = await loadClient({ notification: true, config: { ok: true, enabled: true, browserNotify: true } });
  check('inject 声明 sessions', true);
  store.set({ s1: { id: 's1', displayTitle: '修 bug', running: true } });
  store.emit(); // 上升到 running → 不触发
  check('初始 running 基线不误报', notifications.length === 0);
  store.set({ s1: { id: 's1', displayTitle: '修 bug', running: false } });
  store.emit();
  check('running→idle 触发 1 次', notifications.length === 1);
  check('通知使用会话标题', notifications[0]?.body.includes('修 bug'));
  store.emit(); // 无状态变化 → 不重复
  check('状态未变不重复触发', notifications.length === 1);
}

// ── 2. subagent 过滤 ────────────────────────────────────────────────
{
  const { store, notifications } = await loadClient({ notification: true, config: { ok: true, enabled: true, browserNotify: true } });
  store.set({
    p1: { id: 'p1', displayTitle: '父', running: true },
    c1: { id: 'c1', displayTitle: '子', running: true, origin: 'subagent' },
  });
  store.emit();
  store.set({
    p1: { id: 'p1', displayTitle: '父', running: false },
    c1: { id: 'c1', displayTitle: '子', running: false, origin: 'subagent' },
  });
  store.emit();
  check('subagent 子会话默认跳过（父触发 1 次）', notifications.length === 1);
}

// ── 3. includeSubagents=true（经 /config 端点下发）───────────────────
{
  const { store, notifications } = await loadClient({
    notification: true,
    config: { ok: true, enabled: true, browserNotify: true, includeSubagents: true },
  });
  store.set({ c1: { id: 'c1', displayTitle: '子', running: true, origin: 'subagent' } });
  store.emit();
  store.set({ c1: { id: 'c1', displayTitle: '子', running: false, origin: 'subagent' } });
  store.emit();
  check('includeSubagents=true 时子会话触发', notifications.length === 1);
}

// ── 4. 有 Tauri 桥：优先壳事件，不弹浏览器通知 ────────────────────────
{
  const { store, notifications, tauriEmits } = await loadClient({
    notification: true,
    tauri: true,
    config: { ok: true, enabled: true, browserNotify: true, tauriEventName: 'dsh-notify' },
  });
  store.set({ s1: { id: 's1', displayTitle: 'Tauri 会话', running: true } });
  store.emit();
  store.set({ s1: { id: 's1', displayTitle: 'Tauri 会话', running: false } });
  store.emit();
  check('Tauri 模式发射 shell 事件', tauriEmits.length === 1);
  check('事件名与载荷正确',
    tauriEmits[0]?.event === 'dsh-notify' && tauriEmits[0]?.payload?.sessionId === 's1');
  check('Tauri 模式下无浏览器通知', notifications.length === 0);
}

// ── 5. 自定义模板（经 /config 端点下发）──────────────────────────────
{
  const { store, notifications } = await loadClient({
    notification: true,
    config: {
      ok: true, enabled: true, browserNotify: true,
      titleTemplate: '完成：{title}',
      clientMessageTemplate: '第 {turn} 轮 · {reason}',
    },
  });
  store.set({ s1: { id: 's1', displayTitle: '自定义', running: true } });
  store.emit();
  store.set({ s1: { id: 's1', displayTitle: '自定义', running: false } });
  store.emit();
  check('自定义模板生效', notifications[0]?.title === '完成：自定义');
}

// ── 6. 人工干预：审批 pending interaction ───────────────────────────
{
  const { pending, notifications } = await loadClient({
    notification: true,
    config: { ok: true, enabled: true, browserNotify: true, interventions: true },
  });
  pending.set([
    ['s1', { key: 'approval:1', sessionId: 's1', kind: 'approval', toolName: 'bash', reason: '删除文件' }],
  ]);
  check('审批出现 → 触发 1 次', notifications.length === 1);
  check('审批文案含工具与原因',
    notifications[0]?.title === 'DSH 需要人工处理'
    && notifications[0]?.body.includes('需要审批（bash）')
    && notifications[0]?.body.includes('删除文件'));
  pending.set([['s1', { key: 'approval:1', sessionId: 's1', kind: 'approval', toolName: 'bash', reason: '删除文件' }]]);
  check('同一 key 不重复触发', notifications.length === 1);
  pending.set([['s1', { key: 'approval:2', sessionId: 's1', kind: 'approval', toolName: 'fs' }]]);
  check('新 key 触发第 2 次', notifications.length === 2);
}

// ── 7. 人工干预：提问（含多问题）与 plan-review ───────────────────────
{
  const { pending, notifications } = await loadClient({
    notification: true,
    config: { ok: true, enabled: true, browserNotify: true, interventions: true },
  });
  pending.set([
    ['s1', { key: 'question:1', sessionId: 's1', kind: 'question', questions: [{ question: '选哪个模型？' }, { question: '确认部署？' }] }],
  ]);
  check('提问触发并含问题数',
    notifications[0]?.body.includes('需要回答：选哪个模型？') && notifications[0]?.body.includes('共 2 个问题'));
  pending.set([
    ['s1', { key: 'question:2', sessionId: 's1', kind: 'plan-review', questions: [{ question: '请审查该计划' }] }],
  ]);
  check('plan-review 文案为需要审查计划', notifications[1]?.body.includes('需要审查计划'));
}

// ── 8. interventions: false（经 /config 下发）时不通知 ────────────────
{
  const { pending, notifications } = await loadClient({
    notification: true,
    config: { ok: true, enabled: true, browserNotify: true, interventions: false },
  });
  pending.set([
    ['s1', { key: 'approval:1', sessionId: 's1', kind: 'approval', toolName: 'bash' }],
  ]);
  check('interventions=false 不通知', notifications.length === 0);
}

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
