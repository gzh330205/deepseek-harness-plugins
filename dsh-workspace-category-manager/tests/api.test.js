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
  useEffect(effect, deps) {
    const index = hookIndex++;
    const previous = hookState[index];
    const next = Array.isArray(deps) ? deps : null;
    const changed = previous === undefined || next === null || previous.deps === null || next.length !== previous.deps.length || next.some((value, position) => !Object.is(value, previous.deps[position]));
    if (!changed) return;
    if (typeof previous?.cleanup === 'function') previous.cleanup();
    const cleanup = effect();
    hookState[index] = { deps: next, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
  },
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

// P: 「当前」= 显式注册表（Config currentSessions），不是时间窗口。
// 只有被登记过的会话才进这一栏：会话跑起来、出现新提示词、或者你把它打开时登记；
// 点「隐藏」= 从注册表里删掉这一条。因此：历史会话不会自己冒出来（从没登记过），
// 删掉的也不会自己回来（除非再次运行），而分类树与归档完全不受影响。
const dayAt = (offsetDays, hour, minute = 0) => { const date = new Date(); date.setDate(date.getDate() + offsetDays); date.setHours(hour, minute, 0, 0); return date.getTime(); };
const todayNoon = dayAt(0, 12);
const session = (id, extra) => ({ id, displayTitle: id, blank: false, running: false, retainedBy: {}, updatedAt: todayNoon, ...extra });
const svcP = servicesFor(true);
const propsFor = (svc, bind) => { const out = {}; const configFormsSvc = { get: () => bind() };
  plugin.apply({ effect: () => () => {}, locale: { register: () => {}, bind: () => (key) => key }, get: (name) => name === 'configForms' ? configFormsSvc : svc[name], configForms: { get: () => bind() }, slots: slotsFake(out) });
  return out; };
const renderToday = (rendered, now) => { hookIndex = 0; return collectSimple(rendered['component:sidebar.workspaces']({ api: rendered['sidebar.workspaces'].api, wide: true, t: (key) => key, now, expandSidebar: () => {} })); };
const collectIn = (root, cls) => { const out = []; (function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; const name = node.props?.className; if (typeof name === 'string' && name.split(' ').includes(cls)) out.push(node); const children = node.props?.children; if (Array.isArray(children)) children.forEach(walk); else if (children && typeof children === 'object') walk(children); })(root); return out; };
const wrapOf = (rendered) => rendered.find((row) => row.cls === 'wcm-folderWrap' && row.el.props.key === '__today__');
const textIn = (wrap, cls) => collectIn(wrap.el, cls).map((node) => [].concat(node.props.children).join(''));
const idsIn = (wrap) => collectIn(wrap.el, 'wcm-session').map((node) => node.props.key);

/* 注册表：s-listed 最近发过话、s-viewed 已经看过结果、s-running 跨天还在跑、
 * s-blank-current 是当前打开的新会话；s-history / s-sub / s-archived / s-blank 没登记
 * （s-sub 是子代理、s-archived 已归档、s-blank 从没发过话）；s-dead 登记过但快照里没了。 */
