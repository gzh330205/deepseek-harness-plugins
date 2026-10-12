import React from 'react';
import { createElement as h } from 'react';
import { COLLAPSED_CATEGORIES_FIELD, COLLAPSED_TODAY_GROUPS_FIELD, EXPANDED_WORKSPACES_FIELD, HIDDEN_TODAY_FIELD } from './constants.js';

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
    /* -------------------------「今天」窗口 -------------------------
     * The cross-project Today list is a pure projection of the Session list
     * snapshot, so all of it lives here and stays testable without React.
     *
     * The day window is built from a local Date, never from `ts % 86400000`:
     * the latter breaks on non-UTC offsets and on DST days. Callers pass `now`
     * so a test can pin the window instead of racing the clock.
     * ------------------------------------------------------------- */
    function startOfLocalDay(now) { const date = new Date(typeof now === 'number' ? now : Date.now()); date.setHours(0, 0, 0, 0); return date.getTime(); }
    function msUntilNextLocalDay(now) { const at = typeof now === 'number' ? now : Date.now(); const next = new Date(at); next.setHours(24, 0, 0, 0); return Math.max(1000, next.getTime() - at); }
    /**
     * Sessions that count as「今天运行过」, newest first, minus the ones the
     * operator temporarily removed.
     *
     * `updatedAt` is `max(createdAt, lastPromptAt)` — the Host only advances it
     * on a durable `user/message`, so it answers "did I talk to this session
     * today?" rather than "is work happening in it?". A session left running
     * across midnight therefore carries yesterday's timestamp, which is why a
     * still-running row is admitted regardless of the window (and rendered with
     * a date instead of a clock).
     *
     * Excluded, in the same language as the project rows: subagent children
     * (their titles are the spawning prompt), archived sessions, blank New
     * Session rows other than the one currently selected, and rows whose
     * dismissal record still applies (see {@link todayDismissed}).
     * @param state - `sessions.list` snapshot.
     * @param options - window start, current Session id, archive set, dismissals.
     * @returns visible rows plus the dismissals that are still in force.
     */
    function recentSessions(state, options) {
      const opts = options ?? {};
      const since = typeof opts.since === 'number' ? opts.since : 0;
      const byId = state?.byId ?? {};
      const ids = Array.isArray(state?.ids) && state.ids.length > 0 ? state.ids : Object.keys(byId);
      const archived = new Set(Array.isArray(opts.archivedSessionIds) ? opts.archivedSessionIds : []);
      const hidden = pruneHiddenToday(opts.hiddenToday, state);
      const rows = [];
      for (const id of ids) {
        const summary = byId[id];
        if (summary === undefined) continue;
        if (summary.origin === 'subagent') continue;
        if (archived.has(id)) continue;
        if (summary.blank === true && id !== opts.currentId) continue;
        if (hidden[id] !== undefined) continue;
        const at = typeof summary.updatedAt === 'number' ? summary.updatedAt : 0;
        const running = summary.running === true;
        const fresh = at >= since;
        if (!fresh && !running) continue;
        rows.push({ id, summary, at, fresh, running, label: summary.displayTitle ?? summary.title ?? id });
      }
      rows.sort((left, right) => right.at - left.at || (left.label < right.label ? -1 : left.label > right.label ? 1 : 0));
      return { rows, hidden };
    }
    /**
     * A「临时移除」record still applies until the operator talks to the Session
     * again — one durable activity stamp that moved on. That single signal is
     * deliberate: "只有重新跟它对话才回来" is predictable, and it means hiding a
     * Session that is running keeps it hidden instead of popping back on the
     * next turn.
     * @param record - facts captured when the row was removed.
     * @param summary - current Session list row.
     * @returns whether the record still hides the Session.
     */
    function todayDismissed(record, summary) {
      if (record === null || typeof record !== 'object') return false;
      const at = typeof summary?.updatedAt === 'number' ? summary.updatedAt : 0;
      return at <= (typeof record.updatedAt === 'number' ? record.updatedAt : 0);
    }
    /** Read the「临时移除」map off the plugin Config snapshot value. */
    function hiddenTodayOf(raw) {
      const stored = raw !== null && typeof raw === 'object' ? raw[HIDDEN_TODAY_FIELD] : undefined;
      return stored !== null && typeof stored === 'object' ? stored : {};
    }
    /**
     * Keep only the records that still hide something, on a Session the list
     * still knows. Runs on every write (like the expansion suppression lists) so
     * a long-lived profile cannot accumulate dead entries.
     * @param records - merged dismissal map about to be persisted.
     * @param state - `sessions.list` snapshot.
     * @returns the pruned map.
     */
    function pruneHiddenToday(records, state) {
      const byId = state?.byId ?? {};
      const kept = {};
      for (const [id, record] of Object.entries(records !== null && typeof records === 'object' ? records : {})) {
        const summary = byId[id];
        if (summary === undefined) continue;
        if (!todayDismissed(record, summary)) continue;
        kept[id] = record;
      }
      return kept;
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
     * @param rows - `recentSessions` rows.
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

export { useScope, useWorkspaceSnapshot, useSessionsSnapshot, configOf, currentSessionId, repoNameFromUrl, joinDisplayPath, workspaceId, workspaceLabel, errText, closedCategories, closedTodayGroups, openWorkspaces, retainIds, persistExpansion, nextOverrideGeneration, startOfLocalDay, msUntilNextLocalDay, recentSessions, formatStamp, projectLabelOf, projectGroupOf, groupTodayRows, todayDismissed, hiddenTodayOf, pruneHiddenToday };
