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
  /* The sidebar retires its optimistic expansion overrides in an effect. */
  useEffect() {},
};

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/* Minimal stand-in for the DSH 0.1.7 slots service: registerKitTab needs
 * `subscribe` (no replay of the current state) and `specDynamic`. This one
 * models a deployment WITHOUT the suite package, i.e. the plugin must keep
 * registering its own top-level settings.section section. */
const slotsFake = (sink) => ({
  inject: (key, fn) => { fn(); },
  register: (opts, Component) => { sink[opts.name] = opts.inject ? opts.inject() : {}; sink['component:' + opts.name] = Component; sink._reg = opts; return () => {}; },
  subscribe: () => () => {},
  spec:  () => undefined,
});

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
assert(['workspaces', 'sessions', 'configForms', 'slots', 'locale'].every((n) => plugin.inject.includes(n)), 'hard injects regressed');

/* Service stubs for the two client generations this adapter supports.
 *   modern (withUiWorkspace === true): 0.1.6+ — uiWorkspace owns selection
 *     (openSession) and the New Session flow, `sessions` has no open(),
 *     uiSession.sessionStatus carries {running, pendingInteraction,
 *     completionUnread}.
 *   legacy (false): <=0.1.2 — no uiWorkspace, sessions.open() switches the
 *     view, uiSession.pendingInteractions carries {kind}, list rows carry
 *     current/completed. */
const store = (snapshot) => ({ getSnapshot: () => snapshot, subscribe: () => () => {} });
const servicesFor = (withUiWorkspace) => {
  const modern = withUiWorkspace === true;
  const statuses = new Map();
  const pending = new Map();
  let list = { byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: true } }, current: 's1', ids: ['s1'] };
  const rename = (id, title) => { calls.push(['session.rename', id, title]); return Promise.resolve({ ok: true }); };
  const sessions = {
    list: { subscribe: () => () => {}, getSnapshot: () => list },
    create: (opts) => { calls.push(['sessions.create', opts]); return Promise.resolve('new1'); },
    fork: (opts) => { calls.push(['sessions.fork', opts]); return Promise.resolve('child1'); },
  };
  if (modern) sessions.using = (id, options, operation) => { calls.push(['sessions.using', id, options]); return Promise.resolve(operation({ binding: { session: { rename: (title) => rename(id, title) } } })); };
  else { sessions.open = (id) => calls.push(['sessions.open', id]); sessions.binding = (id) => ({ session: { rename: (title) => rename(id, title) } }); }
  const workspaces = {
    list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [{ workspaceId: 'a', title: 'Proj A', path: 'C:\\a', sessionIds: ['s1'] }], archivedSessionIds: [] }) },
    create: (input) => { calls.push(['workspaces.create', input]); return Promise.resolve({ workspaceId: 'n1' }); },
    rename: (id, title) => { calls.push(['workspaces.rename', id, title]); return Promise.resolve(); },
    delete: (id) => { calls.push(['workspaces.delete', id]); return Promise.resolve(); },
    insertBefore: (id, before) => { calls.push(['workspaces.insertBefore', id, before ?? null]); return Promise.resolve(); },
    archiveSession: (id) => { calls.push(['workspaces.archiveSession', id]); return Promise.resolve(); },
  };
  const uiWorkspace = modern
    ? { openSession: (id) => calls.push(['uiWorkspace.openSession', id]), startSession: (id) => calls.push(['uiWorkspace.startSession', id]), forkSession: (id) => { calls.push(['uiWorkspace.forkSession', id]); return Promise.resolve(); }, archiveSession: (id) => { calls.push(['uiWorkspace.archiveSession', id]); return Promise.resolve(); }, pickDirectory: () => { calls.push(['uiWorkspace.pickDirectory']); return Promise.resolve('/tmp/n'); } }
    : {};
  const uiSession = modern ? { sessionStatus: store(statuses) } : { pendingInteractions: store(pending) };
  return { workspaces, sessions, uiWorkspace, uiSession, statuses, pending, setList: (next) => { list = next; } };
};
const bindScope = (target = state) => ({ subscribe: () => () => {}, getSnapshot: () => ({ value: target, status: 'ready', writable: true }), set: (k, v) => { calls.push(['scope.set', k, v]); target[k] = v; return Promise.resolve(); } });
/* Sidebar expansion is persisted in the Config, so a test that wants the
 * "fresh install" defaults must read a fresh Config instead of inheriting the
 * fields an earlier interaction wrote (in the app that restart-equivalent state
 * comes from disk, not from memory). */
const freshScope = (overrides = {}) => { const fresh = { categories: [], assignments: {}, collapsedCategories: [], expandedWorkspaces: [], ...overrides }; return { target: fresh, bind: () => bindScope(fresh) }; };
const entriesFor = (withUiWorkspace, bind = bindScope) => {
  const svc = servicesFor(withUiWorkspace);
  const props = {};
  const configFormsSvc = { get: () => bind() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'configForms' ? configFormsSvc : svc[name],
    configForms: { get: () => bind() },
    slots: slotsFake(props),
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
const dirInput = rows.find((r) => r.cls.split(' ').includes('wcm-dirInput'));
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
const filled = rows.find((r) => r.cls.split(' ').includes('wcm-dirInput'));
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
assert(calls.some(([k]) => k === 'workspaces.rename') && calls.some(([k]) => k === 'workspaces.delete') && calls.some(([k]) => k === 'workspaces.insertBefore'), 'adapter passthrough broken');
// archive is a view-owner action in 0.1.6+ (it must clear the panel of the archived current session)
assert(calls.some(([k, id]) => k === 'uiWorkspace.archiveSession' && id === 's1'), 'modern archive must go through uiWorkspace');
const legacyD = entriesFor(false)['sidebar.workspaces'].api;
calls.length = 0;
await legacyD.archiveSession('s1');
assert(calls.some(([k, id]) => k === 'workspaces.archiveSession' && id === 's1'), 'legacy archive must stay on the workspaces controller');
assert(props._reg.priority === -1, 'sidebar priority must be -1');
assert(props._reg.children === undefined, 'children must not be declared');

// E: unified status language — session row keeps the chase animation; project/category rows use static dots
const eScope = freshScope({ categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }], assignments: { a: 'c1' } });
props = entriesFor(true, eScope.bind);
/* Expansion is now persisted, so a re-render keeps whatever the previous
 * interaction left behind. Tests that need rows on screen say so explicitly
 * instead of depending on the old "every render starts collapsed" behaviour. */
