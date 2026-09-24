// 客户端产物契约测试：直接执行 `lib/client.js`（真实的 __ModuleLoader__ 注册形态），
// 用假的 ctx 调用 apply，验证 tab 类型与正文席位的注册、样式注入、文案解析。
// 这是在没有浏览器的情况下能对「插件是否会被 DSH 正确装载」做的最强断言。
// 运行：node ./tests/client.bundle.test.js
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'lib/client.js'), 'utf8');
const require = createRequire(import.meta.url);

/* ── 执行产物：模拟 DSH 的 module table ───────────────────────────────── */

let loaded = null;
const fakeWindow = {
  __ModuleLoader__: {
    load(entry) {
      loaded = entry;
    },
  },
};

const styleTags = [];
const fakeDocument = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: {
    appendChild: (tag) => styleTags.push(tag),
  },
};

try {
  // 产物是 `(window, document) => …` 形态？不是：它只依赖全局 window，
  // 工厂函数由 module table 用 require 调用。这里把两者都显式喂进去。
  const run = new Function('window', 'document', code);
  run(fakeWindow, fakeDocument);
} catch (error) {
  failures.push(`执行 lib/client.js 抛错：${error instanceof Error ? error.message : String(error)}`);
}

check('产物：注册到 __ModuleLoader__', loaded !== null && typeof loaded.factory === 'function');
check('产物：id 是包名', loaded?.id === 'dsh-git-panel', String(loaded?.id));

const exports_ = loaded === null ? {} : loaded.factory(require);
check('产物：导出 apply', typeof exports_.apply === 'function');
check('产物：导出 inject 服务列表', Array.isArray(exports_.inject), JSON.stringify(exports_.inject));
check(
  '产物：inject 覆盖 slots/locale/sidebarRightTabs',
  ['slots', 'locale', 'sidebarRightTabs'].every((name) => (exports_.inject ?? []).includes(name)),
  JSON.stringify(exports_.inject),
);
check('产物：不导出 default（DSH 的 unwrapExports 约定）', exports_.default === undefined);
check('产物：注入了样式标签', styleTags.length === 1 && String(styleTags[0].textContent).includes('.dgp'), String(styleTags.length));
check('产物：样式标签带 data-plugin-css 标识', styleTags[0]?.dataset?.pluginCss === 'dsh-git-panel/styles.css', JSON.stringify(styleTags[0]?.dataset));

/* ── 用假 ctx 走一遍注册 ─────────────────────────────────────────────── */

const zh = new Map();
let tabType = null;
const seats = new Map();
const effects = [];
const logged = [];

/** 假 ctx：把 layout / sidebarRight 两个服务也摆上，用来验证中间窗口这条通路。 */
const centerCalls = [];
const previewCalls = [];

const ctx = {
  effect(fn, label) {
    effects.push(label);
    const disposer = fn();
    return typeof disposer === 'function' ? disposer : () => undefined;
  },
  locale: {
    register(namespace, dictionaries) {
      for (const [key, value] of Object.entries(dictionaries.zh ?? {})) zh.set(key, value);
    },
    bind: (namespace) => (key, params) => {
      const template = zh.get(key);
      if (template === undefined) {
        logged.push(`missing key: ${key}`);
        return key;
      }
      if (params === undefined) return template;
      return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ''));
    },
  },
  sidebarRightTabs: {
    register(definition) {
      tabType = definition;
      return () => undefined;
    },
  },
  slots: {
    inject(name, callback) {
      logged.push(`inject seat: ${name}`);
      callback();
    },
    register(definition, component) {
      seats.set(definition.name, { definition, component });
      return () => undefined;
    },
  },
  get: (name) => {
    if (name === 'layout') return { selectPanel: (id) => centerCalls.push(id) };
    if (name === 'sidebarRight') return { openResource: (address) => previewCalls.push(address) };
    return undefined;
  },
};

try {
  exports_.apply(ctx);
} catch (error) {
  failures.push(`apply 抛错：${error instanceof Error ? error.message : String(error)}`);
}