const registryBase = {
  's-listed': { at: dayAt(0, 12), viewedAt: 0 },
  's-viewed': { at: dayAt(0, 10), viewedAt: dayAt(0, 11) },
  's-running': { at: dayAt(-1, 22), viewedAt: 0 },
  's-blank-current': { at: dayAt(0, 8), viewedAt: 0 },
  's-sub': { at: dayAt(0, 11), viewedAt: 0 },
  's-archived': { at: dayAt(0, 10, 30), viewedAt: 0 },
  's-blank': { at: dayAt(0, 9, 30), viewedAt: 0 },
  's-dead': { at: dayAt(0, 7), viewedAt: 0 },
};
const historyIds = ['s-listed', 's-viewed', 's-history', 's-running', 's-blank-current', 's-sub', 's-archived', 's-blank'];
const historyBase = {
  's-listed': session('s-listed', { displayTitle: '中午发过话', updatedAt: dayAt(0, 12), cwd: 'C:\\a' }),
  's-viewed': session('s-viewed', { displayTitle: '看过结果了', updatedAt: dayAt(0, 10), cwd: 'C:\\a' }),
  's-history': session('s-history', { displayTitle: '历史会话（没登记）', updatedAt: dayAt(0, 13), cwd: 'C:\\a' }),
  's-running': session('s-running', { displayTitle: '还在跑', updatedAt: dayAt(-1, 22), running: true, cwd: 'C:\\gone\\beta' }),
  's-blank-current': session('s-blank-current', { displayTitle: '新会话', updatedAt: dayAt(0, 8), blank: true, cwd: 'C:\\a' }),
  's-sub': session('s-sub', { displayTitle: '子代理会话', updatedAt: dayAt(0, 11), origin: 'subagent', cwd: 'C:\\a' }),
  's-archived': session('s-archived', { displayTitle: '已归档', updatedAt: dayAt(0, 10, 30), cwd: 'C:\\a' }),
  's-blank': session('s-blank', { displayTitle: '空白会话', updatedAt: dayAt(0, 9, 30), blank: true, cwd: 'C:\\a' }),
};
const setHistoryList = (patch = {}) => svcP.setList({ current: 's-blank-current', ids: historyIds, byId: { ...historyBase, ...patch } });
const registryScope = (registry, overrides = {}) => freshScope({ currentSessions: registry, ...overrides });
const registryWrites = () => calls.filter(([kind, key]) => kind === 'scope.set' && key === 'currentSessions').map(([, , value]) => value);
const rowIn = (rendered, id) => collectIn(wrapOf(rendered).el, 'wcm-session').find((node) => node.props.key === id);
const hideIn = (rendered, id) => { const row = rowIn(rendered, id); return row === undefined ? undefined : collectIn(row, 'wcm-todayHide')[0]; };
const titleIn = (rendered, id) => collectIn(rowIn(rendered, id), 'wcm-sessionTitle')[0];

/* 工作区快照登记了 a 名下的两个会话：用来验证「定位」与「树里仍然看得到」。 */
const workspacesP = { items: [{ workspaceId: 'a', title: 'Proj A', path: 'C:\\a', sessionIds: ['s-listed', 's-viewed'] }], archivedSessionIds: ['s-archived'], pinnedSessionIds: [] };
svcP.workspaces = { ...svcP.workspaces, list: { subscribe: () => () => {}, getSnapshot: () => workspacesP } };

setHistoryList();
hookState = [];
let propsP = propsFor(svcP, registryScope(registryBase).bind);
let rowsP = renderToday(propsP, todayNoon);
let todayWrap = wrapOf(rowsP);
assert(rowsP.find((row) => row.cls === 'wcm-folderWrap') === todayWrap, 'the Current group must lead the category tree');
assert(textIn(todayWrap, 'wcm-folderCount')[0] === '4', `only registered sessions may show, got ${textIn(todayWrap, 'wcm-folderCount')[0]}`);
assert(JSON.stringify(idsIn(todayWrap)) === JSON.stringify(['s-listed', 's-viewed', 's-blank-current', 's-running']), `registry membership regressed, got ${JSON.stringify(idsIn(todayWrap))}`);
assert(!idsIn(todayWrap).includes('s-history'), 'a session that was never registered must never show, no matter how fresh its activity is');
assert(!idsIn(todayWrap).includes('s-dead'), 'a registered id that no longer exists in the snapshot must not render');
assert(JSON.stringify(textIn(todayWrap, 'wcm-todayGroupLabel')) === JSON.stringify(['Proj A', 'beta']), `groups must lead with the most recently touched project, got ${JSON.stringify(textIn(todayWrap, 'wcm-todayGroupLabel'))}`);
assert(JSON.stringify(textIn(todayWrap, 'wcm-todayGroupCount')) === JSON.stringify(['3', '1']), `each group must count its own rows, got ${JSON.stringify(textIn(todayWrap, 'wcm-todayGroupCount'))}`);
assert(JSON.stringify(textIn(todayWrap, 'wcm-sessionTitle')) === JSON.stringify(['中午发过话', '看过结果了', 'newSession', '还在跑']), `rows must stay newest-first inside their group, got ${JSON.stringify(textIn(todayWrap, 'wcm-sessionTitle'))}`);
const yesterdayStamp = (() => { const date = new Date(dayAt(-1, 22)); return `${date.getMonth() + 1}/${date.getDate()}`; })();
assert(JSON.stringify(textIn(todayWrap, 'wcm-todayTime')) === JSON.stringify(['12:00', '10:00', '08:00', yesterdayStamp]), `clock while today, date otherwise, got ${JSON.stringify(textIn(todayWrap, 'wcm-todayTime'))}`);

