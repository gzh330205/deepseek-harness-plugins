import React from 'react';
import { createElement as h } from 'react';
import { COLLAPSED_CATEGORIES_FIELD, EXPANDED_WORKSPACES_FIELD } from './constants.js';

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
    /* Drop ids that no longer exist (removed category / deleted workspace) so a
     * long-lived profile cannot accumulate dead entries. */
    const retainIds = (ids, existingIds) => { const known = existingIds instanceof Set ? existingIds : new Set(existingIds); return [...ids].filter((id) => known.has(id)); };
    /**
     * Persist one expansion field. The form queues field writes with the latest
     * known revision, so rapid toggles keep their order without a local debounce
     * and never interleave the two expansion lists; a refused or failed write is
     * swallowed here because the next paint simply re-reads the Host mirror.
     * The toggle itself renders from local state, so no await is needed.
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
export { useScope, useWorkspaceSnapshot, useSessionsSnapshot, configOf, currentSessionId, repoNameFromUrl, joinDisplayPath, workspaceId, workspaceLabel, errText, closedCategories, openWorkspaces, retainIds, persistExpansion };
