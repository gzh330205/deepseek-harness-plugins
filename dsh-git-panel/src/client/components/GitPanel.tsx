/**
 * Git 面板外壳：仓库头部（分支 / ahead-behind / 进行中状态）+ 三个子页
 * （变更 / 历史 / 工作树）+ 统一的错误与提示。
 *
 * 数据来源是宿主的全量快照：有焦点时每 5 秒轮询一次，动作后立即用响应里的
 * 快照整体替换，所以三个子页看到的永远是同一份仓库事实。
 */
import React from 'react';
import { POLL_INTERVAL_MS } from '../constants.js';
import { absolutePath, basename, fileAddressFor } from '../format.js';
import type { ActionApi, GitApi } from '../api.js';
import { errText } from '../api.js';
import { getDiffTarget, subscribeDiffTarget, type DiffItem, type DiffTargetState } from '../diff-target.js';
import { useFileDiff } from '../use-diff.js';
import type { Snapshot } from '../types.js';
import { ChangesView, type Selection } from './ChangesView.jsx';
import { HistoryView } from './HistoryView.jsx';
import { WorktreeView } from './WorktreeView.jsx';
import { IconBranch, IconGit, IconRefresh, IconWarning } from './icons.jsx';

export interface GitPanelProps {
  api: GitApi;
  actions: ActionApi;
  t: (key: string, params?: Record<string, unknown>) => string;
  sessionId?: string;
  /** 会话作用域插槽注入的标准件；缺失时降级。 */
  useSessions?: (selector: (state: unknown) => unknown) => unknown;
  /** 框架注入的 tab 信息 hook：只用来判断面板是否可见。 */
  useTabInfo?: () => { tab?: { visible?: boolean; actions?: { openResource?: (address: string) => void } } } | undefined;
  /** 在中心窗口（root `main` 席位）打开差异；不可用时由调用方回落内联。 */
  openDiffInCenter?: (state: DiffTargetState) => void;
  /** 中心窗口是否可用（`ctx.layout` 在场）。 */
  diffCenterAvailable?: boolean;
}

const NO_SUBSCRIPTION = () => undefined;
type Tab = 'changes' | 'history' | 'worktrees';

