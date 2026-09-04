import { SETTINGS_NAMESPACE } from './constants.js';

export function createDshApi(ctx) {
      const workspaces = ctx.get('workspaces');
      const sessions = ctx.get('sessions');
      // uiWorkspace is lazy: the ui-workspace client may provide it AFTER this
      // plugin's apply() (module boot order is not guaranteed), and a live
      // plugin reload can remove/re-add it. Never capture it once at apply time.
      const uiWorkspace = () => ctx.get('uiWorkspace');
      const has = (obj, method) => obj !== undefined && obj !== null && typeof obj[method] === 'function';
      const hasUi = (method) => has(uiWorkspace(), method);
      const startSession = (workspaceId) => {
        const uw = uiWorkspace();
        if (has(uw, 'startSession')) return uw.startSession(workspaceId);
        if (has(workspaces, 'startSession')) return workspaces.startSession(workspaceId);
        if (has(sessions, 'create') && has(sessions, 'open')) {
          const workspace = workspaces.list.getSnapshot().items.find((item) => item.workspaceId === workspaceId);
          const snapshot = sessions.list.getSnapshot();
          const archived = workspaces.list.getSnapshot().archivedSessionIds ?? [];
          const blank = workspace === undefined ? undefined : snapshot.ids.map((id) => snapshot.byId[id]).find((s) => s !== undefined && s.blank && s.cwd === workspace.path && workspace.sessionIds.includes(s.id) && !archived.includes(s.id));
          if (blank !== undefined) { sessions.open(blank.id); return Promise.resolve(); }
          return sessions.create({ workspaceId }).then((sessionId) => { sessions.open(sessionId); });
        }
        return Promise.reject(new Error('startSession unavailable'));
      };
      const pickDirectory = () => {
        const uw = uiWorkspace();
        if (has(uw, 'pickDirectory')) return uw.pickDirectory();
        if (has(workspaces, 'pickDirectory')) return workspaces.pickDirectory();
        return Promise.reject(new Error('directory picking unavailable'));
      };
      return {
        startSession,
        pickDirectory,
        // Evaluated at render time — the button appears once the service is up.
        canPickDirectory: () => hasUi('pickDirectory') || has(workspaces, 'pickDirectory'),
        openSession: (sessionId) => sessions.open(sessionId),
        forkSession: (opts) => sessions.fork(opts),
        sessionBinding: (sessionId) => sessions.binding(sessionId),
        createWorkspace: (input) => workspaces.create(input),
        renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
        deleteWorkspace: (workspaceId) => workspaces.delete(workspaceId),
        insertWorkspaceBefore: (workspaceId, beforeWorkspaceId) => workspaces.insertBefore(workspaceId, beforeWorkspaceId),
        archiveSession: (sessionId) => workspaces.archiveSession(sessionId),
        workspacesList: workspaces.list,
        sessionsList: sessions.list,
        settingsScope: ctx.get('settingsScope').bind({ namespace: SETTINGS_NAMESPACE }),
      };
    }
