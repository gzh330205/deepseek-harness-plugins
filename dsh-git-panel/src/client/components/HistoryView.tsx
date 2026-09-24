/**
 * 「历史」页：提交列表（带提交图泳道）+ 提交详情（文件清单 + 单文件差异）+ 分支切换。
 *
 * 分页是 append 语义，**每次 append 后整表重算泳道**，这样跨页的车道不会断。
 * 分支列表懒加载（点开分支选择器时才拉），因为一个仓库可能上千个 ref。
 */
import React from 'react';
import { withGraph } from '../../shared/graph.js';
import { basename, dirname, fullTime, relativeTime } from '../format.js';
import type { ActionApi, GitApi } from '../api.js';
import type { BranchListResult, BranchRef, CommitEntry, CommitResult, GraphRow } from '../types.js';
import { DiffView } from './DiffView.jsx';
import { IconBack, IconBranch, IconChevron, IconExternal, IconRefresh } from './icons.jsx';
import { HISTORY_PAGE_SIZE } from '../constants.js';

/** 每个提交行的基准高度（px）。必须与 styles.css 里 `.dgp-commititem` 的 min-height 一致，
 *  否则泳道连不上——validate.mjs 会断言这两个数字相等。 */
const ROW_HEIGHT = 46;
const LANE_WIDTH = 12;
/** 泳道从 svg 左边缘起算的留白（与下方 d 属性里的 `+ 6` 必须一致）。 */
const GRAPH_INSET = 6;

export interface HistoryViewProps {
  root: string;
  api: GitApi;
  actions: ActionApi;
  t: (key: string, params?: Record<string, unknown>) => string;
  pathFilter: string;
  onClearPathFilter: () => void;
  onOpenFile: (path: string) => void;
  onSnapshot: (snapshot: unknown) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  setBusy: (label: string) => void;
  busy: string;
}

/**
 * 一行的提交图：泳道线段 + 该行的圆点。
 *
 * 线段按 ROW_HEIGHT 画进 viewBox，再用 `preserveAspectRatio="none"` + `height:100%`
 * 拉到行的实际高度——这样即使某行被内容撑高（字号调大、长 refs），相邻行的线也接得上、
 * 不会出现断口。`vector-effect="non-scaling-stroke"` 保证拉伸不会把线拉粗。
 * 圆点放在 SVG 外面：拉伸只该作用于线段，圆点必须是正圆。
 */
function Graph({ rows, lanes }: { rows: GraphRow[]; lanes: number }) {
  const width = lanes * LANE_WIDTH + GRAPH_INSET * 2;
  const lane = (rows[0]?.lane ?? 0) * LANE_WIDTH + GRAPH_INSET;
  return (
    <span className="dgp-graph" style={{ width }}>
      <svg className="dgp-graphlanes" width={width} height="100%" viewBox={`0 0 ${width} ${ROW_HEIGHT}`} preserveAspectRatio="none" aria-hidden>
        {rows.map((row, index) =>
          row.strokes.map((stroke, strokeIndex) => (
            <path
              key={`${index}-${strokeIndex}`}
              className={`dgp-lane dgp-lane-${stroke.color}`}
              vectorEffect="non-scaling-stroke"
              d={`M ${stroke.x1 * LANE_WIDTH + GRAPH_INSET} ${stroke.y1 * ROW_HEIGHT} L ${stroke.x2 * LANE_WIDTH + GRAPH_INSET} ${stroke.y2 * ROW_HEIGHT}`}
            />
          )),
        )}
      </svg>
      <span className={`dgp-dot dgp-lane-fill-${rows[0]?.color ?? 0}`} style={{ left: lane }} />
    </span>
  );
}

function DecorationBadges({ commit }: { commit: CommitEntry }) {
  if (commit.decorations.length === 0) return null;
  return (
    <span className="dgp-decor">
      {commit.decorations.map((decoration) => (
        <span key={`${decoration.kind}:${decoration.name}`} className={`dgp-decoritem dgp-decor-${decoration.kind}`} title={decoration.name}>
          {decoration.name}
        </span>
      ))}
    </span>
  );
}