/* 「跑完了还没看过」：活动戳晚于最后一次看到它的时间 → 标题加粗；看过的、还在跑的都不加。 */
assert(String(titleIn(rowsP, 's-listed').props.className).includes('wcm-unseen'), 'a finished session you have not looked at must be marked unseen');
assert(!String(titleIn(rowsP, 's-viewed').props.className).includes('wcm-unseen'), 'a session whose result you already looked at must not be marked unseen');
assert(!String(titleIn(rowsP, 's-running').props.className).includes('wcm-unseen'), 'a running session is not "finished and unseen"');
assert(String(rowIn(rowsP, 's-listed').props.title).includes('unseenHint'), 'the unseen row must say why it is listed');

/* 行内动作：定位（会话能定位到树里时）+ 隐藏；归档不进行内（右键菜单里已有）。 */
assert(collectIn(rowIn(rowsP, 's-listed'), 'wcm-sessionLocate').length === 1, 'a locatable row must offer the locate button');
assert(collectIn(rowIn(rowsP, 's-listed'), 'wcm-sessionArchive').length === 0, 'archiving stays in the context menu, never a row button');
calls.length = 0;
rowIn(rowsP, 's-listed').props.onClick({ stopPropagation() {}, preventDefault() {} });
assert(calls.some(([kind, id]) => kind === 'uiWorkspace.openSession' && id === 's-listed'), 'clicking a Current row must open its session');

/* 分组标题可折叠且折叠状态落盘（键是工作区身份 / 目录路径，不是显示名）。 */
const groupOf = (rendered, label) => collectIn(wrapOf(rendered).el, 'wcm-todayGroup').find((node) => collectIn(node, 'wcm-todayGroupLabel').map((child) => [].concat(child.props.children).join('')).includes(label));
assert(groupOf(rowsP, 'Proj A'), 'each project group must expose a foldable header');
calls.length = 0;
groupOf(rowsP, 'Proj A').props.onClick({ stopPropagation() {}, preventDefault() {} });
const groupWrites = calls.filter(([kind, key]) => kind === 'scope.set' && key === 'collapsedTodayGroups').map(([, , value]) => value);
assert(JSON.stringify(groupWrites[groupWrites.length - 1]) === JSON.stringify(['w:a']), `folding a project group must persist its identity key, got ${JSON.stringify(groupWrites)}`);
rowsP = renderToday(propsP, todayNoon);
const foldedHeader = groupOf(rowsP, 'Proj A');
assert(foldedHeader && !foldedHeader.props.className.includes('wcm-open'), 'the clicked project group must repaint folded immediately');
assert(collectIn(wrapOf(rowsP).el, 'wcm-session').length === 4, 'a folded group must still render its rows for the CSS transition');

/* P2: 「隐藏」= 从注册表里删掉这一条。 */
setHistoryList();
const hideScope = registryScope(registryBase);
hookState = [];
calls.length = 0;
let propsHide = propsFor(svcP, hideScope.bind);
let rowsHide = renderToday(propsHide, todayNoon);
assert(hideIn(rowsHide, 's-listed') !== undefined, 'every Current row must expose its hide button');
hideIn(rowsHide, 's-listed').props.onClick({ stopPropagation() {}, preventDefault() {} });
const afterHide = registryWrites().pop() ?? {};
assert(afterHide['s-listed'] === undefined, `hiding must delete the entry from the registry, got ${JSON.stringify(afterHide)}`);
assert(afterHide['s-viewed'] !== undefined && afterHide['s-running'] !== undefined, 'hiding one session must leave the other entries alone');
assert(afterHide['s-dead'] === undefined, 'a write must prune ids the snapshot no longer has');
rowsHide = renderToday(propsHide, todayNoon);
assert(!idsIn(wrapOf(rowsHide)).includes('s-listed'), 'the hidden row must repaint immediately, before the settings write lands');
assert(hideScope.target.currentSessions['s-listed'] === undefined, 'the persisted registry must lose the entry');

