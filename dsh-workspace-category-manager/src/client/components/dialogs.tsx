import React from 'react';
import { createElement as h } from 'react';
import { workspaceId } from '../utils.js';
import { idPattern, colors } from './colors.js';
function Dialog({ title, close, children }) { return h('div', { className: 'wcm-dialogMask', onMouseDown: (event) => { if (event.currentTarget === event.target) close(); } }, h('section', { className: 'wcm-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title }, h('header', { className: 'wcm-dialogHead' }, h('h3', null, title), h('button', { className: 'wcm-close', onClick: close }, '×')), children)); }
    function CategoryForm({ initial, save, cancel, lockedId = false }) { const [draft, setDraft] = React.useState(initial); const [error, setError] = React.useState(''); const patch = (field, value) => setDraft((current) => ({ ...current, [field]: value })); const randomColor = () => { const options = colors.length > 1 ? colors.filter((c) => c !== draft.color) : colors; patch('color', options[Math.floor(Math.random() * options.length)]); }; const submit = () => { const id = draft.id.trim(); const name = draft.name.trim(); if (!idPattern.test(id)) return setError('标识符必须是小写 kebab-case。'); if (name === '') return setError('请填写分类名称。'); save({ ...draft, id, name }); }; return h('div', { className: 'wcm-form' }, h('label', null, '标识符', h('input', { value: draft.id, disabled: lockedId, placeholder: 'client-projects', onChange: (event) => patch('id', event.target.value) })), h('label', null, '分类名称', h('input', { value: draft.name, placeholder: '客户项目', onChange: (event) => patch('name', event.target.value) })), h('label', null, '颜色', h('div', { className: 'wcm-colorRow' }, h('input', { type: 'color', value: draft.color, onChange: (event) => patch('color', event.target.value) }), h('button', { type: 'button', className: 'wcm-randomColor', onClick: randomColor }, '随机'))), h('div', { className: 'wcm-span wcm-actions' }, h('button', { onClick: cancel }, '取消'), h('button', { className: 'wcm-primary', onClick: submit }, '保存')), error ? h('p', { className: 'wcm-error wcm-span' }, error) : null); }
    function Confirm({ title, text, close, confirm }) { return h(Dialog, { title, close }, h('p', { className: 'wcm-muted' }, text), h('div', { className: 'wcm-actions' }, h('button', { onClick: close }, '取消'), h('button', { className: 'wcm-danger', onClick: confirm }, '确认'))); }

    /* ====================== DSH API ADAPTER ======================
     * The ONLY layer of this plugin that touches DSH runtime services.
     * Components consume `api` exclusively, so a DSH upgrade only needs
     * new fallback branches here. scripts/check-api.mjs verifies the
     * tokens below against the installed dsh before shipping.
     * ================================================================= */
    function createDshApi(ctx) {
      const workspaces = ctx.get('workspaces');
      const sessions = ctx.get('sessions');
      const uiWorkspace = ctx.get('uiWorkspace');
      const has = (obj, method) => obj !== undefined && obj !== null && typeof obj[method] === 'function';
      const startSession = (workspaceId) => {
        if (has(uiWorkspace, 'startSession')) return uiWorkspace.startSession(workspaceId);
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
        if (has(uiWorkspace, 'pickDirectory')) return uiWorkspace.pickDirectory();
        if (has(workspaces, 'pickDirectory')) return workspaces.pickDirectory();
        return Promise.reject(new Error('directory picking unavailable'));
      };
      return {
        startSession,
        pickDirectory,
        pickAvailable: has(uiWorkspace, 'pickDirectory') || has(workspaces, 'pickDirectory'),
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
export { Dialog, CategoryForm, Confirm };
