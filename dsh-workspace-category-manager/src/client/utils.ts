import React from 'react';
import { createElement as h } from 'react';
import { COLLAPSED_CATEGORIES_FIELD, COLLAPSED_TODAY_GROUPS_FIELD, EXPANDED_WORKSPACES_FIELD, CURRENT_SESSIONS_FIELD } from './constants.js';

function useScope(scope) { return React.useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot()); }
    function useWorkspaceSnapshot(list) { return React.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot()); }
    function useSessionsSnapshot(list) { return React.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot()); }
    function configOf(scope) { return scope.getSnapshot().value ?? { categories: [], assignments: {} }; }
    /* Which Session is displayed. <=0.1.2 published `current` on the list
     * snapshot; 0.1.6+ moved selection to the view owner and the list row
     * exposes it as a `mainView` retention count instead. */
    function currentSessionId(state) { if (state?.current != null) return state.current; const rows = state?.byId ?? {}; const ids = state?.ids ?? Object.keys(rows); for (const id of ids) { const row = rows[id]; if (row !== undefined && (row.retainedBy?.mainView ?? 0) > 0) return id; } return undefined; }
    /* ------------------------- Sidebar expansion -------------------------
     * "Closed when you closed it, open when you opened it" has to survive a
     * program restart, and browser localStorage cannot carry it: DSH binds Web
     * to an OS-assigned loopback port on every launch, so each session runs on
     * a new origin with an empty storage bucket. The expansion state therefore
     * lives in this plugin's Config (persisted next to categories/assignments),
     * and both fields are SUPPRESSION lists — only the non-default side is
     * stored, so a category is expanded unless it is listed as collapsed and a
     * project row is collapsed unless it is listed as expanded. The persisted
     * value stays tiny and an absent/failed read degrades to the old defaults
     * instead of hiding the whole workspace list.
     * ------------------------------------------------------------------- */
    const expansionKey = (raw, field) => (raw !== null && typeof raw === 'object' ? raw[field] : undefined);
    const expansionIds = (raw, field) => { const stored = expansionKey(raw, field); return Array.isArray(stored) ? new Set(stored.filter((id) => typeof id === 'string')) : new Set(); };
    const closedCategories = (raw) => expansionIds(raw, COLLAPSED_CATEGORIES_FIELD);
    const openWorkspaces = (raw) => expansionIds(raw, EXPANDED_WORKSPACES_FIELD);
    const closedTodayGroups = (raw) => expansionIds(raw, COLLAPSED_TODAY_GROUPS_FIELD);
    /* Drop ids that no longer exist (removed category / deleted workspace) so a
     * long-lived profile cannot accumulate dead entries. */
    const retainIds = (ids, existingIds) => { const known = existingIds instanceof Set ? existingIds : new Set(existingIds); return [...ids].filter((id) => known.has(id)); };
    /**
     * Monotonic id for one optimistic expansion override. A pending write can
     * only be confirmed by a Config snapshot that at least its generation
     * produced, so an older snapshot cannot retire a newer click's override and
     * snap the row back — which is exactly what "lag then jump" looked like.
     */
    let overrideGeneration = 0;
    const nextOverrideGeneration = () => (overrideGeneration += 1);
    /**
     * Persist one expansion field. The form queues field writes with the latest
     * known revision, so rapid toggles keep their order without a local debounce
     * and never interleave the two expansion lists; a refused or failed write is
     * swallowed here because the next paint simply re-reads the Host mirror.
     * The caller already rendered from optimistic local state, so nothing awaits.
     */
    function persistExpansion(scope, field, ids) {
      try { return Promise.resolve(scope.set(field, ids)).then(undefined, () => {}); }
      catch (error) { return Promise.resolve(); }
    }
    function errText(error) { return error instanceof Error ? error.message : String(error); }
    /* Preview mirror of index.js `repoNameFromUrl`: the Host derives the
     * authoritative folder name when the field is left empty, so this copy
     * only feeds the "will clone into …" hint. Keep the two in sync. */
    function repoNameFromUrl(value) {
      let url = typeof value === 'string' ? value.trim() : '';
      if (url === '') return '';
      url = url.replace(/[?#][\s\S]*$/, '').replace(/[/\\]+$/, '');
      const scp = /^[^/@\s]+@[^/:\s]+:([\s\S]+)$/.exec(url);
      const tail = scp !== null ? scp[1] : url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
      const segments = tail.split(/[/\\]/).filter((segment) => segment !== '');
      let name = segments.length === 0 ? '' : segments[segments.length - 1];
      if (name.toLowerCase().endsWith('.git')) name = name.slice(0, -4);
      return name;
    }
    function joinDisplayPath(parent, name) { const base = String(parent ?? '').replace(/[/\\]+$/, ''); const separator = /\\/.test(base) && !/\//.test(base) ? '\\' : '/'; return `${base}${separator}${name}`; }
    function workspaceId(workspace) { return workspace.workspaceId; }
    function workspaceLabel(workspace) { return workspace.title || workspace.path?.replace(/.*[\\/]/, '') || workspace.workspaceId; }
    /* -------------------------「当前」注册表 -------------------------
     * 「当前」不是时间窗口，而是一份**显式注册表**（Config `currentSessions`）：会话跑起来、
     * 有新的提示词、或者你把它打开时，它才被登记进来；点「隐藏」= 从表里删掉这一条。
     * 于是：历史会话不会自己出现（从没登记过），删掉的也不会自己回来（除非它再次运行），
     * 而分类树、归档这些原有行为完全不受影响。全部逻辑都是纯函数，不依赖 React。
     * ------------------------------------------------------------- */
    /** 本地零点：只用来决定行上的时间戳显示成 HH:mm（今天）还是 M/D（更早）。 */
    function startOfLocalDay(now) { const date = new Date(typeof now === 'number' ? now : Date.now()); date.setHours(0, 0, 0, 0); return date.getTime(); }
    /** 读注册表：容忍残缺记录（缺字段按 0 处理），永远返回一份干净的拷贝。 */
    function currentListOf(raw) {
      const stored = raw !== null && typeof raw === 'object' ? raw[CURRENT_SESSIONS_FIELD] : undefined;
      const out = {};
      for (const [id, record] of Object.entries(stored !== null && typeof stored === 'object' ? stored : {})) {
        const entry = record !== null && typeof record === 'object' ? record : {};
        out[id] = { at: typeof entry.at === 'number' ? entry.at : 0, viewedAt: typeof entry.viewedAt === 'number' ? entry.viewedAt : 0 };
      }
      return out;
    }
    /** 剪掉快照里已经不存在的会话（会话被删/被清），写入时顺带跑，配置不会无限长胖。 */
    function pruneCurrentList(records, state) {
      const byId = state?.byId ?? {};
      const kept = {};
      for (const [id, record] of Object.entries(records !== null && typeof records === 'object' ? records : {})) {
        if (byId[id] === undefined) continue;
        kept[id] = { at: typeof record?.at === 'number' ? record.at : 0, viewedAt: typeof record?.viewedAt === 'number' ? record.viewedAt : 0 };
      }
      return kept;
    }
    /**
     * 「当前」要渲染的行 = 注册表 ∩ 快照，按最近活动倒序。
     *
     * 排除口径与项目行一致：子代理子会话（标题就是派发它的提示词）、已归档会话、
     * 从未发过话的空白「新会话」（正在用的那一个除外）。`unseen` = 跑完了但还没被看过
     * （活动戳晚于最后一次把它当作当前会话看到的时间），行上据此做一个轻提示。
     * @param state - `sessions.list` snapshot.
     * @param options - registry, current Session id, archive set.
     * @returns visible rows, newest first.
     */
    function currentRows(state, options) {
      const opts = options ?? {};
      const list = opts.list !== null && typeof opts.list === 'object' ? opts.list : {};
      const byId = state?.byId ?? {};
      const ids = Array.isArray(state?.ids) && state.ids.length > 0 ? state.ids : Object.keys(byId);
      const archived = new Set(Array.isArray(opts.archivedSessionIds) ? opts.archivedSessionIds : []);
      const rows = [];
      for (const id of ids) {
        const summary = byId[id];
        if (summary === undefined) continue;
        if (list[id] === undefined) continue;
        if (summary.origin === 'subagent') continue;
        if (archived.has(id)) continue;
        if (summary.blank === true && id !== opts.currentId) continue;
        const at = typeof summary.updatedAt === 'number' ? summary.updatedAt : 0;
        const running = summary.running === true;
        const viewedAt = typeof list[id].viewedAt === 'number' ? list[id].viewedAt : 0;
        rows.push({ id, summary, at, running, unseen: !running && at > viewedAt, label: summary.displayTitle ?? summary.title ?? id });
      }
      rows.sort((left, right) => right.at - left.at || (left.label < right.label ? -1 : left.label > right.label ? 1 : 0));
      return rows;
    }
    /**
     * 哪些会话需要（重新）登记进「当前」注册表 —— **只看运行**，两种事件：
     *  1. 它刚刚开始运行（上一次观测里它还不在跑）—— 覆盖自动续跑这类没有新提示词的运行；
     *  2. 它的活动戳前进了（你发了新提示词，也就是一次新运行）—— 也包括「隐藏之后又跟它说话」。
     * **打开一个会话不登记**：翻一下就多出一堆条目不是这里想要的（用户明确要求）。打开只对
     * 已经登记过的条目刷新 `viewedAt`，也就是把「跑完了还没看」的加粗标记清掉。
     * `previous === undefined` 是「首次观测」（刚启动/刚挂载）：那时**什么都不登记** —— 没有
     * 可比较的跃迁，历史与「一直在跑」的会话都不会被导进来，隐藏过的也不会在重启后自己回来。
     * @returns 需要 upsert 的记录（含 viewedAt 刷新），没有变化时是空数组。
     */
    function registryUpdates(state, options) {
      const opts = options ?? {};
      const list = opts.list !== null && typeof opts.list === 'object' ? opts.list : {};
      const first = opts.previous === undefined || opts.previous === null;
      /* 上一次观测：{ currentId, sessions: { id: { at, running } } }。 */
      const previous = first ? {} : opts.previous;
      const sessions = first ? {} : previous.sessions ?? {};
      const byId = state?.byId ?? {};
      const ids = Array.isArray(state?.ids) && state.ids.length > 0 ? state.ids : Object.keys(byId);
      const archived = new Set(Array.isArray(opts.archivedSessionIds) ? opts.archivedSessionIds : []);
      const stamp = typeof opts.now === 'number' ? opts.now : Date.now();
      const changes = [];
      for (const id of ids) {
        const summary = byId[id];
        if (summary === undefined) continue;
        if (summary.origin === 'subagent') continue;
        if (archived.has(id)) continue;
        const at = typeof summary.updatedAt === 'number' ? summary.updatedAt : 0;
        const known = list[id];
        const before = sessions[id];
        const startedRunning = !first && summary.running === true && before?.running !== true;
        const advanced = before !== undefined && at > (typeof before.at === 'number' ? before.at : 0);
        /* 「刚打开」是一次状态跃迁：重启后 previous 为空时它也算，所以首个观测只登记当前会话。 */
        const justOpened = id === opts.currentId && (first || previous.currentId !== id);
        /* 登记只看运行事件；`justOpened` 只用于给已登记条目刷 viewedAt。 */
        const fresh = startedRunning || advanced;
        const viewedAt = justOpened ? stamp : known === undefined ? 0 : known.viewedAt;
        if (fresh) changes.push({ id, at: at > 0 ? at : stamp, viewedAt });
        else if (known !== undefined && justOpened) changes.push({ id, at: known.at, viewedAt: stamp });
      }
      return changes;
    }
    const pad2 = (value) => String(value).padStart(2, '0');
    /** Row-stamp: clock while it is still today, calendar day for an overnight runner. */
    function formatStamp(ts, since) {
      if (typeof ts !== 'number' || ts <= 0) return '';
      const date = new Date(ts);
      const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
      return ts >= since ? clock : `${date.getMonth() + 1}/${date.getDate()}`;
    }
    /**
     * Group identity for one Session's project: the owning Workspace's stable id
     * plus its display label, falling back to the directory path + basename when
     * the Workspace was deleted (the Session outlives its registration). The KEY
     * is identity-based on purpose — the label is only presentation, so renaming
     * a project or a folder never invalidates a fold state keyed on it.
     * @param cwd - Session working directory.
     * @param workspaces - Workspace list snapshot.
     * @returns stable group key and display label (both empty without a cwd).
     */
    function projectGroupOf(cwd, workspaces) {
      if (typeof cwd !== 'string' || cwd === '') return { key: '', label: '' };
      const trimmed = cwd.replace(/[\\/]+$/, '');
      const list = Array.isArray(workspaces) ? workspaces : [];
      const pathOf = (workspace) => typeof workspace?.path === 'string' ? workspace.path.replace(/[\\/]+$/, '') : undefined;
      const exact = list.find((workspace) => pathOf(workspace) === trimmed);
      const found = exact ?? list.find((workspace) => pathOf(workspace)?.toLowerCase() === trimmed.toLowerCase());
      if (found !== undefined) return { key: `w:${workspaceId(found)}`, label: workspaceLabel(found) };
      return { key: `p:${trimmed}`, label: trimmed.replace(/.*[\\/]/, '') };
    }
    /** Project label for one Session (the group's display half). */
    function projectLabelOf(cwd, workspaces) { return projectGroupOf(cwd, workspaces).label; }
    /**
     * Fold the Today rows into project groups, newest group first (a group leads
     * with its own most recent Session, so "what I touched last" is on top), and
     * keep each group's rows in the recency order the selector already produced.
     * Sessions without a project fall into one label-less group the renderer
     * shows as Uncategorized.
      * @param rows - `currentRows` rows.
     * @param workspaces - Workspace list snapshot.
     * @returns groups carrying key, label, newest stamp, and member rows.
     */
    function groupTodayRows(rows, workspaces) {
      const groups = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        const { key, label } = projectGroupOf(row.summary?.cwd, workspaces);
        let group = groups.get(key);
        if (group === undefined) { group = { key, label, at: row.at, rows: [] }; groups.set(key, group); }
        else if (row.at > group.at) group.at = row.at;
        group.rows.push(row);
      }
      return [...groups.values()].sort((left, right) => right.at - left.at || (left.label < right.label ? -1 : left.label > right.label ? 1 : 0));
    }

export { currentListOf, pruneCurrentList, currentRows, registryUpdates, useScope, useWorkspaceSnapshot, useSessionsSnapshot, configOf, currentSessionId, repoNameFromUrl, joinDisplayPath, workspaceId, workspaceLabel, errText, closedCategories, closedTodayGroups, openWorkspaces, retainIds, persistExpansion, nextOverrideGeneration, startOfLocalDay, formatStamp, projectLabelOf, projectGroupOf, groupTodayRows };
