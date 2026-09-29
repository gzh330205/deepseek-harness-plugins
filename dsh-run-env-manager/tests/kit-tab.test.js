// 合集迁移自测（跑的是打包产物 lib/client.js，先 pnpm build）：
//   合集缺席 → 继续注册本插件自己的顶层设置分区 settings.section；
//   合集声明 → 切到合集的 settings.pluginKit.tab，且原分区被 dispose；
//   合集卸载 → 切回 settings.section。
// 任一时刻同一个页面只允许出现在一个槽里（list 槽同 id 重复注册会抛错）。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];
const check = (label, condition) => {
  if (condition) passed += 1;
  else failures.push(label);
};

// 只用到 createElement/jsx 的组件值，不会真正渲染。
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children } }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
};

let captured = null;
globalThis.window = { __ModuleLoader__: { load: (mod) => { captured = mod; } } };
require(join(root, 'lib/client.js'));
check('bundle 必须通过 __ModuleLoader__ 注册', captured !== null && captured.id === 'dsh-run-env-manager');
const plugin = captured.factory((name) => {
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return { jsx: React.createElement, jsxs: React.createElement, Fragment: null };
  throw new Error(`unexpected require: ${name}`);
});

/* DSH 0.1.7 slots 服务的最小替身：subscribe 不重放当前状态，
 * inject 跟随声明生命周期，register 在未声明槽上抛错。 */
const makeSuiteSlots = (initiallyDeclared) => {
  const declared = new Set(initiallyDeclared);
  const subs = new Map();
  const ctrls = new Map();
  const live = new Map();
  const listeners = (map, key) => { let set = map.get(key); if (!set) { set = new Set(); map.set(key, set); } return set; };
  return {
    spec:  (key) => declared.has(key) ? { kind: 'list', scope: 'root' } : undefined,
    ids: (key) => [...(live.get(key)?.keys() ?? [])],
    subscribe: (key, fn) => { const set = listeners(subs, key); set.add(fn); return () => set.delete(fn); },
    register: (opts, Component) => {
      if (!declared.has(opts.name)) throw new Error(`slot "${opts.name}" is not declared`);
      let entries = live.get(opts.name); if (!entries) { entries = new Map(); live.set(opts.name, entries); }
      if (entries.has(opts.id)) throw new Error(`slot "${opts.name}" already has an entry with id "${opts.id}"`);
      const entry = { opts, Component };
      entries.set(opts.id, entry);
      return () => { if (entries.get(opts.id) === entry) entries.delete(opts.id); };
    },
    inject: (key, fn) => {
      let active;
      const stop = () => { if (active) { active(); active = undefined; } };
      const reconcile = () => { if (declared.has(key)) { if (!active) active = fn() ?? (() => {}); } else stop(); };
      const set = listeners(ctrls, key); set.add(reconcile);
      reconcile();
      return () => { set.delete(reconcile); stop(); };
    },
    setDeclared: (key, present) => {
      if (present) declared.add(key); else declared.delete(key);
      for (const fn of [...(ctrls.get(key) ?? [])]) fn();
      for (const fn of [...(subs.get(key) ?? [])]) fn();
    },
  };
};

const slots = makeSuiteSlots(['settings.section', 'sidebar.right.pane.tab']);
plugin.apply({
  effect: (fn) => { const disposer = fn(); return () => { if (typeof disposer === 'function') disposer(); }; },
  locale: { register: () => {}, bind: () => (key) => key },
  get: () => undefined,
  sidebarRightTabs: { register: () => () => {} },
  slots,
});

check('合集缺席时 fallback（顶层 settings.section）必须注册', slots.ids('settings.section').includes('run-environments'));
check('合集缺席时不得注册到合集槽', !slots.ids('settings.pluginKit.tab').includes('run-environments'));
slots.setDeclared('settings.pluginKit.tab', true);
check('合集声明后页面必须搬进合集槽', slots.ids('settings.pluginKit.tab').includes('run-environments'));
check('合集声明后原顶层分区必须被 dispose', !slots.ids('settings.section').includes('run-environments'));
check('侧栏面板不受影响', slots.ids('sidebar.right.pane.tab').length === 1);
slots.setDeclared('settings.pluginKit.tab', false);
check('合集卸载后顶层分区必须回来', slots.ids('settings.section').includes('run-environments'));
check('合集卸载后合集槽里不得留注册', !slots.ids('settings.pluginKit.tab').includes('run-environments'));

if (failures.length > 0) {
  console.error(`kit-tab FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`kit-tab OK: ${passed} assertions passed（合集缺席/声明/卸载三个方向）`);