const renderTree = (rendered) => { hookIndex = 0; return rendered['component:sidebar.workspaces']({ api: rendered['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }); };
const renderRows = (rendered) => collectSimple(renderTree(rendered));
/* A flat row list cannot tell a session row's animated dot from a folder row's,
 * so status-dot invariants are checked against the real tree. */
const countChasesOutsideSessions = (node, inSession) => {
  if (Array.isArray(node)) return node.reduce((total, child) => total + countChasesOutsideSessions(child, inSession), 0);
  if (!node || typeof node !== 'object') return 0;
  const className = typeof node.props?.className === 'string' ? node.props.className : '';
  const inside = inSession || className.split(' ').includes('wcm-session');
  let total = className === 'wcm-dotMatrix' && !inside ? 1 : 0;
  const children = node.props?.children;
  if (Array.isArray(children)) total += children.reduce((sum, child) => sum + countChasesOutsideSessions(child, inside), 0);
  else if (children && typeof children === 'object') total += countChasesOutsideSessions(children, inside);
  return total;
};
const expandProjects = (rendered) => {
  const initial = renderRows(rendered);
  for (const row of initial) if (row.cls.includes('wcm-projectRow') && !row.cls.includes('wcm-open')) row.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
  return renderRows(rendered);
};
rows = renderRows(props);
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
/* The session container is always mounted now (the CSS transition needs it), so
 * a collapsed project hides the chase instead of unmounting it. */
assert(rows.filter((r) => r.cls === 'wcm-sessions wcm-closed').length >= 1, 'a collapsed project must render its session container closed');
rows = expandProjects(props);
assert(rows.some((r) => r.cls === 'wcm-dotMatrix'), 'session row must keep the chase animation');
assert(rows.some((r) => r.cls.startsWith('wcm-sessions') && !r.cls.includes('wcm-closed')), 'the expanded project must expose its session container');
assert(rows.filter((r) => r.cls === 'wcm-dotMatrix').length >= 1, 'session row must keep the chase animation');
/* The Today group lists that same running Session, so the chase appears once per
 * Session ROW; what must never animate is a folder or project row. */
assert(countChasesOutsideSessions(renderTree(props), false) === 0, 'chase must appear only on the running session rows');
// done state -> corner badges on category + project, halo dot on the session row
props = entriesFor(true);
const doneProps = { ...props };
// flip the session to done via service stub mutation: replace sessions stub
const svc2 = servicesFor(true);
svc2.sessions.list.getSnapshot = () => ({ byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: false, completed: true } }, current: 's1', ids: ['s1'] });
const propsDone = (() => { const out = {}; const configFormsSvc = { get: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'configForms' ? configFormsSvc : svc2[name],
    configForms: { get: () => bindScope() },
    slots: slotsFake(out),
  });
  return out; })();
hookState = [];
hookIndex = 0;
rows = collectSimple(propsDone['component:sidebar.workspaces']({ api: propsDone['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
const projRowDone = rows.find((r) => r.cls.split(' ').includes('wcm-projectRow'));
projRowDone.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
hookIndex = 0;
rows = collectSimple(propsDone['component:sidebar.workspaces']({ api: propsDone['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(rows.filter((r) => r.cls.includes('wcm-wsBadge') && r.cls.includes('wcm-ws-done')).length >= 2, 'completed sessions must show halo corner badges on category + project rows');
assert(rows.filter((r) => r.cls === 'wcm-wsDot wcm-ws-done').length >= 1, 'session row must show the halo dot when completed-unread');
// viewed: completed=false → markers disappear everywhere
const svc3 = servicesFor(true);
svc3.sessions.list.getSnapshot = () => ({ byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: false, completed: false } }, current: 's1', ids: ['s1'] });
const propsViewed = (() => { const out = {}; const configFormsSvc = { get: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'configForms' ? configFormsSvc : svc3[name],
    configForms: { get: () => bindScope() },
    slots: slotsFake(out),
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
  get: (name) => name === 'configForms' ? { get: () => bindScope() } : raceSvc[name],
  configForms: { get: () => bindScope() },
  slots: slotsFake(raceOut),
});
const raceApi = raceOut['sidebar.workspaces'].api;
assert(!raceApi.canPickDirectory(), 'should start without pick capability');
raceSvc.uiWorkspace = { startSession: () => {}, pickDirectory: () => Promise.resolve('/x') };
assert(raceApi.canPickDirectory(), 'capability must flip once uiWorkspace appears');

// G: management actions moved to context menus — no visible buttons remain
props = entriesFor(true);
hookState = [];
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(!rows.some((r) => r.cls.includes('MenuBtn') || r.cls.includes('wcm-folderDissolve')), 'management buttons must be removed');
const menuTexts = (rs) => rs.filter((r) => r.cls === 'wcm-menuText').map((r) => r.el.props.children);
// project row right-click → rename + delete
rows.find((r) => r.cls.split(' ').includes('wcm-projectRow')).el.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 40, clientY: 50 });
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
let texts = menuTexts(rows);
assert(texts.includes('rename') && texts.includes('deleteWorkspace'), 'project context menu should offer rename + delete');
// folder row right-click → dissolve
rows.find((r) => r.cls.startsWith('wcm-folderRow') && r.el.props.title === '客户项目').el.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 40, clientY: 50 });
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
texts = menuTexts(rows);
assert(texts.length === 1 && texts[0] === 'dissolveCategory', 'folder context menu should offer dissolve');
// session row right-click → rename + fork + archive
/* Expansion now survives a re-render (that is the feature), so collapse every
 * open project row first and let the helper re-expand them deliberately. */
for (const row of renderRows(props)) if (row.cls.includes('wcm-projectRow') && row.cls.includes('wcm-open')) row.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = expandProjects(props);
rows.find((r) => r.cls.split(' ').includes('wcm-session')).el.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 40, clientY: 50 });
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
texts = menuTexts(rows);
assert(texts.includes('rename') && texts.includes('fork') && texts.includes('archive'), 'session context menu should offer rename + fork + archive');

// G2: the fork row must reach the fork capability. 0.1.7's UiWorkspace owns
// forking (uiWorkspace.forkSession → sessions.fork({sessionId, increaseTitle})
// and it is a Promise<void> that resolves after the child is catalogued), so the
// adapter must ask the view owner rather than reach past it.
props = entriesFor(true);
hookState = [];
for (const row of renderRows(props)) if (row.cls.includes('wcm-projectRow') && row.cls.includes('wcm-open')) row.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = expandProjects(props);
rows.find((r) => r.cls.split(' ').includes('wcm-session')).el.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 40, clientY: 50 });
hookIndex = 0;
rows = collectSimple(props['component:sidebar.workspaces']({ api: props['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
calls.length = 0;
/* The clickable row is the button; the text span is its child. */
const menuRowWith = (label) => rows.find((r) => r.cls === 'wcm-menuItem' && r.el.props.children?.props?.children === label);
const forkItem = menuRowWith('fork');
assert(forkItem, 'the session context menu must offer fork');
forkItem.el.props.onClick({ stopPropagation() {} });
await tick();
assert(calls.some(([k, id]) => k === 'uiWorkspace.forkSession' && id === 's1'), `fork must go through uiWorkspace in 0.1.7, got ${JSON.stringify(calls)}`);
// legacy (<0.1.6): no view owner — the child id comes back and is opened
const legacyFork = entriesFor(false);
hookState = [];
for (const row of renderRows(legacyFork)) if (row.cls.includes('wcm-projectRow') && row.cls.includes('wcm-open')) row.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = expandProjects(legacyFork);
rows.find((r) => r.cls.split(' ').includes('wcm-session')).el.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 40, clientY: 50 });
hookIndex = 0;
rows = collectSimple(legacyFork['component:sidebar.workspaces']({ api: legacyFork['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
calls.length = 0;
rows.find((r) => r.cls === 'wcm-menuItem' && r.el.props.children?.props?.children === 'fork').el.props.onClick({ stopPropagation() {} });
await tick();
assert(calls.some(([k, opts]) => k === 'sessions.fork' && opts.sessionId === 's1' && opts.increaseTitle === true), `legacy fork must fall back to sessions.fork, got ${JSON.stringify(calls)}`);
assert(calls.some(([k, id]) => k === 'sessions.open' && id === 'child1'), 'legacy fork must open the returned child through the legacy selection call');

// H: waiting-for-human sessions must show AMBER, overriding running.
// 0.1.6+ shape: uiSession.sessionStatus → { running, pendingInteraction, completionUnread }
const svcH = servicesFor(true);
svcH.statuses.set('s1', { running: true, pendingInteraction: { kind: 'approval' }, completionUnread: false });
const propsH = (() => { const out = {}; const configFormsSvc = { get: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'configForms' ? configFormsSvc : svcH[name],
    configForms: { get: () => bindScope() },
    slots: slotsFake(out),
  });
  return out; })();
hookState = [];
hookIndex = 0;
rows = collectSimple(propsH['component:sidebar.workspaces']({ api: propsH['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(rows.filter((r) => r.cls.includes('wcm-wsBadge') && r.cls.includes('wcm-ws-warning')).length >= 2, 'waiting-for-human must show amber badges on category + project rows');
assert(!rows.some((r) => r.cls.includes('wcm-ws-running')), 'warning must override the running (blue) state');
rows = expandProjects(propsH);
assert(rows.filter((r) => r.cls === 'wcm-wsDot wcm-ws-warning').length >= 1, 'waiting session row must show the amber halo dot');

// H2: legacy shape (<=0.1.2 pendingInteractions {kind}) must still surface AMBER
const svcH2 = servicesFor(false);
svcH2.pending.set('s1', { kind: 'question' });
const propsH2 = (() => { const out = {}; const configFormsSvc = { get: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'configForms' ? configFormsSvc : svcH2[name],
    configForms: { get: () => bindScope() },
    slots: slotsFake(out),
  });
  return out; })();
hookState = [];
hookIndex = 0;
rows = collectSimple(propsH2['component:sidebar.workspaces']({ api: propsH2['sidebar.workspaces'].api, wide: true, t: (k) => k, expandSidebar: () => {} }));
assert(rows.filter((r) => r.cls.includes('wcm-wsBadge') && r.cls.includes('wcm-ws-warning')).length >= 2, 'legacy pendingInteractions must still show amber badges');

// I: regression (0.1.6) — selecting a Session navigates through the view owner.
// sessions.open() only set controller-local selection and stopped switching the
// visible Conversation, so uiWorkspace.openSession must be the modern call.
props = entriesFor(true);
hookState = [];
for (const row of renderRows(props)) if (row.cls.includes('wcm-projectRow') && row.cls.includes('wcm-open')) row.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = expandProjects(props);
const sessionRow = rows.find((r) => r.cls.split(' ').includes('wcm-session'));
assert(sessionRow, 'session row must render once the project is expanded');
calls.length = 0;
sessionRow.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(calls.some(([k, id]) => k === 'uiWorkspace.openSession' && id === 's1'), 'session click must call uiWorkspace.openSession');
assert(!calls.some(([k]) => k === 'sessions.open'), 'modern path must not fall back to the removed sessions.open');
// legacy ends: sessions.open is still the navigation call
const legacyApi = entriesFor(false)['sidebar.workspaces'].api;
calls.length = 0;
legacyApi.openSession('s1');
assert(calls.some(([k, id]) => k === 'sessions.open' && id === 's1'), 'legacy path must keep sessions.open');

// J: current-session highlight — 0.1.6 drops list `current` and exposes the
// main-view retention count on the row instead.
const svcJ = servicesFor(true);
svcJ.setList({ byId: { s1: { id: 's1', displayTitle: 'Conv 1', blank: false, running: false, retainedBy: { mainView: 1 } } }, ids: ['s1'] });
const propsJ = (() => { const out = {}; const configFormsSvc = { get: () => bindScope() };
  plugin.apply({
    effect: () => () => {},
    locale: { register: () => {}, bind: () => (k) => k },
    get: (name) => name === 'configForms' ? configFormsSvc : svcJ[name],
    configForms: { get: () => bindScope() },
    slots: slotsFake(out),
  });
  return out; })();
hookState = [];
for (const row of renderRows(propsJ)) if (row.cls.includes('wcm-projectRow') && row.cls.includes('wcm-open')) row.el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = expandProjects(propsJ);
assert(rows.some((r) => r.cls.split(' ').includes('wcm-current')), 'a mainView-retained session must render as current');

// K: session rename — 0.1.6 only hands out a live binding while retained, so
// the adapter must acquire a reference around the operation.
calls.length = 0;
await entriesFor(true)['sidebar.workspaces'].api.renameSession('s1', 'Renamed');
assert(calls.some(([k, id]) => k === 'sessions.using' && id === 's1'), 'modern rename must acquire a session reference');
assert(calls.some(([k, id, title]) => k === 'session.rename' && id === 's1' && title === 'Renamed'), 'modern rename must reach the session face');
calls.length = 0;
await entriesFor(false)['sidebar.workspaces'].api.renameSession('s1', 'Renamed');
assert(calls.some(([k, id, title]) => k === 'session.rename' && title === 'Renamed'), 'legacy rename must use the resolved binding');
assert(!calls.some(([k]) => k === 'sessions.using'), 'legacy services must not be asked for sessions.using');

// L: Git import — the capability probe gates the tab; submitting clones through
// the Host route and only then registers the resulting directory.
const fetchCalls = [];
const jsonResponse = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
globalThis.fetch = async (url, init = {}) => {
  fetchCalls.push([String(url), init]);
  if (String(url).endsWith('/status')) return jsonResponse(200, { ok: true, available: true, token: 'tok-1', expiresInMs: 600000 });
  if (String(url).endsWith('/clone')) return jsonResponse(200, { ok: true, path: 'D:/clones/repo' });
  return jsonResponse(404, { ok: false, error: 'nope' });
};
const tPath = (key, params) => (params !== undefined && typeof params.path === 'string' ? `${key}:${params.path}` : key);
const renderSidebar = (rendered, t) => { hookIndex = 0; return collectSimple(rendered['component:sidebar.workspaces']({ api: rendered['sidebar.workspaces'].api, wide: true, t, expandSidebar: () => {} })); };
props = entriesFor(true);
hookState = [];
rows = renderSidebar(props, tPath);
rows.find((r) => r.cls === 'wcm-iconBtn' && r.el.props.title === 'addWorkspace').el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = renderSidebar(props, tPath);
assert(!rows.some((r) => r.cls.includes('wcm-modeTab')), 'tabs must wait for the capability probe');
await tick();
rows = renderSidebar(props, tPath);
const gitTab = rows.find((r) => r.cls.split(' ').includes('wcm-modeTab') && r.el.props.children === 'addFromGit');
assert(gitTab, 'Git tab must appear once the Host reports the capability');
gitTab.el.props.onClick({ stopPropagation() {} });
rows = renderSidebar(props, tPath);
const urlInput = rows.find((r) => r.cls.includes('wcm-gitUrl'));
assert(urlInput, 'Git URL field missing');
urlInput.el.props.onChange({ target: { value: 'https://github.com/org/repo.git' } });
rows = renderSidebar(props, tPath);
rows.find((r) => r.cls === 'wcm-dirRow').el.props.children[1].props.onClick({ stopPropagation() {} });
await tick();
rows = renderSidebar(props, tPath);
assert(rows.find((r) => r.cls.includes('wcm-gitParent')).el.props.value === '/tmp/n', 'browse must fill the download directory');
assert(rows.some((r) => r.cls === 'wcm-hint' && String(r.el.props.children).includes('/tmp/n/repo')), `target preview must derive the folder name from the URL, got ${JSON.stringify(rows.filter((r) => r.cls === 'wcm-hint').map((r) => r.el.props.children))}`);
const saveButton = rows.find((r) => r.cls === 'wcm-primary' && r.el.props.children === 'save');
assert(saveButton && saveButton.el.props.disabled === false, 'save must be enabled once URL and download directory are set');
calls.length = 0;
saveButton.el.props.onClick({ stopPropagation() {} });
await tick();
const cloneCall = fetchCalls.find(([url, init]) => url.endsWith('/clone') && init.method === 'POST');
assert(cloneCall, 'clone must be posted to the Host route');
const cloneBody = JSON.parse(cloneCall[1].body);
assert(cloneBody.url === 'https://github.com/org/repo.git' && cloneBody.parentPath === '/tmp/n' && cloneBody.folderName === '' && cloneBody.branch === '', `clone body must carry the dialog values, got ${cloneCall[1].body}`);
assert(cloneCall[1].headers['x-dsh-wcm-token'] === 'tok-1', 'clone must carry the bootstrap token');
assert(calls.some(([k, v]) => k === 'workspaces.create' && v.path === 'D:/clones/repo'), 'the cloned path must be registered as a workspace');
assert(calls.some(([k, key, value]) => k === 'scope.set' && key === 'assignments' && value.n1 === 'c1'), 'the imported project must join the chosen group');
assert(calls.some(([k, id]) => k === 'uiWorkspace.startSession' && id === 'n1'), 'import must finish by opening the new project');

// L2: unavailable Host capability hides the tab and surfaces the Host reason
globalThis.fetch = async () => jsonResponse(200, { ok: true, available: false, reason: '未找到 git 命令' });
props = entriesFor(true);
hookState = [];
rows = renderSidebar(props, tPath);
rows.find((r) => r.cls === 'wcm-iconBtn' && r.el.props.title === 'addWorkspace').el.props.onClick({ stopPropagation() {}, preventDefault() {} });
await tick();
rows = renderSidebar(props, tPath);
assert(!rows.some((r) => r.cls.includes('wcm-modeTab')), 'no Git tab when the Host cannot clone');
let unavailable = '';
try { await props['sidebar.workspaces'].api.cloneRepository({ url: 'https://x/y.git', parentPath: '/tmp' }); } catch (error) { unavailable = error.message; }
assert(unavailable === '未找到 git 命令', `the Host reason must surface, got ${JSON.stringify(unavailable)}`);

// M: sidebar expansion survives a restart. DSH binds Web to a fresh loopback
// port on every launch, so browser localStorage is per-origin and always empty
// at boot; the state has to live in the plugin Config. Reopening the program
// must reproduce exactly what was closed/opened before.
const restart = freshScope({
  categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }, { id: 'c2', name: '内部工具', color: '#ff8c4f' }],
  assignments: { a: 'c1' },
  collapsedCategories: ['c2'],
  expandedWorkspaces: ['a'],
});
props = entriesFor(true, restart.bind);
hookState = [];
rows = renderRows(props);
const folderOf = (name) => rows.find((r) => r.cls.startsWith('wcm-folderRow') && r.el.props.title === name);
assert(folderOf('内部工具') && !folderOf('内部工具').cls.includes('wcm-open'), 'a category stored as collapsed must come back collapsed');
assert(folderOf('客户项目') && folderOf('客户项目').cls.includes('wcm-open'), 'a category not stored as collapsed must stay expanded');
assert(rows.find((r) => r.cls.split(' ').includes('wcm-projectRow')).cls.includes('wcm-open'), 'a project stored as expanded must come back expanded');
assert(rows.some((r) => r.cls.split(' ').includes('wcm-session')), 'the restored expanded project must render its session rows');
// closing a category writes the suppression list, idempotently (closing twice cannot double-list it)
folderOf('客户项目').el.props.onClick({ stopPropagation() {}, preventDefault() {} });
folderOf('客户项目').el.props.onClick({ stopPropagation() {}, preventDefault() {} });
const collapsedWrites = () => calls.filter(([kind, key]) => kind === 'scope.set' && key === 'collapsedCategories').map(([, , value]) => value);
const lastWrite = collapsedWrites()[collapsedWrites().length - 1];
assert(JSON.stringify(lastWrite) === JSON.stringify(['c2', 'c1']), `closing a category must persist it once, got ${JSON.stringify(collapsedWrites())}`);
assert(JSON.stringify(restart.target.collapsedCategories) === JSON.stringify(['c2', 'c1']), 'the persisted config must hold the closed categories');
// reopening the same config (what the next program launch reads from disk) reproduces it
props = entriesFor(true, restart.bind);
hookState = [];
rows = renderRows(props);
assert(!folderOf('客户项目').cls.includes('wcm-open') && !folderOf('内部工具').cls.includes('wcm-open'), 'both categories must come back collapsed after the reopen');
// a stale/dead id must not survive a write, so a long-lived profile cannot grow forever
restart.target.collapsedCategories = ['c1', 'c2', 'gone'];
props = entriesFor(true, restart.bind);
hookState = [];
rows = renderRows(props);
folderOf('内部工具').el.props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(JSON.stringify(restart.target.collapsedCategories) === JSON.stringify(['c1']), `removed categories must be pruned, got ${JSON.stringify(restart.target.collapsedCategories)}`);

// N: while the settings form is still loading there is no persisted state to
// honour, so the list waits instead of flashing every category as expanded and
// then snapping to the stored layout.
const loading = { value: undefined, status: 'loading', writable: true };
const loadingBind = () => ({ subscribe: () => () => {}, getSnapshot: () => loading, set: () => Promise.resolve() });
props = entriesFor(true, loadingBind);
hookState = [];
rows = renderRows(props);
assert(!rows.some((r) => r.cls === 'wcm-folders'), 'the category tree must wait for the first accepted settings section');
loading.value = { categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }], assignments: {}, collapsedCategories: ['c1'], expandedWorkspaces: [] };
loading.status = 'ready';
hookState = [];
rows = renderRows(props);
assert(rows.some((r) => r.cls === 'wcm-folders'), 'the tree must appear once the settings section arrives');
/* The Today group is the tree's first row and is expanded by default, so this
 * invariant is about the real CATEGORY rows. */
assert(rows.find((r) => r.cls.startsWith('wcm-folderRow') && !r.cls.includes('wcm-todayRow')).cls.includes('wcm-open') === false, 'the stored collapsed state must apply on the first real render');

// O: a toggle must repaint from the click, not after the Config round trip.
// The settings write is a remote call, so rendering straight from the Config
// made every folder wait (and look frozen) before it moved; both containers stay
// mounted so the CSS transition has something to animate.
const live = freshScope({
  categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }],
  assignments: { a: 'c1' },
  collapsedCategories: ['c1'],
  expandedWorkspaces: [],
});
const renderLive = () => {
  props = entriesFor(true, live.bind);
  hookState = [];
  return renderRows(props);
};
const rowFor = (rendered, name) => rendered.find((r) => r.cls.startsWith('wcm-folderRow') && r.el.props.title === name);
const containerFor = (rendered, name) => {
  const wrap = rendered.find((r) => r.cls === 'wcm-folderWrap' && [].concat(r.el.props.children).some((c) => c && c.props && c.props.title === name));
  return [].concat(wrap.el.props.children).find((c) => c && c.props && String(c.props.className).includes('wcm-folderProjects'));
};
rows = renderLive();
assert(!rowFor(rows, '客户项目').cls.includes('wcm-open'), 'a category stored as collapsed must render collapsed');
assert(containerFor(rows, '客户项目').props.className.includes('wcm-closed'), 'the collapsed container must carry the transition class');
/* The collapsed panel keeps exactly one child: the rows live inside the inner
 * layer, never as direct grid tracks — as tracks they stayed 34px tall each and
 * the "collapsed" folder kept reserving their height. */
const innerChildren = (rendered, name) => {
  const inner = containerFor(rendered, name).props.children;
  return Array.isArray(inner) ? inner : [inner];
};
assert(innerChildren(rows, '客户项目').length === 1 && String(innerChildren(rows, '客户项目')[0].props.className).includes('wcm-folderProjectsInner'), 'a collapsed panel must wrap its rows in one inner layer');
assert(containerFor(rows, '客户项目').props.className.includes('wcm-closed'), 'the closed panel is what hides the rows (height 0 + visibility)');
// click -> the very next render already shows it open, before any Config change
rowFor(rows, '客户项目').el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rows = renderLive();
assert(rowFor(rows, '客户项目').cls.includes('wcm-open'), 'the clicked category must repaint immediately');
assert(!containerFor(rows, '客户项目').props.className.includes('wcm-closed'), 'the clicked container must open immediately');
assert(!containerFor(rows, '客户项目').props.className.includes('wcm-closed'), 'the opened panel must drop the closed state');
// the click still reaches the Config, and a fresh mount keeps the same state
rows = renderLive();
assert(rowFor(rows, '客户项目').cls.includes('wcm-open'), 'the reopened category must stay open on a fresh mount');
assert(containerFor(rows, '客户项目').props.className.includes('wcm-closed') === false, 'the reopened container must stay open on a fresh mount');

// L: suite migration — the «工作区分类» page lives in exactly ONE place at a
// time: the suite's settings.pluginKit.tab while dsh-plugin-kit is loaded,
// otherwise this plugin's own top-level settings.section section.
const suiteSlots = (() => {
  const declared = new Set(['settings.section', 'sidebar.workspaces']);
  const subs = new Map();   // key → Set<listener>          (entry/declaration notifications)
  const ctrls = new Map();  // key → Set<reconciler>         (slots.inject controllers)
  const live = new Map();   // slot key → Map<id, disposer>
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
    /* Declaration lifetime boundary: inject controllers settle first (they are
     * synchronous in DSH), then the entry subscribers (microtask-batched). */
    setDeclared: (key, present) => {
      if (present) declared.add(key); else declared.delete(key);
      for (const fn of [...(ctrls.get(key) ?? [])]) fn();
      for (const fn of [...(subs.get(key) ?? [])]) fn();
    },
  };
})();
const suiteSvc = servicesFor(true);
plugin.apply({
  effect: () => () => {},
  locale: { register: () => {}, bind: () => (k) => k },
  get: (name) => name === 'configForms' ? { get: () => bindScope() } : suiteSvc[name],
  configForms: { get: () => bindScope() },
  slots: suiteSlots,
});
assert(suiteSlots.ids('settings.section').includes('workspace-categories'), 'suite absent: the fallback settings.section must still register');
assert(!suiteSlots.ids('settings.pluginKit.tab').includes('workspace-categories'), 'suite absent: nothing may register into the suite slot');
suiteSlots.setDeclared('settings.pluginKit.tab', true);
assert(suiteSlots.ids('settings.pluginKit.tab').includes('workspace-categories'), 'suite declared: the page must move into the suite slot');
assert(!suiteSlots.ids('settings.section').includes('workspace-categories'), 'suite declared: the top-level section must be disposed');
suiteSlots.setDeclared('settings.pluginKit.tab', false);
assert(suiteSlots.ids('settings.section').includes('workspace-categories'), 'suite collapsed: the fallback section must come back');
assert(!suiteSlots.ids('settings.pluginKit.tab').includes('workspace-categories'), 'suite collapsed: the suite entry must be gone');

// P: 「今天」cross-project view — a pure projection of the Session list.
// `updatedAt` is max(createdAt, lastPromptAt) and the Host only advances it on a
// durable USER message, so the window answers "did I talk to this session
// today?" rather than "is work happening in it"; a session still running across
// midnight therefore has to be admitted by its running flag, not by its clock.
// Subagent children, archived rows and blank New Session rows stay out (the
// subagent case is the one measured on this machine: a burst of depth-1
// children sharing their parent's minute).
const dayAt = (offsetDays, hour, minute = 0) => { const date = new Date(); date.setDate(date.getDate() + offsetDays); date.setHours(hour, minute, 0, 0); return date.getTime(); };
const todayNoon = dayAt(0, 12);
const session = (id, extra) => ({ id, displayTitle: id, blank: false, running: false, retainedBy: {}, updatedAt: todayNoon, ...extra });
const svcP = servicesFor(true);
const workspacesP = { items: [{ workspaceId: 'a', title: 'Proj A', path: 'C:\\a', sessionIds: [] }], archivedSessionIds: ['s-archived'], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null };
svcP.workspaces = { ...svcP.workspaces, list: { subscribe: () => () => {}, getSnapshot: () => workspacesP } };
const pScope = freshScope({});
const propsFor = (svc, bind) => { const out = {}; const configFormsSvc = { get: () => bind() };
  plugin.apply({ effect: () => () => {}, locale: { register: () => {}, bind: () => (key) => key }, get: (name) => name === 'configForms' ? configFormsSvc : svc[name], configForms: { get: () => bind() }, slots: slotsFake(out) });
  return out; };
const renderToday = (rendered, now) => { hookIndex = 0; return collectSimple(rendered['component:sidebar.workspaces']({ api: rendered['sidebar.workspaces'].api, wide: true, t: (key) => key, now, expandSidebar: () => {} })); };
const collectIn = (root, cls) => { const out = []; (function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; const name = node.props?.className; if (typeof name === 'string' && name.split(' ').includes(cls)) out.push(node); const children = node.props?.children; if (Array.isArray(children)) children.forEach(walk); else if (children && typeof children === 'object') walk(children); })(root); return out; };
const wrapOf = (rendered) => rendered.find((row) => row.cls === 'wcm-folderWrap' && row.el.props.key === '__today__');
const textIn = (wrap, cls) => collectIn(wrap.el, cls).map((node) => [].concat(node.props.children).join(''));
const idsIn = (wrap) => collectIn(wrap.el, 'wcm-session').map((node) => node.props.key);
// empty state: an idle older session is neither today's nor running, and the
// group must say so instead of rendering a bare header
svcP.setList({ current: null, ids: ['s-idle'], byId: { 's-idle': session('s-idle', { displayTitle: '前天聊的', updatedAt: dayAt(-2, 10) }) } });
hookState = [];
let todayWrap = wrapOf(renderToday(propsFor(svcP, pScope.bind), todayNoon));
assert(todayWrap, 'the Today group must render even with nothing in it');
assert(textIn(todayWrap, 'wcm-folderCount')[0] === '0', 'an empty Today group must count 0');
assert(collectIn(todayWrap.el, 'wcm-todayEmpty').length === 1, 'an empty Today group must show its hint');
assert(idsIn(todayWrap).length === 0, 'an idle older session must not enter the Today list');
// `phase: 'pending'` is "nothing arrived yet", not "nothing today"
svcP.setList({ current: null, ids: [], byId: {}, phase: 'pending' });
hookState = [];
todayWrap = wrapOf(renderToday(propsFor(svcP, pScope.bind), todayNoon));
assert(textIn(todayWrap, 'wcm-folderCount')[0] === '0' && collectIn(todayWrap.el, 'wcm-todayEmpty').length === 0, 'an unloaded Session list must not claim the day is empty');
// full projection: today's prompts, a session created earlier today, the running
// overnight one, and every exclusion rule at once
const todayIds = ['s-noon', 's-sub', 's-archived', 's-blank', 's-today', 's-blank-current', 's-early', 's-overnight', 's-yesterday'];
const todayBase = {
  's-noon': session('s-noon', { displayTitle: '今天中午发过话', updatedAt: dayAt(0, 12), cwd: 'C:\\a' }),
  's-sub': session('s-sub', { displayTitle: '子代理会话', updatedAt: dayAt(0, 11), cwd: 'C:\\a', origin: 'subagent' }),
  's-archived': session('s-archived', { displayTitle: '已归档', updatedAt: dayAt(0, 10), cwd: 'C:\\a' }),
  's-blank': session('s-blank', { displayTitle: '空白会话', updatedAt: dayAt(0, 9, 30), cwd: 'C:\\a', blank: true }),
  's-today': session('s-today', { displayTitle: '今天上午发过话', updatedAt: dayAt(0, 9), cwd: 'C:\\a' }),
  's-blank-current': session('s-blank-current', { displayTitle: '新会话', updatedAt: dayAt(0, 8), cwd: 'C:\\a', blank: true }),
  's-early': session('s-early', { displayTitle: '昨天建的，今早继续', updatedAt: dayAt(0, 7), cwd: 'C:\\gone\\beta' }),
  's-overnight': session('s-overnight', { displayTitle: '跨天还在跑', updatedAt: dayAt(-1, 22), running: true, cwd: 'C:\\a' }),
  's-yesterday': session('s-yesterday', { displayTitle: '昨天聊完就不动了', updatedAt: dayAt(-1, 21), cwd: 'C:\\a' }),
};
const setTodayList = (patch = {}) => svcP.setList({ current: 's-blank-current', ids: todayIds, byId: { ...todayBase, ...patch } });
setTodayList();
hookState = [];
let propsP = propsFor(svcP, pScope.bind);
let rowsP = renderToday(propsP, todayNoon);
todayWrap = wrapOf(rowsP);
assert(rowsP.find((row) => row.cls === 'wcm-folderWrap') === todayWrap, 'the Today group must lead the category tree');
assert(textIn(todayWrap, 'wcm-folderCount')[0] === '5', `the Today count must be 5, got ${textIn(todayWrap, 'wcm-folderCount')[0]}`);
/* 行按项目分组，项目名只在分组标题上出现一次；组内仍按时间倒序，分组之间按「组里最新
 * 的那条」排序（Proj A 的 12:00 在 beta 的 07:00 之前）。 */
