/**
 * 「工作树」页：列出仓库的全部 worktree，并支持新建（detached / 新分支）、删除、清理登记。
 *
 * 刻意不提供「自动合回主干」：合回要先在工作树里自动提交、再在主仓库 merge，
 * 冲突时会把用户留在半完成状态。面板的职责是「建出来 / 看清楚 / 安全删掉」。
 */
import React from 'react';
import { basename, dirname } from '../format.js';
import type { ActionApi, GitApi } from '../api.js';
import type { BranchListResult, WorktreeInfo, WorktreeResult } from '../types.js';
import { IconBranch, IconCopy, IconPlus, IconRefresh, IconTrash, IconWorktree } from './icons.jsx';

export interface WorktreeViewProps {
  root: string;
  api: GitApi;
  actions: ActionApi;
  t: (key: string, params?: Record<string, unknown>) => string;
  onSnapshot: (snapshot: unknown) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  busy: string;
  setBusy: (label: string) => void;
}

function badgesFor(info: WorktreeInfo, t: WorktreeViewProps['t']): React.ReactNode[] {
  const badges: React.ReactNode[] = [];
  if (info.current) badges.push(<span key="cur" className="dgp-badge dgp-badge-on">{t('badgeCurrent')}</span>);
  if (info.main) badges.push(<span key="main" className="dgp-badge">{t('badgeMain')}</span>);
  if (!info.exists) badges.push(<span key="missing" className="dgp-badge dgp-badge-warn">{t('badgeMissing')}</span>);
  if (info.locked) badges.push(<span key="locked" className="dgp-badge" title={info.lockReason}>{t('badgeLocked')}</span>);
  if (info.prunable) badges.push(<span key="prunable" className="dgp-badge dgp-badge-warn" title={info.pruneReason}>{t('badgePrunable')}</span>);
  if (info.dirty === true) badges.push(<span key="dirty" className="dgp-badge dgp-badge-warn">{t('badgeDirty', { count: info.dirtyCount ?? 0 })}</span>);
  if (info.dirty === null) badges.push(<span key="unknown" className="dgp-badge dgp-badge-warn">{t('badgeUnknown')}</span>);
  if (info.merged) badges.push(<span key="merged" className="dgp-badge dgp-badge-ok">{t('badgeMerged')}</span>);
  return badges;
}

