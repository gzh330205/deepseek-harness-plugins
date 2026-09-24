/**
 * 中心窗口的差异页：注册在 root 作用域的 `main` 席位（key `git-diff`），
 * 由右侧栏 Git 标签页点击文件时经 `ctx.layout.selectPanel('git-diff')` 选中。
 *
 * 与侧栏内联详情的关系：
 *  - 「打开位置 = 中间」时点文件走这里，侧栏列表保持不动（当前行高亮）；
 *  - 「打开位置 = 侧栏」时点文件走侧栏内联详情，本页不会被选中；
 *  - 两种入口都用 `useFileDiff`，所以拿到的 diff 完全一致。
 *
 * 关闭用 `ctx.layout.selectPanel(null)`，语义是「回到当前会话」——不改变选中的
 * 会话，只是把中心列交还给对话。
 */
import React from 'react';
import { basename, dirname } from '../format.js';
import { subscribeDiffTarget, getDiffTarget, stepDiffTarget, currentDiffItem, type DiffItem } from '../diff-target.js';
import { useFileDiff } from '../use-diff.js';
import type { GitApi } from '../api.js';
import { DiffView } from './DiffView.jsx';
import { IconBack, IconChevron, IconChevronLeft, IconExternal, IconWarning } from './icons.jsx';

export interface DiffPageProps {
  api: GitApi;
  t: (key: string, params?: Record<string, unknown>) => string;
  /** 回到会话（由 index.ts 接到 `ctx.layout.selectPanel(null)`）。 */
  close: () => void;
  /** 在内置预览里打开该文件；缺省或不可用时隐藏按钮。 */
  openPreview?: (item: DiffItem, absolutePath: string) => void;
}

/** 绝对路径：仓库根 + 仓库相对路径。 */
function absolutePathFor(repoRoot: string, relative: string): string {
  const root = String(repoRoot ?? '').replace(/[\\/]+$/, '');
  return relative === '' ? root : `${root}/${relative.replace(/^[\\/]+/, '')}`;
}

export function DiffPage(props: DiffPageProps) {
  const { api, t } = props;
  const state = React.useSyncExternalStore(subscribeDiffTarget, getDiffTarget, getDiffTarget);
  const item = currentDiffItem();
  const total = state === null ? 0 : state.items.length;
  const index = state === null ? 0 : state.index;

  const target = state === null || item === null
    ? null
    : {
        root: state.root,
        path: item.path,
        origPath: item.origPath,
        staged: item.staged,
        untracked: item.untracked,
        fingerprint: `${item.staged ? 's' : 'w'}:${item.untracked ? 'u' : '-'}`,
      };
  // 上下文行数沿用打开时的快照，保证与侧栏看到的 diff 一致。
  const { diff, loading, error } = useFileDiff(api, target, state?.contextLines ?? 3);

  const canPreview = props.openPreview !== undefined && state !== null && state.sessionId !== undefined && item !== null;

  return (
    <div className="dgp dgp-page">
      <div className="dgp-pagehead">
        <button type="button" className="dgp-iconbtn" onClick={props.close} title={t('centerClose')} aria-label={t('centerClose')}>
          <IconBack size={16} />
        </button>
        <span className="dgp-pagetitle" title={item === null ? '' : absolutePathFor(state?.repoRoot ?? '', item.path)}>
          {item === null ? t('centerNoTarget') : item.path}
        </span>
        {item !== null && (
          <span className={`dgp-chip${item.staged ? ' dgp-chip-on' : ''}`}>
            {item.staged ? t('staged') : item.untracked ? t('untracked') : t('unstaged')}
          </span>
        )}
        {diff !== null && !diff.empty && (
          <span className="dgp-stat dgp-pagestat">
            {diff.additions > 0 && <span className="dgp-stat-add">+{diff.additions}</span>}
            {diff.deletions > 0 && <span className="dgp-stat-del">−{diff.deletions}</span>}
          </span>
        )}
        <span className="dgp-rowactions">
          {total > 1 && (
            <>
              <button type="button" className="dgp-iconbtn" title={t('centerPrev')} aria-label={t('centerPrev')} onClick={() => stepDiffTarget(-1)}>
                <IconChevronLeft size={15} />
              </button>
              <span className="dgp-meta dgp-pagecount">{t('centerPosition', { index: index + 1, total })}</span>
              <button type="button" className="dgp-iconbtn" title={t('centerNext')} aria-label={t('centerNext')} onClick={() => stepDiffTarget(1)}>
                <IconChevron size={15} />
              </button>
            </>
          )}
          {canPreview && (
            <button
              type="button"
              className="dgp-iconbtn"
              title={t('openFile')}
              onClick={() => props.openPreview?.(item as DiffItem, absolutePathFor(state?.repoRoot ?? '', (item as DiffItem).path))}
            >
              <IconExternal size={15} />
            </button>
          )}
        </span>
      </div>

      {state !== null && (
        <div className="dgp-pagesub">
          {state.repoRoot}
          {item !== null && dirname(item.path) !== '' ? ` · ${dirname(item.path)}` : ''}
        </div>
      )}

      {error !== '' && (
        <div className="dgp-error">
          <IconWarning size={13} />
          <span className="dgp-errortext">{error}</span>
        </div>
      )}
      {loading && <div className="dgp-empty">{t('loadingDiff')}</div>}
      {!loading && diff !== null && (
        <div className="dgp-pagebody">
          <DiffView
            files={diff.file === null ? [] : [diff.file]}
            truncated={diff.truncated}
            emptyHint={diff.untracked ? t('noDiffUntracked') : t('noDiff')}
            t={t}
          />
        </div>
      )}
      {!loading && diff === null && error === '' && <div className="dgp-empty">{t('centerNoTarget')}</div>}
    </div>
  );
}
