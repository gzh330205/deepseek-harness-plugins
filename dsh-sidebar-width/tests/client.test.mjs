/**
 * dsh-sidebar-width 客户端半区的行为测试。
 *
 * 做法：用极小的假 DOM + **假的 DSH 布局 store** 把 lib/client.js 真执行起来，驱动
 * 「启动应用 → 用户拖动记录 → 收起不记录 → 只记被改的那一侧 → store 晚到」整条链路。
 *
 * 为什么必须真跑代码：这个插件踩过的坑（误用 `slots.specDynamic`、漏掉 `OVERRIDE_ID`
 * 声明、`minmax(0px, 300px)` 被空格切断、拖右栏把左栏一起写坏、改 DOM 轨道导致右侧
 * 面板盖住中间栏）**全都过得了文本校验**，只有真跑才抓得到。
 *
 * 现在的实现只通过布局 store 的 actions 改宽度，所以断言直接看「调了哪些 action」。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(resolve(root, 'lib/client.js'), 'utf8');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 假 DOM（只够插件注入设置页样式用） ─────────────────────────────── */

function makeDocument() {
  const tags = [];
  return {
    head: {
      appendChild(tag) {
        tags.push(tag);
        return tag;
      },
    },
    querySelector() {
      return null;
    },
    createElement() {
      return { dataset: {}, textContent: '' };
    },
    __tags: tags,
  };
}

/* ── 假的 DSH 布局 store ────────────────────────────────────────────── */

function makeLayout(overrides = {}) {
  const info = {
    sidebar: 280,
    viewportWidth: 1920,
    narrowExpanded: false,
    rightbar: null,
    rightbarShown: false,
    rightbarTrack: false,
    rightbarFullscreen: false,
    rightbarInstant: false,
    ...overrides,
  };
  const listeners = new Set();
  const calls = [];
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };
  const instance = {
    getSnapshot: () => ({ panelInfo: { activePanelId: null }, layoutInfo: info }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions: {
      setSidebar(px) {
        calls.push(['setSidebar', px]);
        info.sidebar = Math.max(264, Math.min(420, Math.round(px)));
        emit();
      },
      setRightbar(px) {
        calls.push(['setRightbar', px]);
        info.rightbar = Math.max(300, Math.min(Math.round(info.viewportWidth * 0.7), Math.round(px)));
        emit();
      },
    },
  };
  return { instance, info, calls, emit, store: { create: () => instance } };
}

/** 假的服务上下文：`root` 槽里挂着布局 store（与真实的 ui-layout 一致）。 */
function makeContext(saved) {
  const listeners = new Set();
  const scope = {
    getSnapshot: () => ({ status: 'ready', value: { enabled: true, ...saved.current } }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(key, value) {
      saved.current[key] = value;
      for (const listener of [...listeners]) listener();
      return Promise.resolve();
    },
  };
  const layout = { entries: [] };
  const ctx = {
    effect() {},
    locale: { register() {}, bind: () => (key) => key },
    configForms: { get: () => scope },
    slots: {
      spec: () => undefined,
      subscribe: () => () => {},
      inject: (_slot, fn) => fn(),
      register: () => () => {},
      entries: (key) => (key === 'root' ? layout.entries : []),
    },
  };
  return { ctx, scope, saved, layout };
}

/** 载入产物，返回 exports（apply / inject）。 */
function loadBundle() {
  let entry = null;
  const window = {
    innerWidth: 1920,
    __ModuleLoader__: {
      load(spec) {
        entry = spec;
      },
    },
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_sub, get) => get(),
    useEffect() {},
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  };
  const run = new Function('window', 'document', 'MutationObserver', 'require', bundle);
  run(window, makeDocument(), class {}, () => React);
  return entry.factory(() => React);
}

/** 启动插件并等它连上布局 store（发现循环是 200ms 轮询）。 */
async function boot(config = {}, layoutOverrides = {}) {
  const saved = { current: { sidebarWidth: 0, rightbarWidth: 0, ...config } };
  const env = makeContext(saved);
  const layout = makeLayout(layoutOverrides);
  env.layout.entries.push({ store: layout.store });
  const mod = loadBundle();
  mod.apply(env.ctx);
  await sleep(450);
  return { ...env, layout, mod };
}

/* ── 场景 1：启动即把全局宽度写进 store ─────────────────────────────── */

{
  const { layout, saved } = await boot({ sidebarWidth: 360, rightbarWidth: 520 });
  check('启动应用左栏', layout.calls.some(([a, v]) => a === 'setSidebar' && v === 360), JSON.stringify(layout.calls));
  check('启动应用右栏', layout.calls.some(([a, v]) => a === 'setRightbar' && v === 520), JSON.stringify(layout.calls));
  check('右侧栏未打开时也写入偏好值', layout.info.rightbar === 520, String(layout.info.rightbar));
  check(
    '我们自己的写入不被记成用户意图',
    saved.current.sidebarWidth === 360 && saved.current.rightbarWidth === 520,
    JSON.stringify(saved.current),
  );
}

/* ── 场景 2：值已在目标上就不重复调用 ───────────────────────────────── */

