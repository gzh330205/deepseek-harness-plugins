import { SETTINGS_NAMESPACE } from './constants.js';

/* ====================== DSH API ADAPTER ======================
 * The ONLY layer of this plugin that touches DSH runtime services.
 * Components consume `api` exclusively, so a DSH upgrade only needs
 * new fallback branches here. scripts/check-api.mjs verifies the
 * tokens below against the installed dsh before shipping.
 *
 * Version map (see README "版本兼容"):
 *   0.1.7+ : settings are an entry's volatile Config. The `settingsScope`
 *            service is gone; the form comes from ctx.configForms.get(entryId),
 *            where entryId doubles as the settings namespace. Same snapshot
 *            shape (status/value/writable) and same subscribe/set methods.
 *   0.1.6+ : selection is a view-owner action — uiWorkspace.openSession
 *            retains the Session as the main view and reveals the panel;
 *            sessions.open is gone. Human-intervention/running/completion
 *            facts come from uiSession.sessionStatus.
 *   <=0.1.2: sessions.open switched the view; uiSession.pendingInteractions
 *            carried the intervention facts; list rows carried `current`
 *            and `completed`.
 * ============================================================ */
export function createDshApi(ctx) {
      const workspaces = ctx.get('workspaces');
      const sessions = ctx.get('sessions');
      // uiWorkspace is lazy: the ui-workspace client may provide it AFTER this
      // plugin's apply() (module boot order is not guaranteed), and a live
      // plugin reload can remove/re-add it. Never capture it once at apply time.
      const uiWorkspace = () => ctx.get('uiWorkspace');
      // Unified Session UI-status store, also lazy. 0.1.6+ exposes
      // uiSession.sessionStatus (Map<id, {running, pendingInteraction,
      // completionUnread}>); <=0.1.2 exposed uiSession.pendingInteractions
      // (Map<id, {kind, ...}>). Both are snapshot stores with
      // subscribe/getSnapshot, so the renderer reads one shape and normalizes.
      const sessionStatus = () => { const ui = ctx.get('uiSession'); return ui?.sessionStatus ?? ui?.pendingInteractions; };
      const has = (obj, method) => obj !== undefined && obj !== null && typeof obj[method] === 'function';
      const hasUi = (method) => has(uiWorkspace(), method);
      /**
       * Select a Session and show its Conversation. In 0.1.6+ this is a single
       * navigation action owned by uiWorkspace (retain as main view + reveal
       * panel); sessions.open only set controller-local selection and no longer
       * switches the visible Session, so it is the legacy fallback.
       */
      const openSession = (sessionId) => {
        const uw = uiWorkspace();
        if (has(uw, 'openSession')) return uw.openSession(sessionId);
        if (has(sessions, 'open')) return sessions.open(sessionId);
        return undefined;
      };
      const startSession = (workspaceId) => {
        const uw = uiWorkspace();
        if (has(uw, 'startSession')) return uw.startSession(workspaceId);
        if (has(workspaces, 'startSession')) return workspaces.startSession(workspaceId);
        if (has(sessions, 'create')) {
          const workspace = workspaces.list.getSnapshot().items.find((item) => item.workspaceId === workspaceId);
          const snapshot = sessions.list.getSnapshot();
          const archived = workspaces.list.getSnapshot().archivedSessionIds ?? [];
          const blank = workspace === undefined ? undefined : snapshot.ids.map((id) => snapshot.byId[id]).find((s) => s !== undefined && s.blank && s.cwd === workspace.path && workspace.sessionIds.includes(s.id) && !archived.includes(s.id));
          if (blank !== undefined) { openSession(blank.id); return Promise.resolve(); }
          return sessions.create({ workspaceId }).then((sessionId) => { openSession(sessionId); });
        }
        return Promise.reject(new Error('startSession unavailable'));
      };
      const pickDirectory = () => {
        const uw = uiWorkspace();
        if (has(uw, 'pickDirectory')) return uw.pickDirectory();
        if (has(workspaces, 'pickDirectory')) return workspaces.pickDirectory();
        return Promise.reject(new Error('directory picking unavailable'));
      };
      /**
       * Rename a Session. 0.1.6+ only hands out a live binding while the
       * Session is retained, so acquire one around the operation with
       * sessions.using; <=0.1.2 resolved a binding for any catalog row.
       */
      const renameSession = async (sessionId, title) => {
        if (has(sessions, 'using')) {
          const result = await sessions.using(sessionId, { source: 'workspaceOperation' }, (reference) => reference.binding.session.rename(title));
          if (result !== undefined && result !== null && result.ok === false) throw new Error(result.error.message);
          return;
        }
        const face = has(sessions, 'binding') ? sessions.binding(sessionId)?.session : undefined;
        if (face === undefined) throw new Error('unknown session');
        const result = await face.rename(title);
        if (result.ok === false) throw new Error(result.error.message);
      };
      /**
       * Archive a Session. 0.1.6+ also clears the Conversation panel when the
       * archived Session is the one on screen, so that policy must be asked of
       * uiWorkspace rather than applied to the controller directly.
       */
      const archiveSession = (sessionId) => {
        const uw = uiWorkspace();
        if (has(uw, 'archiveSession')) return uw.archiveSession(sessionId);
        return workspaces.archiveSession(sessionId);
      };
      /* ---------------- Host Git import ----------------
       * Cloning runs on the Host (index.js) because the browser cannot run git.
       * The status probe doubles as the CSRF bootstrap: it returns a
       * short-lived token that the clone POST must carry. This block reads no
       * DSH service — it is the Host half's one HTTP surface.
       * ------------------------------------------------ */
      const GIT_ROUTE = '/dsh-workspace-category-manager/git';
      const jsonRequest = async (path, init) => {
        let response;
        try {
          response = await fetch(path, { ...(init ?? {}), headers: { accept: 'application/json', ...((init?.headers) ?? {}) } });
        } catch (error) {
          throw new Error('无法连接 DSH Host 的 Git 导入接口。');
        }
        let payload = null;
        try { payload = await response.json(); } catch (error) { payload = null; }
        if (response.ok !== true || payload === null || payload.ok !== true) {
          const detail = payload !== null && typeof payload.error === 'string' && payload.error !== '' ? payload.error : `Git 导入接口返回 HTTP ${response.status}。`;
          throw new Error(detail);
        }
        return payload;
      };
      const gitImportStatus = () => jsonRequest(`${GIT_ROUTE}/status`);
      const cloneRepository = async (input) => {
        const status = await gitImportStatus();
        if (status.available !== true) throw new Error(typeof status.reason === 'string' && status.reason !== '' ? status.reason : '当前部署不支持从 Git 导入。');
        const result = await jsonRequest(`${GIT_ROUTE}/clone`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-dsh-wcm-token': status.token },
          body: JSON.stringify(input),
        });
        return result.path;
      };
      return {
        startSession,
        pickDirectory,
        // Evaluated at render time — the button appears once the service is up.
        canPickDirectory: () => hasUi('pickDirectory') || has(workspaces, 'pickDirectory'),
        sessionStatus,
        openSession,
        forkSession: (opts) => sessions.fork(opts),
        renameSession,
        createWorkspace: (input) => workspaces.create(input),
        renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
        deleteWorkspace: (workspaceId) => workspaces.delete(workspaceId),
        insertWorkspaceBefore: (workspaceId, beforeWorkspaceId) => workspaces.insertBefore(workspaceId, beforeWorkspaceId),
        archiveSession,
        gitImportStatus,
        cloneRepository,
        workspacesList: workspaces.list,
        sessionsList: sessions.list,
        // 0.1.7: settings are an entry's volatile Config; the entry id is the
        // namespace. ConfigForms.get() hands back the same shared form per entry,
        // so holding it here is equivalent to the old per-namespace binding.
        configForms: ctx.get('configForms').get(SETTINGS_NAMESPACE),
      };
    }
