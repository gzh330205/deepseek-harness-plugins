window.__ModuleLoader__.load({
  id: 'dsh-web-auth',
  factory: (require) => {
    const React = require('react');
    const { createElement: h } = React;

    const NS = 'settings.webAuth';
    const AUTH_BASE = '/__auth__';
    const STATUS_API = `${AUTH_BASE}/status`;
    const USERS_API = `${AUTH_BASE}/users`;

    const cssId = 'dsh-web-auth/settings.css';
    const css = `
.auth{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}
.auth h2,.auth h3,.auth p{margin:0}.auth-intro,.auth-muted{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.55}
.auth-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.auth-badge{background:var(--dsw-alias-bg-module-platform);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:11px;padding:2px 8px;white-space:nowrap}
.auth-list{display:flex;flex-direction:column;gap:8px}
.auth-card{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}
.auth-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.auth-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.auth button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}
.auth button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.auth button:disabled{cursor:default;opacity:.5}
.auth-primary{background:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-brand-primary)!important;color:white!important}
.auth-danger{color:var(--dsw-alias-state-error-primary)!important}
.auth form{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.auth input{font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px 10px;min-width:200px}
.auth label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.auth-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5}
.auth-ok{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:1.5}
.auth-dialogMask{background:var(--dsw-alias-bg-mask-1);z-index:2000;display:flex;align-items:center;justify-content:center;position:fixed;inset:0;padding:24px}
.auth-dialog{max-height:calc(100vh - 48px);width:min(440px,100%);overflow:auto;background:var(--dsw-alias-bg-layer-2);border-radius:16px;box-shadow:var(--dsw-shadow-lv3);padding:18px}
.auth-dialogHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.auth-dialogHead strong{font-size:14px}
.auth-close{border:none!important;background:transparent!important;font-size:20px;line-height:1}
`;
    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${cssId}"]`) === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-web-auth';
      tag.dataset.pluginCss = cssId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    async function api(path, options = {}) {
      const response = await fetch(path, { credentials: 'same-origin', ...options });
      let data = {};
      try {
        data = await response.json();
      } catch {
        /* non-JSON responses keep {} */
      }
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      return data;
    }

    function useRefresh() {
      const [, force] = React.useReducer((x) => x + 1, 0);
      return force;
    }

    function PasswordDialog({ title, button, onSubmit, close, t }) {
      const [password, setPassword] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const submit = async () => {
        if (password.length < 8) return setError(t('passwordTooShort'));
        setBusy(true);
        setError('');
        try {
          await onSubmit(password);
          close();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      };
      return h('div', { className: 'auth-dialogMask', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) close(); } },
        h('section', { className: 'auth-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title },
          h('header', { className: 'auth-dialogHead' }, h('strong', null, title), h('button', { className: 'auth-close', type: 'button', onClick: close, 'aria-label': 'Close' }, '×')),
          h('form', { onSubmit: (event) => { event.preventDefault(); submit(); } },
            h('label', null, t('newPassword'), h('input', { type: 'password', autoComplete: 'new-password', value: password, onChange: (event) => setPassword(event.target.value), autoFocus: true })),
            error ? h('p', { className: 'auth-error', style: { marginTop: 8 } }, error) : null,
            h('div', { className: 'auth-actions' },
              h('button', { type: 'button', onClick: close, disabled: busy }, t('cancel')),
              h('button', { className: 'auth-primary', type: 'submit', disabled: busy }, button)))));
    }

    function AuthTab({ t }) {
      const refresh = useRefresh();
      const [status, setStatus] = React.useState(null);
      const [users, setUsers] = React.useState([]);
      const [canRemove, setCanRemove] = React.useState(true);
      const [failure, setFailure] = React.useState('');
      const [username, setUsername] = React.useState('');
      const [dialog, setDialog] = React.useState(null); // { kind: 'add'|'reset', user }
      const [busy, setBusy] = React.useState(false);

      const load = async () => {
        setFailure('');
        try {
          const [statusData, usersData] = await Promise.all([api(STATUS_API), api(USERS_API)]);
          setStatus(statusData);
          setUsers(usersData.users ?? []);
          setCanRemove(Boolean(usersData.canRemove));
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      };
      React.useEffect(() => { load(); }, []);

      const addUser = async (password) => {
        setBusy(true);
        try {
          await api(`${USERS_API}/add`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password }) });
          setUsername('');
          await load();
          refresh();
        } finally {
          setBusy(false);
        }
      };
      const resetPassword = (user) => async (password) => {
        setBusy(true);
        try {
          await api(`${USERS_API}/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user, password }) });
          await load();
          refresh();
        } finally {
          setBusy(false);
        }
      };
      const removeUser = async (user) => {
        if (!window.confirm(`${t('removeTitle')} ${user}?`)) return;
        setFailure('');
        try {
          await api(`${USERS_API}/remove`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user }) });
          await load();
          refresh();
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      };

      const modeText = status === null ? '…' : status.mode === 'disabled'
        ? t('modeDisabled')
        : status.mode === 'token'
          ? t('modeToken')
          : t('modeUsers');

      const logout = async () => {
        if (!window.confirm(t('logoutConfirm'))) return;
        setBusy(true);
        setFailure('');
        try {
          await api(`${AUTH_BASE}/logout`, { method: 'POST' });
        } catch {
          /* 忽略：跳转登录页本身即完成会话清理 */
        }
        window.location.assign(`${AUTH_BASE}/login?loggedout=1`);
      };

      return h('div', { className: 'auth' },
        h('h2', null, t('title')),
        h('p', { className: 'auth-intro' }, t('intro')),
        failure !== '' ? h('p', { className: 'auth-error' }, failure) : null,
        h('div', { className: 'auth-status' },
          h('span', { className: 'auth-badge' }, modeText),
          status !== null ? h('span', { className: 'auth-muted' }, t('accounts', { count: String(status.accounts) })) : null,
          status !== null && status.user ? h('span', { className: 'auth-muted' }, t('loggedInAs', { user: status.user })) : null,
          h('button', { className: 'auth-danger', onClick: logout, disabled: busy }, t('logout'))),
        h('h3', null, t('addTitle')),
        h('form', { onSubmit: (event) => { event.preventDefault(); setDialog({ kind: 'add' }); } },
          h('label', null, t('username'), h('input', { value: username, placeholder: 'admin', onChange: (event) => setUsername(event.target.value), autoComplete: 'username' })),
          h('button', { className: 'auth-primary', type: 'submit', disabled: username.trim() === '' || busy }, t('add'))),
        h('h3', null, t('listTitle')),
        users.length === 0 ? h('p', { className: 'auth-muted' }, t('empty')) : h('div', { className: 'auth-list' },
          users.map((user) => h('article', { className: 'auth-card', key: user.username },
            h('div', { className: 'auth-row' }, h('strong', null, user.username),
              user.username === status?.user ? h('span', { className: 'auth-badge' }, t('me')) : null),
            h('div', { className: 'auth-actions' },
              h('button', { onClick: () => setDialog({ kind: 'reset', user: user.username }) }, t('resetPassword')),
              h('button', { className: 'auth-danger', disabled: !canRemove || users.length <= 1, onClick: () => removeUser(user.username) }, t('remove')))))),
        dialog?.kind === 'add' ? h(PasswordDialog, { title: t('addTitle'), button: t('add'), onSubmit: addUser, close: () => setDialog(null), t }) : null,
        dialog?.kind === 'reset' ? h(PasswordDialog, { title: `${t('resetPassword')} — ${dialog.user}`, button: t('save'), onSubmit: resetPassword(dialog.user), close: () => setDialog(null), t }) : null);
    }

    const zh = {
      title: '认证',
      intro: '管理访问 DSH Web 的账户。密码只保存 scrypt 哈希；修改或删除账户会立即撤销其会话。',
      modeUsers: '账户密码模式',
      modeToken: '主令牌模式',
      modeDisabled: '未启用（开放访问）',
      accounts: '账户数：{count}',
      loggedInAs: '当前登录：{user}',
      logout: '退出登录',
      logoutConfirm: '确定要退出登录吗？未保存的工作不受影响，下次访问需要重新登录。',
      addTitle: '新增账户',
      username: '用户名',
      add: '新增',
      listTitle: '账户',
      empty: '尚无账户。',
      me: '当前账户',
      resetPassword: '重置密码',
      remove: '删除',
      removeTitle: '删除账户',
      save: '保存',
      cancel: '取消',
      newPassword: '新密码（至少 8 位）',
      passwordTooShort: '密码至少 8 位。',
      unavailable: '读取状态失败。',
    };
    const en = {
      title: 'Authentication',
      intro: 'Manage accounts that may access DSH Web. Passwords are stored as scrypt hashes only; changes revoke the affected sessions immediately.',
      modeUsers: 'Account + password mode',
      modeToken: 'Master token mode',
      modeDisabled: 'Disabled (open access)',
      accounts: 'Accounts: {count}',
      loggedInAs: 'Signed in as {user}',
      logout: 'Sign out',
      logoutConfirm: 'Sign out? Unsaved work is unaffected; the next visit requires a new login.',
      addTitle: 'Add account',
      username: 'Username',
      add: 'Add',
      listTitle: 'Accounts',
      empty: 'No accounts yet.',
      me: 'Current',
      resetPassword: 'Reset password',
      remove: 'Remove',
      removeTitle: 'Remove account',
      save: 'Save',
      cancel: 'Cancel',
      newPassword: 'New password (min 8 chars)',
      passwordTooShort: 'Password must be at least 8 characters.',
      unavailable: 'Failed to load status.',
    };

    const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope'];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-web-auth: dictionaries');
      const t = ctx.locale.bind(NS);
      ctx.slots.inject('settings.plugins.tab', function* () {
        yield ctx.slots.register({
          name: 'settings.plugins.tab',
          id: 'web-auth',
          order: 22,
          label: () => t('title'),
          locale: NS,
          inject: () => ({ t }),
        }, AuthTab);
      });
    }

    return { apply, inject };
  },
});