assert(JSON.stringify(textIn(todayWrap, 'wcm-todayGroupLabel')) === JSON.stringify(['Proj A', 'beta']), `project groups must lead with the most recently touched project, got ${JSON.stringify(textIn(todayWrap, 'wcm-todayGroupLabel'))}`);
assert(JSON.stringify(textIn(todayWrap, 'wcm-todayGroupCount')) === JSON.stringify(['4', '1']), `each group must count its own rows, got ${JSON.stringify(textIn(todayWrap, 'wcm-todayGroupCount'))}`);
assert(JSON.stringify(textIn(todayWrap, 'wcm-sessionTitle')) === JSON.stringify(['今天中午发过话', '今天上午发过话', 'newSession', '跨天还在跑', '昨天建的，今早继续']), `rows must stay newest-first inside their group (the selected blank keeps the New Session label), got ${JSON.stringify(textIn(todayWrap, 'wcm-sessionTitle'))}`);
const yesterdayStamp = (() => { const date = new Date(dayAt(-1, 22)); return `${date.getMonth() + 1}/${date.getDate()}`; })();
assert(JSON.stringify(textIn(todayWrap, 'wcm-todayTime')) === JSON.stringify(['12:00', '09:00', '08:00', yesterdayStamp, '07:00']), `an overnight runner must show its date, got ${JSON.stringify(textIn(todayWrap, 'wcm-todayTime'))}`);
assert(collectIn(todayWrap.el, 'wcm-todayProject').length === 0, 'the project name must live on the group header, never repeated per row');
assert(JSON.stringify(idsIn(todayWrap)) === JSON.stringify(['s-noon', 's-today', 's-blank-current', 's-overnight', 's-early']), `exclusions regressed, got ${JSON.stringify(idsIn(todayWrap))}`);
// one click opens the session; the Today group itself is a view, not a category
calls.length = 0;
collectIn(todayWrap.el, 'wcm-session')[0].props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(calls.some(([kind, id]) => kind === 'uiWorkspace.openSession' && id === 's-noon'), 'a Today row must open its session through uiWorkspace');
// 分组标题可以单独折叠，而且折叠状态落盘（键是工作区身份 / 目录路径，不是显示名）
const groupOf = (rendered, label) => collectIn(wrapOf(rendered).el, 'wcm-todayGroup').find((node) => collectIn(node, 'wcm-todayGroupLabel').map((child) => [].concat(child.props.children).join('')).includes(label));
const groupHeaderOf = (rendered, label) => groupOf(rendered, label);
assert(groupHeaderOf(rowsP, 'Proj A'), 'each project group must expose a foldable header');
calls.length = 0;
groupHeaderOf(rowsP, 'Proj A').props.onClick({ stopPropagation() {}, preventDefault() {} });
const groupWrites = calls.filter(([kind, key]) => kind === 'scope.set' && key === 'collapsedTodayGroups').map(([, , value]) => value);
assert(JSON.stringify(groupWrites[groupWrites.length - 1]) === JSON.stringify(['w:a']), `folding a project group must persist its identity key, got ${JSON.stringify(groupWrites)}`);
rowsP = renderToday(propsP, todayNoon);
const foldedHeader = groupHeaderOf(rowsP, 'Proj A');
assert(foldedHeader && !foldedHeader.props.className.includes('wcm-open'), 'the clicked project group must repaint folded immediately');
assert(collectIn(wrapOf(rowsP).el, 'wcm-session').length === 5, 'a folded group must still render its rows for the CSS transition');
hookState = [];
rowsP = renderToday(propsFor(svcP, pScope.bind), todayNoon);
assert(!groupHeaderOf(rowsP, 'Proj A').props.className.includes('wcm-open'), 'the folded project group must survive a remount');
/* 「当前」里不放项目操作按钮：分组标题只有 折叠箭头 + 名称 + 数字，点它只折叠、不弹菜单。
 * 项目菜单仍然只有一个入口——分类树里右键项目行（共用同一份菜单项定义）。 */