function BranchPicker(props: {
  t: HistoryViewProps['t'];
  branches: BranchListResult | null;
  loading: boolean;
  current: string;
  busy: string;
  onCheckout: (ref: string, newBranch?: string) => void;
  onReload: () => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = React.useState('');
  const [newBranch, setNewBranch] = React.useState('');
  const { t } = props;
  const match = (ref: BranchRef) => filter === '' || ref.name.toLowerCase().includes(filter.toLowerCase());
  const groups: Array<{ title: string; items: BranchRef[] }> = [
    { title: t('branchLocal'), items: (props.branches?.local ?? []).filter(match) },
    { title: t('branchRemote'), items: (props.branches?.remote ?? []).filter(match).slice(0, 80) },
    { title: t('branchTags'), items: (props.branches?.tags ?? []).filter(match).slice(0, 80) },
  ];

  return (
    <div className="dgp-branchpop">
      <div className="dgp-branchpop-head">
        <input className="dgp-input" placeholder={t('filterBranches')} value={filter} onChange={(event) => setFilter(event.target.value)} autoFocus />
        <button type="button" className="dgp-iconbtn" title={t('refresh')} onClick={props.onReload}>
          <IconRefresh size={13} />
        </button>
      </div>
      {props.loading && <div className="dgp-empty">{t('loading')}</div>}
      <div className="dgp-branchlist">
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.title}>
              <div className="dgp-branchgroup">{group.title}</div>
              {group.items.map((ref) => (
                <button
                  key={ref.fullName}
                  type="button"
                  className={`dgp-branchitem${ref.head ? ' dgp-branchitem-on' : ''}`}
                  disabled={props.busy !== ''}
                  title={ref.subject}
                  onClick={() => props.onCheckout(ref.kind === 'remote' ? ref.fullName : ref.name)}
                >
                  <span className="dgp-branchname">{ref.name}</span>
                  <span className="dgp-branchmeta">{ref.commit}</span>
                </button>
              ))}
            </div>
          ),
        )}
      </div>
      <div className="dgp-branchnew">
        <input className="dgp-input" placeholder={t('newBranchPlaceholder')} value={newBranch} onChange={(event) => setNewBranch(event.target.value)} />
        <button
          type="button"
          disabled={newBranch.trim() === '' || props.busy !== ''}
          onClick={() => props.onCheckout('HEAD', newBranch.trim())}
        >
          {t('createBranch')}
        </button>
      </div>
      <button type="button" className="dgp-linkbtn" onClick={props.onClose}>
        {t('close')}
      </button>
    </div>
  );
}

