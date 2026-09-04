// API-surface tests against the BUILT bundle (lib/client.js).
// Covers the __ModuleLoader__ contract, the DSH API adapter's modern path,
// its legacy/degradation fallbacks, and the slot registrations.
// Run: pnpm test   (after pnpm build)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const calls = [];
const state = { categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }], assignments: { a: 'c1' } };
let hookState = [];
let hookIndex = 0;
const makeEl = (type, props) => {
  const el = { type, props };
  el.classList = { _s: new Set(props.className ? String(props.className).split(' ') : []), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, contains(x) { return this._s.has(x); }, toString() { return [...this._s].join(' '); } };
  el.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 300 });
  return el;
};
const React = {
  createElement(type, config, ...children) {
    const kids = children.filter((c) => c !== null && c !== undefined && c !== false);
    if (typeof type === 'function') {
      const props = { ...(config ?? {}) };
      if (kids.length === 1) props.children = kids[0];
      else if (kids.length > 1) props.children = kids;
      return type(props);
    }
    const props = { ...(config ?? {}) };
    if (kids.length === 1) props.children = kids[0];
    else if (kids.length > 1) props.children = kids;
    return makeEl(type, props);
  },
  useState(initial) {
    const i = hookIndex++;
    if (!(i in hookState)) hookState[i] = typeof initial === 'function' ? initial() : initial;
    return [hookState[i], (next) => { hookState[i] = typeof next === 'function' ? next(hookState[i]) : next; }];
  },
  useRef(initial) {
    const i = hookIndex++;
    if (!(i in hookState)) hookState[i] = { current: initial };
    return hookState[i];
  },
  useSyncExternalStore(subscribe, getSnapshot) { return getSnapshot(); },
};

const assert = (condition, message) => { if (!condition) throw new Error(message); };

let captured = null;
globalThis.window = { __ModuleLoader__: { load: (m) => { captured = m; } } };
require(join(root, 'lib/client.js'));
assert(captured && captured.id === 'dsh-workspace-category-manager', 'bundle did not register via __ModuleLoader__');
const plugin = captured.factory((name) => {
  if (name === 'react' || name === 'react/jsx-runtime') return name === 'react' ? React : { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment };
  throw new Error(`unexpected require: ${name}`);
});
assert(plugin.apply && plugin.inject, 'module face must export apply+inject');
assert(!plugin.inject.includes('uiWorkspace'), 'uiWorkspace must be soft');
assert(['workspaces', 'sessions', 'settingsScope', 'slots', 'locale'].every((n) => plugin.inject.includes(n)), 'hard injects regressed');

const servicesFor = (withUiWorkspace) => {
  const sessions = {
    list: { subscribe: () => () => {}, getSnapshot: () => ({ byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: true } }, current: 's1', ids: ['s1'] }) },
    open: (id) => calls.push(['sessions.open', id]),
    create: (opts) => { calls.push(['sessions.create', opts]); return Promise.resolve('new1'); },
    fork: (opts) => { calls.push(['sessions.fork', opts]); return Promise.resolve('child1'); },
    binding: (id) => ({ session: { rename: (title) => { calls.push(['session.rename', id, title]); return Promise.resolve({ ok: true }); } } }),
  };
  const workspaces = {
    list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [{ workspaceId: 'a', title: 'Proj A', path: 'C:\\a', sessionIds: ['s1'] }], archivedSessionIds: [] }) },
    create: (input) => { calls.push(['workspaces.create', input]); return Promise.resolve({ workspaceId: 'n1' }); },
    rename: (id, title) => { calls.push(['workspaces.rename', id, title]); return Promise.resolve(); },
    delete: (id) => { calls.push(['workspaces.delete', id]); return Promise.resolve(); },
    insertBefore: (id, before) => { calls.push(['workspaces.insertBefore', id, before ?? null]); return Promise.resolve(); },
    archiveSession: (id) => { calls.push(['workspaces.archiveSession', id]); return Promise.resolve(); },
  };
  const uiWorkspace = withUiWorkspace
    ? { startSession: (id) => calls.push(['uiWorkspace.startSession', id]), pickDirectory: () => { calls.push(['uiWorkspace.pickDirectory']); return Promise.resolve('/tmp/n'); } }
    : {};
  return { workspaces, sessions, uiWorkspace };
};
const bindScope = () => ({ subscribe: () => () => {}, getSnapshot: () => ({ value: state, status: 'ready', writable: true }), set: (k, v) => { calls.push(['scope.set', k, v]); state[k] = v; return Promise.resolve(); } });
const entriesFor = (withUiWorkspace) => {
  const svc = servicesFor(withUiWorkspace);
  const props = {};
  const settingsScopeSvc = { bind: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'settingsScope' ? settingsScopeSvc : svc[name],
    settingsScope: { bind: () => bindScope() },
    slots: { inject: (key, fn) => { fn(); }, register: (opts, Component) => { props[opts.name] = opts.inject ? opts.inject() : {}; props['component:' + opts.name] = Component; props._reg = opts; return () => {}; } },
  });
  return props;
};
const collectSimple = (tree) => {
  const rows = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string' && node.props?.className) rows.push({ cls: node.props.className, el: node });
    const children = node.props?.children;
    if (Array.isArray(children)) children.forEach(walk);
    else if (children && typeof children === 'object') walk(children);
  })(tree);
  return rows;
};

