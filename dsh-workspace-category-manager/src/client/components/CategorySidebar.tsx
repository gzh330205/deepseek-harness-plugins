import React from 'react';
import { createElement as h } from 'react';
import { useScope, useWorkspaceSnapshot, useSessionsSnapshot, configOf, currentSessionId, repoNameFromUrl, joinDisplayPath, workspaceId, workspaceLabel, errText, closedCategories, closedTodayGroups, openWorkspaces, retainIds, persistExpansion, nextOverrideGeneration, startOfLocalDay, msUntilNextLocalDay, recentSessions, formatStamp, projectLabelOf, groupTodayRows, hiddenTodayOf, pruneHiddenToday } from '../utils.js';
import { COLLAPSED_CATEGORIES_FIELD, COLLAPSED_TODAY_GROUPS_FIELD, EXPANDED_WORKSPACES_FIELD, TODAY_FOLDER_ID, HIDDEN_TODAY_FIELD } from '../constants.js';
import { Dialog, CategoryForm } from './dialogs.jsx';
import { IconFolderClose16, IconFolderOpen16, IconTriangleRightFill14, IconPlusOutline16, IconPersonalizationOutline16, IconProjectAddOutline16, IconEllipsisOutline16, IconTrashOutline16, IconTagOutline16, IconClock16, IconEyeOffOutline16, IconLocate16, IconFoldAll16, IconUnfoldAll16 } from './icons.jsx';
import { StateDot } from './StateDot.jsx';
const EMPTY_STATUSES = new Map();
const useSessionStatuses = (api) => React.useSyncExternalStore(
  (listener) => { const source = api.sessionStatus(); return source === undefined ? () => {} : source.subscribe(listener); },
  () => api.sessionStatus()?.getSnapshot() ?? EMPTY_STATUSES,
  () => api.sessionStatus()?.getSnapshot() ?? EMPTY_STATUSES
);
const visiblePendingKind = (kind) => kind === 'approval' || kind === 'plan-review' || kind === 'question' ? kind : undefined;
/* One status language over both store generations:
 *   0.1.6+ uiSession.sessionStatus → { running, pendingInteraction, completionUnread }
 *   <=0.1.2 uiSession.pendingInteractions → { kind } (running/completed come from the list row)
 * A missing entry falls back to the list row, which still carries running/completed. */
