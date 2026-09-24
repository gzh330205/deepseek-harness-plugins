/**
 * 变更条目语义：宿主解析 `git status --porcelain=v2` 得到条目，这里把条目上的
 * 两个状态码（index / worktree）翻成 UI 需要的分组与展示键。
 *
 * 宿主与浏览器半共用本模块（`src/host/status.js` 产出、`src/client/**` 消费），
 * 所以只能依赖纯 ESM、无 Node API。
 */

/** porcelain v2 里「未修改」的占位字符。 */
export const UNMODIFIED = '.';

/** 单个状态码 → 语义键。i18n 的键就是这些值。 */
export function codeToKind(code) {
  switch (code) {
    case 'M':
      return 'modified';
    case 'T':
      return 'typechange';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'U':
      return 'conflicted';
    case '?':
      return 'untracked';
    case '!':
      return 'ignored';
    default:
      return 'unknown';
  }
}

/** 展示用单字母：语义键 → 一个字符（未跟踪是 `?`，冲突统一 `U`）。 */
export function kindLetter(kind) {
  switch (kind) {
    case 'modified':
      return 'M';
    case 'typechange':
      return 'T';
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'copied':
      return 'C';
    case 'conflicted':
      return 'U';
    case 'untracked':
      return '?';
    case 'ignored':
      return '!';
    default:
      return '·';
  }
}

/** 语义键 → 配色档（样式类后缀）。 */
export function kindTone(kind) {
  switch (kind) {
    case 'added':
    case 'untracked':
      return 'add';
    case 'deleted':
      return 'del';
    case 'conflicted':
      return 'conflict';
    case 'renamed':
    case 'copied':
    case 'typechange':
      return 'move';
    default:
      return 'mod';
  }
}

/** 一条变更的权威分组判定：暂存区里有东西，且不是未跟踪。 */
export function isStaged(entry) {
  return entry.untracked !== true && entry.conflicted !== true && entry.index !== UNMODIFIED && entry.index !== '?' && entry.index !== '!';
}

/** 工作区里有东西（未跟踪算工作区侧，与 git 的行为一致）。 */
export function isUnstaged(entry) {
  if (entry.conflicted === true) return true;
  if (entry.untracked === true) return true;
  return entry.worktree !== UNMODIFIED && entry.worktree !== '?' && entry.worktree !== '!';
}

/**
 * 分组：冲突 → 已暂存 → 未跟踪 → 未暂存。
 * 一个文件可能同时出现在已暂存与未暂存两组里（git 的正常状态，Codex/VS Code 也这么显示）。
 */
export function groupChanges(entries) {
  const conflicts = [];
  const staged = [];
  const untracked = [];
  const unstaged = [];
  for (const entry of entries) {
    if (entry.conflicted === true) {
      conflicts.push(entry);
      continue;
    }
    if (isStaged(entry)) staged.push(entry);
    if (entry.untracked === true) untracked.push(entry);
    else if (isUnstaged(entry)) unstaged.push(entry);
  }
  return { conflicts, staged, untracked, unstaged };
}

/** 面板头部用的计数。 */
export function changeCounts(entries) {
  const groups = groupChanges(entries);
  return {
    total: entries.length,
    staged: groups.staged.length,
    unstaged: groups.unstaged.length,
    untracked: groups.untracked.length,
    conflicted: groups.conflicts.length,
  };
}

/** `+n −m` 徽标文案；二进制返回 `null`（调用方显示「二进制」）。 */
export function statBadge(entry) {
  if (entry.binary === true) return null;
  const additions = typeof entry.additions === 'number' ? entry.additions : null;
  const deletions = typeof entry.deletions === 'number' ? entry.deletions : null;
  if (additions === null && deletions === null) return null;
  return { additions: additions ?? 0, deletions: deletions ?? 0 };
}

/** 取路径末级名称（Windows/POSIX 分隔符都要认）。 */
export function baseName(path) {
  const normalized = String(path ?? '').replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at >= 0 ? normalized.slice(at + 1) : normalized;
}

/** 取路径的目录部分（不含末级）。 */
export function dirName(path) {
  const normalized = String(path ?? '').replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at > 0 ? normalized.slice(0, at) : '';
}