check('apply：注册了 effect（词典 + 类型/正文 + 中心差异页）', effects.length >= 3, JSON.stringify(effects));
check('tab 类型：kind 是 git', tabType?.kind === 'git', String(tabType?.kind));
check('tab 类型：id 与包名一致', tabType?.id === 'dsh-git-panel', String(tabType?.id));
check('tab 类型：keepMounted（切 tab 不丢状态）', tabType?.keepMounted === true);
check('tab 类型：标题文案可解析', typeof tabType?.title === 'function' && tabType.title() === 'Git', String(tabType?.title?.()));
check('引导卡片：有一个入口', Array.isArray(tabType?.guide) && tabType.guide.length === 1);
check('引导卡片：kind 与 order', tabType?.guide?.[0]?.kind === undefined && typeof tabType?.guide?.[0]?.order === 'number', JSON.stringify(tabType?.guide?.[0]));
check('引导卡片：标题与描述可解析', tabType?.guide?.[0]?.title() === 'Git 变更' && tabType?.guide?.[0]?.description().length > 0, String(tabType?.guide?.[0]?.title?.()));
check('引导卡片：带图标组件', typeof tabType?.guide?.[0]?.icon === 'function');

const bodySeat = seats.get('sidebar.right.pane.tab');
check('正文席位：注册在 sidebar.right.pane.tab', bodySeat !== undefined, JSON.stringify([...seats.keys()]));
check('正文席位：key 与 tab 类型 id 一致', bodySeat?.definition?.key === 'dsh-git-panel', String(bodySeat?.definition?.key));
check('正文席位：声明 locale 命名空间', bodySeat?.definition?.locale === 'gitPanel', String(bodySeat?.definition?.locale));
check('正文席位：组件是函数', typeof bodySeat?.component === 'function');
check('正文席位：inject 注入 api/actions/t', typeof bodySeat?.definition?.inject === 'function' && typeof bodySeat.definition.inject().t === 'function');

/* ── 中心窗口差异页（root `main` 席位） ───────────────────────────────── */

const diffSeat = seats.get('main');
check('中心席位：注册在 root 的 main keyed 席位', diffSeat !== undefined, JSON.stringify([...seats.keys()]));
check('中心席位：key 是 git-diff', diffSeat?.definition?.key === 'git-diff', String(diffSeat?.definition?.key));
check('中心席位：组件是函数', typeof diffSeat?.component === 'function');
check('正文席位：注入 openDiffInCenter 与可用标志', (() => { const p = bodySeat?.definition?.inject?.(); return typeof p?.openDiffInCenter === 'function' && p?.diffCenterAvailable === true; })(), '');

const state = { root: 'D:/repo', repoRoot: 'D:/repo', sessionId: 'session-1', items: [{ path: 'src/a.ts', staged: false, untracked: false, kind: 'modified' }], index: 0, contextLines: 3 };
bodySeat?.definition?.inject?.().openDiffInCenter(state);
check('中心席位：openDiffInCenter 调用了 layout.selectPanel(git-diff)', centerCalls[0] === 'git-diff', JSON.stringify(centerCalls));

const centerProps = diffSeat?.definition?.inject?.();
check('中心席位：inject 注入 api/t/close/openPreview', typeof centerProps?.api === 'object' && typeof centerProps?.t === 'function' && typeof centerProps?.close === 'function' && typeof centerProps?.openPreview === 'function', '');
centerProps?.openPreview?.({ path: 'src/a.ts', staged: false, untracked: false, kind: 'modified' }, 'D:/repo/src/a.ts');
check('中心席位：在内置预览里打开的是 session 作用域地址（盘符保留字面冒号）', previewCalls[0] === 'dsh-resource://file/session/session-1/D:/repo/src/a.ts', String(previewCalls[0]));
centerProps?.close?.();
check('中心席位：关闭即 selectPanel(null) 回到对话', centerCalls[1] === null, JSON.stringify(centerCalls));

check('文案：没有缺失的 key', logged.every((line) => !line.startsWith('missing key')), JSON.stringify(logged));
check('文案：中文默认语言生效', zh.get('title') === 'Git' && zh.get('tab.changes') === '变更');

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`client.bundle.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`client.bundle.test OK (${passed} assertions)`);
