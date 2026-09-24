/**
 * 「变更」页：待提交的变更文件列表 + 提交流程 + 单文件差异。
 *
 * 分组口径与 git 一致，并显示**两组可以同时出现同一个文件**（既暂存又改动）：
 *  - 冲突（unmerged）
 *  - 已暂存（index 侧有变化）
 *  - 未跟踪
 *  - 未暂存（工作区侧有变化）
 *
 * 列表有两种显示模式，用户可切换并记住选择：
 *  - `flat`（默认）平铺：一行一个文件，行内带弱化的目录前缀；
 *  - `tree` 目录：按目录折叠成树，目录行聚合文件数与增删行数。
 * 两种模式都**在分组内部**生效——分组决定了该行是「暂存侧」还是「工作区侧」，
 * 批量动作（全部暂存/全部取消）也仍然按分组走，所以切模式不会改变语义。
 */
import React from 'react';
import { basename, dirname } from '../format.js';
import { groupChanges, kindLetter, kindTone, statBadge } from '../../shared/git-status.js';
import { buildChangeTree, collectDirectoryPaths } from '../../shared/change-tree.js';
import type { DiffItem } from '../diff-target.js';
import { DiffView } from './DiffView.jsx';
import { IconBack, IconChevron, IconExpand, IconExternal, IconMinus, IconPlus, IconUndo } from './icons.jsx';
import type { ChangeEntry, FileDiffResult, Snapshot } from '../types.js';

/** 显示模式：平铺 / 目录树。 */
export type ChangesViewMode = 'flat' | 'tree';

/** 点文件时差异开在哪里：中间窗口 / 侧栏内联。 */
export type DiffOpenTarget = 'center' | 'inline';

const VIEW_STORAGE_KEY = 'dsh-git-panel/changes-view';
const OPEN_STORAGE_KEY = 'dsh-git-panel/diff-open-target';

/** 读取记住的显示模式：SSR、无 localStorage、解析失败都回落到平铺。 */
export function readStoredViewMode(): ChangesViewMode {
  try {
    if (typeof window === 'undefined' || window.localStorage === undefined) return 'flat';
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'tree' ? 'tree' : 'flat';
  } catch {
    return 'flat';
  }
}

function storeViewMode(mode: ChangesViewMode): void {
  try {
    if (typeof window === 'undefined' || window.localStorage === undefined) return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    /* 存不下就算了，本次会话内仍然生效。 */
  }
}

/** 默认「中间窗口」：这正是用户点文件时最想看到的位置；侧栏内联作为备选。 */
export function readStoredOpenTarget(): DiffOpenTarget {
  try {
    if (typeof window === 'undefined' || window.localStorage === undefined) return 'center';
    return window.localStorage.getItem(OPEN_STORAGE_KEY) === 'inline' ? 'inline' : 'center';
  } catch {
    return 'center';
  }
}

function storeOpenTarget(target: DiffOpenTarget): void {
  try {
    if (typeof window === 'undefined' || window.localStorage === undefined) return;
    window.localStorage.setItem(OPEN_STORAGE_KEY, target);
  } catch {
    /* 同上 */
  }
}

type Side = 'staged' | 'worktree';

/** 平铺模式下不需要树；给 `ChangeTree` 一个稳定的空树，避免每次渲染新建对象。 */
const EMPTY_TREE = buildChangeTree([]);

export interface Selection {
  path: string;
  origPath?: string;
  staged: boolean;
  untracked: boolean;
  kind: string;
}

export interface ChangesViewProps {
  snapshot: Snapshot;
  selection: Selection | null;
  diff: FileDiffResult | null;
  diffLoading: boolean;
  diffError: string;
  busy: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  onSelect: (selection: Selection | null) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  onDiscard: (entry: ChangeEntry) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onCommit: (message: string, amend: boolean) => void;
  onOpenFile: (path: string) => void;
  onShowFileHistory: (path: string) => void;
  /** 中间窗口（root `main` 席位）是否可用；不可用时一律走侧栏内联。 */
  centerAvailable: boolean;
  /** 在中间窗口打开：传入同组条目与点击下标。 */
  onOpenInCenter?: (items: DiffItem[], index: number) => void;
  /** 中间窗口当前显示的文件路径（高亮对应行）。 */
  activePath?: string;
}