export function GitPanel(props: GitPanelProps) {
  const { api, actions, t } = props;
  const useSessions = props.useSessions ?? (NO_SUBSCRIPTION as GitPanelProps['useSessions']);
  const useTabInfo = props.useTabInfo;
  // hook 顺序稳定：useTabInfo 是注册时固定下来的 prop，不会在两次渲染间变化。
  const tabInfo = typeof useTabInfo === 'function' ? useTabInfo() : undefined;
  const visible = tabInfo?.tab?.visible !== false;
  const openResource = tabInfo?.tab?.actions?.openResource;

  const sessionCwd = useSessions((state) => {
    const byId = (state as { byId?: Record<string, { cwd?: string }> } | undefined)?.byId;
    return props.sessionId === undefined ? undefined : byId?.[props.sessionId]?.cwd;
  });

  const [root, setRoot] = React.useState('');
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [tab, setTab] = React.useState<Tab>('changes');
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [historyPath, setHistoryPath] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);

  // 工作区根跟随当前会话（第一次拿到后不再抖动，避免切换会话时把面板切走）。
  React.useEffect(() => {
    if (typeof sessionCwd === 'string' && sessionCwd !== '') setRoot((current) => (current === '' ? sessionCwd : current));
  }, [sessionCwd]);

  // 在途请求标记：轮询是 5 秒一次，大仓库上一次 git status 可能更久，
  // 不加这个就会出现多个 git 进程叠在一起。
  const inflight = React.useRef(false);
  const refresh = React.useCallback(
    async (silent: boolean) => {
      if (root === '' || inflight.current) return;
      inflight.current = true;
      if (!silent) setRefreshing(true);
      try {
        const next = await api.snapshot(root);
        setSnapshot(next);
        if (!silent) setError('');
      } catch (cause) {
        if (!silent) setError(errText(cause));
      } finally {
        inflight.current = false;
        if (!silent) setRefreshing(false);
      }
    },
    [api, root],
  );

  React.useEffect(() => {
    if (root === '') return undefined;
    void refresh(false);
    return undefined;
  }, [root, refresh]);

  React.useEffect(() => {
    if (root === '' || !visible) return undefined;
    const timer = setInterval(() => void refresh(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [root, visible, refresh]);

  // 提示 6 秒后自动消失。
  React.useEffect(() => {
    if (notice === '') return undefined;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 选中文件的状态指纹：暂存/取消暂存/提交都会改变它，从而让差异重新拉取。
  // 只看稳定引用（selection / snapshot）不够——动作后 snapshot 换了新对象，
  // 但 selection 还是同一个，不加指纹就会一直显示动作前的旧差异。
  const selectionFingerprint = React.useMemo(() => {
    if (selection === null) return '';
    const entry = snapshot?.changes.find((item) => item.path === selection.path);
    if (entry === undefined) return 'gone';
    return `${entry.index}${entry.worktree}${entry.untracked === true ? 'u' : ''}${entry.origPath ?? ''}`;
  }, [selection, snapshot]);

  // 中心窗口正在显示哪一行（用于列表高亮）；订阅模块级 store。
  const centerTarget = React.useSyncExternalStore(subscribeDiffTarget, getDiffTarget, getDiffTarget);
  const activeDiffPath = centerTarget === null ? undefined : centerTarget.items[centerTarget.index]?.path;

  // 侧栏内联详情同样用共享 hook 拉差异，保证与中心窗口一致。
  const inlineTarget =
    selection === null || snapshot?.repo == null
      ? null
      : {
          root,
          path: selection.path,
          origPath: selection.origPath,
          staged: selection.staged,
          untracked: selection.untracked,
          fingerprint: selectionFingerprint,
        };
  const { diff, loading: diffLoading, error: diffError } = useFileDiff(api, inlineTarget, snapshot?.contextLines ?? 3);

  const applySnapshot = (next: unknown) => {
    if (next !== null && typeof next === 'object' && 'changes' in (next as Record<string, unknown>)) {
      setSnapshot(next as Snapshot);
    }
  };

  const run = async (label: string, task: () => Promise<unknown>, success?: string) => {
    setBusy(label);
    setError('');
    try {
      const result = await task();
      applySnapshot(result);
      if (success !== undefined) setNotice(success);
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy('');
    }
  };

  const openFile = (relative: string) => {
    if (openResource === undefined || snapshot?.repo == null || props.sessionId === undefined) {
      setNotice(t('openFileUnavailable'));
      return;
    }
    try {
      openResource(fileAddressFor(props.sessionId, absolutePath(snapshot.repo.repoRoot, relative)));
    } catch (cause) {
      setError(errText(cause));
    }
  };

  if (root === '') {
    return (
      <div className="dgp">
        <div className="dgp-empty">{t('needCwd')}</div>
      </div>
    );
  }

  if (snapshot === null) {
    return (
      <div className="dgp">
        <div className="dgp-empty">{error === '' ? t('loading') : error}</div>
      </div>
    );
  }

  const repo = snapshot.repo;

  if (repo === null) {
    return (
      <div className="dgp">
        <div className="dgp-head">
          <span className="dgp-reponame">
            <span className="dgp-ellipsis">{basename(root)}</span>
          </span>
          <button type="button" className="dgp-iconbtn" title={t('refresh')} onClick={() => void refresh(false)}>
            <IconRefresh size={13} />
          </button>
        </div>
        <div className="dgp-empty">
          <IconWarning size={16} />
          <div>{snapshot.reason ?? t('notARepo')}</div>
          {snapshot.gitMissing !== true && <div className="dgp-meta">{root}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="dgp">
      <div className="dgp-head">
        <span className="dgp-reponame" title={repo.repoRoot}>
          <span className="dgp-ellipsis">{repo.name}</span>
          {repo.isWorktree && <span className="dgp-badge">{t('badgeWorktree')}</span>}
        </span>
        <button type="button" className="dgp-iconbtn" title={t('refresh')} disabled={refreshing} onClick={() => void refresh(false)}>
          <IconRefresh size={13} />
        </button>
      </div>

      <div className="dgp-branchrow">
        <span className="dgp-branch" title={repo.upstream === '' ? repo.branch : `${repo.branch} → ${repo.upstream}`}>
          {repo.detached ? t('detachedHead') : repo.unborn ? t('unbornBranch', { branch: repo.branch }) : repo.branch}
        </span>
        {repo.upstream !== '' && <span className="dgp-meta dgp-ellipsis">{repo.upstream}</span>}
        {repo.ahead > 0 && <span className="dgp-ahead">↑{repo.ahead}</span>}
        {repo.behind > 0 && <span className="dgp-behind">↓{repo.behind}</span>}
      </div>

      {repo.state !== 'clean' && (
        <div className="dgp-hint dgp-hint-warn">
          <span>{t('stateInProgress', { state: repo.state })}</span>
          {repo.state === 'merge' && (
            <button type="button" className="dgp-linkbtn" disabled={busy !== ''} onClick={() => void run('abortMerge', () => actions.abortMerge(root), t('mergeAborted'))}>
              {t('abortMerge')}
            </button>
          )}
        </div>
      )}

      <nav className="dgp-tabs">
        {(['changes', 'history', 'worktrees'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`dgp-tab${tab === item ? ' dgp-tab-on' : ''}`}
            onClick={() => {
              setTab(item);
              if (item !== 'changes') setSelection(null);
            }}
          >
            {t(`tab.${item}`)}
            {item === 'changes' && snapshot.counts.total > 0 && <span className="dgp-tabcount">{snapshot.counts.total}</span>}
          </button>
        ))}
      </nav>

      {error !== '' && (
        <div className="dgp-error">
          <IconWarning size={13} />
          <span className="dgp-errortext">{error}</span>
          <button type="button" className="dgp-iconbtn" title={t('dismiss')} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {notice !== '' && <div className="dgp-notice">{notice}</div>}
      {busy !== '' && <div className="dgp-busy">{t('working')}</div>}

      <div className="dgp-body">
        {tab === 'changes' && (
          <ChangesView
            snapshot={snapshot}
            selection={selection}
            diff={diff}
            diffLoading={diffLoading}
            diffError={diffError}
            busy={busy}
            t={t}
            onSelect={setSelection}
            onStage={(paths) => void run('stage', () => actions.stage(root, paths))}
            onUnstage={(paths) => void run('unstage', () => actions.unstage(root, paths))}
            onStageAll={() => void run('stageAll', () => actions.stageAll(root))}
            onUnstageAll={() => void run('unstageAll', () => actions.unstageAll(root))}
            onDiscard={(entry) => {
              const message = entry.untracked === true
                ? t('confirmDeleteUntracked', { path: entry.path })
                : t('confirmDiscard', { path: entry.path });
              if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(message)) return;
              void run('discard', () =>
                entry.untracked === true ? actions.discard(root, [], [entry.path]) : actions.discard(root, [entry.path], []),
              );
            }}
            onCommit={(message, amend) =>
              void run('commit', () => actions.commit(root, message, { amend }), t('commitDone'))
            }
            onOpenFile={openFile}
            onShowFileHistory={(path) => {
              setHistoryPath(path);
              setSelection(null);
              setTab('history');
            }}
            centerAvailable={props.diffCenterAvailable === true && props.openDiffInCenter !== undefined}
            activePath={activeDiffPath}
            onOpenInCenter={(items: DiffItem[], index: number) => {
              if (snapshot.repo === null || props.openDiffInCenter === undefined) return;
              props.openDiffInCenter({
                root,
                repoRoot: snapshot.repo.repoRoot,
                sessionId: props.sessionId,
                items,
                index,
                contextLines: snapshot.contextLines,
              });
              // 中心窗口接管后，侧栏不再显示内联详情。
              setSelection(null);
            }}
          />
        )}
        {tab === 'history' && (
          <HistoryView
            root={root}
            api={api}
            actions={actions}
            t={t}
            pathFilter={historyPath}
            onClearPathFilter={() => setHistoryPath('')}
            onOpenFile={openFile}
            onSnapshot={applySnapshot}
            onError={setError}
            onNotice={setNotice}
            setBusy={setBusy}
            busy={busy}
          />
        )}
        {tab === 'worktrees' && (
          <WorktreeView
            root={root}
            api={api}
            actions={actions}
            t={t}
            onSnapshot={applySnapshot}
            onError={setError}
            onNotice={setNotice}
            setBusy={setBusy}
            busy={busy}
          />
        )}
      </div>
    </div>
  );
}
