// Validate the dsh-plugin-kit scaffold:
//   1. required files + package.json contract (exports / dsh metadata / link deps);
//   2. host half shape (Config / inject / apply, no `export default`);
//   3. cordis.patch.yml — exactly one insert with the 8 expected id/name rows;
//   4. locale meta (the host-side plugin card title/description);
//   5. lib/client.js — parseable, consistent with src/client/index.js;
//   6. a runtime smoke test of the client contract: register the
//      settings.section, project the `settings.pluginKit.tab` list slot in
//      order, and render the tab bar / panels with stubbed React.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const fail = (message) => {
  throw new Error(`dsh-plugin-kit: ${message}`);
};

/* ---------- 1. files ---------- */
const required = [
  'package.json',
  'cordis.patch.yml',
  'index.js',
  'README.md',
  'locale/en.json',
  'locale/zh.json',
  'src/client/index.js',
  'lib/client.js',
  'scripts/build-client.mjs',
  'scripts/validate.mjs',
];
const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) fail(`missing required files: ${missing.join(', ')}`);

/* ---------- 2. package.json ---------- */
const manifest = JSON.parse(read('package.json'));
if (manifest.name !== 'dsh-plugin-kit') fail('package name must be dsh-plugin-kit');
if (manifest.version !== '0.1.0') fail('package version must be 0.1.0');
if (manifest.private !== true) fail('package must stay private');
if (manifest.type !== 'module') fail('package must be type=module');
if (manifest.main !== './index.js') fail('main must be ./index.js');
if (manifest.exports?.['.'] !== './index.js') fail('exports["."] must be ./index.js');
if (manifest.exports?.['./client'] !== './lib/client.js') fail('exports["./client"] must be ./lib/client.js');
if (manifest.exports?.['./package.json'] !== './package.json') fail('exports["./package.json"] is missing');
if (manifest.exports?.['./locale/*.json'] !== './locale/*.json') fail('exports["./locale/*.json"] is missing');
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch must be ./cordis.patch.yml');
if (manifest.dsh?.client?.platform !== 'web') fail('dsh.client.platform must be web');
const clientInject = manifest.dsh?.client?.inject ?? [];
for (const name of ['@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-ui-slots']) {
  if (!clientInject.includes(name)) fail(`dsh.client.inject is missing ${name}`);
}
if (clientInject.length !== 2) fail(`dsh.client.inject must declare exactly the two required services, got ${clientInject.length}`);
if (!manifest.peerDependencies?.['@deepseek-ai/cordis']?.startsWith('^4')) fail('peerDependencies["@deepseek-ai/cordis"] must be ^4.x');
if (typeof manifest.peerDependencies?.react !== 'string') fail('peerDependencies.react is missing');

const linked = [
  'dsh-git-panel',
  'dsh-run-env-manager',
  'dsh-workspace-category-manager',
  'dsh-mcp-skill-manager',
  'dsh-win-notify',
  'dsh-oneway-usage-monitor',
  'dsh-sidebar-width',
];
for (const name of linked) {
  const spec = manifest.dependencies?.[name];
  if (spec !== `link:../${name}`) fail(`dependencies["${name}"] must be link:../${name}, got ${String(spec)}`);
  if (!existsSync(resolve(root, '..', name, 'package.json'))) fail(`link dependency ../${name} has no package.json on disk`);
}
const extraDeps = Object.keys(manifest.dependencies ?? {}).filter(
  // index.js 直接 import 了 schemastery 来声明 Config，所以它必须是运行时依赖
  // （其它插件同样声明 ~3.18.4：`.volatile()` 从 3.18.4 起才有）。
  (name) => !linked.includes(name) && name !== '@deepseek-ai/schemastery',
);
if (manifest.dependencies?.['@deepseek-ai/schemastery'] !== '~3.18.4') {
  fail('dependencies["@deepseek-ai/schemastery"] must be ~3.18.4');
}
if (extraDeps.length > 0) fail(`unexpected runtime dependencies: ${extraDeps.join(', ')}`);

/* ---------- 3. host half ---------- */
const host = read('index.js');
if (/^[ \t]*export[ \t]+default\b/m.test(host)) fail('the host half must not use `export default`');
for (const needle of ["import z from '@deepseek-ai/schemastery'", 'export const Config = z.object({})', 'export const inject = []', 'export function apply()']) {
  if (!host.includes(needle)) fail(`index.js is missing: ${needle}`);
}