function StatBadge({ entry, side }: { entry: ChangeEntry; side: Side }) {
  const stat = entry.stats?.[side] ?? null;
  if (stat === null) return null;
  const badge = statBadge(stat as never);
  if (badge === null) return stat.binary ? <span className="dgp-meta">{'bin'}</span> : null;
  return (
    <span className="dgp-stat">
      {badge.additions > 0 && <span className="dgp-stat-add">+{badge.additions}</span>}
      {badge.deletions > 0 && <span className="dgp-stat-del">−{badge.deletions}</span>}
    </span>
  );
}

/** 目录行的聚合增删（`unknown` 表示子树里都是未跟踪那类没有行数的条目）。 */
function AggregateBadge({ stats }: { stats: { additions: number; deletions: number; binary: boolean; unknown: boolean } }) {
  if (stats.unknown === true) return null;
  if (stats.binary === true && stats.additions === 0 && stats.deletions === 0) return <span className="dgp-meta">{'bin'}</span>;
  return (
    <span className="dgp-stat">
      {stats.additions > 0 && <span className="dgp-stat-add">+{stats.additions}</span>}
      {stats.deletions > 0 && <span className="dgp-stat-del">−{stats.deletions}</span>}
    </span>
  );
}

function ChangeRow(props: {
  entry: ChangeEntry;
  side: Side;
  t: ChangesViewProps['t'];
  onOpen: () => void;
  actions: React.ReactNode;
  /** 目录模式下的缩进层级。 */
  depth?: number;
  /** 目录模式下行内不再重复目录前缀。 */
  hideDirectory?: boolean;
  /** 该行是否是中间窗口正在显示的文件。 */
  active?: boolean;
}) {
  const { entry, side, t } = props;
  const directory = dirname(entry.path);
  const renamed = entry.origPath !== undefined && entry.origPath !== entry.path;
  const indent = props.depth === undefined ? undefined : { paddingLeft: 10 + props.depth * 12 };
  return (
    <div className={`dgp-row${props.active === true ? ' dgp-row-on' : ''}`} style={indent}>
      <span className={`dgp-letter dgp-tone-${kindTone(entry.kind)}`} title={t(`kind.${entry.kind}`)}>
        {kindLetter(entry.kind)}
      </span>
      <button type="button" className="dgp-name" onClick={props.onOpen} title={entry.path}>
        <span className="dgp-name-main">{basename(entry.path)}</span>
        {props.hideDirectory !== true && directory !== '' && <span className="dgp-name-dir">{directory}</span>}
        {renamed && <span className="dgp-name-from">← {entry.origPath}</span>}
      </button>
      <StatBadge entry={entry} side={side} />
      <span className="dgp-rowactions">{props.actions}</span>
    </div>
  );
}

