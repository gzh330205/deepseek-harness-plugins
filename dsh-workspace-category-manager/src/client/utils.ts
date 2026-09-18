import React from 'react';
import { createElement as h } from 'react';
import { FOLDER_STATE_KEY } from './constants.js';

function useScope(scope) { return React.useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot()); }
    function useWorkspaceSnapshot(list) { return React.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot()); }
    function useSessionsSnapshot(list) { return React.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot()); }
    function configOf(scope) { return scope.getSnapshot().value ?? { categories: [], assignments: {} }; }
    /* Which Session is displayed. <=0.1.2 published `current` on the list
     * snapshot; 0.1.6+ moved selection to the view owner and the list row
     * exposes it as a `mainView` retention count instead. */
    function currentSessionId(state) { if (state?.current != null) return state.current; const rows = state?.byId ?? {}; const ids = state?.ids ?? Object.keys(rows); for (const id of ids) { const row = rows[id]; if (row !== undefined && (row.retainedBy?.mainView ?? 0) > 0) return id; } return undefined; }
    const FOLDER_STATE_KEY = 'dsh-workspace-category-manager:folderOpen';
    const loadFolderState = () => { try { const raw = localStorage.getItem(FOLDER_STATE_KEY); if (raw === null) return {}; const parsed = JSON.parse(raw); return parsed !== null && typeof parsed === 'object' ? parsed : {}; } catch (error) { return {}; } };
    const saveFolderState = (state) => { try { localStorage.setItem(FOLDER_STATE_KEY, JSON.stringify(state)); } catch (error) { /* storage unavailable */ } };
    function errText(error) { return error instanceof Error ? error.message : String(error); }
    function workspaceId(workspace) { return workspace.workspaceId; }
    function workspaceLabel(workspace) { return workspace.title || workspace.path?.replace(/.*[\\/]/, '') || workspace.workspaceId; }
export { useScope, useWorkspaceSnapshot, useSessionsSnapshot, configOf, currentSessionId, workspaceId, workspaceLabel, errText, loadFolderState, saveFolderState };
