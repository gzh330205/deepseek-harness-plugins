// 「合集 tab 双态注册器」契约测试：直接用真实的 SlotCore 驱动 src/shared/kit-tab.ts
// 编译出的逻辑，覆盖三种加载顺序 + 合集塌陷 / 重新声明。
//
// 为什么必须有这个文件：这个 helper 的守卫写法踩过两次坑——
//   1) 只 subscribe 不立刻 apply → 「合集先加载」时页签永不出现；
//   2) 用 Boolean(dispose) 当状态 → 合集缺席时 fallback 永不注册、fallback 生效后
//      合集再声明也切不回去。
// 跑：node ./tests/kit-tab.test.js
import { readFileSync } from 'node:fs';
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

/* ── 真实的 slots 纯核心 ─────────────────────────────────────────────── */

const DSH = 'G:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/';
let SlotCore;
try {
  ({ SlotCore } = await import(`file://${DSH}dsh-client-ui-slots/lib/index.js`));
} catch (error) {
  // 换机器 / 换 DSH 版本时不当成失败：契约测试需要宿主自带的 slots 纯核心。
  console.log(`kit-tab.test SKIPPED（找不到 DSH 的 dsh-client-ui-slots：${error?.message ?? error}）`);
  process.exit(0);
}

const SUITE = 'settings.pluginKit.tab';
const PLAIN = 'settings.plugins.tab';

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** 与 DSH 浏览器里同名的两个声明：内置插件分区、以及合集分区。 */
function declareShell(core) {
  core.register({ name: 'root', children: { 'settings.section': { kind: 'list', scope: 'root' } } }, () => {});
  core.register(
    { name: 'settings.section', id: 'plugins', order: 15, children: { [PLAIN]: { kind: 'list', scope: 'root' } } },
    () => {},
  );
}

function declareSuite(core) {
  return core.register(
    {
      name: 'settings.section',
      id: 'plugin-kit',
      order: 18,
      children: { [SUITE]: { kind: 'list', scope: 'root' } },
    },
    () => {},
  );
}

/** 把 SlotCore 包成浏览器里那个 ctx 的最小面。 */
function ctxOf(core) {
  const effects = [];
  return {
    effects,
    ctx: {
      slots: {
        subscribe: (key, fn) => core.subscribe(key, fn),
        spec:  (key) => core.spec(key),
        register: (options, component) => core.register(options, component),
        inject: (_name, fn) => fn(),
      },
      effect: (fn, label) => {
        effects.push(label);
        const disposer = fn();
        return typeof disposer === 'function' ? disposer : () => undefined;
      },
    },
  };
}

const ids = (core, key) => core.entries(key).map((entry) => entry.options.id);

/* ── 载入被测量：把 TS 源码交给 esbuild 转译，测的就是仓库里那一份实现 ── */

const source = readFileSync(join(root, 'src/shared/kit-tab.ts'), 'utf8');
const start = source.indexOf('export function registerKitTab');
if (start < 0) failures.push('找不到 export function registerKitTab（契约漂移？）');
const body = source.slice(start).replace('export function registerKitTab', 'function registerKitTab');
const { transform } = await import('esbuild');
const { code } = await transform(body, { loader: 'ts', format: 'esm', target: 'es2022' });
const registerKitTab = new Function(`${code}; return registerKitTab;`)();

function opts(core, { fallback = true } = {}) {
  return {
    tab: () => core.register({ name: SUITE, id: 'git-panel', order: 60 }, () => {}),
    fallback: fallback
      ? () => core.register({ name: PLAIN, id: 'git-panel', order: 60 }, () => {})
      : undefined,
  };
}

/* ── S1：合集真缺席 → fallback 必须注册 ──────────────────────────────── */