/** 目录树的递归渲染：目录行可折叠，文件行复用 `ChangeRow`。 */
function TreeNodes(props: {
  nodes: Array<ReturnType<typeof buildChangeTree>['children'][number]>;
  depth: number;
  side: Side;
  t: ChangesViewProps['t'];
  collapsed: Record<string, boolean>;
  toggle: (path: string) => void;
  renderFile: (entry: ChangeEntry, depth: number) => React.ReactNode;
}) {
  const { nodes, depth, side, t } = props;
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'file') return <React.Fragment key={node.path}>{props.renderFile(node.entry as ChangeEntry, depth)}</React.Fragment>;
        const open = props.collapsed[node.path] !== true;
        return (
          <React.Fragment key={node.path}>
            <div className="dgp-row dgp-dirrow" style={{ paddingLeft: 6 + depth * 12 }} title={node.path}>
              <button type="button" className="dgp-dirtoggle" onClick={() => props.toggle(node.path)}>
                <IconChevron size={12} open={open} />
                <span className="dgp-dirname">{node.name}</span>
              </button>
              <span className="dgp-meta dgp-dircount">{t('dirFiles', { count: node.files })}</span>
              <AggregateBadge stats={node[side]} />
            </div>
            {open && (
              <TreeNodes
                nodes={node.children as never}
                depth={depth + 1}
                side={side}
                t={t}
                collapsed={props.collapsed}
                toggle={props.toggle}
                renderFile={props.renderFile}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * 一个分组的正文：按当前模式渲染平铺行或目录树。
 * 折叠状态由面板持有（`collapsed` / `onToggle`）：这样「全部折叠 / 全部展开」能一次
 * 作用到所有分组，同一个目录在「已暂存」与「未暂存」两组里的开合也保持一致。
 */
function ChangeTree(props: {
  entries: ChangeEntry[];
  tree: ReturnType<typeof buildChangeTree>;
  mode: ChangesViewMode;
  side: Side;
  t: ChangesViewProps['t'];
  collapsed: Record<string, boolean>;
  onToggle: (path: string) => void;
  renderFile: (entry: ChangeEntry, depth: number) => React.ReactNode;
}) {
  if (props.mode !== 'tree') {
    return (
      <>
        {props.entries.map((entry) => (
          <React.Fragment key={entry.path}>{props.renderFile(entry, 0)}</React.Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      <TreeNodes
        nodes={props.tree.children as never}
        depth={0}
        side={props.side}
        t={props.t}
        collapsed={props.collapsed}
        toggle={props.onToggle}
        renderFile={props.renderFile}
      />
    </>
  );
}

function Group(props: {
  title: string;
  count: number;
  children: React.ReactNode;
  action?: React.ReactNode;
  tone?: string;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="dgp-group">
      <div className="dgp-grouphead">
        <button type="button" className="dgp-grouptoggle" onClick={() => setOpen((value) => !value)}>
          <IconChevron size={12} open={open} />
          <span className={`dgp-grouptitle${props.tone === undefined ? '' : ` dgp-tone-${props.tone}`}`}>{props.title}</span>
          <span className="dgp-groupcount">{props.count}</span>
        </button>
        {props.action}
      </div>
      {open && <div className="dgp-rows">{props.children}</div>}
    </section>
  );
}

function CommitBox(props: {
  t: ChangesViewProps['t'];
  stagedCount: number;
  busy: string;
  onCommit: (message: string, amend: boolean) => void;
}) {
  const [message, setMessage] = React.useState('');
  const [amend, setAmend] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const { t } = props;

  React.useEffect(() => {
    if (props.stagedCount === 0) {
      setMessage('');
      setAmend(false);
      setConfirming(false);
    }
  }, [props.stagedCount]);

  const submit = () => {
    if (message.trim() === '') return;
    if (amend && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    props.onCommit(message, amend);
    setMessage('');
    setAmend(false);
  };

  return (
    <div className="dgp-commitbox">
      <textarea
        className="dgp-commitmsg"
        placeholder={t('commitPlaceholder', { count: props.stagedCount })}
        value={message}
        rows={2}
        onChange={(event) => {
          setMessage(event.target.value);
          setConfirming(false);
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="dgp-commitrow">
        <label className="dgp-check">
          <input
            type="checkbox"
            checked={amend}
            onChange={(event) => {
              setAmend(event.target.checked);
              setConfirming(false);
            }}
          />
          {t('amend')}
        </label>
        <button
          type="button"
          className={`dgp-primary${confirming ? ' dgp-dangerbtn' : ''}`}
          disabled={message.trim() === '' || props.busy !== ''}
          onClick={submit}
        >
          {confirming ? t('amendConfirm') : t('commit')}
        </button>
      </div>
    </div>
  );
}

export function ChangesView(props: ChangesViewProps) {
  const { snapshot, selection, t } = props;
  const [mode, setMode] = React.useState<ChangesViewMode>(readStoredViewMode);
  const [openTarget, setOpenTarget] = React.useState<DiffOpenTarget>(readStoredOpenTarget);
  const switchMode = React.useCallback((next: ChangesViewMode) => {
    setMode(next);
    storeViewMode(next);
  }, []);
  const switchOpenTarget = React.useCallback((next: DiffOpenTarget) => {
    setOpenTarget(next);
    storeOpenTarget(next);
  }, []);
  // 分组与目录树一起算：依赖只是快照里的变更数组，轮询拿到同一份引用时不会重算。
  const { groups, trees } = React.useMemo(() => {
    const next = groupChanges(snapshot.changes as never);
    if (mode !== 'tree') return { groups: next, trees: null };
    return {
      groups: next,
      trees: {
        conflicts: buildChangeTree(next.conflicts as never),
        staged: buildChangeTree(next.staged as never),
        untracked: buildChangeTree(next.untracked as never),
        unstaged: buildChangeTree(next.unstaged as never),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, snapshot.changes]);

  // 折叠状态由面板持有；「全部折叠」需要事先知道所有目录路径。
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const toggleDirectory = React.useCallback((path: string) => {
    setCollapsed((current) => ({ ...current, [path]: current[path] !== true }));
  }, []);
  const directoryPaths = React.useMemo(() => {
    if (trees === null) return [] as string[];
    return [...new Set([
      ...collectDirectoryPaths(trees.conflicts as never),
      ...collectDirectoryPaths(trees.staged as never),
      ...collectDirectoryPaths(trees.untracked as never),
      ...collectDirectoryPaths(trees.unstaged as never),
    ])];
  }, [trees]);
  const collapsedCount = directoryPaths.filter((path) => collapsed[path] === true).length;
  const expandAll = React.useCallback(() => setCollapsed({}), []);
  const collapseAll = React.useCallback(() => setCollapsed(Object.fromEntries(directoryPaths.map((path) => [path, true]))), [directoryPaths]);

  /** 一个条目 → 中心窗口的条目形状。 */
  const toItem = React.useCallback(
    (entry: ChangeEntry, side: Side): DiffItem => ({
      path: entry.path,
      origPath: entry.origPath,
      staged: side === 'staged',
      untracked: side === 'worktree' && entry.untracked === true,
      kind: entry.kind,
    }),
    [],
  );

  /**
   * 点一行：默认把差异开在中间窗口，侧栏列表保持原位（该行高亮）；
   * 选了「侧栏」或中间窗口不可用时，回落到原来的内联详情。
   */
  const openEntry = React.useCallback(
    (entries: ChangeEntry[], entry: ChangeEntry, side: Side) => {
      if (openTarget === 'center' && props.centerAvailable && props.onOpenInCenter !== undefined) {
        const index = entries.indexOf(entry);
        props.onOpenInCenter(entries.map((candidate) => toItem(candidate, side)), index < 0 ? 0 : index);
        return;
      }
      props.onSelect({
        path: entry.path,
        origPath: entry.origPath,
        staged: side === 'staged',
        untracked: side === 'worktree' && entry.untracked === true,
        kind: entry.kind,
      });
    },
    [openTarget, props, toItem],
  );
  const onlyUntracked = groups.untracked.length > 0 && groups.staged.length === 0 && groups.unstaged.length === 0 && groups.conflicts.length === 0;

  if (selection !== null) {
    const entry = snapshot.changes.find((item) => item.path === selection.path);
    return (
      <div className="dgp-pane">
        <div className="dgp-detailhead">
          <button type="button" className="dgp-iconbtn" onClick={() => props.onSelect(null)} title={t('back')}>
            <IconBack size={14} />
          </button>
          <span className="dgp-detailpath" title={selection.path}>
            {basename(selection.path)}
          </span>
          <span className={`dgp-chip${selection.staged ? ' dgp-chip-on' : ''}`}>
            {selection.staged ? t('staged') : selection.untracked ? t('untracked') : t('unstaged')}
          </span>
          <span className="dgp-rowactions">
            {props.centerAvailable && props.onOpenInCenter !== undefined && (
              <button
                type="button"
                className="dgp-iconbtn"
                title={t('openInCenter')}
                onClick={() => {
                  const entry = snapshot.changes.find((item) => item.path === selection.path);
                  const side: Side = selection.staged ? 'staged' : 'worktree';
                  const entries = selection.staged ? groups.staged : selection.untracked ? groups.untracked : groups.unstaged;
                  const index = entry === undefined ? 0 : Math.max(0, entries.indexOf(entry));
                  props.onOpenInCenter?.((entries.length === 0 ? [entry].filter(Boolean) : entries).map((item) => toItem(item as ChangeEntry, side)), index);
                }}
              >
                <IconExpand size={14} />
              </button>
            )}
            <button type="button" className="dgp-iconbtn" onClick={() => props.onOpenFile(selection.path)} title={t('openFile')}>
              <IconExternal size={14} />
            </button>
            <button type="button" className="dgp-iconbtn" onClick={() => props.onShowFileHistory(selection.path)} title={t('fileHistory')}>
              <IconUndo size={14} />
            </button>
          </span>
        </div>
        {dirname(selection.path) !== '' && <div className="dgp-detaildir">{dirname(selection.path)}</div>}
        {props.diffError !== '' && <div className="dgp-error">{props.diffError}</div>}
        {props.diffLoading && <div className="dgp-empty">{t('loadingDiff')}</div>}
        {!props.diffLoading && props.diff !== null && (
          <DiffView
            files={props.diff.file === null ? [] : [props.diff.file]}
            truncated={props.diff.truncated}
            emptyHint={props.diff.untracked ? t('noDiffUntracked') : t('noDiff')}
            t={t}
          />
        )}
        {entry !== undefined && (
          <div className="dgp-detailactions">
            {selection.staged ? (
              <button type="button" title={t('unstage')} disabled={props.busy !== ''} onClick={() => props.onUnstage([selection.path])}>
                {t('unstage')}
              </button>
            ) : (
              <button type="button" title={t('stage')} disabled={props.busy !== ''} onClick={() => props.onStage([selection.path])}>
                {t('stage')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /** 每个分组的行渲染：`renderFile` 在平铺/目录两种模式下都被调用，只有缩进与目录前缀不同。 */
  const renderRow = (side: Side, entries: ChangeEntry[], entry: ChangeEntry, depth: number, actions: React.ReactNode) => (
    <ChangeRow
      entry={entry}
      side={side}
      t={t}
      depth={mode === 'tree' ? depth : undefined}
      hideDirectory={mode === 'tree'}
      active={props.activePath !== undefined && props.activePath === entry.path}
      onOpen={() => openEntry(entries, entry, side)}
      actions={actions}
    />
  );

  const stageButton = (entry: ChangeEntry) => (
    <button type="button" className="dgp-iconbtn" title={t('stage')} disabled={props.busy !== ''} onClick={() => props.onStage([entry.path])}>
      <IconPlus size={13} />
    </button>
  );

  return (
    <div className="dgp-pane">
      {snapshot.repo?.unborn === true && <div className="dgp-hint">{t('unbornHint')}</div>}
      {snapshot.repo !== null && snapshot.repo.state !== 'clean' && (
        <div className="dgp-hint dgp-hint-warn">{t('stateInProgress', { state: snapshot.repo.state })}</div>
      )}

      {snapshot.counts.staged > 0 && (
        <CommitBox t={t} stagedCount={snapshot.counts.staged} busy={props.busy} onCommit={props.onCommit} />
      )}

      {snapshot.changes.length > 0 && (
        <div className="dgp-viewbar">
          <span className="dgp-meta">{t('viewMode')}</span>
          <div className="dgp-segmented" role="group" aria-label={t('viewMode')}>
            {(['flat', 'tree'] as ChangesViewMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`dgp-segment${mode === item ? ' dgp-segment-on' : ''}`}
                aria-pressed={mode === item}
                title={item === 'flat' ? t('viewFlatHint') : t('viewTreeHint')}
                onClick={() => switchMode(item)}
              >
                {item === 'flat' ? t('viewFlat') : t('viewTree')}
              </button>
            ))}
          </div>
          {mode === 'tree' && directoryPaths.length > 0 && (
            <span className="dgp-rowactions dgp-treeactions">
              <button type="button" className="dgp-linkbtn" disabled={collapsedCount === 0} onClick={expandAll} title={t('expandAllHint')}>
                {t('expandAll')}
              </button>
              <button
                type="button"
                className="dgp-linkbtn"
                disabled={collapsedCount === directoryPaths.length}
                onClick={collapseAll}
                title={t('collapseAllHint')}
              >
                {t('collapseAll')}
              </button>
            </span>
          )}
          {props.centerAvailable && (
            <>
              <span className="dgp-meta">{t('openMode')}</span>
              <div className="dgp-segmented" role="group" aria-label={t('openMode')}>
                {(['center', 'inline'] as DiffOpenTarget[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`dgp-segment${openTarget === item ? ' dgp-segment-on' : ''}`}
                    aria-pressed={openTarget === item}
                    title={item === 'center' ? t('openCenterHint') : t('openInlineHint')}
                    onClick={() => switchOpenTarget(item)}
                  >
                    {item === 'center' ? t('openCenter') : t('openInline')}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {snapshot.changes.length === 0 && (
        <div className="dgp-empty">{onlyUntracked ? t('noTrackedChanges') : t('cleanWorktree')}</div>
      )}

      {groups.conflicts.length > 0 && (
        <Group title={t('groupConflicts')} count={groups.conflicts.length} tone="conflict">
          <ChangeTree
            entries={groups.conflicts as never}
            tree={trees?.conflicts ?? EMPTY_TREE}
            mode={mode}
            side="worktree"
            t={t}
            collapsed={collapsed}
            onToggle={toggleDirectory}
            renderFile={(entry, depth) => renderRow('worktree', groups.conflicts, entry, depth, stageButton(entry))}
          />
        </Group>
      )}

      {groups.staged.length > 0 && (
        <Group
          title={t('groupStaged')}
          count={groups.staged.length}
          action={
            <button type="button" className="dgp-linkbtn" disabled={props.busy !== ''} onClick={props.onUnstageAll}>
              {t('unstageAll')}
            </button>
          }
        >
          <ChangeTree
            entries={groups.staged as never}
            tree={trees?.staged ?? EMPTY_TREE}
            mode={mode}
            side="staged"
            t={t}
            collapsed={collapsed}
            onToggle={toggleDirectory}
            renderFile={(entry, depth) =>
              renderRow(
                'staged',
                groups.staged,
                entry,
                depth,
                <button type="button" className="dgp-iconbtn" title={t('unstage')} disabled={props.busy !== ''} onClick={() => props.onUnstage([entry.path])}>
                  <IconMinus size={13} />
                </button>,
              )
            }
          />
        </Group>
      )}

      {groups.untracked.length > 0 && (
        <Group title={t('groupUntracked')} count={groups.untracked.length}>
          <ChangeTree
            entries={groups.untracked as never}
            tree={trees?.untracked ?? EMPTY_TREE}
            mode={mode}
            side="worktree"
            t={t}
            collapsed={collapsed}
            onToggle={toggleDirectory}
            renderFile={(entry, depth) =>
              renderRow(
                'worktree',
                groups.untracked,
                entry,
                depth,
                <>
                  {stageButton(entry)}
                  <button
                    type="button"
                    className="dgp-iconbtn dgp-dangerbtn"
                    title={t('deleteUntracked')}
                    disabled={props.busy !== ''}
                    onClick={() => props.onDiscard(entry)}
                  >
                    <IconUndo size={13} />
                  </button>
                </>,
              )
            }
          />
        </Group>
      )}

      {groups.unstaged.length > 0 && (
        <Group
          title={t('groupUnstaged')}
          count={groups.unstaged.length}
          action={
            <button type="button" className="dgp-linkbtn" disabled={props.busy !== ''} onClick={props.onStageAll}>
              {t('stageAll')}
            </button>
          }
        >
          <ChangeTree
            entries={groups.unstaged as never}
            tree={trees?.unstaged ?? EMPTY_TREE}
            mode={mode}
            side="worktree"
            t={t}
            collapsed={collapsed}
            onToggle={toggleDirectory}
            renderFile={(entry, depth) =>
              renderRow(
                'worktree',
                groups.unstaged,
                entry,
                depth,
                <>
                  {stageButton(entry)}
                  <button
                    type="button"
                    className="dgp-iconbtn dgp-dangerbtn"
                    title={t('discard')}
                    disabled={props.busy !== ''}
                    onClick={() => props.onDiscard(entry)}
                  >
                    <IconUndo size={13} />
                  </button>
                </>,
              )
            }
          />
        </Group>
      )}

      {snapshot.truncated && <div className="dgp-truncated">{t('changesTruncated', { total: snapshot.totalChanges ?? snapshot.changes.length })}</div>}
    </div>
  );
}
