window.__ModuleLoader__.load({
  id: 'dsh-mcp-skill-manager',
  factory: (require) => {
    const React = require('react');
    const { createElement: h } = React;
    const cssId = 'dsh-mcp-skill-manager/settings.css';
    const css = `
      .msm{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}.msm h2,.msm h3,.msm p{margin:0}.msm-intro,.msm-muted{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.55}.msm-head,.msm-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.msm-list{display:flex;flex-direction:column;gap:8px}.msm-card{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}.msm-title{font-size:14px;font-weight:600}.msm-meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin-top:3px;overflow-wrap:anywhere}.msm-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.msm button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}.msm button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.msm button:disabled{cursor:default;opacity:.5}.msm-primary{background:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-brand-primary)!important;color:white!important}.msm-danger{color:var(--dsw-alias-state-error-primary)!important}.msm-badge{background:var(--dsw-alias-bg-module-platform);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:11px;padding:2px 8px;white-space:nowrap}.msm-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5}.msm-dialogMask{background:var(--dsw-alias-bg-mask-1);z-index:2000;display:flex;align-items:center;justify-content:center;position:fixed;inset:0;padding:24px}.msm-hint{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}.msm-subhead{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);text-transform:none;margin:6px 0 0}.msm-statusBar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px}.msm-statusBar>div{display:flex;flex-direction:column;gap:2px}.msm-detail{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;line-height:1.5;margin-top:8px}.msm-ok{color:var(--dsw-alias-state-success-primary)}.msm-bad{color:var(--dsw-alias-state-error-primary)}.msm-idle{color:var(--dsw-alias-label-tertiary)}
    .msm-dialog{max-height:calc(100vh - 48px);width:min(640px,100%);overflow:auto;background:var(--dsw-alias-bg-layer-2);border-radius:16px;box-shadow:var(--dsw-shadow-lv3);padding:18px}.msm-dialogHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.msm-close{font-size:20px!important;line-height:1;padding:3px 8px!important}.msm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.msm-form label{display:flex;flex-direction:column;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}.msm-form input,.msm-form select,.msm-form textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px}.msm-form textarea{min-height:150px;resize:vertical}.msm-span{grid-column:1/-1}.msm-check{align-items:center;flex-direction:row!important;gap:7px!important}.msm-check input{width:auto!important}.msm-picker{display:flex;flex-direction:column;gap:8px;margin-top:10px}.msm-choice{display:flex;align-items:flex-start;gap:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:9px}.msm-choice input{margin-top:3px}.msm-choiceText{min-width:0;flex:1}.msm-source{display:flex;gap:6px;flex-wrap:wrap}.msm-source button[data-active=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
    `;
    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${cssId}"]`) === null) { const tag = document.createElement('style'); tag.dataset.plugin = 'dsh-mcp-skill-manager'; tag.dataset.pluginCss = cssId; tag.textContent = css; document.head.appendChild(tag); }

    const NS = 'settings.mcpSkillManager';
    const SETTINGS_NAMESPACE = 'mcp-skill-manager';
    const API = '/dsh-mcp-skill-manager/v1';
    const SOURCES = [['claude-code', 'Claude Code'], ['codex', 'Codex'], ['opencode', 'OpenCode']];
    const emptyMcp = () => ({ id: '', label: '', enabled: true, transport: 'stdio', serverName: '', command: '', args: [], cwd: '', url: '', env: {}, envVars: {}, headers: {}, headerEnvVars: {}, toolCallTimeoutMs: 60000, failOnStartupError: false, maxInstructionBytes: 32768, reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 30000, maxAttempts: 10 } });
    const emptySkill = () => ({ name: '', description: '', whenToUse: '', content: '', enabled: true, modelInvocable: true, userInvocable: true });
    const valueOf = (scope) => scope.getSnapshot().value ?? { mcpServers: [], skills: [], skillLinks: [] };
    const errorText = (error) => error instanceof Error ? error.message : String(error);
    function useScope(scope) { return React.useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot()); }
    function Field({ label, value, onChange, type = 'text', span = false, placeholder = '' }) { return h('label', { className: span ? 'msm-span' : undefined }, label, type === 'textarea' ? h('textarea', { value, placeholder, onChange: (event) => onChange(event.target.value) }) : h('input', { type, value, placeholder, onChange: (event) => onChange(event.target.value) })); }
    function Check({ label, checked, onChange }) { return h('label', { className: 'msm-check' }, h('input', { type: 'checkbox', checked, onChange: (event) => onChange(event.target.checked) }), label); }
    function Dialog({ title, children, close }) { return h('div', { className: 'msm-dialogMask', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) close(); } }, h('section', { className: 'msm-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title }, h('header', { className: 'msm-dialogHead' }, h('h3', null, title), h('button', { className: 'msm-close', type: 'button', onClick: close, 'aria-label': 'Close' }, '×')), children)); }

    /**
     * 键值对编辑器（环境变量 / HTTP 头共用）。
     *
     * 两个必须守住的点：
     *   1. **行标识要稳定**。早期版本用 `${key}:${index}` 当 React key，
     *      于是「打一个字符 → key 变了 → React 认为换了一行 → 重建 DOM → 输入框失焦」，
     *      一个字符都打不连贯。现在每行有一个自增 id，与正在编辑的文本无关。
     *   2. **空名字的行要留在本地**。键清空是为了重打，但投影给上层的对象里
     *      空名字必须被过滤掉（schema 不接受空键名）；本地行列表不能被同步逻辑清掉，
     *      否则光标下面的行会突然消失。
     *
     * 值不再用 password 遮罩显示：它本来就以明文存在 profile 的 cordis.patch.yml 里，
     * 遮罩只会让人没法核对自己填了什么。
     */
    function KeyValueEditor({ label, hint, value, onChange, keyPlaceholder, valuePlaceholder }) {
      const idRef = React.useRef(1);
      const rowsFrom = (source) => Object.entries(source ?? {}).map(([name, item]) => ({ id: idRef.current++, name, value: String(item ?? '') }));
      // 投影：只把名字非空的行交给上层。
      const project = (rows) => Object.fromEntries(rows.filter((row) => row.name.trim() !== '').map((row) => [row.name, row.value]));
      const [rows, setRows] = React.useState(() => rowsFrom(value));

      // 只有当外部值与本地投影不一致时才重建行（也就是父组件真的换了数据：
      // 切换编辑对象、重置表单）。打字过程中投影与外部值一致，绝不重建。
      const projected = JSON.stringify(project(rows));
      React.useEffect(() => {
        if (JSON.stringify(value ?? {}) === projected) return;
        setRows(rowsFrom(value));
      });

      const commit = (next) => { setRows(next); onChange(project(next)); };
      return h('div', { className: 'msm-span' },
        h('label', null, label),
        hint ? h('p', { className: 'msm-muted' }, hint) : null,
        h('div', { className: 'msm-picker' },
          rows.map((row) => h('div', { className: 'msm-row', key: row.id },
            h('input', {
              value: row.name,
              placeholder: keyPlaceholder,
              spellCheck: false,
              autoComplete: 'off',
              onChange: (event) => commit(rows.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item)),
            }),
            h('input', {
              type: 'text',
              value: row.value,
              placeholder: valuePlaceholder,
              spellCheck: false,
              autoComplete: 'off',
              onChange: (event) => commit(rows.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item)),
            }),
            h('button', { type: 'button', className: 'msm-danger', onClick: () => commit(rows.filter((item) => item.id !== row.id)) }, '移除'))),
          h('button', { type: 'button', onClick: () => setRows([...rows, { id: idRef.current++, name: '', value: '' }]) }, '新增')));
    }
    function EnvironmentEditor({ value, onChange }) { return h(KeyValueEditor, { label: '环境变量', hint: '这些值会原样传给 MCP 子进程，并以明文写入本机 profile 的 cordis.patch.yml。', value, onChange, keyPlaceholder: 'JENKINS_URL', valuePlaceholder: '值' }); }
    function HeaderEditor({ value, onChange }) { return h(KeyValueEditor, { label: 'HTTP 请求头', hint: '用于 HTTP MCP 认证，例如 Authorization: Bearer <token> 或 X-API-Key: <key>。值以明文写入本机 profile 的 cordis.patch.yml。', value, onChange, keyPlaceholder: 'Authorization', valuePlaceholder: 'Bearer <token>' }); }
    function McpForm({ initial, save, cancel }) {
      const [draft, setDraft] = React.useState({ ...initial, env: initial.env ?? {}, argsText: (initial.args ?? []).join(' ') }); const [error, setError] = React.useState(''); const patch = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
      const positive = (value, fallback) => { const n = Number(value); return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback; };
      const submit = () => {
        const id = (draft.id ?? '').trim();
        const serverName = (draft.serverName ?? '').trim();
        const command = (draft.command ?? '').trim();
        const url = (draft.url ?? '').trim();
        if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) return setError('标识符必须是小写 kebab-case。');
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(serverName)) return setError('serverName 格式无效（[A-Za-z0-9_-]{1,32}）。');
        if (draft.transport === 'stdio' && command === '') return setError('stdio 服务需要命令。');
        if (draft.transport === 'streamable-http' && !/^https?:\/\//i.test(url)) return setError('HTTP 服务需要有效 URL。');
        if ([draft.toolCallTimeoutMs, draft.maxInstructionBytes, draft.reconnect?.initialDelayMs, draft.reconnect?.maxDelayMs, draft.reconnect?.maxAttempts].some((value) => Number(value) < 1)) return setError('超时、字节上限与重连参数都必须是正整数。');
        const env = Object.fromEntries(Object.entries(draft.env ?? {}).filter(([key]) => key.trim() !== ''));
        const headers = Object.fromEntries(Object.entries(draft.headers ?? {}).filter(([key]) => key.trim() !== ''));
        if (Object.keys(env).some((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) return setError('环境变量名只能包含字母、数字和下划线，且不能以数字开头。');
        if (Object.keys(headers).some((key) => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key))) return setError('HTTP Header 名称格式无效。');
        save({ ...draft, env, headers, id, serverName, label: (draft.label ?? '').trim(), command, cwd: (draft.cwd ?? '').trim(), url,
          args: (draft.argsText ?? '').trim() ? (draft.argsText ?? '').trim().split(/\s+/) : [],
          toolCallTimeoutMs: positive(draft.toolCallTimeoutMs, 60000),
          maxInstructionBytes: positive(draft.maxInstructionBytes, 32768),
          failOnStartupError: Boolean(draft.failOnStartupError),
          reconnect: {
            enabled: draft.reconnect?.enabled !== false,
            initialDelayMs: positive(draft.reconnect?.initialDelayMs, 500),
            maxDelayMs: positive(draft.reconnect?.maxDelayMs, 30000),
            maxAttempts: positive(draft.reconnect?.maxAttempts, 10),
          } });
      };
      return h('div', { className: 'msm-form' }, h(Field, { label: '标识符', value: draft.id, onChange: (value) => patch('id', value), placeholder: 'github' }), h(Field, { label: '显示名称（可选）', value: draft.label, onChange: (value) => patch('label', value) }), h('label', null, '连接类型', h('select', { value: draft.transport, onChange: (event) => patch('transport', event.target.value) }, h('option', { value: 'stdio' }, '本地 stdio'), h('option', { value: 'streamable-http' }, 'Streamable HTTP'))), h(Field, { label: 'serverName', value: draft.serverName, onChange: (value) => patch('serverName', value), placeholder: 'github' }), draft.transport === 'stdio' ? h(Field, { label: '命令', value: draft.command, onChange: (value) => patch('command', value), placeholder: 'npx' }) : h(Field, { label: 'MCP URL', value: draft.url, onChange: (value) => patch('url', value), placeholder: 'https://example.com/mcp' }), draft.transport === 'stdio' ? h(Field, { label: '参数（空格分隔）', value: draft.argsText, onChange: (value) => patch('argsText', value), placeholder: '-y @scope/mcp-server' }) : null, draft.transport === 'stdio' ? h(Field, { label: '工作目录（可选）', value: draft.cwd, onChange: (value) => patch('cwd', value) }) : null, draft.transport === 'stdio' ? h(EnvironmentEditor, { value: draft.env, onChange: (value) => patch('env', value) }) : h(HeaderEditor, { value: draft.headers, onChange: (value) => patch('headers', value) }), h('p', { className: 'msm-subhead msm-span' }, '高级（与官方 dsh-mcp-client 同名同义）'), h(Field, { label: '单次调用超时（ms）', value: draft.toolCallTimeoutMs ?? 60000, onChange: (v) => patch('toolCallTimeoutMs', v) }), h(Field, { label: '服务器指令字节上限', value: draft.maxInstructionBytes ?? 32768, onChange: (v) => patch('maxInstructionBytes', v) }), h(Check, { label: '初始连接失败即拒绝激活（failOnStartupError）', checked: Boolean(draft.failOnStartupError), onChange: (v) => patch('failOnStartupError', v) }), h(Check, { label: '断线自动重连', checked: draft.reconnect?.enabled !== false, onChange: (v) => patch('reconnect', { ...(draft.reconnect ?? {}), enabled: v }) }), h(Field, { label: '重连次数上限', value: draft.reconnect?.maxAttempts ?? 10, onChange: (v) => patch('reconnect', { ...(draft.reconnect ?? {}), maxAttempts: v }) }), h('p', { className: 'msm-muted msm-span' }, '默认 failOnStartupError=false：初始连接失败时 DSH 照常启动，只是这台服务器的工具不会出现（所以才有上面的状态检查）。'),h(Check, { label: '启用', checked: draft.enabled, onChange: (value) => patch('enabled', value) }), error ? h('p', { className: 'msm-error msm-span' }, error) : null, h('div', { className: 'msm-actions msm-span' }, h('button', { onClick: cancel }, '取消'), h('button', { className: 'msm-primary', onClick: submit }, '保存')));
    }
    function SkillForm({ initial, save, cancel }) {
      const [draft, setDraft] = React.useState(initial); const [error, setError] = React.useState(''); const patch = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
      const submit = () => { const name = draft.name.trim(); if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) return setError('名称必须是小写 kebab-case。'); if (!draft.description.trim()) return setError('请填写描述。'); save({ ...draft, name, description: draft.description.trim(), whenToUse: draft.whenToUse.trim() }); };
      return h('div', { className: 'msm-form' }, h(Field, { label: '名称', value: draft.name, onChange: (value) => patch('name', value), placeholder: 'release-check' }), h(Field, { label: '描述', value: draft.description, onChange: (value) => patch('description', value) }), h(Field, { label: '何时使用（可选）', value: draft.whenToUse, onChange: (value) => patch('whenToUse', value), span: true }), h(Field, { label: 'Markdown 指令', value: draft.content, onChange: (value) => patch('content', value), type: 'textarea', span: true }), h(Check, { label: '启用', checked: draft.enabled, onChange: (value) => patch('enabled', value) }), h(Check, { label: '允许模型调用', checked: draft.modelInvocable, onChange: (value) => patch('modelInvocable', value) }), h(Check, { label: '允许用户调用', checked: draft.userInvocable, onChange: (value) => patch('userInvocable', value) }), error ? h('p', { className: 'msm-error msm-span' }, error) : null, h('div', { className: 'msm-actions msm-span' }, h('button', { onClick: cancel }, '取消'), h('button', { className: 'msm-primary', onClick: submit }, '保存')));
    }
    let importerToken;
    async function importerRequest(path, options = {}) {
      if (importerToken === undefined) { const boot = await fetch(`${API}/bootstrap`, { credentials: 'same-origin' }); const bootstrap = await boot.json(); if (!boot.ok) throw new Error(bootstrap.error ?? '无法取得导入授权。'); importerToken = bootstrap.token; }
      const response = await fetch(`${API}${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.headers ?? {}), 'x-dsh-msm-token': importerToken } });
      const result = await response.json(); if (!response.ok) { importerToken = undefined; throw new Error(result.error ?? '导入失败。'); } return result;
    }
    function ImportDialog({ kind, commit, close }) {
      const [source, setSource] = React.useState('claude-code'); const [scan, setScan] = React.useState(null); const [selected, setSelected] = React.useState(() => new Set()); const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
      const load = async (nextSource = source) => { setBusy(true); setError(''); setSelected(new Set()); try { const data = await importerRequest(`/scan?kind=${kind}`); setScan(data.scans.find((item) => item.source === nextSource) ?? null); } catch (err) { setError(errorText(err)); } finally { setBusy(false); } };
      React.useEffect(() => { load(source); }, [source]);
      const entries = scan?.entries ?? []; const toggle = (key) => setSelected((old) => { const next = new Set(old); next.has(key) ? next.delete(key) : next.add(key); return next; });
      const submit = async () => { if (selected.size === 0) return setError('请至少选择一项。'); setBusy(true); setError(''); try { if (kind === 'mcp') await importerRequest('/import-mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, keys: [...selected] }) }); else { for (const key of selected) await importerRequest('/link-skill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, key }) }); } await commit(); close(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); } };
      return h(Dialog, { title: kind === 'mcp' ? '导入 MCP' : '链接外部 Skills', close }, h('p', { className: 'msm-muted' }, kind === 'mcp' ? '仅在你打开此窗口后扫描。配置会转换为 DSH 格式；明文凭据不会导入。' : '仅在你打开此窗口后扫描。选择后在 DSH Skills 目录创建目录链接，不复制 SKILL.md。'), h('div', { className: 'msm-source' }, SOURCES.map(([key, label]) => h('button', { key, 'data-active': key === source, disabled: busy, onClick: () => setSource(key) }, label))), error ? h('p', { className: 'msm-error' }, error) : null, h('div', { className: 'msm-picker' }, busy && scan === null ? h('p', { className: 'msm-muted' }, '正在扫描…') : entries.length === 0 ? h('p', { className: 'msm-muted' }, '未发现可导入项目。') : entries.map((item) => { const key = kind === 'mcp' ? item.importedFrom.sourceKey : item.key; const title = kind === 'mcp' ? (item.label || item.id) : item.displayName; const note = kind === 'mcp' ? `${item.transport} · ${item.sourcePath}${item.diagnostics?.length ? ` · ${item.diagnostics.join(' ')}` : ''}` : `${item.description || '无描述'} · ${item.sourcePath}`; return h('label', { className: 'msm-choice', key }, h('input', { type: 'checkbox', checked: selected.has(key), onChange: () => toggle(key) }), h('span', { className: 'msm-choiceText' }, h('strong', null, title), h('span', { className: 'msm-meta' }, note))); })), h('div', { className: 'msm-actions' }, h('button', { onClick: close, disabled: busy }, '取消'), h('button', { className: 'msm-primary', onClick: submit, disabled: busy || selected.size === 0 }, kind === 'mcp' ? '导入选中的 MCP' : '创建选中的链接')));
    }
    function Confirm({ title, text, confirm, close }) { return h(Dialog, { title, close }, h('p', { className: 'msm-muted' }, text), h('div', { className: 'msm-actions' }, h('button', { onClick: close }, '取消'), h('button', { className: 'msm-danger', onClick: confirm }, '确认'))); }

    /**
     * 状态面板：显示「现在照这份配置去连，连得上吗」。
     *
     * 探测由宿主半做（真的起一次连接：stdio 会拉子进程、HTTP 会握手），
     * 浏览器半只负责触发与展示，所以这里不判断协议，只看宿主给的结论。
     */
    function McpStatusPanel({ health, t, check }) {
      const reports = Object.values(health.byId ?? {});
      const ok = reports.filter((item) => item?.probe?.ok).length;
      const bad = reports.filter((item) => item !== undefined && item.probe !== undefined && item.probe.ok === false && item.probe.skipped !== true).length;
      const busy = health.phase === 'checking';
      const summary = busy ? t('checking') : reports.length === 0 ? t('notChecked') : `${t('healthy')} ${ok} · ${t('unhealthy')} ${bad}`;
      return h('div', { className: 'msm-statusBar' },
        h('div', null, h('strong', null, t('statusTitle')), h('span', { className: 'msm-meta' }, summary)),
        h('button', { className: 'msm-primary', disabled: busy, onClick: () => check() }, busy ? t('checking') : t('checkNow')));
    }

    /** 单个服务的健康行：结论徽章 + 工具数 / 耗时 / 服务器版本 / 错误文本。 */
    function McpHealth({ report, enabled, t }) {
      if (!enabled) return h('p', { className: 'msm-detail msm-idle' }, t('skipped'));
      if (report === undefined) return h('p', { className: 'msm-detail msm-idle' }, t('notChecked'));
      const probe = report.probe ?? {};
      if (probe.skipped === true) return h('p', { className: 'msm-detail msm-idle' }, t('skipped'));
      const parts = [];
      if (probe.ok === true) {
        parts.push(h('span', { className: 'msm-ok', key: 'verdict' }, `● ${t('healthy')}`));
        parts.push(h('span', { className: 'msm-meta', key: 'tools', title: (probe.toolNames ?? []).join(', ') }, `${t('tools')} ${probe.toolCount ?? 0}`));
        if (typeof probe.ms === 'number') parts.push(h('span', { className: 'msm-meta', key: 'ms' }, `${probe.ms} ms`));
        if (probe.serverInfo?.name) parts.push(h('span', { className: 'msm-meta', key: 'info' }, `${probe.serverInfo.name}${probe.serverInfo.version ? ` ${probe.serverInfo.version}` : ''}`));
      } else {
        parts.push(h('span', { className: 'msm-bad', key: 'verdict' }, `● ${t('unhealthy')}`));
        if (typeof probe.ms === 'number') parts.push(h('span', { className: 'msm-meta', key: 'ms' }, `${probe.ms} ms`));
      }
      const mountError = report.mount !== undefined && report.mount !== null && report.mount.ok === false
        ? `${t('mountFailed')}: ${report.mount.error ?? ''}`
        : '';
      // 命令解析层面的诊断（Windows 的 .cmd / 无扩展名 shim 陷阱）：单独一行显示，
      // 它往往才是「服务配了却永远连不上」的真正原因。
      const hint = probe.ok === true ? (report.mount?.hint ?? '') : (probe.hint ?? report.mount?.hint ?? '');
      return h('div', null,
        h('p', { className: 'msm-detail' }, ...parts),
        probe.ok === true ? null : h('p', { className: 'msm-error msm-detail' }, probe.error ?? ''),
        mountError === '' ? null : h('p', { className: 'msm-error msm-detail' }, mountError),
        hint === '' ? null : h('p', { className: 'msm-hint msm-detail' }, hint));
    }

    function McpTab({ scope, t, refresh }) {
      const snapshot = useScope(scope); const current = valueOf(scope); const [dialog, setDialog] = React.useState(null); const [failure, setFailure] = React.useState(''); const [health, setHealth] = React.useState({ phase: 'idle', byId: {} }); const autoChecked = React.useRef(false);
      /* 一个服务一个请求：慢的（npx 首次下载）不会拖住快的，卡片各自亮结果。 */
      const checkStatus = async (ids) => {
        setHealth((old) => ({ ...old, phase: 'checking' }));
        const targets = ids ?? current.mcpServers.filter((server) => server.enabled).map((server) => server.id);
        await Promise.all(targets.map(async (id) => {
          try {
            const response = await fetch(`${API}/mcp-status?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? '状态检查失败。');
            const report = payload.servers?.[0];
            setHealth((old) => ({ ...old, byId: { ...old.byId, [id]: report } }));
          } catch (error) {
            setHealth((old) => ({ ...old, byId: { ...old.byId, [id]: { id, probe: { ok: false, error: errorText(error) } } } }));
          }
        }));
        setHealth((old) => ({ ...old, phase: 'done' }));
      };
      /* 打开 MCP 页自动检查一次：这是「我现在不知道哪个可用」的直接答案。 */
      React.useEffect(() => { if (autoChecked.current) return; autoChecked.current = true; if (current.mcpServers.some((server) => server.enabled)) void checkStatus(); }, []);
      const write = async (servers) => { try { setFailure(''); await scope.set('mcpServers', servers); } catch (error) { setFailure(errorText(error)); } };
      const save = (record) => { const clean = { ...record }; delete clean.argsText; const exists = current.mcpServers.some((item) => item.id === clean.id); if (!exists && current.mcpServers.some((item) => item.serverName === clean.serverName)) return setFailure('serverName 已存在。'); write(exists ? current.mcpServers.map((item) => item.id === clean.id ? clean : item) : [...current.mcpServers, clean]); setDialog(null); };
      if (snapshot.status === 'loading') return h('p', { className: 'msm-muted' }, t('loading')); if (snapshot.status !== 'ready') return h('p', { className: 'msm-error' }, t('unavailable'));
      return h('div', { className: 'msm' }, h('h2', null, t('mcpTab')), h('p', { className: 'msm-intro' }, t('mcpIntro')), h(McpStatusPanel, { health, t, check: () => checkStatus() }), failure ? h('p', { className: 'msm-error' }, failure) : null, h('div', { className: 'msm-head' }, h('h3', null, t('mcpTitle')), h('div', { className: 'msm-actions', style: { marginTop: 0 } }, h('button', { disabled: !snapshot.writable, onClick: () => setDialog({ kind: 'import' }) }, t('import')), h('button', { className: 'msm-primary', disabled: !snapshot.writable, onClick: () => setDialog({ kind: 'add' }) }, t('add')))), h('div', { className: 'msm-list' }, current.mcpServers.length === 0 ? h('p', { className: 'msm-muted' }, t('emptyMcp')) : current.mcpServers.map((server) => h('article', { className: 'msm-card', key: server.id }, h('div', { className: 'msm-row' }, h('div', null, h('div', { className: 'msm-title' }, server.label || server.id), h('div', { className: 'msm-meta' }, `${server.serverName} · ${server.transport}${server.importedFrom?.source ? ` · ${server.importedFrom.source}` : ''}`)), h('span', { className: 'msm-badge' }, server.enabled ? t('enabled') : t('disabled'))), h(McpHealth, { report: health.byId[server.id], enabled: server.enabled, t }), h('div', { className: 'msm-actions' }, h('button', { onClick: () => setDialog({ kind: 'edit', record: server }) }, t('edit')), h('button', { onClick: () => write(current.mcpServers.map((item) => item.id === server.id ? { ...item, enabled: !item.enabled } : item)) }, server.enabled ? t('disable') : t('enable')), h('button', { className: 'msm-danger', onClick: () => setDialog({ kind: 'remove', record: server }) }, t('remove')))))), dialog?.kind === 'add' ? h(Dialog, { title: t('addMcp'), close: () => setDialog(null) }, h(McpForm, { initial: emptyMcp(), save, cancel: () => setDialog(null) })) : null, dialog?.kind === 'edit' ? h(Dialog, { title: t('editMcp'), close: () => setDialog(null) }, h(McpForm, { initial: dialog.record, save, cancel: () => setDialog(null) })) : null, dialog?.kind === 'import' ? h(ImportDialog, { kind: 'mcp', close: () => setDialog(null), commit: () => refresh() }) : null, dialog?.kind === 'remove' ? h(Confirm, { title: t('removeMcp'), text: `确定删除 ${dialog.record.label || dialog.record.id}？`, close: () => setDialog(null), confirm: () => { write(current.mcpServers.filter((item) => item.id !== dialog.record.id)); setDialog(null); } }) : null);
    }
    function SkillsTab({ scope, t, refresh }) {
      const snapshot = useScope(scope); const current = valueOf(scope); const [dialog, setDialog] = React.useState(null); const [failure, setFailure] = React.useState(''); const writeSkills = async (skills) => { try { setFailure(''); await scope.set('skills', skills); } catch (error) { setFailure(errorText(error)); } }; const writeLinks = async (links) => { try { setFailure(''); await scope.set('skillLinks', links); } catch (error) { setFailure(errorText(error)); } };
      const save = (record) => { const exists = current.skills.some((item) => item.name === record.name); writeSkills(exists ? current.skills.map((item) => item.name === record.name ? record : item) : [...current.skills, record]); setDialog(null); };
      const unlink = async (name) => { try { await importerRequest('/unlink-skill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'codex', name }) }); await refresh(); } catch (error) { setFailure(errorText(error)); } };
      if (snapshot.status === 'loading') return h('p', { className: 'msm-muted' }, t('loading')); if (snapshot.status !== 'ready') return h('p', { className: 'msm-error' }, t('unavailable'));
      const all = [...current.skills.map((item) => ({ ...item, linked: false })), ...current.skillLinks.map((item) => ({ ...item, linked: true, description: item.sourcePath }))];
      return h('div', { className: 'msm' }, h('h2', null, t('skillsTab')), h('p', { className: 'msm-intro' }, t('skillsIntro')), failure ? h('p', { className: 'msm-error' }, failure) : null, h('div', { className: 'msm-head' }, h('h3', null, t('skillTitle')), h('div', { className: 'msm-actions', style: { marginTop: 0 } }, h('button', { disabled: !snapshot.writable, onClick: () => setDialog({ kind: 'import' }) }, t('linkImport')), h('button', { className: 'msm-primary', disabled: !snapshot.writable, onClick: () => setDialog({ kind: 'add' }) }, t('add')))), h('div', { className: 'msm-list' }, all.length === 0 ? h('p', { className: 'msm-muted' }, t('emptySkill')) : all.map((skill) => h('article', { className: 'msm-card', key: `${skill.linked ? 'link' : 'managed'}:${skill.name}` }, h('div', { className: 'msm-row' }, h('div', null, h('div', { className: 'msm-title' }, skill.name), h('div', { className: 'msm-meta' }, `${skill.linked ? `${t('linked')} · ` : ''}${skill.description || ''}`)), h('span', { className: 'msm-badge' }, skill.enabled ? t('enabled') : t('disabled'))), h('div', { className: 'msm-actions' }, skill.linked ? null : h('button', { onClick: () => setDialog({ kind: 'edit', record: skill }) }, t('edit')), h('button', { onClick: () => skill.linked ? writeLinks(current.skillLinks.map((item) => item.name === skill.name ? { ...item, enabled: !item.enabled } : item)) : writeSkills(current.skills.map((item) => item.name === skill.name ? { ...item, enabled: !item.enabled } : item)) }, skill.enabled ? t('disable') : t('enable')), h('button', { className: 'msm-danger', onClick: () => setDialog({ kind: skill.linked ? 'unlink' : 'remove', record: skill }) }, skill.linked ? t('unlink') : t('remove')))))), dialog?.kind === 'add' ? h(Dialog, { title: t('addSkill'), close: () => setDialog(null) }, h(SkillForm, { initial: emptySkill(), save, cancel: () => setDialog(null) })) : null, dialog?.kind === 'edit' ? h(Dialog, { title: t('editSkill'), close: () => setDialog(null) }, h(SkillForm, { initial: dialog.record, save, cancel: () => setDialog(null) })) : null, dialog?.kind === 'import' ? h(ImportDialog, { kind: 'skill', close: () => setDialog(null), commit: () => refresh() }) : null, dialog?.kind === 'remove' ? h(Confirm, { title: t('removeSkill'), text: `确定删除 ${dialog.record.name}？`, close: () => setDialog(null), confirm: () => { writeSkills(current.skills.filter((item) => item.name !== dialog.record.name)); setDialog(null); } }) : null, dialog?.kind === 'unlink' ? h(Confirm, { title: t('unlinkSkill'), text: `仅移除 DSH 中的链接，不会删除来源目录。确定取消链接 ${dialog.record.name}？`, close: () => setDialog(null), confirm: () => { unlink(dialog.record.name); setDialog(null); } }) : null);
    }
    const zh = { mcpTab: 'MCP', skillsTab: 'Skills', loading: '正在读取设置…', unavailable: '此部署未提供可编辑的管理设置。', mcpIntro: '新增、编辑、启停 DSH MCP 服务，或手动导入 Claude Code、Codex、OpenCode 的配置。导入仅在你主动打开导入窗口后读取来源。', skillsIntro: '新增托管 Skill，或手动选择外部 Skill 并在 DSH Skills 目录创建链接；不会复制或删除来源文件。', mcpTitle: 'MCP 服务', skillTitle: 'Skills', add: '新增', addMcp: '新增 MCP', editMcp: '编辑 MCP', removeMcp: '删除 MCP', addSkill: '新增 Skill', editSkill: '编辑 Skill', removeSkill: '删除 Skill', unlinkSkill: '取消链接', import: '导入', linkImport: '链接导入', emptyMcp: '尚未配置 MCP 服务。', emptySkill: '尚未添加 Skill。', enabled: '已启用', disabled: '已停用', edit: '编辑', enable: '启用', disable: '停用', remove: '删除', unlink: '取消链接', linked: '外部链接', statusTitle: '状态检查', checkNow: '重新检查', checking: '正在探测…', notChecked: '未检查', healthy: '可用', unhealthy: '不可用', skipped: '已停用', tools: '工具', mountFailed: 'DSH 启动时未载入' };
    const en = { mcpTab: 'MCP', skillsTab: 'Skills', loading: 'Loading settings…', unavailable: 'This deployment does not expose editable manager settings.', mcpIntro: 'Add, edit, enable, or disable DSH MCP servers, or manually import configuration from Claude Code, Codex, or OpenCode. Sources are read only when you open Import.', skillsIntro: 'Create managed Skills or manually select an external Skill to link inside the DSH Skills directory. Source files are neither copied nor deleted.', mcpTitle: 'MCP servers', skillTitle: 'Skills', add: 'Add', addMcp: 'Add MCP', editMcp: 'Edit MCP', removeMcp: 'Remove MCP', addSkill: 'Add Skill', editSkill: 'Edit Skill', removeSkill: 'Remove Skill', unlinkSkill: 'Unlink Skill', import: 'Import', linkImport: 'Link import', emptyMcp: 'No MCP servers are configured.', emptySkill: 'No Skills have been added.', enabled: 'Enabled', disabled: 'Disabled', edit: 'Edit', enable: 'Enable', disable: 'Disable', remove: 'Remove', unlink: 'Unlink', linked: 'External link', statusTitle: 'Status check', checkNow: 'Re-check', checking: 'Probing…', notChecked: 'Not checked', healthy: 'Reachable', unhealthy: 'Unreachable', skipped: 'Disabled', tools: 'tools', mountFailed: 'Failed to start in DSH' };
    const inject = ['slots', 'locale', 'connection', 'remote', 'configForms'];
    /**
     * 合集耦合点：合集的浏览器半区在 settings.section(plugin-kit) 上声明了一个
     * list 子槽 settings.pluginKit.tab。子插件把设置页贡献到该槽时，它会出现在
     * 「设置 → 插件合集」分区的页签栏里；合集缺席时退回本插件自己的入口。
     * 别改槽名：它是 dsh-plugin-kit 与全部子插件之间的唯一契约。
     * 契约副本：src/client/kit-tab.mjs（客户端半区不能 import npm 包，故此处内联）。
     */
    function registerKitTab(ctx, options) {
      const slot = options.slot ?? 'settings.pluginKit.tab';
      const slots = ctx.slots;
      let dispose;
      let mode;
      const apply = () => {
        const declared = slots.spec?.(slot) !== undefined;
        const next = declared ? 'tab' : options.fallback ? 'fallback' : undefined;
        if (next === mode) return;
        if (dispose) dispose();
        dispose = undefined;
        mode = next;
        dispose = next === 'tab' ? options.tab() : next === 'fallback' ? options.fallback() : undefined;
      };
      const off = slots.subscribe(slot, apply);
      apply();
      ctx.effect(() => () => { off(); if (dispose) dispose(); }, options.effectName ?? 'plugin-kit: settings tab');
    }
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mcp-skill-manager: dictionaries');
      const t = ctx.locale.bind(NS);
      const scope = ctx.configForms.get(SETTINGS_NAMESPACE); /* 0.1.7: 条目 id 即设置命名空间 */
      const refresh = () => ctx.configForms.describe().ensure();
      /* 一个设置页 = 一组 register options + 组件；合集在场挂到合集槽，缺席挂回内置插件页。
         expose 的 inject 回调是普通箭头函数并且**立即执行**（目标槽已声明时同步注册），回调
         返回 register 的 disposer —— 不用 generator、不依赖 inject 的惰性重放。 */
      const expose = (slot, options, component) => ctx.slots.inject(slot, () => ctx.slots.register({ ...options, name: slot, locale: NS, inject: () => ({ scope, t, refresh }) }, component));
      const mcpOptions = { id: 'mcp', order: 20, label: () => t('mcpTab') };
      const skillOptions = { id: 'skills', order: 21, label: () => t('skillsTab') };
      registerKitTab(ctx, {
        effectName: 'mcp-skill-manager: kit settings tab (mcp)',
        tab: () => expose('settings.pluginKit.tab', mcpOptions, McpTab),
        fallback: () => expose('settings.plugins.tab', mcpOptions, McpTab),
      });
      registerKitTab(ctx, {
        effectName: 'mcp-skill-manager: kit settings tab (skills)',
        tab: () => expose('settings.pluginKit.tab', skillOptions, SkillsTab),
        fallback: () => expose('settings.plugins.tab', skillOptions, SkillsTab),
      });
    }
    return { apply, inject };
  }
});