// A: modern — one dialog: pick group + directory, then save (create + assign + start session)
let props = entriesFor(true);
const sidebarApi = props['sidebar.workspaces'].api;
assert(sidebarApi.canPickDirectory(), 'canPickDirectory should be true');
hookIndex = 0;
let rows = collectSimple(props['component:sidebar.workspaces']({ api: sidebarApi, wide: true, t: (k) => k, expandSidebar: () => {} }));
const addBtn = rows.find((r) => r.cls === 'wcm-iconBtn' && r.el.props.title === 'addWorkspace');
assert(addBtn, 'add button should render');
calls.length = 0;
addBtn.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
// dialog with group select + directory browse + save
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: sidebarApi, wide: true, t: (k) => k, expandSidebar: () => {} }));
const dirInput = rows.find((r) => r.cls === 'wcm-dirInput');
assert(dirInput, 'dialog should carry a directory input');
assert(dirInput.el.props.value === '', 'directory starts empty');
const browseBtn = rows.find((r) => r.cls === 'wcm-dirRow' ? r.el.props.children[1] : null) ?? rows.find((r) => r.cls === 'wcm-dialog' ? null : null);
// find the browse button: it is the sibling of the input inside wcm-dirRow
const dirRow = rows.find((r) => r.cls === 'wcm-dirRow');
assert(dirRow, 'dialog directory row missing');
assert(!calls.some(([k]) => k === 'workspaces.create'), 'no create before save');
// click browse -> pickDirectory fills the path
dirRow.el.props.children[1].props.onClick({ stopPropagation() {} });
await new Promise((r) => setTimeout(r, 0));
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: sidebarApi, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(calls.some(([k]) => k === 'uiWorkspace.pickDirectory'), 'pickDirectory not called on browse');
const filled = rows.find((r) => r.cls === 'wcm-dirInput');
assert(filled.el.props.value === '/tmp/n', 'browse should fill the directory input');
// group select defaults to the first category (c1) — save
const saveBtn = rows.find((r) => r.cls === 'wcm-primary' && r.el.props.children === 'save');
assert(saveBtn, 'save button missing');
calls.length = 0;
saveBtn.el.props.onClick({ stopPropagation() {} });
await new Promise((r) => setTimeout(r, 0));
assert(calls.some(([k, v]) => k === 'workspaces.create' && v.path === '/tmp/n'), 'create not wired on save');
assert(calls.some(([k, key, value]) => k === 'scope.set' && key === 'assignments' && value['n1'] === 'c1'), 'assignment not written');
assert(calls.some(([k, id]) => k === 'uiWorkspace.startSession' && id === 'n1'), 'startSession not wired');