{
  const core = new SlotCore();
  declareShell(core);
  const { ctx } = ctxOf(core);
  registerKitTab(ctx, opts(core));
  await tick();
  check('S1 合集缺席：fallback 注册到内置插件页签', ids(core, PLAIN).includes('git-panel'), JSON.stringify(ids(core, PLAIN)));
  check('S1 合集缺席：合集槽为空', ids(core, SUITE).length === 0, JSON.stringify(ids(core, SUITE)));
}

/* ── S2：合集与子插件同一时刻（先声明后 apply）→ 落在合集槽 ─────────── */

{
  const core = new SlotCore();
  declareShell(core);
  declareSuite(core);
  const { ctx } = ctxOf(core);
  registerKitTab(ctx, opts(core));
  await tick();
  check('S2 合集先声明：注册到合集槽', ids(core, SUITE).includes('git-panel'), JSON.stringify(ids(core, SUITE)));
  check('S2 合集先声明：fallback 未注册', !ids(core, PLAIN).includes('git-panel'), JSON.stringify(ids(core, PLAIN)));
}

/* ── S3：apply 之后合集才声明 → 从 fallback 切到合集槽 ───────────────── */

{
  const core = new SlotCore();
  declareShell(core);
  const { ctx } = ctxOf(core);
  registerKitTab(ctx, opts(core));
  await tick();
  check('S3 初始：fallback 已注册', ids(core, PLAIN).includes('git-panel'));
  declareSuite(core);
  await tick();
  check('S3 合集后声明：切到合集槽', ids(core, SUITE).includes('git-panel'), JSON.stringify(ids(core, SUITE)));
  check('S3 合集后声明：fallback 已 dispose', !ids(core, PLAIN).includes('git-panel'), JSON.stringify(ids(core, PLAIN)));
}

/* ── S4：合集塌陷 → 切回 fallback ────────────────────────────────────── */

{
  const core = new SlotCore();
  declareShell(core);
  const collapse = declareSuite(core);
  const { ctx } = ctxOf(core);
  registerKitTab(ctx, opts(core));
  await tick();
  check('S4 初始：在合集槽', ids(core, SUITE).includes('git-panel'));
  collapse();
  await tick();
  check('S4 合集塌陷：退回 fallback', ids(core, PLAIN).includes('git-panel'), JSON.stringify(ids(core, PLAIN)));
  check('S4 合集塌陷：合集槽已清空', !ids(core, SUITE).includes('git-panel'));
}

/* ── S5：没有 fallback（本插件无旧设置入口）→ 合集缺席时静默 ─────────── */

{
  const core = new SlotCore();
  declareShell(core);
  const { ctx } = ctxOf(core);
  registerKitTab(ctx, opts(core, { fallback: false }));
  await tick();
  check('S5 无 fallback + 合集缺席：不注册任何东西', ids(core, PLAIN).length === 0 && ids(core, SUITE).length === 0);
  declareSuite(core);
  await tick();
  check('S5 无 fallback + 合集出现：注册到合集槽', ids(core, SUITE).includes('git-panel'), JSON.stringify(ids(core, SUITE)));
}

/* ── S6：同一 id 不允许重复注册（list 槽会抛错，第二次挂载要显式失败） ── */

{
  const core = new SlotCore();
  declareShell(core);
  const { ctx } = ctxOf(core);
  registerKitTab(ctx, opts(core));
  await tick();
  check('S6 首次挂载：fallback 只有一个 git-panel', ids(core, PLAIN).filter((id) => id === 'git-panel').length === 1, JSON.stringify(ids(core, PLAIN)));
  let threw = false;
  try {
    registerKitTab(ctx, opts(core));
    await tick();
  } catch {
    threw = true;
  }
  check('S6 二次挂载：重复 id 走 fail-loud（抛错）而不是静默覆盖', threw);
  check('S6 二次挂载后：仍然只有一个 git-panel', ids(core, PLAIN).filter((id) => id === 'git-panel').length === 1, JSON.stringify(ids(core, PLAIN)));
}

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`kit-tab.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`kit-tab.test OK (${passed} assertions)`);
