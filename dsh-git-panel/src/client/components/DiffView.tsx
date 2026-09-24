/**
 * 统一 diff 渲染：单文件（变更页）与多文件（提交详情）共用。
 *
 * 只画文本差异：不引 Monaco、不做并排——侧栏宽度下并排会把每边压到 20 来个字符，
 * 行内统一视图反而更好读。行数有上限（`MAX_RENDER_LINES`），超大 diff 只画前
 * 若干行并明确提示，避免一次渲染上万个节点把侧栏卡死。
 */
import React from 'react';
import type { DiffFile, DiffLine } from '../types.js';
import { IconChevron } from './icons.jsx';

const MAX_RENDER_LINES = 3000;

const SIGN: Record<DiffLine['type'], string> = { add: '+', del: '-', ctx: ' ', note: '' };

function lineClass(line: DiffLine): string {
  if (line.type === 'note') return 'dgp-line dgp-line-note';
  return `dgp-line dgp-line-${line.type}`;
}

/** 真实行数（含 note 行），用于预算。 */
function lineCount(file: DiffFile): number {
  return file.hunks.reduce((sum, hunk) => sum + hunk.lines.length + 1, 0);
}

interface LinesBudget {
  left: number;
}

function HunkView({ hunk, budget }: { hunk: DiffFile['hunks'][number]; budget: LinesBudget }) {
  if (budget.left <= 0) return null;
  const lines: React.ReactNode[] = [];
  budget.left -= 1;
  lines.push(
    <div key="header" className="dgp-line dgp-line-hunk" title={hunk.section}>
      {hunk.header}
    </div>,
  );
  for (let index = 0; index < hunk.lines.length; index += 1) {
    if (budget.left <= 0) break;
    const line = hunk.lines[index];
    budget.left -= 1;
    if (line.type === 'note') {
      lines.push(
        <div key={index} className={lineClass(line)}>
          <span className="dgp-note">{line.text}</span>
        </div>,
      );
      continue;
    }
    lines.push(
      <div key={index} className={lineClass(line)}>
        <span className="dgp-ln">{line.oldNumber ?? ''}</span>
        <span className="dgp-ln">{line.newNumber ?? ''}</span>
        <span className="dgp-sign">{SIGN[line.type]}</span>
        <span className="dgp-text">{line.text === '' ? '\u00a0' : line.text}</span>
      </div>,
    );
  }
  return <>{lines}</>;
}

export interface DiffViewProps {
  files: DiffFile[];
  /** 单个文件时是否显示文件头（变更页自己画标题，提交详情需要）。 */
  showFileHeaders?: boolean;
  emptyHint?: string;
  truncated?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function DiffView(props: DiffViewProps) {
  const { files, t } = props;
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  if (files.length === 0) {
    return <div className="dgp-empty">{props.emptyHint ?? t('noDiff')}</div>;
  }

  const budget: LinesBudget = { left: MAX_RENDER_LINES };
  const showHeaders = props.showFileHeaders === true || files.length > 1;

  return (
    <div className="dgp-diff">
      {files.map((file, index) => {
        const key = `${file.path}:${index}`;
        const isCollapsed = collapsed[key] === true;
        const total = lineCount(file);
        return (
          <div className="dgp-difffile" key={key}>
            {showHeaders && (
              <button
                type="button"
                className="dgp-difffile-head"
                onClick={() => setCollapsed((current) => ({ ...current, [key]: !isCollapsed }))}
              >
                <IconChevron size={12} open={!isCollapsed} />
                <span className="dgp-difffile-path" title={file.path}>
                  {file.renameFrom !== '' && file.renameFrom !== file.path ? `${file.renameFrom} → ${file.path}` : file.path}
                </span>
                <span className="dgp-stat-add">+{file.additions}</span>
                <span className="dgp-stat-del">−{file.deletions}</span>
              </button>
            )}
            {!isCollapsed && file.binary && <div className="dgp-empty">{file.binaryNote || t('binaryFile')}</div>}
            {!isCollapsed && !file.binary && (
              <>
                {file.newFile && <div className="dgp-line dgp-line-note"><span className="dgp-note">{t('newFileNote')}</span></div>}
                {file.deletedFile && <div className="dgp-line dgp-line-note"><span className="dgp-note">{t('deletedFileNote')}</span></div>}
                {file.hunks.map((hunk, hunkIndex) => (
                  <HunkView key={hunkIndex} hunk={hunk} budget={budget} />
                ))}
                {!file.binary && total === 0 && <div className="dgp-empty">{t('noContentDiff')}</div>}
              </>
            )}
          </div>
        );
      })}
      {budget.left <= 0 && <div className="dgp-truncated">{t('diffTooLong', { lines: MAX_RENDER_LINES })}</div>}
      {props.truncated === true && <div className="dgp-truncated">{t('diffTruncated')}</div>}
    </div>
  );
}
