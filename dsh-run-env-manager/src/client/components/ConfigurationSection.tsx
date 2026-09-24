import React from 'react';
import { errText, type RunEnvApi } from '../api.js';
import { EnvironmentLibrary } from './EnvironmentLibrary.jsx';
import { ENVIRONMENT_KINDS, emptyBindings, emptyConfiguration, type Bindings, type EnvironmentKind, type RunConfiguration, type Snapshot } from '../types.js';

const KIND_LABELS: Record<EnvironmentKind, string> = {
  java: 'Java / JDK',
  maven: 'Maven',
  python: 'Python',
  node: 'Node.js',
  go: 'Go',
  tomcat: 'Tomcat',
  ant: 'Ant',
};

/** 环境变量在表单里用 `KEY=VALUE` 每行一条表示。 */
function envToText(env: Record<string, string>): string {
  return Object.entries(env ?? {}).map(([name, value]) => `${name}=${value}`).join('\n');
}

function textToEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return env;
}

export interface ConfigurationSectionProps {
  snapshot: Snapshot;
  api: RunEnvApi;
  onSnapshot: (snapshot: Snapshot) => void;
  root: string;
  pickDirectory?: () => Promise<string | null>;
  editing: string | null;
  setEditing: (id: string | null) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * 「配置」分页：项目级环境绑定、运行配置增删改、整份 JSON 编辑、全局环境库。
 * 与运行分页共享同一份宿主快照。
 */
export function ConfigurationSection(props: ConfigurationSectionProps) {
  const { snapshot, api, onSnapshot, root, pickDirectory, editing, setEditing, t } = props;
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  // run() 是异步的，用它 .then 收尾时读不到最新的 error state，所以镜像一份到 ref。
  const errorRef = React.useRef('');
  errorRef.current = error;
  const [notice, setNotice] = React.useState('');
  const [jsonOpen, setJsonOpen] = React.useState(false);
  const [jsonText, setJsonText] = React.useState('');
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<RunConfiguration | null>(null);

  const workspace = snapshot.workspace;
  const configurations = workspace?.configurations ?? [];
  const bindings: Bindings = { ...emptyBindings(), ...(workspace?.bindings ?? {}) };
  const environments = snapshot.library.environments;
  const defaults = { ...emptyBindings(), ...snapshot.library.defaults };

  const run = async (label: string, task: () => Promise<Snapshot>, success = '') => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      onSnapshot(await task());
      setNotice(success);
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy('');
    }
  };

  const changeBinding = (kind: EnvironmentKind, id: string) => {
    void run('binding', () => api.saveBindings(root, { ...bindings, [kind]: id }));
  };

  const openEditor = (configuration: RunConfiguration) => {
    setDraft(JSON.parse(JSON.stringify(configuration)) as RunConfiguration);
    setError('');
  };

  // 保存失败时保留草稿与表单，别让用户白填一遍。
  const saveDraft = async () => {
    if (draft === null) return;
    setBusy('config');
    setError('');
    setNotice('');
    try {
      onSnapshot(await api.saveConfiguration(root, draft));
      setNotice(t('configSaved'));
      setDraft(null);
      setEditing(null);
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="renv-config">
      <section className="renv-section">
        <div className="renv-sectionHead">
          <span className="renv-title">{t('projectBindings')}</span>
          <span className="renv-hint">{t('projectBindingsHint')}</span>
        </div>
        <div className="renv-grid2">
          {ENVIRONMENT_KINDS.map((kind) => (
            <label key={kind} className="renv-field">
              {KIND_LABELS[kind]}
              <select value={bindings[kind]} disabled={busy !== ''} onChange={(event) => changeBinding(kind, event.target.value)}>
                <option value="">{t('followDefault')}{defaults[kind] !== '' ? ` (${nameOf(environments, defaults[kind])})` : ''}</option>
                {environments.filter((environment) => environment.kind === kind).map((environment) => (
                  <option key={environment.id} value={environment.id}>{environment.name || environment.id}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {ENVIRONMENT_KINDS.every((kind) => environments.every((environment) => environment.kind !== kind)) && (
          <div className="renv-hint">{t('noEnvironmentHint')}</div>
        )}
      </section>

      <section className="renv-section">
        <div className="renv-sectionHead">
          <span className="renv-title">{t('configurations')}</span>
          <div className="renv-row">
            <button type="button" disabled={busy !== ''} onClick={() => openEditor(emptyConfiguration(suggestConfigId(configurations)))}>
              {t('addConfiguration')}
            </button>
            <button
              type="button"
              disabled={busy !== ''}
              onClick={() => {
                setJsonText(JSON.stringify({ root, bindings, configurations }, null, 2));
                setJsonOpen(true);
                setError('');
              }}
            >
              {t('editJson')}
            </button>
          </div>
        </div>

        {configurations.length === 0 && <div className="renv-hint">{t('emptyConfigurations')}</div>}
        <div className="renv-list">
          {configurations.map((configuration) => (
            <div key={configuration.id} className="renv-libRow">
              <div className="renv-grow">
                <div className="renv-title">{configuration.name || configuration.id}</div>
                <div className="renv-meta">
                  {configuration.type === 'tomcat' ? `tomcat · ${configuration.tomcat.contextPath}:${configuration.tomcat.port}` : configuration.command}
                </div>
                <div className="renv-meta">
                  {t('cwd')}: {configuration.cwd || '${workspaceFolder}'}
                  {boundSummary(configuration, environments) !== '' && ` · ${boundSummary(configuration, environments)}`}
                </div>
              </div>
              <div className="renv-row">
                <button type="button" disabled={busy !== ''} onClick={() => openEditor(configuration)}>{t('edit')}</button>
                <button
                  type="button"
                  className="renv-danger"
                  disabled={busy !== ''}
                  onClick={() => {
                    if (!window.confirm(t('removeConfigurationConfirm', { name: configuration.name || configuration.id }))) return;
                    void run('remove', () => api.removeConfiguration(root, configuration.id));
                  }}
                >
                  {t('remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {draft !== null && (
          <div className="renv-card">
            <div className="renv-grid2">
              <label className="renv-field">
                {t('configId')}
                <input value={draft.id} disabled={editing !== null} onChange={(event) => setDraft({ ...draft, id: event.target.value })} spellCheck={false} />
              </label>
              <label className="renv-field">
                {t('configName')}
                <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t('configNamePlaceholder')} />
              </label>
              <label className="renv-field">
                {t('configType')}
                <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as RunConfiguration['type'] })}>
                  <option value="command">{t('typeCommand')}</option>
                  <option value="tomcat">{t('typeTomcat')}</option>
                </select>
              </label>
              {draft.type === 'command' && (
                <label className="renv-field renv-span2">
                  {t('command')}
                  <input value={draft.command} onChange={(event) => setDraft({ ...draft, command: event.target.value })} placeholder={t('commandPlaceholder')} spellCheck={false} />
                </label>
              )}
              {draft.type === 'tomcat' && (
                <>
                  <label className="renv-field renv-span2">
                    {t('tomcatWebapp')}
                    <input value={draft.tomcat.webapp} onChange={(event) => setDraft({ ...draft, tomcat: { ...draft.tomcat, webapp: event.target.value } })} placeholder={t('tomcatWebappPlaceholder')} spellCheck={false} />
                  </label>
                  <label className="renv-field">
                    {t('tomcatContextPath')}
                    <input value={draft.tomcat.contextPath} onChange={(event) => setDraft({ ...draft, tomcat: { ...draft.tomcat, contextPath: event.target.value } })} placeholder="/app" spellCheck={false} />
                  </label>
                  <label className="renv-field">
                    {t('tomcatPort')}
                    <input type="number" value={draft.tomcat.port} onChange={(event) => setDraft({ ...draft, tomcat: { ...draft.tomcat, port: Number(event.target.value) || 0 } })} />
                  </label>
                  <label className="renv-field">
                    {t('tomcatShutdownPort')}
                    <input type="number" value={draft.tomcat.shutdownPort} onChange={(event) => setDraft({ ...draft, tomcat: { ...draft.tomcat, shutdownPort: Number(event.target.value) || 0 } })} />
                  </label>
                  <label className="renv-field">
                    {t('tomcatJvmArgs')}
                    <input
                      value={draft.tomcat.jvmArgs.join(' ')}
                      onChange={(event) => setDraft({ ...draft, tomcat: { ...draft.tomcat, jvmArgs: event.target.value.split(/\s+/).filter((item) => item !== '') } })}
                      placeholder="-Xmx512m"
                      spellCheck={false}
                    />
                  </label>
                  <label className="renv-field renv-span2">
                    {t('tomcatBuildCommand')}
                    <input value={draft.tomcat.buildCommand} onChange={(event) => setDraft({ ...draft, tomcat: { ...draft.tomcat, buildCommand: event.target.value } })} placeholder="ant -f build.xml compile" spellCheck={false} />
                  </label>
                  <div className="renv-hint renv-span2">{t('tomcatHint')}</div>
                </>
              )}
              <label className="renv-field renv-span2">
                {t('cwd')}
                <div className="renv-row">
                  <input value={draft.cwd} onChange={(event) => setDraft({ ...draft, cwd: event.target.value })} placeholder="${workspaceFolder}" spellCheck={false} />
                  {pickDirectory !== undefined && (
                    <button
                      type="button"
                      onClick={() => void pickDirectory().then((picked) => {
                        if (typeof picked === 'string' && picked !== '') setDraft((current) => (current === null ? current : { ...current, cwd: picked }));
                      })}
                    >
                      {t('browse')}
                    </button>
                  )}
                </div>
              </label>
              <label className="renv-field">
                {t('readyWhen')}
                <input
                  value={draft.readyWhen.url}
                  onChange={(event) => setDraft({ ...draft, readyWhen: { ...draft.readyWhen, url: event.target.value } })}
                  placeholder="http://localhost:5173"
                  spellCheck={false}
                />
              </label>
              <label className="renv-field">
                {t('browserUrl')}
                <input value={draft.browserUrl} onChange={(event) => setDraft({ ...draft, browserUrl: event.target.value })} placeholder={t('optional')} spellCheck={false} />
              </label>
              <label className="renv-field renv-span2">
                {t('envVars')}
                <textarea
                  className="renv-textarea"
                  rows={3}
                  value={envToText(draft.env)}
                  onChange={(event) => setDraft({ ...draft, env: textToEnv(event.target.value) })}
                  placeholder={'KEY=VALUE'}
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="renv-row renv-actions">
              <button type="button" className="renv-primary" disabled={busy !== ''} onClick={() => void saveDraft()}>
                {busy === 'config' ? t('saving') : t('save')}
              </button>
              <button type="button" disabled={busy !== ''} onClick={() => { setDraft(null); setEditing(null); }}>{t('cancel')}</button>
            </div>
          </div>
        )}

        {jsonOpen && (
          <div className="renv-card">
            <div className="renv-hint">{t('editJsonHint')}</div>
            <textarea className="renv-textarea renv-json" rows={14} value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} />
            <div className="renv-row renv-actions">
              <button
                type="button"
                className="renv-primary"
                disabled={busy !== ''}
                onClick={() => {
                  let parsed: { bindings?: Bindings; configurations?: RunConfiguration[] };
                  try {
                    parsed = JSON.parse(jsonText);
                  } catch (cause) {
                    setError(`${t('jsonInvalid')} ${errText(cause)}`);
                    return;
                  }
                  // 本地先解析一次只是为了给人更快的反馈，真正的校验在宿主。
                  void run('json', () => api.saveWorkspace(root, {
                    bindings: { ...emptyBindings(), ...(parsed.bindings ?? {}) },
                    configurations: Array.isArray(parsed.configurations) ? parsed.configurations : [],
                  }), t('jsonSaved')).then(() => {
                    if (errorRef.current === '') setJsonOpen(false);
                  });
                }}
              >
                {busy === 'json' ? t('saving') : t('save')}
              </button>
              <button type="button" disabled={busy !== ''} onClick={() => setJsonOpen(false)}>{t('cancel')}</button>
            </div>
          </div>
        )}
      </section>

      <section className="renv-section">
        <div className="renv-sectionHead">
          <span className="renv-title">{t('globalEnvironments')}</span>
          <button type="button" onClick={() => setLibraryOpen(!libraryOpen)}>{libraryOpen ? t('collapse') : t('expand')}</button>
        </div>
        {libraryOpen && (
          <EnvironmentLibrary snapshot={snapshot} api={api} onSnapshot={onSnapshot} pickDirectory={pickDirectory} t={t} />
        )}
      </section>

      {error !== '' && <div className="renv-error">{error}</div>}
      {notice !== '' && <div className="renv-hint">{notice}</div>}
    </div>
  );
}

function nameOf(environments: Snapshot['library']['environments'], id: string): string {
  return environments.find((environment) => environment.id === id)?.name ?? id;
}

/** 运行配置自己覆盖了哪些环境（用于列表里一眼看出差异）。 */
function boundSummary(configuration: RunConfiguration, environments: Snapshot['library']['environments']): string {
  return Object.entries(configuration.environment ?? {})
    .filter(([, id]) => typeof id === 'string' && id !== '')
    .map(([kind, id]) => `${kind}=${nameOf(environments, id)}`)
    .join(' ');
}

function suggestConfigId(configurations: RunConfiguration[]): string {
  const used = new Set(configurations.map((configuration) => configuration.id));
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `run-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return 'run';
}