const groupChildren = (rendered, label) => { const group = groupOf(rendered, label); return group === undefined ? [] : [].concat(group.props.children).filter((child) => child !== null && child !== undefined); };
assert(JSON.stringify(groupChildren(rowsP, 'Proj A').map((child) => String(child.props.className))) === JSON.stringify(['wcm-todayGroupCaret', 'wcm-todayGroupLabel', 'wcm-todayGroupCount']), `a「当前」group header must carry only its caret, label and count, got ${JSON.stringify(groupChildren(rowsP, 'Proj A').map((child) => child.props.className))}`);
calls.length = 0;
groupHeaderOf(rowsP, 'Proj A').props.onClick({ stopPropagation() {}, preventDefault() {}, clientX: 30, clientY: 40 });
rowsP = renderToday(propsP, todayNoon);
assert(rowsP.filter((row) => String(row.cls).split(' ').includes('wcm-menu')).length === 0, 'a「当前」group header must not open a project menu');
/* 「定位到会话」：行内的定位按钮（紧挨着隐藏按钮），把这个会话在左侧分类树里露出来 ——
 * 展开它所属的分类与项目，并把树里那一行高亮。没被任何工作区记账的会话（工作区被删了）
 * 在树里没有行，按钮就不出现。 */
workspacesP.items[0].sessionIds = ['s-noon'];
const locateScope = freshScope({ categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }], assignments: { a: 'c1' }, collapsedCategories: ['c1'], expandedWorkspaces: [] });
hookState = [];
const propsL = propsFor(svcP, locateScope.bind);
let rowsL = renderToday(propsL, todayNoon);
const rowNodeIn = (rendered, id) => collectIn(wrapOf(rendered).el, 'wcm-session').find((node) => node.props.key === id);
const locateIn = (rendered, id) => { const row = rowNodeIn(rendered, id); return row === undefined ? undefined : collectIn(row, 'wcm-sessionLocate')[0]; };
const hideIn = (rendered, id) => { const row = rowNodeIn(rendered, id); return row === undefined ? undefined : collectIn(row, 'wcm-todayHide')[0]; };
assert(locateIn(rowsL, 's-noon') && hideIn(rowsL, 's-noon'), 'a locatable row must offer the locate button beside the hide button');
assert(!locateIn(rowsL, 's-early'), 'a session accounted to no workspace has nowhere to be located');
assert(!rowsL.some((row) => String(row.cls).includes('wcm-locateHit')), 'nothing may be highlighted before the first locate');
calls.length = 0;
locateIn(rowsL, 's-noon').props.onClick({ stopPropagation() {}, preventDefault() {} });
const writeOf = (key) => calls.filter(([kind, name]) => kind === 'scope.set' && name === key).map(([, , value]) => value).pop();
assert(JSON.stringify(writeOf('collapsedCategories')) === JSON.stringify([]), `locating must expand the owning category, got ${JSON.stringify(writeOf('collapsedCategories'))}`);
assert(JSON.stringify(writeOf('expandedWorkspaces')) === JSON.stringify(['a']), `locating must expand the owning project, got ${JSON.stringify(writeOf('expandedWorkspaces'))}`);
rowsL = renderToday(propsL, todayNoon);
const hits = rowsL.filter((row) => String(row.cls).includes('wcm-locateHit'));
assert(hits.length === 1 && hits[0].el.props['data-wcm-tree-session'] === 's-noon', `the located session must be highlighted in the tree, got ${hits.length}`);
// 定位锚点只能打在树里的行上：「当前」行如果也带同一个属性，querySelector 会命中它（它本来就在视野里），滚动就成了空操作
assert(rowNodeIn(rowsL, 's-noon').props['data-wcm-tree-session'] === undefined, 'the「当前」row must not carry the tree anchor, or the locator would scroll to itself');
// 已经露出来的会话再点一次不该重复写配置
calls.length = 0;
locateIn(rowsL, 's-noon').props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(!calls.some(([kind]) => kind === 'scope.set'), 'locating an already visible session must not write the Config again');
workspacesP.items[0].sessionIds = [];
/* 一键「全部收起 / 全部展开」：作用在分类和项目**自身**的折叠状态上（复用 collapsedCategories
 * / expandedWorkspaces，不新增字段），并且不得顺带改动「当前」分组的折叠位。 */