{
  const { layout } = await boot({ sidebarWidth: 280, rightbarWidth: 0 }, { sidebar: 280 });
  check('左栏已是目标值时不调 setSidebar', layout.calls.filter(([a]) => a === 'setSidebar').length === 0, JSON.stringify(layout.calls));
  check('右栏配置为 0 时不调 setRightbar', layout.calls.filter(([a]) => a === 'setRightbar').length === 0, JSON.stringify(layout.calls));
}

/* ── 场景 3：用户拖动 → 防抖后记录 ─────────────────────────────────── */

{
  const { layout, saved } = await boot({ sidebarWidth: 300, rightbarWidth: 0 });
  layout.info.sidebar = 380;
  layout.emit();
  check('拖动当下还没写配置（防抖）', saved.current.sidebarWidth === 300, JSON.stringify(saved.current));
  await sleep(500);
  check('防抖后把新宽度记回配置', saved.current.sidebarWidth === 380, JSON.stringify(saved.current));
  check('记录左栏不影响右栏配置', saved.current.rightbarWidth === 0, JSON.stringify(saved.current));
}

/* ── 场景 4：收起侧栏（sidebar=0）不记录 ───────────────────────────── */

{
  const { layout, saved } = await boot({ sidebarWidth: 360, rightbarWidth: 0 });
  layout.info.sidebar = 0;
  layout.emit();
  await sleep(500);
  check('收起侧栏不把 0 记进配置', saved.current.sidebarWidth === 360, JSON.stringify(saved.current));
}

/* ── 场景 5：用户只改右栏 → 只记右栏（回归：曾把左栏一起写坏） ─────── */

{
  const { layout, saved } = await boot({ sidebarWidth: 360, rightbarWidth: 400 });
  layout.info.rightbar = 640;
  layout.emit();
  await sleep(500);
  check('改右栏记录右栏', saved.current.rightbarWidth === 640, JSON.stringify(saved.current));
  check('改右栏不动左栏配置', saved.current.sidebarWidth === 360, JSON.stringify(saved.current));
}

/* ── 场景 6：只改左栏 → 只记左栏 ───────────────────────────────────── */

{
  const { layout, saved } = await boot({ sidebarWidth: 360, rightbarWidth: 400 });
  layout.info.sidebar = 320;
  layout.emit();
  await sleep(500);
  check('改左栏记录左栏', saved.current.sidebarWidth === 320, JSON.stringify(saved.current));
  check('改左栏不动右栏配置', saved.current.rightbarWidth === 400, JSON.stringify(saved.current));
}

/* ── 场景 7：store 晚到（entries 先空后满）也能连上 ─────────────────── */

{
  const saved = { current: { sidebarWidth: 360, rightbarWidth: 0 } };
  const env = makeContext(saved);
  const layout = makeLayout();
  const mod = loadBundle();
  mod.apply(env.ctx); // 此刻 entries('root') 还是空的
  await sleep(300);
  check('store 未就绪时不调用任何 action', layout.calls.length === 0, JSON.stringify(layout.calls));
  env.layout.entries.push({ store: layout.store });
  await sleep(500);
  check('store 就绪后自动应用', layout.calls.some(([a, v]) => a === 'setSidebar' && v === 360), JSON.stringify(layout.calls));
}

/* ── 场景 8：拿不到 store 时不抛错 ─────────────────────────────────── */

{
  const env = makeContext({ current: { sidebarWidth: 360 } });
  const mod = loadBundle();
  let threw = false;
  try {
    mod.apply(env.ctx);
    await sleep(300);
  } catch (error) {
    threw = true;
  }
  check('拿不到布局 store 时 apply 不抛错', !threw);
}

/* ── 场景 9：折叠态（sidebar=0）不强行展开 ─────────────────────────── */

{
  const { layout } = await boot({ sidebarWidth: 360, rightbarWidth: 0 }, { sidebar: 0 });
  check('折叠态不调用 setSidebar', layout.calls.filter(([a]) => a === 'setSidebar').length === 0, JSON.stringify(layout.calls));
}

/* ── 场景 10：窄视口不强撑左栏，但右栏仍应用 ───────────────────────── */

{
  const { layout } = await boot({ sidebarWidth: 360, rightbarWidth: 420 }, { viewportWidth: 900 });
  check('窄视口不调 setSidebar', layout.calls.filter(([a]) => a === 'setSidebar').length === 0, JSON.stringify(layout.calls));
  check('窄视口仍应用右栏', layout.calls.some(([a, v]) => a === 'setRightbar' && v === 420), JSON.stringify(layout.calls));
}

/* ── 场景 11：右栏宽度受原生上限约束时以引擎实际值为准 ─────────────── */

{
  const { layout } = await boot({ sidebarWidth: 0, rightbarWidth: 3000 }, { viewportWidth: 1000 });
  check('超过视口 70% 的右栏请求被原生截断', layout.info.rightbar === 700, String(layout.info.rightbar));
}

/* ── 场景 12：导出契约 ─────────────────────────────────────────────── */

{
  const mod = loadBundle();
  check(
    'inject 声明齐全',
    JSON.stringify(mod.inject) === JSON.stringify(['slots', 'locale', 'configForms']),
    JSON.stringify(mod.inject),
  );
  check('导出具名 apply', typeof mod.apply === 'function');
}

console.log(`\n${passed}/${passed + failures.length} 通过`);
if (failures.length) {
  console.log('失败项:', failures.join(' / '));
  process.exitCode = 1;
}