export function WorktreeView(props: WorktreeViewProps) {
  const { api, actions, t, root } = props;
  const callbacks = React.useRef(props);
  callbacks.current = props;

  const [data, setData] = React.useState<WorktreeResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [baseRef, setBaseRef] = React.useState('HEAD');
  const [mode, setMode] = React.useState<'detached' | 'branch'>('detached');
  const [branch, setBranch] = React.useState('');
  const [branches, setBranches] = React.useState<BranchListResult | null>(null);
  const [removing, setRemoving] = React.useState<WorktreeInfo | null>(null);
  const [force, setForce] = React.useState(false);
  const [exportPatch, setExportPatch] = React.useState(true);
  const [localBusy, setLocalBusy] = React.useState('');

  const applyResult = (response: WorktreeResult & { ok?: boolean }) => {
    setData({
      repo: response.repo ?? null,
      worktrees: response.worktrees ?? [],
      worktreeTotal: response.worktreeTotal ?? 0,
      worktreeTruncated: response.worktreeTruncated === true,
      suggestedRoot: response.suggestedRoot ?? '',
      defaultBranchPrefix: response.defaultBranchPrefix ?? '',
      configuredRoot: response.configuredRoot ?? '',
    });
  };

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.worktrees(root);
      applyResult(response);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [api, root]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (!formOpen || branches !== null) return;
    void (async () => {
      try {
        const response = await api.branches(root);
        setBranches({ local: response.local, remote: response.remote, tags: response.tags, truncated: response.truncated, total: response.total });
      } catch {
        /* 分支列表拉不到不影响用 HEAD 建工作树。 */
      }
    })();
  }, [formOpen, branches, api, root]);

  const create = async () => {
    setLocalBusy('create');
    try {
      const response = await actions.worktreeAdd(root, {
        dirName: label.trim() === '' ? undefined : label.trim(),
        baseRef,
        mode,
        branch: mode === 'branch' && branch.trim() !== '' ? branch.trim() : undefined,
      });
      applyResult(response);
      callbacks.current.onSnapshot(response);
      const createdPath = response.created?.path ?? '';
      callbacks.current.onNotice(t('worktreeCreated', { path: createdPath }));
      setFormOpen(false);
      setLabel('');
      setBranch('');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalBusy('');
      callbacks.current.setBusy('');
    }
  };

  const remove = async () => {
    if (removing === null) return;
    setLocalBusy('remove');
    try {
      const response = await actions.worktreeRemove(root, { path: removing.path, force, exportPatch });
      applyResult(response);
      callbacks.current.onSnapshot(response);
      const patch = response.removedWorktree?.patchPath ?? '';
      const retained = response.removedWorktree?.retainedBranch ?? '';
      callbacks.current.onNotice(
        retained === '' ? t('worktreeRemoved') : t('worktreeRemovedBranchKept', { branch: retained }),
      );
      if (patch !== '') callbacks.current.onNotice(t('patchExported', { path: patch }));
      setRemoving(null);
      setForce(false);
      setExportPatch(true);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalBusy('');
      callbacks.current.setBusy('');
    }
  };

  const prune = async () => {
    setLocalBusy('prune');
    try {
      const response = await actions.worktreePrune(root);
      applyResult(response);
      callbacks.current.onNotice(response.pruneOutput === '' ? t('pruneNothing') : t('pruneDone', { output: response.pruneOutput }));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalBusy('');
      callbacks.current.setBusy('');
    }
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      callbacks.current.onNotice(t('copied'));
    } catch {
      callbacks.current.onNotice(path);
    }
  };

  const busy = props.busy !== '' || localBusy !== '';

  return (
    <div className="dgp-pane">
      <div className="dgp-historybar">
        <span className="dgp-ellipsis dgp-meta" title={data?.suggestedRoot ?? ''}>
          {t('worktreeRootLabel')}: {data?.suggestedRoot ?? '…'}
        </span>
        <span className="dgp-rowactions">
          <button type="button" className="dgp-iconbtn" title={t('prune')} disabled={busy} onClick={() => void prune()}>
            <IconWorktree size={13} />
          </button>
          <button type="button" className="dgp-iconbtn" title={t('refresh')} disabled={loading} onClick={() => void reload()}>
            <IconRefresh size={13} />
          </button>
          <button type="button" className="dgp-iconbtn" title={t('newWorktree')} disabled={busy} onClick={() => setFormOpen((value) => !value)}>
            <IconPlus size={13} />
          </button>
        </span>
      </div>

      {formOpen && (
        <div className="dgp-form">
          <label className="dgp-field">
            <span>{t('worktreeName')}</span>
            <input
              className="dgp-input"
              placeholder={t('worktreeNamePlaceholder')}
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                if (mode === 'branch' && branch === '') setBranch(`${data?.defaultBranchPrefix ?? ''}${event.target.value.trim().replace(/[^\w./-]+/g, '-')}`);
              }}
            />
          </label>
          <label className="dgp-field">
            <span>{t('worktreeBase')}</span>
            <select className="dgp-input" value={baseRef} onChange={(event) => setBaseRef(event.target.value)}>
              <option value="HEAD">{t('worktreeBaseHead')}</option>
              {(branches?.local ?? []).map((ref) => (
                <option key={ref.fullName} value={ref.fullName}>
                  {ref.name}
                </option>
              ))}
              {(branches?.tags ?? []).slice(0, 50).map((ref) => (
                <option key={ref.fullName} value={ref.fullName}>
                  tag: {ref.name}
                </option>
              ))}
            </select>
          </label>
          <div className="dgp-field">
            <span>{t('worktreeMode')}</span>
            <div className="dgp-radio">
              <label className="dgp-check">
                <input type="radio" checked={mode === 'detached'} onChange={() => setMode('detached')} />
                {t('modeDetached')}
              </label>
              <label className="dgp-check">
                <input type="radio" checked={mode === 'branch'} onChange={() => setMode('branch')} />
                {t('modeBranch')}
              </label>
            </div>
          </div>
          {mode === 'branch' && (
            <label className="dgp-field">
              <span>{t('branchName')}</span>
              <input className="dgp-input" placeholder={t('branchNamePlaceholder')} value={branch} onChange={(event) => setBranch(event.target.value)} />
            </label>
          )}
          <div className="dgp-formactions">
            <button type="button" className="dgp-primary" disabled={busy} onClick={() => void create()}>
              {localBusy === 'create' ? t('creating') : t('create')}
            </button>
            <button type="button" disabled={busy} onClick={() => setFormOpen(false)}>
              {t('cancel')}
            </button>
          </div>
          <div className="dgp-hint">{t('worktreeIsolationHint')}</div>
        </div>
      )}

      {error !== '' && <div className="dgp-error">{error}</div>}
      {loading && data === null && <div className="dgp-empty">{t('loading')}</div>}
      {data !== null && data.worktrees.length === 0 && <div className="dgp-empty">{t('noWorktrees')}</div>}

      <div className="dgp-rows">
        {(data?.worktrees ?? []).map((info) => (
          <div className="dgp-wt" key={info.path}>
            <div className="dgp-wthead">
              <IconBranch size={13} />
              <span className="dgp-wtname" title={info.path}>
                {basename(info.path)}
              </span>
              <span className="dgp-hash">{info.head}</span>
              <span className="dgp-rowactions">
                <button type="button" className="dgp-iconbtn" title={t('copyPath')} onClick={() => void copyPath(info.path)}>
                  <IconCopy size={13} />
                </button>
                {!info.main && (
                  <button
                    type="button"
                    className="dgp-iconbtn dgp-dangerbtn"
                    title={t('removeWorktree')}
                    disabled={busy}
                    onClick={() => {
                      setRemoving(info);
                      setForce(false);
                      setExportPatch(info.dirty === true || info.merged === false);
                    }}
                  >
                    <IconTrash size={13} />
                  </button>
                )}
              </span>
            </div>
            <div className="dgp-wtmeta">
              {info.detached ? <span className="dgp-chip">{t('detached')}</span> : <span className="dgp-chip dgp-chip-on">{info.branch}</span>}
              {badgesFor(info, t)}
            </div>
            {dirname(info.path) !== '' && <div className="dgp-meta dgp-ellipsis">{info.path}</div>}

            {removing !== null && removing.path === info.path && (
              <div className="dgp-confirm">
                <div className="dgp-confirmtext">{t('removeWorktreeConfirm', { path: info.path })}</div>
                {(info.dirty === true || info.merged === false) && (
                  <label className="dgp-check">
                    <input type="checkbox" checked={exportPatch} onChange={(event) => setExportPatch(event.target.checked)} />
                    {t('exportPatch')}
                  </label>
                )}
                {info.dirty === true && (
                  <label className="dgp-check">
                    <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                    {t('forceRemove')}
                  </label>
                )}
                <div className="dgp-formactions">
                  <button type="button" className="dgp-dangerbtn dgp-primary" disabled={busy} onClick={() => void remove()}>
                    {localBusy === 'remove' ? t('removing') : t('confirmRemove')}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setRemoving(null)}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {data !== null && data.worktreeTruncated && <div className="dgp-truncated">{t('worktreeTruncated', { total: data.worktreeTotal })}</div>}
      <div className="dgp-hint">{t('worktreeHint')}</div>
    </div>
  );
}
