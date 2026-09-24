import React from 'react';
import { errText, type RunEnvApi } from '../api.js';
import { ENVIRONMENT_KINDS, emptyBindings, type DevelopmentEnvironment, type EnvironmentKind, type Snapshot } from '../types.js';

const KIND_LABELS: Record<EnvironmentKind, string> = {
  java: 'Java / JDK',
  maven: 'Maven',
  python: 'Python',
  node: 'Node.js',
  go: 'Go',
  tomcat: 'Tomcat',
  ant: 'Ant',
};

interface DraftEnvironment {
  id: string;
  kind: EnvironmentKind;
  name: string;
  path: string;
}

const emptyDraft = (kind: EnvironmentKind): DraftEnvironment => ({ id: '', kind, name: '', path: '' });

export interface EnvironmentLibraryProps {
  snapshot: Snapshot;
  api: RunEnvApi;
  /** 宿主返回的快照替换回调：所有动作都回全量快照。 */
  onSnapshot: (snapshot: Snapshot) => void;
  /** 可选的原生目录选择器（`uiWorkspace.pickDirectory`）；缺失时手填路径。 */
  pickDirectory?: () => Promise<string | null>;
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * 全局开发环境库管理：从 PATH 检测、手工添加（验证后才入库）、设默认、删除。
 * 与环境类型对应的可执行文件解析、版本探测都在宿主侧完成（见 src/host/environment.js）。
 */
export function EnvironmentLibrary({ snapshot, api, onSnapshot, pickDirectory, t }: EnvironmentLibraryProps) {
  const [draft, setDraft] = React.useState<DraftEnvironment | null>(null);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const run = async (label: string, task: () => Promise<Snapshot | void>, success?: (result: Snapshot | void) => string) => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await task();
      if (result !== undefined) onSnapshot(result);
      setNotice(success?.(result) ?? '');
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy('');
    }
  };

  const environments = snapshot.library.environments;
  const defaults = { ...emptyBindings(), ...snapshot.library.defaults };

  const saveDraft = async (validated: DraftEnvironment) => {
    const id = validated.id.trim() !== ''
      ? validated.id.trim()
      : suggestedId(validated.kind, validated.name, environments);
    const environment: DevelopmentEnvironment = {
      id,
      kind: validated.kind,
      name: validated.name.trim() !== '' ? validated.name.trim() : `${validated.kind} · ${validated.path}`,
      path: validated.path.trim(),
      version: '',
    };
    await run('save', async () => {
      // 先验证再保存：探测走宿主，失败就不入库。
      const probed = await api.validateEnvironment(environment.kind, environment.path);
      const version = probed.validated?.version ?? '';
      return api.saveEnvironment({ ...environment, version });
    }, () => t('librarySaved'));
    setDraft(null);
  };

  return (
    <div className="renv-lib">
      <div className="renv-row renv-rowWrap">
        <button type="button" disabled={busy !== ''} onClick={() => void run('detect', () => api.detect(), (result) => t('libraryDetected', { count: (result as Snapshot).detected ?? 0 }))}>
          {busy === 'detect' ? t('detecting') : t('libraryDetect')}
        </button>
        <button type="button" disabled={busy !== ''} onClick={() => setDraft(emptyDraft('java'))}>
          {t('libraryAdd')}
        </button>
        {notice !== '' && <span className="renv-hint">{notice}</span>}
      </div>

      {draft !== null && (
        <div className="renv-card">
          <div className="renv-grid2">
            <label className="renv-field">
              {t('envKind')}
              <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as EnvironmentKind })}>
                {ENVIRONMENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
                ))}
              </select>
            </label>
            <label className="renv-field">
              {t('envName')}
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t('envNamePlaceholder')} />
            </label>
            <label className="renv-field renv-span2">
              {t('envPath')}
              <div className="renv-row">
                <input value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} placeholder={t('envPathPlaceholder')} spellCheck={false} />
                {pickDirectory !== undefined && (
                  <button
                    type="button"
                    onClick={() => void pickDirectory().then((picked) => {
                      if (typeof picked === 'string' && picked !== '') setDraft((current) => (current === null ? current : { ...current, path: picked }));
                    })}
                  >
                    {t('browse')}
                  </button>
                )}
              </div>
            </label>
          </div>
          <div className="renv-row renv-actions">
            <button type="button" className="renv-primary" disabled={busy !== '' || draft.path.trim() === ''} onClick={() => void saveDraft(draft)}>
              {busy === 'save' ? t('validating') : t('validateAndSave')}
            </button>
            <button type="button" disabled={busy !== ''} onClick={() => setDraft(null)}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {error !== '' && <div className="renv-error">{error}</div>}

      <div className="renv-list">
        {ENVIRONMENT_KINDS.map((kind) => {
          const items = environments.filter((environment) => environment.kind === kind);
          return (
            <div key={kind} className="renv-libGroup">
              <div className="renv-libKind">{KIND_LABELS[kind]}</div>
              {items.length === 0 && <div className="renv-hint">{t('libraryEmptyKind')}</div>}
              {items.map((environment) => (
                <div key={environment.id} className="renv-libRow">
                  <div className="renv-grow">
                    <div className="renv-title">
                      {environment.name || environment.id}
                      {defaults[kind] === environment.id && <span className="renv-tag">{t('isDefault')}</span>}
                    </div>
                    <div className="renv-meta">{environment.version !== '' ? `${environment.version} · ` : ''}{environment.path}</div>
                  </div>
                  <div className="renv-row">
                    {defaults[kind] !== environment.id && (
                      <button type="button" disabled={busy !== ''} onClick={() => void run('default', () => api.setDefault(kind, environment.id))}>
                        {t('setDefault')}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy !== ''}
                      onClick={() => setDraft({ id: environment.id, kind, name: environment.name, path: environment.path })}
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className="renv-danger"
                      disabled={busy !== ''}
                      onClick={() => {
                        if (!window.confirm(t('libraryRemoveConfirm', { name: environment.name || environment.id }))) return;
                        void run('remove', () => api.removeEnvironment(environment.id));
                      }}
                    >
                      {t('remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 由 kind 与名称/版本推出一个可读 id；重名时宿主会报错，这里先补后缀。 */
function suggestedId(kind: EnvironmentKind, name: string, existing: DevelopmentEnvironment[]): string {
  const slug = `${kind}-${(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)}`.replace(/-+$/, '');
  const base = slug === kind ? `${kind}-env` : slug;
  const used = new Set(existing.map((environment) => environment.id));
  let id = base;
  for (let index = 2; used.has(id) && index < 1000; index += 1) id = `${base}-${index}`;
  return id;
}