export function HistoryView(props: HistoryViewProps) {
  const { api, actions, t, root } = props;
  // 回调放进 ref：异步流程里用最新实现，但依赖数组保持稳定，避免每次渲染重发请求。
  const callbacks = React.useRef(props);
  callbacks.current = props;
  const [commits, setCommits] = React.useState<CommitEntry[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const [ref, setRef] = React.useState('');
  const [unborn, setUnborn] = React.useState(false);
  const [branches, setBranches] = React.useState<BranchListResult | null>(null);
  const [branchesLoading, setBranchesLoading] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<{ result: CommitResult; hash: string } | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailDiffPath, setDetailDiffPath] = React.useState('');
  const [detailDiffError, setDetailDiffError] = React.useState('');

  const load = React.useCallback(
    async (options: { skip: number; append: boolean }) => {
      if (options.append) setLoadingMore(true);
      else setLoading(true);
      try {
        const response = await api.history(root, { limit: HISTORY_PAGE_SIZE, skip: options.skip, ref, path: props.pathFilter });
        setUnborn(response.history.unborn === true);
        setCommits((current) => (options.append ? [...current, ...response.history.commits] : response.history.commits));
        setHasMore(response.history.hasMore === true);
        setError('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        if (!options.append) setCommits([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, root, ref, props.pathFilter],
  );

  React.useEffect(() => {
    void load({ skip: 0, append: false });
  }, [load]);

  const loadBranches = React.useCallback(async () => {
    setBranchesLoading(true);
    try {
      const response = await api.branches(root);
      setBranches({ local: response.local, remote: response.remote, tags: response.tags, truncated: response.truncated, total: response.total });
    } catch (cause) {
      callbacks.current.onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBranchesLoading(false);
    }
  }, [api, root]);

  React.useEffect(() => {
    if (pickerOpen && branches === null) void loadBranches();
  }, [pickerOpen, branches, loadBranches]);

  const graph = React.useMemo(() => withGraph(commits), [commits]);

  const openDetail = async (hash: string) => {
    setDetailLoading(true);
    setDetailDiffPath('');
    setDetailDiffError('');
    try {
      const result = await api.commit(root, hash);
      setDetail({ result, hash });
    } catch (cause) {
      callbacks.current.onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetailDiff = async (path: string, orig?: string) => {
    if (detail === null) return;
    if (detailDiffPath === path) {
      setDetailDiffPath('');
      return;
    }
    setDetailLoading(true);
    setDetailDiffError('');
    try {
      const response = await api.commit(root, detail.hash, path, orig);
      setDetail({ result: { detail: detail.result.detail, diff: response.diff }, hash: detail.hash });
      setDetailDiffPath(path);
    } catch (cause) {
      setDetailDiffError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDetailLoading(false);
    }
  };

  const checkout = async (target: string, newBranch?: string) => {
    const confirmText = newBranch === undefined ? t('checkoutConfirm', { ref: target }) : t('createBranchConfirm', { ref: newBranch, base: target });
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(confirmText)) return;
    callbacks.current.setBusy('checkout');
    try {
      const snapshot = await actions.checkout(root, target, newBranch);
      callbacks.current.onSnapshot(snapshot);
      callbacks.current.onNotice(t('checkoutDone', { ref: newBranch ?? target }));
      setPickerOpen(false);
      setBranches(null);
      void load({ skip: 0, append: false });
    } catch (cause) {
      callbacks.current.onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      callbacks.current.setBusy('');
    }
  };

  if (detail !== null) {
    const files = detail.result.detail.files;
    return (
      <div className="dgp-pane">
        <div className="dgp-detailhead">
          <button type="button" className="dgp-iconbtn" onClick={() => setDetail(null)} title={t('back')}>
            <IconBack size={14} />
          </button>
          <span className="dgp-hash">{detail.result.detail.commit.shortHash}</span>
          <span className="dgp-detailpath" title={detail.result.detail.commit.subject}>
            {detail.result.detail.commit.subject}
          </span>
        </div>
        <div className="dgp-commitbody">
          <div className="dgp-meta">
            {detail.result.detail.commit.author} · {fullTime(detail.result.detail.commit.authoredAt)}
          </div>
          {detail.result.detail.merge && <div className="dgp-meta">{t('mergeCommit')}</div>}
          {detail.result.detail.commit.body !== '' && <pre className="dgp-commitmsgtext">{detail.result.detail.commit.body}</pre>}
        </div>
        <div className="dgp-grouphead">
          <span className="dgp-grouptitle">{t('filesChanged', { count: detail.result.detail.totalFiles })}</span>
        </div>
        <div className="dgp-rows">
          {files.map((file) => (
            <div key={`${file.path}:${file.origPath ?? ''}`}>
              <div className="dgp-row">
                <span className="dgp-letter dgp-tone-mod">{file.status.slice(0, 1).toUpperCase()}</span>
                <button type="button" className="dgp-name" onClick={() => void openDetailDiff(file.path, file.origPath)} title={file.path}>
                  <span className="dgp-name-main">{basename(file.path)}</span>
                  {dirname(file.path) !== '' && <span className="dgp-name-dir">{dirname(file.path)}</span>}
                  {file.origPath !== undefined && <span className="dgp-name-from">← {file.origPath}</span>}
                </button>
                <span className="dgp-stat">
                  {file.additions !== null && file.additions > 0 && <span className="dgp-stat-add">+{file.additions}</span>}
                  {file.deletions !== null && file.deletions > 0 && <span className="dgp-stat-del">−{file.deletions}</span>}
                  {file.binary && <span className="dgp-meta">{t('binary')}</span>}
                </span>
                <span className="dgp-rowactions">
                  <button type="button" className="dgp-iconbtn" title={t('openFile')} onClick={() => props.onOpenFile(file.path)}>
                    <IconExternal size={13} />
                  </button>
                </span>
              </div>
              {detailDiffPath === file.path && (
                <div className="dgp-inlinediff">
                  {detailDiffError !== '' && <div className="dgp-error">{detailDiffError}</div>}
                  {detailLoading && <div className="dgp-empty">{t('loadingDiff')}</div>}
                  {!detailLoading && detail.result.diff !== null && <DiffView files={detail.result.diff.files} truncated={detail.result.diff.truncated} t={t} />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dgp-pane">
      <div className="dgp-historybar">
        <button type="button" className="dgp-branchbtn" onClick={() => setPickerOpen((value) => !value)} title={t('switchBranch')}>
          <IconBranch size={13} />
          <span className="dgp-ellipsis">{ref === '' ? t('headRef') : ref}</span>
          {ref !== '' && (
            <span
              className="dgp-clearbtn"
              role="button"
              tabIndex={0}
              title={t('backToHead')}
              onClick={(event) => {
                event.stopPropagation();
                setRef('');
              }}
            >
              ×
            </span>
          )}
        </button>
        <button type="button" className="dgp-iconbtn" title={t('refresh')} onClick={() => void load({ skip: 0, append: false })}>
          <IconRefresh size={13} />
        </button>
      </div>
      {pickerOpen && (
        <BranchPicker
          t={t}
          branches={branches}
          loading={branchesLoading}
          current={ref}
          busy={props.busy}
          onCheckout={(target, newBranch) => void checkout(target, newBranch)}
          onReload={() => void loadBranches()}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {props.pathFilter !== '' && (
        <div className="dgp-hint">
          {t('pathFilter', { path: props.pathFilter })}
          <button type="button" className="dgp-linkbtn" onClick={props.onClearPathFilter}>
            {t('clearFilter')}
          </button>
        </div>
      )}
      {error !== '' && <div className="dgp-error">{error}</div>}
      {loading && <div className="dgp-empty">{t('loading')}</div>}
      {!loading && unborn && <div className="dgp-empty">{t('unbornHint')}</div>}
      {!loading && !unborn && commits.length === 0 && <div className="dgp-empty">{t('noCommits')}</div>}

      <div className="dgp-commitlist">
        {graph.commits.map((commit) => (
          <button type="button" className="dgp-commititem" key={commit.hash} onClick={() => void openDetail(commit.hash)} title={commit.subject}>
            <Graph rows={[commit.graph]} lanes={graph.lanes} />
            <span className="dgp-commitinfo">
              <span className="dgp-subjectline">
                <span className="dgp-commitsubject">{commit.subject}</span>
                <DecorationBadges commit={commit} />
              </span>
              <span className="dgp-commitmeta">
                <span className="dgp-hash">{commit.shortHash}</span>
                <span className="dgp-ellipsis">{commit.author}</span>
                <span className="dgp-commitwhen">{relativeTime(commit.authoredAt)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {hasMore && (
        <button type="button" className="dgp-more" disabled={loadingMore} onClick={() => void load({ skip: commits.length, append: true })}>
          {loadingMore ? t('loading') : t('loadMore')}
        </button>
      )}
    </div>
  );
}