const svcB = servicesFor(true);
const workspacesB = { items: [{ workspaceId: 'w1', title: 'Alpha', path: 'C:\\a', sessionIds: ['s1'] }, { workspaceId: 'w2', title: 'Beta', path: 'C:\\b', sessionIds: [] }], archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null };
svcB.workspaces = { ...svcB.workspaces, list: { subscribe: () => () => {}, getSnapshot: () => workspacesB } };
svcB.setList({ current: null, ids: ['s1'], byId: { s1: session('s1', { displayTitle: 'Alpha 的会话', updatedAt: dayAt(0, 9), cwd: 'C:\\a' }) } });
const bulkScope = freshScope({ categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }, { id: 'c2', name: '内部工具', color: '#ff8c4f' }], assignments: { w1: 'c1' }, collapsedCategories: ['__today__', 'c2'], expandedWorkspaces: ['w1'] });
hookState = [];
const propsB = propsFor(svcB, bulkScope.bind);
const bulkWrites = (key) => calls.filter(([kind, name]) => kind === 'scope.set' && name === key).map(([, , value]) => value);
const sortedJson = (value) => JSON.stringify([...value].sort());
const rowsWith = (rows, token) => rows.filter((row) => String(row.cls).includes(token));
const categoryRows = (rows) => rowsWith(rows, 'wcm-folderRow').filter((row) => !String(row.cls).includes('wcm-todayRow'));
// 测试桩会立刻执行函数组件，所以比不了组件引用——比图标实际画出来的路径（几何）。
const iconShapeOf = (rendered) => { const children = bulkToggleOf(rendered).el.props.children; const svg = Array.isArray(children) ? children[0] : children; const parts = Array.isArray(svg.props.children) ? svg.props.children : [svg.props.children]; return JSON.stringify(parts.map((node) => node.props.d ?? '')); };
const bulkToggleOf = (rendered) => rendered.find((row) => row.cls === 'wcm-iconBtn' && (row.el.props.title === 'foldAll' || row.el.props.title === 'unfoldAll'));
let rowsB = renderToday(propsB, todayNoon);
assert(!rowsB.some((row) => String(row.cls).includes('wcm-categories')), 'the directory must not be hidden as a whole container any more');
assert(bulkToggleOf(rowsB) && bulkToggleOf(rowsB).el.props.title === 'foldAll', 'with something open the header must offer Collapse all');
const openIcon = iconShapeOf(rowsB);
// 方向由真实展开状态推导，两条轴各自独立成立：分类开着（项目全合）或项目开着（分类全合）
// 都应该是「全部收起」——否则「全部收起」会漏掉另一半。
hookState = [];
const openCategoryOnly = freshScope({ categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }, { id: 'c2', name: '内部工具', color: '#ff8c4f' }], assignments: {}, collapsedCategories: ['__today__', 'c2'], expandedWorkspaces: [] });
assert(bulkToggleOf(renderToday(propsFor(svcB, openCategoryOnly.bind), todayNoon)).el.props.title === 'foldAll', 'an open category alone must still offer Collapse all');
hookState = [];
const openProjectOnly = freshScope({ categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }], assignments: { w1: 'c1' }, collapsedCategories: ['__today__', 'c1', '__uncategorized__'], expandedWorkspaces: ['w1'] });
assert(bulkToggleOf(renderToday(propsFor(svcB, openProjectOnly.bind), todayNoon)).el.props.title === 'foldAll', 'an open project alone must still offer Collapse all');
hookState = [];
rowsB = renderToday(propsB, todayNoon);
// 全部收起：分类全收、项目全收，会话行随之从树里消失（只剩「当前」里那一行）
calls.length = 0;
bulkToggleOf(rowsB).el.props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(sortedJson(bulkWrites('collapsedCategories').pop() ?? []) === sortedJson(['__today__', 'c1', 'c2', '__uncategorized__']), `Collapse all must fold every category and keep the Current fold bit, got ${JSON.stringify(bulkWrites('collapsedCategories'))}`);
assert(JSON.stringify(bulkWrites('expandedWorkspaces').pop() ?? null) === JSON.stringify([]), `Collapse all must fold every project, got ${JSON.stringify(bulkWrites('expandedWorkspaces'))}`);
rowsB = renderToday(propsB, todayNoon);
assert(categoryRows(rowsB).every((row) => !String(row.cls).includes('wcm-open')), 'every category row must repaint folded');
assert(iconShapeOf(rowsB) !== openIcon, 'the icon must switch to the other glyph instead of rotating in place');
assert(rowsWith(rowsB, 'wcm-projectRow').length === 2, 'both projects must be rendered for the fold assertions to mean anything');
assert(rowsWith(rowsB, 'wcm-projectRow').every((row) => !String(row.cls).includes('wcm-open')), 'no project row may stay open after Collapse all');
assert(bulkToggleOf(rowsB).el.props.title === 'unfoldAll', 'the toggle must flip to Expand all once everything is folded');
assert(!collectIn(wrapOf(rowsB).el, 'wcm-folderRow')[0].props.className.includes('wcm-open'), 'the Current group must keep its own fold bit (it was folded and stays folded)');
// 全部展开：分类全开、项目全开（树里重新出现会话行）
calls.length = 0;
bulkToggleOf(rowsB).el.props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(sortedJson(bulkWrites('collapsedCategories').pop() ?? []) === sortedJson(['__today__']), `Expand all must open every category and still keep the Current fold bit, got ${JSON.stringify(bulkWrites('collapsedCategories'))}`);
assert(sortedJson(bulkWrites('expandedWorkspaces').pop() ?? []) === sortedJson(['w1', 'w2']), `Expand all must open every project, got ${JSON.stringify(bulkWrites('expandedWorkspaces'))}`);
rowsB = renderToday(propsB, todayNoon);
assert(rowsWith(rowsB, 'wcm-projectRow').filter((row) => String(row.cls).includes('wcm-open')).length === 2, 'every project must repaint expanded');
assert(categoryRows(rowsB).every((row) => String(row.cls).includes('wcm-open')), 'every category row must repaint expanded after Expand all');
assert(categoryRows(rowsB).every((row) => String(row.cls).includes('wcm-open')), 'every category row must repaint expanded');
assert(iconShapeOf(rowsB) === openIcon, 'expanding must switch the icon back to the first glyph');
// 点击立刻生效（回写未落地也已画完）
const optimisticBulk = { categories: [{ id: 'c1', name: '客户项目', color: '#4f8cff' }], assignments: {}, collapsedCategories: [], expandedWorkspaces: [], hiddenToday: {} };
const optimisticBulkBind = () => ({ subscribe: () => () => {}, getSnapshot: () => ({ value: optimisticBulk, status: 'ready', writable: true }), set: (key, value) => { calls.push(['scope.set', key, value]); return new Promise(() => {}); } });
hookState = [];
const propsOB = propsFor(svcB, optimisticBulkBind);
let rowsOB = renderToday(propsOB, todayNoon);
bulkToggleOf(rowsOB).el.props.onClick({ stopPropagation() {}, preventDefault() {} });
rowsOB = renderToday(propsOB, todayNoon);
assert(categoryRows(rowsOB).every((row) => !String(row.cls).includes('wcm-open')), 'Collapse all must repaint before the settings write lands');
assert(String(rowsWith(rowsOB, 'wcm-folderRow').find((row) => String(row.cls).includes('wcm-todayRow')).cls).includes('wcm-open'), 'the Current group is not a category: Collapse all must leave it alone');
assert(optimisticBulk.collapsedCategories.length === 0, 'the optimistic paint must not require the Config to have changed');
hookState = [];
rowsP = renderToday(propsP, todayNoon);
const todayRow = collectIn(wrapOf(rowsP).el, 'wcm-folderRow')[0];
assert(todayRow.props.draggable === undefined, 'the Today group must not be draggable like a category');
calls.length = 0;
todayRow.props.onClick({ stopPropagation() {}, preventDefault() {} });
const collapsedWritesP = calls.filter(([kind, key]) => kind === 'scope.set' && key === 'collapsedCategories').map(([, , value]) => value);
assert(JSON.stringify(collapsedWritesP[collapsedWritesP.length - 1]) === JSON.stringify(['__today__']), `collapsing Today must persist __today__ itself, got ${JSON.stringify(collapsedWritesP)}`);
rowsP = renderToday(propsP, todayNoon);
assert(!collectIn(wrapOf(rowsP).el, 'wcm-folderRow')[0].props.className.includes('wcm-open'), 'the clicked Today group must repaint collapsed immediately');
// a remount reads the persisted suppression list, exactly like a restart
hookState = [];
rowsP = renderToday(propsFor(svcP, pScope.bind), todayNoon);
assert(!collectIn(wrapOf(rowsP).el, 'wcm-folderRow')[0].props.className.includes('wcm-open'), 'the collapsed Today group must survive a remount');
assert(collectIn(wrapOf(rowsP).el, 'wcm-session').length === 5, 'a collapsed Today group must still render its rows for the CSS transition');
// rolling past midnight keeps only what is still running
rowsP = renderToday(propsP, dayAt(1, 12));
todayWrap = wrapOf(rowsP);
assert(textIn(todayWrap, 'wcm-folderCount')[0] === '1' && JSON.stringify(textIn(todayWrap, 'wcm-sessionTitle')) === JSON.stringify(['跨天还在跑']), `after midnight only the running session stays, got ${JSON.stringify(textIn(todayWrap, 'wcm-sessionTitle'))}`);

