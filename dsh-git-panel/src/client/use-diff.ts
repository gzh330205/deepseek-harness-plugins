/**
 * 拉取单个文件的差异：右侧栏的内联详情与中间窗口的差异页共用一份实现，
 * 保证两处对「同一状态看同一份 diff」的行为一致（含状态指纹触发的重新拉取）。
 */
import React from 'react';
import { errText, type GitApi } from './api.js';
import type { FileDiffResult } from './types.js';

export interface DiffRequestTarget {
  root: string;
  path: string;
  origPath?: string;
  staged: boolean;
  untracked: boolean;
  /** 变更状态指纹：暂存/取消暂存/提交后变化，用来触发重新拉取。 */
  fingerprint?: string;
}

export interface FileDiffState {
  diff: FileDiffResult | null;
  loading: boolean;
  error: string;
}

export function useFileDiff(api: GitApi, target: DiffRequestTarget | null, contextLines: number): FileDiffState {
  const [diff, setDiff] = React.useState<FileDiffResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (target === null) {
      setDiff(null);
      setError('');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const response = await api.diff(target.root, {
          path: target.path,
          orig: target.origPath,
          staged: target.staged,
          untracked: target.untracked,
          context: contextLines,
        });
        if (!cancelled) setDiff(response.diff);
      } catch (cause) {
        if (!cancelled) {
          setDiff(null);
          setError(errText(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, target?.root, target?.path, target?.origPath, target?.staged, target?.untracked, target?.fingerprint, contextLines]);

  return { diff, loading, error };
}