/* 还在跑/继续观测时它不会自己回来（没有新活动）——然后再对话一次（活动戳前进）就回来。 */
renderToday(propsHide, todayNoon);
assert(!idsIn(wrapOf(renderToday(propsHide, todayNoon))).includes('s-listed'), 'a hidden session must not come back while nothing changes');
setHistoryList({ 's-listed': { ...historyBase['s-listed'], updatedAt: dayAt(0, 14) } });
renderToday(propsHide, todayNoon);
const revived = registryWrites().pop() ?? {};
assert(revived['s-listed'] !== undefined, `talking to it again must re-register it, got ${JSON.stringify(revived)}`);
assert(idsIn(wrapOf(renderToday(propsHide, todayNoon))).includes('s-listed'), 'the re-registered row must be back');

/* 重新挂载（= 重启）：删掉的不会自己回来（换一个会话验证，保证观测是全新的）。 */
setHistoryList();
hideIn(renderToday(propsHide, todayNoon), 's-viewed').props.onClick({ stopPropagation() {}, preventDefault() {} });
hookState = [];
rowsHide = renderToday(propsFor(svcP, hideScope.bind), todayNoon);
assert(!idsIn(wrapOf(rowsHide)).includes('s-viewed'), 'a hidden session must stay gone after a restart');

/* 但树里仍然看得到它（隐藏只影响这一栏）。 */
const treeRows = rowsP.filter((row) => row.el.props['data-wcm-tree-session'] === 's-viewed');
assert(treeRows.length >= 1, 'hiding must not remove the session from the project tree');
/* P3: 登记是观测型副作用 —— 跑起来 / 新提示词 / 打开它，三种事件。 */
const autoScope = registryScope({});
hookState = [];
calls.length = 0;
setHistoryList();
let propsAuto = propsFor(svcP, autoScope.bind);
renderToday(propsAuto, todayNoon);
let wrote = registryWrites().pop() ?? {};
assert(JSON.stringify(Object.keys(wrote)) === JSON.stringify([]), `the first observation must register nothing at all, got ${JSON.stringify(Object.keys(wrote))}`);
assert(wrote['s-history'] === undefined && wrote['s-running'] === undefined, 'the first observation must not import history or sessions that were already running');
assert(wrote['s-blank-current'] === undefined, 'the first observation must not import history or sessions that were already running');
/* 打开一个没登记过的会话：只在那一栏看着，不许因此多出一条。 */
svcP.setList({ current: 's-history', ids: historyIds, byId: historyBase });
renderToday(propsAuto, todayNoon);
assert(registryWrites().pop() === undefined || !('s-history' in (registryWrites().pop() ?? {})), 'opening a session you never ran must not register it');
svcP.setList({ current: 's-blank-current', ids: historyIds, byId: historyBase });
renderToday(propsAuto, todayNoon);
/* 一个会话开始运行（running 由 false 变 true）→ 登记 */
svcP.setList({ current: 's-blank-current', ids: [...historyIds, 's-started'], byId: { ...historyBase, 's-started': session('s-started', { displayTitle: '刚跑起来', running: true, updatedAt: dayAt(0, 9), cwd: 'C:\\a' }) } });
renderToday(propsAuto, todayNoon);
wrote = registryWrites().pop() ?? {};
assert(wrote['s-started'] !== undefined, `a session that starts running must be registered, got ${JSON.stringify(Object.keys(wrote))}`);
assert(wrote['s-history'] === undefined, 'a session that only has history activity must stay unregistered');
/* 已经登记过的会话继续跑（没有跃迁）→ 不重复写 */
const writesBefore = registryWrites().length;
renderToday(propsAuto, todayNoon);
assert(registryWrites().length === writesBefore, 'a steady observation must not write the registry again');