/* ---------- 4. bundle patch ---------- */
const patchText = read('cordis.patch.yml');
const patchRows = [...patchText.replace(/^[ \t]*#.*$/gm, '').matchAll(/^[ \t]*-[ \t]*id:[ \t]*(\S+)[ \t]*\r?\n[ \t]*name:[ \t]*(\S+)[ \t]*$/gm)]
  .map((match) => ({ id: match[1], name: match[2] }));
const expectedRows = [
  { id: 'dsh-plugin-kit', name: 'dsh-plugin-kit' },
  { id: 'git-panel', name: 'dsh-git-panel' },
  { id: 'run-env-manager', name: 'dsh-run-env-manager' },
  { id: 'workspace-category-manager', name: 'dsh-workspace-category-manager' },
  { id: 'mcp-skill-manager', name: 'dsh-mcp-skill-manager' },
  { id: 'win-notify', name: 'dsh-win-notify' },
  { id: 'oneway-usage-monitor', name: 'dsh-oneway-usage-monitor' },
  { id: 'sidebar-width', name: 'dsh-sidebar-width' },
];
if (patchRows.length !== expectedRows.length) fail(`cordis.patch.yml must declare exactly ${expectedRows.length} rows, found ${patchRows.length}`);
expectedRows.forEach((expected, index) => {
  const actual = patchRows[index];
  if (actual.id !== expected.id || actual.name !== expected.name) {
    fail(`cordis.patch.yml row ${index + 1} must be id=${expected.id}/name=${expected.name}, got id=${actual.id}/name=${actual.name}`);
  }
});
const insertCount = (patchText.match(/^[ \t]*-[ \t]*insert:[ \t]*$/gm) ?? []).length;
if (insertCount !== 1) fail(`cordis.patch.yml must contain exactly one insert, found ${insertCount}`);
for (const row of patchRows.slice(1)) {
  const subManifest = JSON.parse(readFileSync(resolve(root, '..', row.name, 'package.json'), 'utf8'));
  if (subManifest.name !== row.name) fail(`cordis.patch.yml row name ${row.name} does not match its package.json name ${subManifest.name}`);
}
/* 锚点行：客户端半区只挂到 name 恰好等于裸包名的行。 */
const anchor = patchRows[0];
if (anchor.id !== 'dsh-plugin-kit' || anchor.name !== 'dsh-plugin-kit') fail('the anchor row must be id=name=dsh-plugin-kit');

/* ---------- 5. locales ---------- */
for (const [file, expectedTitle] of [['locale/en.json', 'Plugin Kit'], ['locale/zh.json', '插件合集']]) {
  const locale = JSON.parse(read(file));
  if (locale.meta?.title !== expectedTitle) fail(`${file} meta.title must be ${expectedTitle}`);
  if (typeof locale.meta?.description !== 'string' || locale.meta.description.trim() === '') fail(`${file} meta.description is missing`);
}

/* ---------- 6. source + bundle ---------- */
const source = read('src/client/index.js');
const bundle = read('lib/client.js');
for (const [file, text] of [['src/client/index.js', source], ['lib/client.js', bundle]]) {
  if (/^[ \t]*export[ \t]+default\b/m.test(text)) fail(`${file} must not use \`export default\``);
}
for (const needle of [
  "const NS = 'settings.pluginKit'",
  "const TABS_KEY = 'settings.pluginKit.tab'",
  "ctx.slots.entries(TABS_KEY)",
  "ctx.slots.inject('settings.section'",
  "id: 'plugin-kit'",
  'order: 18',
  "role: 'tablist'",
  "renderSlot(TABS_KEY, {}, { only: row.id })",
  'hidden: !selected',
  '本部署没有可用的插件配置页。',
]) {
  if (!source.includes(needle)) fail(`src/client/index.js is missing: ${needle}`);
}
/* The suite owns the plugin-kit surface only: it must never claim
 * `settings.plugins.tab` (that stays with the built-in Plugins section). */
for (const pattern of [/slots\.(?:register|inject)\(\s*['"]settings\.plugins\.tab['"]/, /name:\s*['"]settings\.plugins\.tab['"]/]) {
  if (pattern.test(source)) fail('the suite must not register settings.plugins.tab');
}
if (bundle.includes('settings.plugins.tab')) fail('the bundle must not reference settings.plugins.tab');
if (bundle.includes('react/jsx-runtime')) fail('the bundle must not require react/jsx-runtime (no JSX transpilation)');
for (const needle of ['window.__ModuleLoader__.load(', 'id: "dsh-plugin-kit"', 'settings.pluginKit.tab', 'role: "tablist"', 'order: 18']) {
  if (!bundle.includes(needle)) fail(`lib/client.js is missing: ${needle}`);
}
/* The bundle must be parseable, and it is the same program as the source. */
new vm.Script(bundle, { filename: 'lib/client.js' });
for (const needle of ['settings.pluginKit.tab', 'settings.section', 'plugin-kit', 'hidden']) {
  if (!bundle.includes(needle)) fail(`lib/client.js drifted from src (missing ${needle})`);
}

/* ---------- 7. runtime contract smoke ---------- */
const registration = {};
const sandbox = { window: { __ModuleLoader__: { load: (value) => { registration.value = value; } } } };
vm.runInNewContext(bundle, sandbox, { filename: 'lib/client.js' });
if (registration.value?.id !== 'dsh-plugin-kit') fail(`bundle registered id ${String(registration.value?.id)}`);

const reactStub = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useId: () => ':ps:',
  useRef: (initial) => ({ current: initial }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
};
const api = registration.value.factory((specifier) => {
  if (specifier === 'react') return reactStub;
  throw new Error(`client half must only require react, got ${specifier}`);
});
if (typeof api.apply !== 'function' || !Array.isArray(api.inject)) fail('the client factory must export apply and inject');
if (api.inject.join(',') !== 'slots,locale') fail(`client inject must be slots,locale, got ${api.inject.join(',')}`);

const dictionaries = {};
const language = 'zh';
const state = { entries: [], version: 0 };
let section;
const renderSlotCalls = [];
const ctx = {
  effect: (setup) => {
    setup();
    return () => {};
  },
  locale: {
    bind: (ns) => (key) => dictionaries[ns]?.[language]?.[key] ?? key,
    register: (ns, dict) => {
      dictionaries[ns] = dict;
    },
    getSnapshot: () => ({ revision: 0 }),
    subscribe: () => () => {},
  },
  slots: {
    entries: () => state.entries,
    getVersion: () => state.version,
    subscribe: () => () => {},
    inject: (key, factory) => {
      if (key !== 'settings.section') fail(`unexpected slots.inject key ${key}`);
      factory();
      return () => {};
    },
    register: (options, component) => {
      section = { options, component };
      return () => {};
    },
  },
};
api.apply(ctx);
if (section === undefined) fail('apply() did not register a settings.section');
if (section.options.name !== 'settings.section') fail('registered slot name must be settings.section');
if (section.options.id !== 'plugin-kit') fail('registered section id must be plugin-kit');
if (section.options.order !== 18) fail('registered section order must be 18');
if (section.options.locale !== 'settings.pluginKit') fail('registered section locale must be settings.pluginKit');
if (section.options.children?.['settings.pluginKit.tab']?.kind !== 'list') fail('children must declare settings.pluginKit.tab as a list');
if (section.options.children?.['settings.pluginKit.tab']?.scope !== 'root') fail('settings.pluginKit.tab must be a root-scoped list');
if (dictionaries['settings.pluginKit']?.zh?.nav !== '插件合集') fail('locale.register must provide the zh nav label');

/* Sub-plugins contribute while booting, so the entries exist before the
 * section first renders — mirror that here. */
state.entries = [
  { options: { id: 'c', order: 30, label: () => 'C' } },
  { options: { id: 'a', order: 18, label: () => 'A' } },
  { options: { id: 'b', order: 20, label: () => 'B' } },
  { options: { id: 'b2', order: 20, label: 'B2' } },
];
state.version = 1;
const injected = section.options.inject?.() ?? {};
const tabsSource = injected.hooks?.tabs;
if (typeof tabsSource?.getSnapshot !== 'function' || typeof tabsSource?.subscribe !== 'function') fail('the section must inject a `tabs` hook source');
if (!Array.isArray(injected.tabs) || injected.tabs.length !== 4) fail('the section must inject a plain static `tabs` fallback snapshot');
const rows = tabsSource.getSnapshot();
if (rows.map((row) => row.id).join(',') !== 'a,b,b2,c') fail(`rows must be order-sorted and stable, got ${rows.map((row) => row.id).join(',')}`);
if (tabsSource.getSnapshot() !== rows) fail('getSnapshot must be referentially stable while the slot version is unchanged');
state.version = 2;
if (tabsSource.getSnapshot() === rows) fail('getSnapshot must recompute after the slot version bumps');

const t = (key) => dictionaries['settings.pluginKit'][language][key] ?? key;
const render = (entries, useStateQueue = []) => {
  state.entries = entries;
  state.version += 1;
  /* The bundle captured the react stub by reference, so swapping useState here
   * steers the component's (requestedId, visitedIds) state for this render. */
  reactStub.useState = (initial) => [useStateQueue.length > 0 ? useStateQueue.shift() : typeof initial === 'function' ? initial() : initial, () => {}];
  return section.component({
    t,
    renderSlot: (key, props, options) => {
      renderSlotCalls.push({ key, props, options });
      return { type: 'slot', key, props, children: [] };
    },
    useTabs: (select) => select(tabsSource.getSnapshot()),
  });
};
const tree = (node) => {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.children ?? []).flatMap((child) => (Array.isArray(child) ? child.flatMap(tree) : tree(child)))];
};
const find = (node, predicate) => tree(node).find(predicate);

renderSlotCalls.length = 0;
const emptyTree = render([]);
const empty = find(emptyTree, (node) => node.props?.className === 'ps-empty');
if (!empty) fail('rows.length === 0 must render the empty copy');
if (empty.children?.[0] !== '本部署没有可用的插件配置页。') fail('the empty copy must come from the locale dictionary');
if (renderSlotCalls.length !== 0) fail('the empty state must not renderSlot');

renderSlotCalls.length = 0;
const shadedTree = render([
  { options: { id: 'a', order: 18, label: 'A' } },
  { options: { id: 'b', order: 20, label: 'B' } },
  { options: { id: 'c', order: 30, label: 'C' } },
]);
const tablist = find(shadedTree, (node) => node.props?.role === 'tablist');
if (!tablist) fail('rows.length > 0 must render a role=tablist tab bar');
if (tablist.props['aria-label'] !== '插件页签') fail('the tab bar must carry a localized aria-label');
const tabs = tree(tablist).filter((node) => node.props?.role === 'tab');
if (tabs.length !== 3) fail(`expected 3 tabs, got ${tabs.length}`);
if (tabs[0].props['aria-selected'] !== true || tabs[0].props.tabIndex !== 0) fail('the first tab must be active');
if (tabs[1].props['aria-selected'] !== false || tabs[1].props.tabIndex !== -1) fail('inactive tabs must not be focusable');
if (tabs.map((tab) => tab.children[0]).join(',') !== 'A,B,C') fail('tab labels must be resolved from the entries');
/* Arrow / Home / End keep the roving tabindex inside the tab bar. */
const keydown = tabs[0].props.onKeyDown;
for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) keydown({ key, preventDefault: () => {} });
keydown({ key: 'x', preventDefault: () => {} });
const panelsWithoutVisits = find(shadedTree, (node) => node.props?.role === 'tabpanel');
if (!panelsWithoutVisits) fail('the active panel must be rendered');
if (panelsWithoutVisits.props.hidden !== false) fail('the active panel must not be hidden');
if (renderSlotCalls.length !== 1 || renderSlotCalls[0].key !== 'settings.pluginKit.tab' || renderSlotCalls[0].options.only !== 'a') {
  fail(`the active panel must renderSlot the active tab, got ${JSON.stringify(renderSlotCalls)}`);
}

/* Visited-but-inactive panels stay mounted (hidden): force requestedId=b and
 * visitedIds={a,b} through the stubbed useState queue. */
renderSlotCalls.length = 0;
const visitedTree = render(
  [
    { options: { id: 'a', order: 18, label: 'A' } },
    { options: { id: 'b', order: 20, label: 'B' } },
  ],
  ['b', new Set(['a', 'b'])],
);
const panelNodes = tree(visitedTree).filter((node) => node.props?.role === 'tabpanel');
if (panelNodes.length !== 2) fail(`expected the visited panel to stay mounted, got ${panelNodes.length}`);
const hiddenPanels = panelNodes.filter((node) => node.props.hidden === true);
if (hiddenPanels.length !== 1) fail('exactly one visited-but-inactive panel must be hidden');
const activePanel = panelNodes.find((node) => node.props.hidden === false);
if (activePanel?.props['aria-labelledby'] === undefined) fail('panels must be labelled by their tab');
if (renderSlotCalls.length !== 2) fail(`both visited panels must renderSlot their content, got ${renderSlotCalls.length}`);

/* Defensive path: a host that does not bind the hooks source still renders from
 * the static snapshot instead of crashing the whole Settings page. */
state.entries = [{ options: { id: 'a', order: 18, label: 'A' } }];
state.version += 1;
const fallbackTree = section.component({
  t,
  renderSlot: () => null,
  tabs: tabsSource.getSnapshot(),
});
if (!find(fallbackTree, (node) => node.props?.role === 'tablist')) fail('the static tabs fallback must still render the tab bar');

console.log('dsh-plugin-kit scaffold is valid (files, manifest, patch rows, locale, bundle, client contract).');
