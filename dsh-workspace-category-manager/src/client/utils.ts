import React from 'react';
import { createElement as h } from 'react';
import { FOLDER_STATE_KEY } from './constants.js';

function useScope(scope) { return React.useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot()); }
    function useWorkspaceSnapshot(list) { return React.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot()); }
    function useSessionsSnapshot(list) { return React.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot()); }
    function configOf(scope) { return scope.getSnapshot().value ?? { categories: [], assignments: {} }; }
    const FOLDER_STATE_KEY = 'dsh-workspace-category-manager:folderOpen';
    const loadFolderState = () => { try { const raw = localStorage.getItem(FOLDER_STATE_KEY); if (raw === null) return {}; const parsed = JSON.parse(raw); return parsed !== null && typeof parsed === 'object' ? parsed : {}; } catch (error) { return {}; } };
    const saveFolderState = (state) => { try { localStorage.setItem(FOLDER_STATE_KEY, JSON.stringify(state)); } catch (error) { /* storage unavailable */ } };
    function errText(error) { return error instanceof Error ? error.message : String(error); }
    function workspaceId(workspace) { return workspace.workspaceId; }
    function workspaceLabel(workspace) { return workspace.title || workspace.path?.replace(/.*[\\/]/, '') || workspace.workspaceId; }
export { useScope, useWorkspaceSnapshot, useSessionsSnapshot, configOf, workspaceId, workspaceLabel, errText, loadFolderState, saveFolderState };