// P2: 「从今天隐藏」是临时移除，不是排除名单。记录里带着移除那一刻的活动事实
// （updatedAt / running），会话之后出现当时没有的活动就自动回来——新的用户消息，
// 或者从非运行变为运行，都不需要定时器或额外的扫描。
const rowNodeOf = (wrap, id) => collectIn(wrap.el, 'wcm-session').find((node) => node.props.key === id);
const hideButtonIn = (wrap, id) => { const row = rowNodeOf(wrap, id); return row === undefined ? undefined : collectIn(row, 'wcm-todayHide')[0]; };
const hideWrites = () => calls.filter(([kind, key]) => kind === 'scope.set' && key === 'hiddenToday').map(([, , value]) => value);
const hideScope = freshScope({});
calls.length = 0;
hookState = [];
let propsDismiss = propsFor(svcP, hideScope.bind);
assert(hideButtonIn(wrapOf(renderToday(propsDismiss, todayNoon)), 's-noon'), 'every Today row must expose its hide button');
// 点击必须立刻生效，即使设置回写还没落地：这个 scope 既不改值也不 resolve
const optimisticTarget = { categories: [], assignments: {}, collapsedCategories: [], expandedWorkspaces: [] };
const optimisticBind = () => ({ subscribe: () => () => {}, getSnapshot: () => ({ value: optimisticTarget, status: 'ready', writable: true }), set: (key, value) => { calls.push(['scope.set', key, value]); return new Promise(() => {}); } });
hookState = [];
const propsO = propsFor(svcP, optimisticBind);
hideButtonIn(wrapOf(renderToday(propsO, todayNoon)), 's-noon').props.onClick({ stopPropagation() {}, preventDefault() {} });
let rowsO = renderToday(propsO, todayNoon);
assert(!idsIn(wrapOf(rowsO)).includes('s-noon') && textIn(wrapOf(rowsO), 'wcm-folderCount')[0] === '4', 'hiding must repaint immediately, before the settings write lands');
assert(calls.some(([kind, key]) => kind === 'scope.set' && key === 'hiddenToday'), 'the dismissal must still reach the Config');
// 真实 scope：记录内容、跨挂载保留
calls.length = 0;
hookState = [];
propsDismiss = propsFor(svcP, hideScope.bind);
hideButtonIn(wrapOf(renderToday(propsDismiss, todayNoon)), 's-noon').props.onClick({ stopPropagation() {}, preventDefault() {} });
const record = hideWrites().pop()['s-noon'];
assert(record !== undefined && record.updatedAt === dayAt(0, 12) && typeof record.at === 'number' && !('running' in record), `the dismissal must capture only the activity stamp, got ${JSON.stringify(record)}`);
hookState = [];
let rowsHidden = renderToday(propsFor(svcP, hideScope.bind), todayNoon);
assert(!idsIn(wrapOf(rowsHidden)).includes('s-noon'), 'a dismissal must survive a remount (it lives in the Config, not in React state)');
assert(textIn(wrapOf(rowsHidden), 'wcm-folderCount')[0] === '4', 'the count must follow the visible rows');
assert(collectIn(wrapOf(rowsHidden).el, 'wcm-todayRestore').length === 0, 'there must be no restore button: talking to the session is the only way back');
// 重新跟这个会话对话（新的用户消息）-> 自己回来
setTodayList({ 's-noon': { ...todayBase['s-noon'], updatedAt: dayAt(0, 13) } });
hookState = [];
let rowsBack = renderToday(propsFor(svcP, hideScope.bind), todayNoon);
assert(idsIn(wrapOf(rowsBack)).includes('s-noon') && textIn(wrapOf(rowsBack), 'wcm-folderCount')[0] === '5', 'talking to the session again must bring it back');
// 失效的记录不能带进下一次落盘
hideButtonIn(wrapOf(rowsBack), 's-today').props.onClick({ stopPropagation() {}, preventDefault() {} });
const pruned = hideWrites().pop();
assert(pruned['s-today'] !== undefined && pruned['s-noon'] === undefined, `a dismissal that no longer hides anything must be pruned, got ${JSON.stringify(pruned)}`);
// 隐藏后它自己跑起来（没有新消息）：不回来 —— 只有你重新跟它对话才算
hookState = [];
let rowsH3 = renderToday(propsFor(svcP, hideScope.bind), todayNoon);
assert(!idsIn(wrapOf(rowsH3)).includes('s-today'), 'the just-hidden row must stay hidden');
hideButtonIn(wrapOf(rowsH3), 's-early').props.onClick({ stopPropagation() {}, preventDefault() {} });
setTodayList({ 's-early': { ...todayBase['s-early'], running: true } });
hookState = [];
let rowsH4 = renderToday(propsFor(svcP, hideScope.bind), todayNoon);
assert(!idsIn(wrapOf(rowsH4)).includes('s-early'), 'a session that starts running again must stay hidden until it is talked to');
// 再对话一次就回来（哪怕它当时在跑）
setTodayList({ 's-early': { ...todayBase['s-early'], running: true, updatedAt: dayAt(0, 7, 30) } });
hookState = [];
let rowsH5 = renderToday(propsFor(svcP, hideScope.bind), todayNoon);
assert(idsIn(wrapOf(rowsH5)).includes('s-early'), 'a new prompt must bring back even a session that was running');
// 把今天唯一的会话隐藏掉：不能一边说「今天还没有运行过会话」，一边又什么都没有
svcP.setList({ current: null, ids: ['s-only'], byId: { 's-only': session('s-only', { displayTitle: '今天唯一的会话', updatedAt: dayAt(0, 9), cwd: 'C:\\a' }) } });
const onlyScope = freshScope({});
hookState = [];
let rowsOnly = renderToday(propsFor(svcP, onlyScope.bind), todayNoon);
hideButtonIn(wrapOf(rowsOnly), 's-only').props.onClick({ stopPropagation() {}, preventDefault() {} });
hookState = [];
let rowsEmpty = renderToday(propsFor(svcP, onlyScope.bind), todayNoon);
assert(textIn(wrapOf(rowsEmpty), 'wcm-folderCount')[0] === '0' && idsIn(wrapOf(rowsEmpty)).length === 0, 'the hidden-only group is empty');
assert(collectIn(wrapOf(rowsEmpty).el, 'wcm-todayEmpty').length === 0, 'hiding every row must not claim the day is empty');

console.log('tests OK: built bundle — loader contract, modern/legacy/degradation, registrations, row icon slots, unified status dots, lazy uiWorkspace, context menus, pending-interaction warnings, session navigation + rename, Git import, restart-stable sidebar expansion, optimistic animated toggles, cross-project Today view with temporary dismissal, suite settings migration');