// B: legacy — no uiWorkspace: add hidden, list renders, startSession falls back to sessions.create
props = entriesFor(false);
const apiB = props['sidebar.workspaces'].api;
assert(!apiB.canPickDirectory(), 'canPickDirectory should be false');
rows = collectSimple(props['component:sidebar.workspaces']({ api: apiB, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(!rows.some((r) => r.cls === 'wcm-iconBtn' && r.el.props.title === 'addWorkspace'), 'add button must hide without pick');
assert(rows.some((r) => r.cls === 'wcm-folders'), 'list must still render');
calls.length = 0;
await apiB.startSession('a');
assert(calls.some(([k]) => k === 'sessions.create'), 'fallback should create via sessions');

// C: settings section renders via api
props = entriesFor(true);
hookIndex = 0;
const secTree = props['component:settings.section']({ api: props['settings.section'].api, t: (k) => k });
assert(collectSimple(secTree).some((r) => r.cls === 'wcm'), 'settings section should render via api');

// D: adapter passthrough + registration shape
calls.length = 0;
const apiD = props['sidebar.workspaces'].api;
await Promise.all([apiD.renameWorkspace('a', 'N'), apiD.deleteWorkspace('a'), apiD.insertWorkspaceBefore('a', 'b'), apiD.archiveSession('s1')]);
assert(calls.some(([k]) => k === 'workspaces.rename') && calls.some(([k]) => k === 'workspaces.delete') && calls.some(([k]) => k === 'workspaces.insertBefore') && calls.some(([k]) => k === 'workspaces.archiveSession'), 'adapter passthrough broken');
assert(props._reg.priority === -1, 'sidebar priority must be -1');
assert(props._reg.children === undefined, 'children must not be declared');

// E: unified status language — session row keeps the chase animation; project/category rows use static dots
props = entriesFor(true);
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(rows.filter((r) => r.cls === 'wcm-rowIconSlot').length >= 2, 'icon slots missing (category + project rows)');
assert(rows.some((r) => r.cls.includes('wcm-rowIconCategory')), 'category rows must use the tag icon');
assert(rows.filter((r) => r.cls === 'wcm-rowChevron').length >= 2, 'chevrons must live inside the icon slots');
// running: the icon stays, carrying a BLUE corner badge (no dedicated slot, no icon swap)
assert(rows.filter((r) => r.cls === 'wcm-rowIconSlot').length >= 2, 'icon slots missing (category + project rows)');
assert(rows.some((r) => r.cls.includes('wcm-rowIconCategory')), 'category rows must use the tag icon');
assert(rows.filter((r) => r.cls === 'wcm-rowChevron').length >= 2, 'chevrons must live inside the icon slots');
assert(!rows.some((r) => r.cls === 'wcm-wsSlot'), 'no dedicated status slots anymore');
assert(rows.filter((r) => r.cls.includes('wcm-wsBadge') && r.cls.includes('wcm-ws-running')).length >= 2, 'running must show blue corner badges on category + project rows');
assert(rows.some((r) => r.cls === 'wcm-rowIcon'), 'icons must stay (not be replaced by the dot)');
assert(!rows.some((r) => r.cls === 'wcm-dotMatrix'), 'chase must not appear on collapsed category/project rows');
// expand the project — the running session row keeps the chase animation
const projRowEl = rows.find((r) => r.cls === 'wcm-projectRow');
projRowEl.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(rows.some((r) => r.cls === 'wcm-dotMatrix'), 'session row must keep the chase animation');
assert(rows.filter((r) => r.cls === 'wcm-dotMatrix').length === 1, 'chase must appear only on the running session row');
// done state -> corner badges on category + project, halo dot on the session row
props = entriesFor(true);
const doneProps = { ...props };
// flip the session to done via service stub mutation: replace sessions stub
const svc2 = servicesFor(true);
svc2.sessions.list.getSnapshot = () => ({ byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: false, completed: true } }, current: 's1', ids: ['s1'] });
const propsDone = (() => { const out = {}; const settingsScopeSvc = { bind: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'settingsScope' ? settingsScopeSvc : svc2[name],
    settingsScope: { bind: () => bindScope() },
    slots: { inject: (key, fn) => { fn(); }, register: (opts, Component) => { out[opts.name] = opts.inject ? opts.inject() : {}; out['component:' + opts.name] = Component; return () => {}; } },
  });
  return out; })();
hookState = [];
hookIndex = 0;
rows = collectSimple(propsDone['component:sidebar.workspaces']({ api: propsDone['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
const projRowDone = rows.find((r) => r.cls === 'wcm-projectRow');
projRowDone.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
hookIndex = 0;
rows = collectSimple(propsDone['component:sidebar.workspaces']({ api: propsDone['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(rows.filter((r) => r.cls.includes('wcm-wsBadge') && r.cls.includes('wcm-ws-done')).length >= 2, 'completed sessions must show halo corner badges on category + project rows');
assert(rows.filter((r) => r.cls === 'wcm-wsDot wcm-ws-done').length >= 1, 'session row must show the halo dot when completed-unread');
// viewed: completed=false → markers disappear everywhere
const svc3 = servicesFor(true);
svc3.sessions.list.getSnapshot = () => ({ byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: false, completed: false } }, current: 's1', ids: ['s1'] });
const propsViewed = (() => { const out = {}; const settingsScopeSvc = { bind: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'settingsScope' ? settingsScopeSvc : svc3[name],
    settingsScope: { bind: () => bindScope() },
    slots: { inject: (key, fn) => { fn(); }, register: (opts, Component) => { out[opts.name] = opts.inject ? opts.inject() : {}; out['component:' + opts.name] = Component; return () => {}; } },
  });
  return out; })();
hookState = [];
hookIndex = 0;
rows = collectSimple(propsViewed['component:sidebar.workspaces']({ api: propsViewed['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(!rows.some((r) => r.cls.includes('wcm-ws-running') || r.cls.includes('wcm-ws-done')), 'viewed sessions must not leave markers on category/project rows');

// F: race regression — uiWorkspace arrives AFTER apply: capability detection must be live
const raceSvc = servicesFor(false);
const raceOut = {};
plugin.apply({
  effect: () => () => {},
  locale: { register: () => {}, bind: () => (k) => k },
  get: (name) => name === 'settingsScope' ? { bind: () => bindScope() } : raceSvc[name],
  settingsScope: { bind: () => bindScope() },
  slots: { inject: (key, fn) => { fn(); }, register: (opts, Component) => { raceOut[opts.name] = opts.inject ? opts.inject() : {}; raceOut['component:' + opts.name] = Component; return () => {}; } },
});
const raceApi = raceOut['sidebar.workspaces'].api;
assert(!raceApi.canPickDirectory(), 'should start without pick capability');
raceSvc.uiWorkspace = { startSession: () => {}, pickDirectory: () => Promise.resolve('/x') };
assert(raceApi.canPickDirectory(), 'capability must flip once uiWorkspace appears');

console.log('tests OK: built bundle — loader contract, modern/legacy/degradation, registrations, row icon slots, unified status dots, lazy uiWorkspace');
