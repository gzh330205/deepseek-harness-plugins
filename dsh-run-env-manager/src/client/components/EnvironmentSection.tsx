import React from 'react';
import { errText, type RunEnvApi } from '../api.js';
import { EnvironmentLibrary } from './EnvironmentLibrary.jsx';
import type { Snapshot } from '../types.js';

export interface EnvironmentSectionProps {
  api: RunEnvApi;
  pickDirectory?: () => Promise<string | null>;
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * 设置页里的全局开发环境区。设置页没有会话上下文，所以自己拉一份
 * 不含工作区的快照（`status?root=`），与环境库的读写完全一致。
 */
export function EnvironmentSection({ api, pickDirectory, t }: EnvironmentSectionProps) {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await api.status('');
        if (!cancelled) setSnapshot(next);
      } catch (cause) {
        if (!cancelled) setError(errText(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error !== '') return <div className="renv renv-error">{error}</div>;
  if (snapshot === null) return <div className="renv renv-hint">{t('loading')}</div>;
  return (
    <div className="renv">
      <div className="renv-hint">{t('settingsIntro')}</div>
      <EnvironmentLibrary snapshot={snapshot} api={api} onSnapshot={setSnapshot} pickDirectory={pickDirectory} t={t} />
    </div>
  );
}