/* 打开一个**已经登记过**的会话：不会新登记，但会刷新它的 viewedAt —— 也就是把
 * 「跑完了还没看」的加粗摘掉。这是「打开」在注册表里唯一的作用。 */
const viewScope = registryScope({ 's-listed': { at: dayAt(0, 12), viewedAt: 0 } });
hookState = [];
calls.length = 0;
svcP.setList({ current: null, ids: historyIds, byId: historyBase });
const propsView = propsFor(svcP, viewScope.bind);
let rowsView = renderToday(propsView, todayNoon);
assert(String(titleIn(rowsView, 's-listed').props.className).includes('wcm-unseen'), 'a finished session nobody opened is marked unseen');
svcP.setList({ current: 's-listed', ids: historyIds, byId: historyBase });
renderToday(propsView, todayNoon);
const viewed = registryWrites().pop() ?? {};
assert(viewed['s-listed'] !== undefined && viewed['s-listed'].viewedAt > 0, `opening a registered session must refresh viewedAt, got ${JSON.stringify(viewed)}`);
assert(JSON.stringify(Object.keys(viewed).sort()) === JSON.stringify(['s-listed']), 'opening must not touch any other entry');
assert(!String(titleIn(renderToday(propsView, todayNoon), 's-listed').props.className).includes('wcm-unseen'), 'the unseen mark must clear once you have looked at it');

/* P4: 隐藏一个「还在跑」的会话：它不会因为还在跑被重新登记（没有 running 跃迁）。 */
const stickyScope = registryScope({ 's-running': { at: dayAt(-1, 22), viewedAt: 0 } });
hookState = [];
calls.length = 0;
setHistoryList();
const propsSticky = propsFor(svcP, stickyScope.bind);
let rowsSticky = renderToday(propsSticky, todayNoon);
assert(idsIn(wrapOf(rowsSticky)).includes('s-running'), 'the running session must be listed');
hideIn(rowsSticky, 's-running').props.onClick({ stopPropagation() {}, preventDefault() {} });
rowsSticky = renderToday(propsSticky, todayNoon);
assert(!idsIn(wrapOf(rowsSticky)).includes('s-running'), 'hiding a running session must stick while it keeps running');
assert((registryWrites().pop() ?? {})['s-running'] === undefined, 'a running session with no new activity must not be re-registered');

/* 归档：归档过的会话即使登记过也不显示；光是渲染不写任何配置。 */
setHistoryList();
hookState = [];
calls.length = 0;
const rowsArchived = renderToday(propsFor(svcP, registryScope(registryBase).bind), todayNoon);
assert(!idsIn(wrapOf(rowsArchived)).includes('s-archived'), 'an archived session must never show, even when it is in the registry');
/* 渲染本身不改变成员：首个观测只会刷 viewedAt（记下「你现在看的是它」），成员集合不变。 */
const expectedKeys = Object.keys(registryBase).filter((id) => id !== 's-dead').sort();
assert(registryWrites().every((value) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expectedKeys)), 'a render may only refresh viewedAt, never membership');

/* P5: 空态 —— 未加载完时不许谎称「没有会话」。 */
hookState = [];
let rowsEmpty = renderToday(propsFor(svcP, registryScope({}).bind), todayNoon);
assert(textIn(wrapOf(rowsEmpty), 'wcm-folderCount')[0] === '0', 'an empty registry must count 0');
svcP.setList({ current: null, ids: [], byId: {}, phase: 'pending' });
hookState = [];
rowsEmpty = renderToday(propsFor(svcP, registryScope({}).bind), todayNoon);
assert(collectIn(wrapOf(rowsEmpty).el, 'wcm-todayEmpty').length === 0, 'an unloaded Session list must not claim there is nothing to show');

console.log('tests OK: built bundle — loader contract, modern/legacy/degradation, registrations, row icon slots, unified status dots, lazy uiWorkspace, context menus, pending-interaction warnings, session navigation + rename, Git import, restart-stable sidebar expansion, optimistic animated toggles, Current registry (auto-register / hide-deletes / unseen), suite settings migration');