const sessionStatusOf = (summary, statuses) => { const raw = statuses.get(summary.id); const pendingKind = visiblePendingKind(raw?.kind ?? raw?.pendingInteraction?.kind); const running = raw?.running ?? summary.running === true; const completed = raw?.completionUnread ?? summary.completed === true; return pendingKind !== undefined ? 'warning' : running ? 'running' : completed ? 'done' : undefined; };

    function CategorySidebar({ api, wide, expandSidebar, t, now }) {
            const scope = api.configForms; const snapshot = useScope(scope); const workspaceState = useWorkspaceSnapshot(api.workspacesList); const sessionState = useSessionsSnapshot(api.sessionsList); const config = configOf(scope); const [failure, setFailure] = React.useState(''); const [collapseOverrides, setCollapseOverrides] = React.useState({}); const [orderBy, setOrderBy] = React.useState('manual'); const [menuOpen, setMenuOpen] = React.useState(false); const [addError, setAddError] = React.useState(null); const [menuFor, setMenuFor] = React.useState(null); const [renameTarget, setRenameTarget] = React.useState(null); const [renameDraft, setRenameDraft] = React.useState(''); const [renameBusy, setRenameBusy] = React.useState(false); const [renameError, setRenameError] = React.useState(''); const [deleteTarget, setDeleteTarget] = React.useState(null); const [deleteBusy, setDeleteBusy] = React.useState(false); const [deleteError, setDeleteError] = React.useState(''); const [addCategoryOpen, setAddCategoryOpen] = React.useState(false); const [addOpen, setAddOpen] = React.useState(false); const [addDraft, setAddDraft] = React.useState({ mode: 'local', path: '', group: '', url: '', branch: '', folder: '', parent: '' }); const [addBusy, setAddBusy] = React.useState(false); const [addFormError, setAddFormError] = React.useState(''); const [addCloning, setAddCloning] = React.useState(false); const [gitAvailable, setGitAvailable] = React.useState(false); const [dissolveTarget, setDissolveTarget] = React.useState(null); const [dissolveBusy, setDissolveBusy] = React.useState(false); const [dissolveError, setDissolveError] = React.useState(''); const dragRef = React.useRef({ kind: null, id: null, el: null, over: null }); const pendingOverrides = React.useRef(new Map()); /* Bumped by the midnight/visibility effect so the Today window is recomputed while the app stays open. */ const [, setClockTick] = React.useState(0); /*「今天」的临时移除：id → 记录（隐藏）或 null（强制显示），Host 确认后自动退休。 */ const [hideOverrides, setHideOverrides] = React.useState({}); const [locateTarget, setLocateTarget] = React.useState(null);
      const list = workspaceState.items ?? []; const byId = sessionState.byId ?? {}; const currentId = currentSessionId(sessionState);
      const sessionStatuses = useSessionStatuses(api);
      const startSession = (workspace) => api.startSession(workspaceId(workspace));
      const openSession = (sessionId) => api.openSession(sessionId);
      /* Expansion is persisted in the plugin Config, not localStorage: DSH picks
       * a new loopback port on every launch, so localStorage is origin-scoped
       * and always empty at boot. See utils.js for the suppression-list model. */
      /* A click repaints from a local override immediately and only then writes
       * the field. Rendering straight from the Config would make every toggle
       * wait for the settings round trip (hundreds of ms, sometimes over a
       * second), which reads as "click, pause, jump". An override retires as soon
       * as a snapshot produced at or after its generation confirms it, so Host
       * state stays the source of truth and an override can never resurrect
       * something the Host dropped (a removed category, a deleted workspace). */
      const persistedCollapsed = closedCategories(config);
      const persistedWorkspaces = openWorkspaces(config);
      const persistedGroups = closedTodayGroups(config);
      const idsOfCategories = () => new Set([TODAY_FOLDER_ID, '__uncategorized__', ...config.categories.map((category) => category.id)]);
      const idsOfWorkspaces = () => new Set(list.map((workspace) => workspaceId(workspace)));
      const isCollapsed = (id) => { const entry = collapseOverrides[id]; return entry === undefined || entry.field !== COLLAPSED_CATEGORIES_FIELD ? persistedCollapsed.has(id) : entry.value; };
      const isWorkspaceOpen = (id) => { const entry = collapseOverrides[id]; return entry === undefined || entry.field !== EXPANDED_WORKSPACES_FIELD ? persistedWorkspaces.has(id) : entry.value; };
      /* ---------------- 今天（跨项目）----------------
       * `now` is the test seam: production passes nothing and reads the wall
       * clock on every render, tests pin the window instead of racing midnight.
       * The window is a local-day boundary, so it must come from a Date — a
       * `ts % 86400000` shortcut breaks on non-UTC offsets and on DST days. */
      const nowMs = typeof now === 'number' ? now : Date.now();
      const dayStart = startOfLocalDay(nowMs);
      const persistedHidden = hiddenTodayOf(config);
      /* 点「从今天隐藏」要立刻消失，不能等设置回写（几百 ms 到一秒），所以乐观值
       * 先行：id → 记录 = 现在隐藏，id → null = 现在强制显示（「恢复」用）。 */
      const mergedHidden = () => {
        const merged = { ...persistedHidden };
        Object.entries(hideOverrides).forEach(([id, override]) => { if (override === null) delete merged[id]; else merged[id] = override; });
        return merged;
      };
      const today = recentSessions(sessionState, { since: dayStart, currentId, archivedSessionIds: workspaceState.archivedSessionIds, hiddenToday: mergedHidden() });
      const todayRows = today.rows;
      const todayHidden = Object.keys(today.hidden).length;
      /* 项目名不再逐行重复，而是单独成组：分组标题可折叠，分组内仍按时间倒序；
       * 分组的 id 全集只在「今天」里出现过的项目，所以持久化的折叠列表不会残留。 */
      const todayGroups = groupTodayRows(todayRows, list);
      const idsOfTodayGroups = () => new Set(todayGroups.map((group) => group.key));
      const isGroupCollapsed = (key) => { const entry = collapseOverrides[key]; return entry === undefined || entry.field !== COLLAPSED_TODAY_GROUPS_FIELD ? persistedGroups.has(key) : entry.value; };
      const todayOpen = wide && !isCollapsed(TODAY_FOLDER_ID);
      /* 「定位」用的反查索引：会话 → 归属工作区。一次遍历建好，避免每行各扫一遍列表。 */
      const workspaceBySession = new Map();
      list.forEach((workspace) => (workspace.sessionIds ?? []).forEach((sessionId) => workspaceBySession.set(sessionId, workspaceId(workspace))));
      /* 乐观值一旦被 Host 快照确认就退休：隐藏值以「Host 的记录不旧于本地记录」为准，
       * 强制显示以「Host 已经没有这条记录」为准。失效的记录不会一直留着。 */
      React.useEffect(() => {
        const ids = Object.keys(hideOverrides);
        if (ids.length === 0) return;
        const survivor = {};
        for (const id of ids) {
          const override = hideOverrides[id];
          const stored = persistedHidden[id];
          const settled = override === null ? stored === undefined : stored !== undefined && stored.at >= override.at;
          if (!settled) survivor[id] = override;
        }
        if (Object.keys(survivor).length !== ids.length) setHideOverrides(survivor);
      });
      /* `phase: 'pending'` means no list pull has landed yet, so an empty member
       * set there is "nothing arrived", not "nothing today" — the hint waits for
       * the first accepted pull instead of claiming the day is empty. */
      const sessionsReady = sessionState.phase === undefined || sessionState.phase === 'ready';
      /* One collapse axis per field: its persisted suppression list and its live
       * id universe. Keeping both in one place means a new axis (今天的分组) rides
       * the same optimistic-override machinery instead of forking it. */
      const persistedOf = (field) => field === COLLAPSED_CATEGORIES_FIELD ? persistedCollapsed : field === EXPANDED_WORKSPACES_FIELD ? persistedWorkspaces : persistedGroups;
      const universeOf = (field) => field === COLLAPSED_CATEGORIES_FIELD ? idsOfCategories() : field === EXPANDED_WORKSPACES_FIELD ? idsOfWorkspaces() : idsOfTodayGroups();
      /* Mid-midnight rollover: one timer aligned to the next local midnight,
       * plus a visibility re-read, because a machine that slept through midnight
       * has its timer throttled and would otherwise keep showing yesterday. */
      React.useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        let timer = 0;
        const arm = () => { timer = setTimeout(() => { setClockTick((value) => value + 1); arm(); }, msUntilNextLocalDay(Date.now())); };
        const onVisible = () => { if (document.visibilityState === 'visible') setClockTick((value) => value + 1); };
        arm();
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
      }, []);
      /* An override is dropped once it is both settled (its write answered) and
       * confirmed by the snapshot, or once the id no longer exists — so the Host
       * stays the source of truth and a removed category/deleted workspace cannot
       * be resurrected by a stale local value. This is cleanup only: while it is
       * pending, the row must not fall back to the Config, or it would flicker
       * back to the old state between the click and the write. */
      React.useEffect(() => {
        const ids = Object.keys(collapseOverrides);
        if (ids.length === 0) return;
        const survivor = {};
        for (const id of ids) {
          const entry = collapseOverrides[id];
          const exists = universeOf(entry.field).has(id);
          const settled = !pendingOverrides.current.has(id);
          const confirmed = persistedOf(entry.field).has(id) === entry.value;
          if (exists && !(settled && confirmed)) survivor[id] = entry;
        }
        if (Object.keys(survivor).length !== ids.length) setCollapseOverrides(survivor);
      });
      /* While the settings form is still loading there is no persisted value at
       * all; rendering every category as expanded for that one tick would flash
       * the wrong layout, so the whole list waits for the first accepted section
       * (the stock browser gates on its own "workspaceReady" for the same
       * reason). A loaded section always carries both fields through the Host
       * defaults, so this cannot stall on a healthy deployment — and an
       * unavailable form leaves the list empty exactly as it was before. */
      const expansionReady = snapshot.value !== undefined;
      /* The next persisted value is built from the Config list plus every
       * override still in flight — a snapshot older than a queued write must not
       * undo it, and two quick clicks must not clobber each other. */
      const nextOverrides = (field) => { const known = new Set(persistedOf(field)); pendingOverrides.current.forEach((entry) => { if (entry.field !== field) return; if (entry.value) known.add(entry.id); else known.delete(entry.id); }); return known; };
      const toggle = (id, field, nextValue, existingIds) => {
        const generation = nextOverrideGeneration();
        pendingOverrides.current.set(id, { id, field, value: nextValue, generation });
        setCollapseOverrides((previous) => ({ ...previous, [id]: { generation, field, value: nextValue } }));
        const next = nextOverrides(field); if (nextValue) next.add(id); else next.delete(id);
        persistExpansion(scope, field, retainIds(next, existingIds())).then(() => { const entry = pendingOverrides.current.get(id); if (entry !== undefined && entry.generation === generation) pendingOverrides.current.delete(id); });
      };
      const toggleFolder = (id) => { toggle(id, COLLAPSED_CATEGORIES_FIELD, !isCollapsed(id), idsOfCategories); };
      const toggleProject = (id) => { toggle(id, EXPANDED_WORKSPACES_FIELD, !isWorkspaceOpen(id), idsOfWorkspaces); };
      const toggleTodayGroup = (key) => { toggle(key, COLLAPSED_TODAY_GROUPS_FIELD, !isGroupCollapsed(key), idsOfTodayGroups); };
      /* 「定位到会话」：把这个会话在左边的分类树里露出来 —— 展开它所属的分类与项目，
       * 再滚动到那一行并短暂高亮。展开走的是同一套乐观 + 落盘机制，所以点击当下就重绘。
       * 没被任何工作区记账的会话（工作区被删了）在树里没有行，按钮就不出现。 */
      const locateSession = (sessionId) => {
        const owner = workspaceBySession.get(sessionId);
        if (owner === undefined) return;
        const category = config.assignments[owner] ?? '__uncategorized__';
        if (isCollapsed(category)) toggle(category, COLLAPSED_CATEGORIES_FIELD, false, idsOfCategories);
        if (!isWorkspaceOpen(owner)) toggle(owner, EXPANDED_WORKSPACES_FIELD, true, idsOfWorkspaces);
        setLocateTarget({ id: sessionId, at: Date.now() });
      };
      /* 「定位到会话」的滚动有两个坑：① 会话行外面套着一层 `overflow:hidden` 的展开面板
       * （它自己也算一个 scrollport），scrollIntoView 会把它当目标；② 「当前」列表里的行
       * 与树里的行是同一份渲染，若共用一个定位属性，querySelector 会命中先出现的「当前」
       * 行（它本来就在视野里），滚动就成了空操作。所以锚点只打在树里的行上，并直接用真正
       * 的滚动容器算偏移；再叠一次延时校正，因为展开那 180ms 里行还没落到最终位置。 */
      const revealLocated = (sessionId) => {
        if (typeof document === 'undefined') return;
        const target = document.querySelector(`[data-wcm-tree-session="${sessionId}"]`);
        if (target === null) return;
        const scroller = target.closest('.wcm-folders');
        if (scroller === null) { if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' }); return; }
        const row = target.getBoundingClientRect(); const box = scroller.getBoundingClientRect(); const margin = 8;
        if (row.top < box.top + margin) scroller.scrollTop += row.top - (box.top + margin);
        else if (row.bottom > box.bottom - margin) scroller.scrollTop += row.bottom - (box.bottom - margin);
      };
      React.useEffect(() => {
        if (locateTarget === null || typeof document === 'undefined') return undefined;
        const id = locateTarget.id;
        const first = setTimeout(() => revealLocated(id), 30);
        const settle = setTimeout(() => revealLocated(id), 260);
        const expire = setTimeout(() => setLocateTarget(null), 2200);
        return () => { clearTimeout(first); clearTimeout(settle); clearTimeout(expire); };
      }, [locateTarget]);
      /* 「从今天隐藏」是临时移除，不是排除名单：记录里带着移除那一刻的活动戳，
       * 只有**重新跟这个会话对话**（updatedAt 前进）才会让它失效、行自己回来 ——
       * 没有恢复按钮，也没有定时器；写入前先剪枝，字段只保留还有效的条目。 */
      const hideFromToday = (row) => {
        const record = { at: Date.now(), updatedAt: row.at };
        setHideOverrides((previous) => ({ ...previous, [row.id]: record }));
        const merged = { ...mergedHidden(), [row.id]: record };
        scope.set(HIDDEN_TODAY_FIELD, pruneHiddenToday(merged, sessionState)).catch((reason) => { setFailure(errText(reason)); });
      };
      const sessionsOf = (workspace) => { const archived = new Set(workspaceState.archivedSessionIds ?? []); return (workspace.sessionIds ?? []).map((id) => byId[id]).filter((summary) => summary !== undefined && summary.origin !== 'subagent' && !archived.has(summary.id) && (!summary.blank || summary.id === currentId)); };
      const runningOf = (workspace) => (workspace.sessionIds ?? []).some((id) => byId[id]?.running === true);
      /* Unified status language across the three levels:
       * - session row:  running → chase animation; done → green dot; warning → amber dot
       * - project row:  aggregated over its sessions (no animation): warning > running > done
       * - category row: aggregated over its projects: warning > running > done
       * Dots are static markers — the chase animation only ever appears on session rows. */
      /* One precedence for every aggregate row (category / project / today):
       * warning > running > done, and no marker at all for an empty set. */
      const aggregateStatus = (statuses) => { const known = statuses.filter((status) => status !== undefined); if (known.length === 0) return undefined; if (known.includes('warning')) return 'warning'; if (known.includes('running')) return 'running'; return 'done'; };
      const statusOfWorkspace = (workspace) => aggregateStatus(sessionsOf(workspace).map((summary) => sessionStatusOf(summary, sessionStatuses)));
      const statusOfCategory = (f) => aggregateStatus(f.projects.map(statusOfWorkspace));
      const statusDot = (status) => status !== undefined ? h('span', { className: `wcm-wsDot wcm-ws-${status}` }) : null;
      const sessionStatusDot = (status) => status === 'running' ? h(StateDot, { state: 'ongoing' }) : statusDot(status);
      /* Category/project rows: the icon stays and carries a corner badge (blue = running,
       * amber = needs attention, green = finished-unread) — same halo effect as session dots. */
      const statusIconSlot = (status, icon) => h('span', { className: 'wcm-rowIconSlot' }, h('span', { className: 'wcm-rowIcon' }, icon), h('span', { className: 'wcm-rowChevron' }, h(IconTriangleRightFill14)), status !== undefined ? h('span', { className: `wcm-wsDot wcm-wsBadge wcm-ws-${status}` }) : null);
      const latestUpdatedAt = (workspace) => (workspace.sessionIds ?? []).reduce((max, id) => { const summary = byId[id]; const updated = summary !== undefined && typeof summary.updatedAt === 'number' ? summary.updatedAt : 0; return updated > max ? updated : max; }, 0);
      const assignmentOf = (wid) => config.assignments[wid];
      const projectsOf = (catId) => list.filter((workspace) => assignmentOf(workspaceId(workspace)) === catId);
      const orderProjects = (projects) => orderBy === 'updated' ? [...projects].sort((a, b) => latestUpdatedAt(b) - latestUpdatedAt(a)) : projects;
      const folders = config.categories.map((category) => ({ id: category.id, name: category.name, color: category.color, projects: orderProjects(projectsOf(category.id)) })).concat({ id: '__uncategorized__', name: t('uncategorized'), color: '#94a3b8', projects: orderProjects(projectsOf(undefined)) });
      /* 一键「全部收起 / 全部展开」：作用于分类和项目**自身**的展开状态，复用既有的两个
       * 抑制/允许列表（不新增字段）。做法是给每个 id 立一个乐观值（点击当下就重绘），两个
       * 字段各写一次；写盘沿用同一套修剪，所以「当前」分组的折叠位不会被动到 —— 它不在
       * folders 里，只是被 nextOverrides 原样带过去。 */
      const applyExpansion = (changes) => {
        if (changes.length === 0) return;
        const generations = new Map(); const patched = {};
        changes.forEach(({ id, field, value }) => { const generation = nextOverrideGeneration(); generations.set(id, generation); pendingOverrides.current.set(id, { id, field, value, generation }); patched[id] = { generation, field, value }; });
        setCollapseOverrides((previous) => ({ ...previous, ...patched }));
        for (const field of new Set(changes.map((change) => change.field))) {
          persistExpansion(scope, field, retainIds(nextOverrides(field), universeOf(field))).then(() => { generations.forEach((generation, id) => { const entry = pendingOverrides.current.get(id); if (entry !== undefined && entry.generation === generation) pendingOverrides.current.delete(id); }); });
        }
      };
      const anyExpanded = folders.some((folder) => !isCollapsed(folder.id)) || list.some((workspace) => isWorkspaceOpen(workspaceId(workspace)));
      const foldAll = () => {
        const changes = [];
        folders.forEach((folder) => changes.push({ id: folder.id, field: COLLAPSED_CATEGORIES_FIELD, value: anyExpanded }));
        list.forEach((workspace) => changes.push({ id: workspaceId(workspace), field: EXPANDED_WORKSPACES_FIELD, value: !anyExpanded }));
        applyExpansion(changes);
      };
      const openAddWorkspace = () => { setAddDraft({ mode: 'local', path: '', group: config.categories[0]?.id ?? '', url: '', branch: '', folder: '', parent: '' }); setAddFormError(''); setAddError(null); setAddCloning(false); setAddOpen(true); /* Probe the Host Git import capability so the tab only appears when usable. */ api.gitImportStatus().then((status) => { setGitAvailable(status.available === true); }).catch(() => { setGitAvailable(false); }); };
      const browseDirectory = async (field) => { if (addBusy) return; setAddBusy(true); setAddFormError(''); try { const path = await api.pickDirectory(); if (typeof path === 'string' && path !== '') setAddDraft((draft) => ({ ...draft, [field]: path })); } catch (error) { setAddFormError(errText(error)); } finally { setAddBusy(false); } };
      const saveAddWorkspace = async () => { if (addBusy) return; setAddBusy(true); setAddFormError(''); try { let path = addDraft.path.trim(); if (addDraft.mode === 'git') { const url = addDraft.url.trim(); if (url === '') throw new Error(t('gitUrlRequired')); const parent = addDraft.parent.trim(); if (parent === '') throw new Error(t('gitParentRequired')); setAddCloning(true); path = await api.cloneRepository({ url, parentPath: parent, folderName: addDraft.folder.trim(), branch: addDraft.branch.trim() }); } else if (path === '') { return; } const workspace = await api.createWorkspace({ path }); const wid = workspaceId(workspace); const assignments = { ...config.assignments }; const group = addDraft.group; if (group === '' || group === '__uncategorized__') delete assignments[wid]; else assignments[wid] = group; await scope.set('assignments', assignments); setAddOpen(false); api.startSession(wid); } catch (error) { setAddFormError(errText(error)); } finally { setAddCloning(false); setAddBusy(false); } };
      const rowHalf = (event) => { const rect = event.currentTarget.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'; };
      const commitDrop = (activeId, targetId, half) => { if (activeId === null || activeId === targetId) return; const index = list.findIndex((workspace) => workspaceId(workspace) === targetId); if (index === -1) return; const anchor = half === 'before' ? targetId : list[index + 1]?.workspaceId; if (anchor === activeId) return; const sourceIndex = list.findIndex((workspace) => workspaceId(workspace) === activeId); const anchorIndex = anchor === undefined ? list.length : list.findIndex((workspace) => workspaceId(workspace) === anchor); if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return; const targetCat = assignmentOf(targetId); const activeCat = assignmentOf(activeId); if (targetCat !== activeCat) { const assignments = { ...config.assignments }; if (targetCat === undefined) delete assignments[activeId]; else assignments[activeId] = targetCat; scope.set('assignments', assignments).catch((reason) => { setFailure(errText(reason)); }); } api.insertWorkspaceBefore(activeId, anchor).catch((reason) => { setFailure(reason instanceof Error ? reason.message : String(reason)); }); };
      const commitFolderDrop = (activeId, targetId, half) => { if (activeId === targetId) return; const cats = config.categories; const index = cats.findIndex((category) => category.id === targetId); if (index === -1) return; const anchor = half === 'before' ? targetId : cats[index + 1]?.id; if (anchor === activeId) return; const sourceIndex = cats.findIndex((category) => category.id === activeId); const anchorIndex = anchor === undefined ? cats.length : cats.findIndex((category) => category.id === anchor); if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return; const next = cats.filter((category) => category.id !== activeId); const insertAt = anchor === undefined ? next.length : next.findIndex((category) => category.id === anchor); next.splice(insertAt === -1 ? next.length : insertAt, 0, cats[sourceIndex]); scope.set('categories', next).catch((reason) => { setFailure(errText(reason)); }); };
      const commitAssign = (projectId, folderId) => { if (folderId === '__uncategorized__') { if (config.assignments[projectId] === undefined) return; const assignments = { ...config.assignments }; delete assignments[projectId]; scope.set('assignments', assignments).catch((reason) => { setFailure(errText(reason)); }); } else { if (config.assignments[projectId] === folderId) return; const assignments = { ...config.assignments, [projectId]: folderId }; scope.set('assignments', assignments).catch((reason) => { setFailure(errText(reason)); }); } };
      const clearDrag = () => { const s = dragRef.current; if (s.over !== null) s.over.el.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); if (s.el !== null) s.el.classList.remove('wcm-dragging'); dragRef.current = { kind: null, id: null, el: null, over: null }; };
      const dragStart = (kind, id) => (event) => { dragRef.current = { kind, id, el: event.currentTarget, over: null }; if (event.dataTransfer !== undefined) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); } event.currentTarget.classList.add('wcm-dragging'); };
      const dragOverFolder = (folderId) => (event) => { const s = dragRef.current; if (s.id === null || (s.kind === 'folder' && (s.id === folderId || folderId === '__uncategorized__'))) return; event.preventDefault(); if (event.dataTransfer !== undefined) event.dataTransfer.dropEffect = 'move'; if (s.kind === 'folder') { if (s.over !== null && s.over.el !== event.currentTarget) s.over.el.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); event.currentTarget.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); const half = rowHalf(event); event.currentTarget.classList.add(half === 'before' ? 'wcm-dropBefore' : 'wcm-dropAfter'); s.over = { el: event.currentTarget, half }; } else { if (s.over !== null && s.over.el !== event.currentTarget) s.over.el.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); event.currentTarget.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); event.currentTarget.classList.add('wcm-dropInto'); s.over = { el: event.currentTarget, half: null }; } };
      const dropOnFolder = (folderId) => (event) => { event.preventDefault(); const s = dragRef.current; if (s.kind === 'folder') { if (folderId !== '__uncategorized__') commitFolderDrop(s.id, folderId, rowHalf(event)); } else commitAssign(s.id, folderId); clearDrag(); };
      const dragOverProject = (id) => (event) => { const s = dragRef.current; if (s.kind !== 'project' || s.id === null || s.id === id) return; event.preventDefault(); if (event.dataTransfer !== undefined) event.dataTransfer.dropEffect = 'move'; const half = rowHalf(event); if (s.over !== null && s.over.el !== event.currentTarget) s.over.el.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); event.currentTarget.classList.remove('wcm-dropBefore', 'wcm-dropAfter', 'wcm-dropInto'); event.currentTarget.classList.add(half === 'before' ? 'wcm-dropBefore' : 'wcm-dropAfter'); s.over = { el: event.currentTarget, half }; };
      const dropOnProject = (id) => (event) => { event.preventDefault(); commitDrop(dragRef.current.id, id, rowHalf(event)); clearDrag(); };
      const dragEnd = () => { clearDrag(); };
      const closeMenus = () => { setMenuFor(null); setMenuOpen(false); };
      /* Project menus are opened from the category tree only: the「当前」group headers
       * deliberately carry no project actions. */
      const openMenuAt = (kind, id, event) => { event.preventDefault(); event.stopPropagation(); setMenuFor({ kind, id, x: event.clientX, y: event.clientY }); };
      const confirmRename = async () => { if (renameTarget === null || renameBusy) return; const title = renameDraft.trim(); if (title === '') return; setRenameBusy(true); setRenameError(''); try { if (renameTarget.kind === 'workspace') await api.renameWorkspace(renameTarget.id, title); else await api.renameSession(renameTarget.id, title); setRenameTarget(null); } catch (error) { setRenameError(errText(error)); } finally { setRenameBusy(false); } };
      const confirmDelete = async () => { if (deleteTarget === null || deleteBusy) return; setDeleteBusy(true); setDeleteError(''); try { await api.deleteWorkspace(deleteTarget.id); setDeleteTarget(null); } catch (error) { setDeleteError(errText(error)); } finally { setDeleteBusy(false); } };
      const confirmDissolve = async () => { if (dissolveTarget === null || dissolveBusy) return; setDissolveBusy(true); setDissolveError(''); try { const assignments = { ...config.assignments }; Object.keys(assignments).forEach((wid) => { if (assignments[wid] === dissolveTarget.id) delete assignments[wid]; }); await scope.set('assignments', assignments); await scope.set('categories', config.categories.filter((category) => category.id !== dissolveTarget.id)); setDissolveTarget(null); } catch (error) { setDissolveError(errText(error)); } finally { setDissolveBusy(false); } };
      /* Both actions are owned by uiWorkspace on 0.1.6+; a rejection must land in
       * the sidebar instead of vanishing, or the row looks like a dead click. */
      const forkSession = (sessionId) => { const started = api.forkSession(sessionId); if (started !== undefined && started !== null) Promise.resolve(started).catch((reason) => { setFailure(errText(reason)); }); };
      const archiveSession = (sessionId) => { api.archiveSession(sessionId).catch((reason) => { setFailure(errText(reason)); }); };
      const menuItem = (label, danger, onPick) => h('button', { className: `wcm-menuItem${danger ? ' wcm-menuDanger' : ''}`, onClick: () => { closeMenus(); onPick(); } }, h('span', { className: 'wcm-menuText' }, label));
      const popover = (...items) => [h('div', { className: 'wcm-menuMask', key: 'mask', onClick: closeMenus }), h('div', { className: 'wcm-menu wcm-menuCompact', key: 'menu' }, ...items)];
      const popoverAt = (x, y, ...items) => [h('div', { className: 'wcm-menuMask', key: 'mask', onClick: closeMenus }), h('div', { className: 'wcm-menu wcm-menuCompact wcm-menuFixed', key: 'menu', style: { left: x, top: y } }, ...items)];
      /* One definition of the project menu: right-clicking the project row and the
       *「当前」group header's locate button must offer exactly the same actions. */
      const workspaceMenuItems = (id, label) => [menuItem(t('rename'), false, () => { setRenameTarget({ kind: 'workspace', id, title: label }); setRenameDraft(label); setRenameError(''); }), menuItem(t('deleteWorkspace'), true, () => setDeleteTarget({ id, label }))];
      const sessionRow = (summary, extras) => { const opts = extras ?? {}; const status = sessionStatusOf(summary, sessionStatuses); const showStatus = status !== undefined; const title = summary.blank ? t('newSession') : summary.displayTitle ?? summary.title ?? summary.id; const openIt = () => { openSession(summary.id); }; const sessMenuOpen = menuFor !== null && menuFor.kind === 'session' && menuFor.id === summary.id; return h('div', { className: `wcm-session${summary.id === currentId ? ' wcm-current' : ''}${opts.highlight === true ? ' wcm-locateHit' : ''}`, key: summary.id, role: 'button', tabIndex: 0, ...(opts.anchor === true ? { 'data-wcm-tree-session': summary.id } : {}), title: opts.tooltip ?? summary.cwd, onClick: (event) => { event.stopPropagation(); openIt(); }, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openIt(); } }, onContextMenu: (event) => openMenuAt('session', summary.id, event) }, h('span', { className: 'wcm-sessionStatus' }, showStatus ? sessionStatusDot(status) : null), ...(opts.leading ?? []), h('span', { className: 'wcm-sessionTitle' }, title), ...(opts.trailing ?? []), sessMenuOpen ? popoverAt(menuFor.x, menuFor.y, menuItem(t('rename'), false, () => { setRenameTarget({ kind: 'session', id: summary.id, title }); setRenameDraft(title); setRenameError(''); }), menuItem(t('fork'), false, () => forkSession(summary.id)), menuItem(t('archive'), false, () => archiveSession(summary.id))) : null); };
            const project = (workspace) => { const id = workspaceId(workspace); const rows = sessionsOf(workspace); const expanded = wide && isWorkspaceOpen(id); const wsStatus = statusOfWorkspace(workspace); const label = workspaceLabel(workspace); const act = () => { if (wide) toggleProject(id); else startSession(workspace); }; const wsMenuOpen = menuFor !== null && menuFor.kind === 'workspace' && menuFor.id === id; return h('div', { className: `wcm-projectRow${expanded ? ' wcm-open' : ''}`, key: id, draggable: wide, title: workspace.path, role: 'button', tabIndex: 0, onClick: act, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); act(); } }, onDragStart: wide ? dragStart('project', id) : undefined, onDragOver: wide ? dragOverProject(id) : undefined, onDrop: wide ? dropOnProject(id) : undefined, onDragEnd: wide ? dragEnd : undefined, onContextMenu: wide ? (event) => openMenuAt('workspace', id, event) : undefined }, h('div', { className: 'wcm-projectLine' }, statusIconSlot(wsStatus, expanded ? h(IconFolderOpen16) : h(IconFolderClose16)), h('span', { className: 'wcm-projectLabel' }, label), wide ? h('button', { className: 'wcm-projectAdd', title: t('newSession'), onClick: (event) => { event.stopPropagation(); startSession(workspace); } }, h(IconPlusOutline16)) : null), wsMenuOpen ? popoverAt(menuFor.x, menuFor.y, ...workspaceMenuItems(id, label)) : null, h('div', { className: `wcm-sessions${expanded ? '' : ' wcm-closed'}` }, h('div', { className: 'wcm-sessionsInner' }, rows.map((summary) => sessionRow(summary, { anchor: true, highlight: locateTarget !== null && locateTarget.id === summary.id }))))); };
      const folder = (f) => { const isUncategorized = f.id === '__uncategorized__'; const open = wide && !isCollapsed(f.id); const status = statusOfCategory(f); const onToggle = () => { if (wide) toggleFolder(f.id); else if (expandSidebar !== undefined) expandSidebar(); }; return h('div', { className: 'wcm-folderWrap', key: f.id }, h('div', { className: `wcm-folderRow${open ? ' wcm-open' : ''}`, draggable: wide && !isUncategorized, role: 'button', tabIndex: 0, title: f.name, onClick: onToggle, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(); } }, onDragStart: wide && !isUncategorized ? dragStart('folder', f.id) : undefined, onDragOver: wide ? dragOverFolder(f.id) : undefined, onDrop: wide ? dropOnFolder(f.id) : undefined, onDragEnd: wide ? dragEnd : undefined, onContextMenu: wide && !isUncategorized ? (event) => openMenuAt('folder', f.id, event) : undefined }, statusIconSlot(status, h('span', { className: 'wcm-rowIcon wcm-rowIconCategory', style: { color: f.color } }, h(IconTagOutline16))), h('span', { className: 'wcm-folderLabel' }, f.name), h('span', { className: 'wcm-folderCount' }, f.projects.length), menuFor !== null && menuFor.kind === 'folder' && menuFor.id === f.id ? popoverAt(menuFor.x, menuFor.y, menuItem(t('dissolveCategory'), true, () => setDissolveTarget({ id: f.id, name: f.name }))) : null), h('div', { className: `wcm-folderProjects${open ? '' : ' wcm-closed'}` }, h('div', { className: 'wcm-folderProjectsInner' }, f.projects.map(project)))); };
      /* 「今天」is a view over the same Sessions, not a category: it renders
       * outside the `folders` array so category ordering, drag/drop and dissolve
       * keep operating on real categories only. */
      const todayNode = h('div', { className: 'wcm-folderWrap', key: TODAY_FOLDER_ID },
        h('div', { className: `wcm-folderRow wcm-todayRow${todayOpen ? ' wcm-open' : ''}`, role: 'button', tabIndex: 0, title: t('today'), onClick: () => { if (wide) toggleFolder(TODAY_FOLDER_ID); else if (expandSidebar !== undefined) expandSidebar(); }, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (wide) toggleFolder(TODAY_FOLDER_ID); else if (expandSidebar !== undefined) expandSidebar(); } } },
          statusIconSlot(aggregateStatus(todayRows.map((row) => sessionStatusOf(row.summary, sessionStatuses))), h(IconClock16)),
          h('span', { className: 'wcm-folderLabel' }, t('today')),
          h('span', { className: 'wcm-folderCount' }, todayRows.length)),
        h('div', { className: `wcm-sessions${todayOpen ? '' : ' wcm-closed'}` },
          h('div', { className: 'wcm-sessionsInner' }, todayRows.length > 0
            ? todayGroups.map((group) => { const open = wide && !isGroupCollapsed(group.key); const label = group.label === '' ? t('uncategorized') : group.label; return h('div', { className: 'wcm-todayGroupWrap', key: group.key }, h('button', { className: `wcm-todayGroup${open ? ' wcm-open' : ''}`, type: 'button', title: `${label} · ${group.rows.length}`, 'aria-expanded': open, onClick: (event) => { event.stopPropagation(); toggleTodayGroup(group.key); } }, h('span', { className: 'wcm-todayGroupCaret' }, h(IconTriangleRightFill14)), h('span', { className: 'wcm-todayGroupLabel' }, label), h('span', { className: 'wcm-todayGroupCount' }, group.rows.length)), h('div', { className: `wcm-todayGroupRows${open ? '' : ' wcm-closed'}` }, group.rows.map((row) => { const rowLabel = projectLabelOf(row.summary.cwd, list); const tooltip = rowLabel === '' ? row.summary.cwd : `${rowLabel} · ${row.summary.cwd ?? ''}${row.fresh ? '' : ` · ${t('todayOvernight')}`}`; return sessionRow(row.summary, { tooltip, leading: [h('span', { className: 'wcm-todayTime', key: 'time' }, formatStamp(row.at, dayStart))], trailing: [wide && workspaceBySession.has(row.id) ? h('button', { className: 'wcm-sessionLocate', key: 'locate', type: 'button', title: t('locateSession'), 'aria-label': t('locateSession'), onClick: (event) => { event.stopPropagation(); locateSession(row.id); } }, h(IconLocate16)) : null, wide ? h('button', { className: 'wcm-todayHide', key: 'hide', type: 'button', title: t('todayHide'), 'aria-label': t('todayHide'), onClick: (event) => { event.stopPropagation(); hideFromToday(row); } }, h(IconEyeOffOutline16)) : null] }); }))); })
            : sessionsReady && todayHidden === 0 ? h('p', { className: 'wcm-todayEmpty', key: 'today-empty' }, t('todayEmpty')) : null)));
      const folderTree = expansionReady ? h('div', { className: 'wcm-folders' }, todayNode, folders.map(folder)) : null;
      const sortItem = (mode, label) => h('button', { className: `wcm-menuItem${orderBy === mode ? ' wcm-menuItemOn' : ''}`, onClick: () => { setOrderBy(mode); setMenuOpen(false); } }, h('span', { className: 'wcm-menuText' }, label), orderBy === mode ? h('span', { className: 'wcm-menuCheck' }, '✓') : null);
      const headerActions = h('div', { className: 'wcm-sidebarActions' }, h('button', { className: 'wcm-iconBtn', title: t('viewOptions'), 'aria-label': t('viewOptions'), onClick: () => { setMenuFor(null); setMenuOpen((value) => !value); } }, h(IconPersonalizationOutline16)), h('button', { className: 'wcm-iconBtn', title: anyExpanded ? t('foldAll') : t('unfoldAll'), 'aria-label': anyExpanded ? t('foldAll') : t('unfoldAll'), 'aria-expanded': anyExpanded, onClick: foldAll }, h(anyExpanded ? IconFoldAll16 : IconUnfoldAll16)), h('button', { className: 'wcm-iconBtn', title: t('addCategory'), 'aria-label': t('addCategory'), onClick: () => setAddCategoryOpen(true) }, h(IconPlusOutline16)), api.canPickDirectory() ? h('button', { className: 'wcm-iconBtn', title: t('addWorkspace'), 'aria-label': t('addWorkspace'), onClick: openAddWorkspace }, h(IconProjectAddOutline16)) : null, menuOpen ? h('div', { className: 'wcm-menuWrap' }, h('div', { className: 'wcm-menuMask', onClick: () => setMenuOpen(false) }), h('div', { className: 'wcm-menu' }, h('div', { className: 'wcm-menuLabel' }, t('orderByLabel')), sortItem('manual', t('orderManual')), sortItem('updated', t('orderUpdated')))) : null);
      const errorDialog = addError ? h(Dialog, { title: t('addWorkspaceError'), close: () => setAddError(null) }, h('p', { className: 'wcm-muted' }, addError), h('div', { className: 'wcm-actions' }, h('button', { onClick: () => setAddError(null) }, t('close')), h('button', { className: 'wcm-primary', onClick: () => { setAddError(null); openAddWorkspace(); } }, t('retry')))) : null;
      const renameDialog = renameTarget !== null ? h(Dialog, { title: renameTarget.kind === 'workspace' ? t('renameWorkspaceTitle') : t('renameSessionTitle'), close: () => { if (!renameBusy) setRenameTarget(null); } }, h('input', { className: 'wcm-renameInput', value: renameDraft, disabled: renameBusy, placeholder: t('rename'), onChange: (event) => setRenameDraft(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') confirmRename(); } }), renameError !== '' ? h('p', { className: 'wcm-error' }, renameError) : null, h('div', { className: 'wcm-actions' }, h('button', { onClick: () => setRenameTarget(null), disabled: renameBusy }, t('cancel')), h('button', { className: 'wcm-primary', onClick: confirmRename, disabled: renameBusy || renameDraft.trim() === '' }, t('save')))) : null;
      const deleteDialog = deleteTarget !== null ? h(Dialog, { title: t('deleteWorkspace'), close: () => { if (!deleteBusy) setDeleteTarget(null); } }, h('p', { className: 'wcm-muted' }, t('deleteWorkspaceText', { name: deleteTarget.label })), deleteError !== '' ? h('p', { className: 'wcm-error' }, deleteError) : null, h('div', { className: 'wcm-actions' }, h('button', { onClick: () => setDeleteTarget(null), disabled: deleteBusy }, t('cancel')), h('button', { className: 'wcm-danger', onClick: confirmDelete, disabled: deleteBusy }, t('confirm')))) : null;
      const dissolveDialog = dissolveTarget !== null ? h(Dialog, { title: t('dissolveCategory'), close: () => { if (!dissolveBusy) setDissolveTarget(null); } }, h('p', { className: 'wcm-muted' }, t('dissolveCategoryText', { name: dissolveTarget.name })), dissolveError !== '' ? h('p', { className: 'wcm-error' }, dissolveError) : null, h('div', { className: 'wcm-actions' }, h('button', { onClick: () => setDissolveTarget(null), disabled: dissolveBusy }, t('cancel')), h('button', { className: 'wcm-danger', onClick: confirmDissolve, disabled: dissolveBusy }, t('confirm')))) : null;
      const addCategoryDialog = addCategoryOpen ? h(Dialog, { title: t('addCategory'), close: () => setAddCategoryOpen(false) }, h(CategoryForm, { initial: { id: '', name: '', color: '#4f8cff' }, lockedId: false, cancel: () => setAddCategoryOpen(false), save: (category) => { if (config.categories.some((item) => item.id === category.id)) { setFailure(t('categoryIdExists')); return; } scope.set('categories', [...config.categories, category]).catch((reason) => { setFailure(errText(reason)); }); setAddCategoryOpen(false); } })) : null;
      const modeTab = (mode, label) => h('button', { type: 'button', className: `wcm-modeTab${addDraft.mode === mode ? ' wcm-modeTabOn' : ''}`, disabled: addBusy, onClick: () => { setAddDraft((draft) => ({ ...draft, mode })); setAddFormError(''); } }, label);
      const groupField = h('label', { className: 'wcm-form-field' }, t('chooseGroup'), h('select', { className: 'wcm-select wcm-selectFull', value: addDraft.group, disabled: addBusy, onChange: (event) => setAddDraft((draft) => ({ ...draft, group: event.target.value })) }, config.categories.map((category) => h('option', { key: category.id, value: category.id }, category.name)), h('option', { value: '' }, t('uncategorized'))));
      const localFields = [h('label', { className: 'wcm-form-field', key: 'dir' }, t('chooseDirectory'), h('div', { className: 'wcm-dirRow' }, h('input', { className: 'wcm-dirInput wcm-localPath', value: addDraft.path, readOnly: true, placeholder: t('directoryPlaceholder') }), h('button', { type: 'button', disabled: addBusy, onClick: () => browseDirectory('path') }, t('browse'))))];
      /* Preview only: the Host derives the authoritative folder name when the field is empty. */
      const gitFolderName = addDraft.folder.trim() !== '' ? addDraft.folder.trim() : repoNameFromUrl(addDraft.url);
      const gitTarget = addDraft.parent.trim() !== '' && gitFolderName !== '' ? joinDisplayPath(addDraft.parent.trim(), gitFolderName) : '';
      const gitFields = [h('label', { className: 'wcm-form-field', key: 'url' }, t('gitUrl'), h('input', { className: 'wcm-textInput wcm-gitUrl', value: addDraft.url, disabled: addBusy, placeholder: t('gitUrlPlaceholder'), spellCheck: false, onChange: (event) => setAddDraft((draft) => ({ ...draft, url: event.target.value })) })), h('div', { className: 'wcm-formFieldRow', key: 'row' }, h('label', { className: 'wcm-form-field' }, t('gitBranch'), h('input', { className: 'wcm-textInput wcm-gitBranch', value: addDraft.branch, disabled: addBusy, placeholder: t('gitBranchPlaceholder'), spellCheck: false, onChange: (event) => setAddDraft((draft) => ({ ...draft, branch: event.target.value })) })), h('label', { className: 'wcm-form-field' }, t('gitFolder'), h('input', { className: 'wcm-textInput wcm-gitFolder', value: addDraft.folder, disabled: addBusy, placeholder: t('gitFolderPlaceholder'), spellCheck: false, onChange: (event) => setAddDraft((draft) => ({ ...draft, folder: event.target.value })) }))), h('label', { className: 'wcm-form-field', key: 'parent' }, t('gitParent'), h('div', { className: 'wcm-dirRow' }, h('input', { className: 'wcm-dirInput wcm-gitParent', value: addDraft.parent, readOnly: true, placeholder: t('gitParentPlaceholder') }), h('button', { type: 'button', disabled: addBusy, onClick: () => browseDirectory('parent') }, t('browse')))), addDraft.url.trim() !== '' && gitFolderName === '' ? h('p', { className: 'wcm-hint', key: 'folderHint' }, t('gitFolderHint')) : null, gitTarget !== '' ? h('p', { className: 'wcm-hint', key: 'target' }, t('gitTargetHint', { path: gitTarget })) : null];
      const addReady = !addBusy && (addDraft.mode === 'git' ? addDraft.url.trim() !== '' && addDraft.parent.trim() !== '' : addDraft.path.trim() !== '');
      const addWorkspaceDialog = addOpen ? h(Dialog, { title: t('addWorkspace'), close: () => { if (!addBusy) setAddOpen(false); } }, gitAvailable ? h('div', { className: 'wcm-modeTabs' }, modeTab('local', t('addLocal')), modeTab('git', t('addFromGit'))) : null, groupField, ...(addDraft.mode === 'git' ? gitFields : localFields), addFormError !== '' ? h('p', { className: 'wcm-error' }, addFormError) : null, addCloning ? h('p', { className: 'wcm-hint wcm-cloning' }, t('gitCloning')) : null, h('div', { className: 'wcm-gap' }), h('div', { className: 'wcm-actions' }, h('button', { disabled: addBusy, onClick: () => setAddOpen(false) }, t('cancel')), h('button', { className: 'wcm-primary', disabled: !addReady, onClick: saveAddWorkspace }, t('save')))) : null;
      const root = h('div', { className: `wcm-sidebar${wide ? '' : ' wcm-sidebarRail'}` }, h('div', { className: 'wcm-sidebarHead' }, h('span', null, t('workspaceTitle')), wide ? headerActions : null), failure ? h('p', { className: 'wcm-error' }, failure) : null, folderTree, errorDialog, addWorkspaceDialog, renameDialog, deleteDialog, dissolveDialog, addCategoryDialog);
      return root;
    }
export { CategorySidebar };
