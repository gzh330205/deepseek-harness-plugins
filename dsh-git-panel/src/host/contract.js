/**
 * 契约：请求字段校验、路径护栏、以及所有「不设上限就会被用户搞崩」的数值上限。
 *
 * 浏览器半只发工作区根 + 仓库相对路径 + ref/hash，宿主在这里一律先校验再拿去拼
 * argv。所有 git 参数都是 argv 数组（不过 shell），这里的正则主要是**语义**护栏：
 * 拒绝 `--upload-pack=...` 这类会被 git 当成选项的输入、拒绝跳出仓库的相对路径。
 */
import { isAbsolute, join, resolve, sep } from 'node:path';

export const LIMITS = {
  /** 单个文件的补丁文本上限（超出截断，UI 明确提示）。 */
  maxDiffBytes: 4 * 1024 * 1024,
  /** 一次 diff 上下文行数上限。 */
  maxContextLines: 50,
  defaultContextLines: 3,
  /** 历史分页。 */
  defaultHistoryLimit: 40,
  maxHistoryLimit: 200,
  /** 提交详情里的文件数上限。 */
  maxCommitFiles: 1000,
  /** 单次快照返回的变更条目上限（未跟踪文件全列，需要兜底）。 */
  maxChanges: 2000,
  /** 一次批量操作（暂存/取消暂存/放弃）最多接受多少条路径。 */
  maxPathsPerAction: 500,
  /** worktree 列表里逐棵探测 dirty 的超时。 */
  worktreeProbeTimeoutMs: 8000,
  /** 一次最多探测多少棵 worktree 的状态。 */
  maxWorktreeProbes: 50,
};

/** git ref：与 one-code 同一套字符集，足够覆盖 `refs/heads/x`、`HEAD~1`、`main^{commit}`。 */
export const REF_PATTERN = /^[A-Za-z0-9._/\-@^{}~]+$/;
/** 提交 hash：4~40 位十六进制。 */
export const HASH_PATTERN = /^[0-9a-fA-F]{4,40}$/;
/** 新建分支名：比 ref 更窄（不允许 `~^:?*[` 与空格），且不许以 `-` 开头。 */
export const BRANCH_PATTERN = /^[A-Za-z0-9._/][A-Za-z0-9._/\-]{0,119}$/;

export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function assertText(value, field, maxLength = 4096) {
  if (typeof value !== 'string' || value.trim() === '') throw badRequest(`缺少字段 ${field}。`);
  if (value.length > maxLength) throw badRequest(`字段 ${field} 过长。`);
  return value;
}

/** 工作区根：必须是绝对路径（其余交给 git 自己判断是不是仓库）。 */
export function assertRoot(value) {
  const root = assertText(value, 'root', 1024);
  if (!isAbsolute(root)) throw badRequest('工作区根必须是绝对路径。');
  return root;
}

export function assertRef(value, field = 'ref') {
  const ref = assertText(value, field, 256);
  if (!REF_PATTERN.test(ref) || ref.startsWith('-')) throw badRequest(`非法的 git ref：${ref}`);
  return ref;
}

export function assertHash(value, field = 'hash') {
  const hash = assertText(value, field, 64);
  if (!HASH_PATTERN.test(hash)) throw badRequest(`非法的提交 hash：${hash}`);
  return hash;
}

/** 新建分支名：先过本地正则，再交给 `git check-ref-format --branch` 复核。 */
export function assertBranch(value, field = 'branch') {
  const branch = assertText(value, field, 160);
  if (!BRANCH_PATTERN.test(branch) || branch.includes('..') || branch.endsWith('/') || branch.endsWith('.lock')) {
    throw badRequest(`非法的分支名：${branch}`);
  }
  return branch;
}

export function assertInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

/**
 * 仓库相对路径护栏：git status/log 给的都是这种路径，回程再校验一次，避免
 * 浏览器半（或任何注入点）让我们对仓库外的文件动手。
 */
export function normalizeRepoPath(value, field = 'path') {
  const path = assertText(value, field, 4096);
  if (path.includes('\0') || /[\r\n]/.test(path)) throw badRequest(`路径含有非法字符：${field}`);
  if (isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.startsWith('\\\\') || path.startsWith('//')) {
    throw badRequest(`路径必须是仓库相对路径：${path}`);
  }
  const segments = path.split(/[\\/]+/).filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) throw badRequest('路径为空。');
  if (segments.includes('..')) throw badRequest(`路径不允许跳出仓库：${path}`);
  return segments.join('/');
}

/** 绝对路径的包含判定，只用于日志/展示与 worktree 目录的合理性检查。 */
export function isInside(parent, child) {
  const left = resolve(parent).replace(/[\\/]+$/, '').toLowerCase();
  const right = resolve(child).replace(/[\\/]+$/, '').toLowerCase();
  return right === left || right.startsWith(left + sep.toLowerCase()) || right.startsWith(`${left}/`);
}

/** 目录名净化：保留 Unicode 字母数字，其余压成 `-`。 */
export function slugify(value, fallback = 'worktree', maxLength = 48) {
  const text = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, maxLength);
  return text === '' ? fallback : text;
}

/** 仓库名（末级目录，用于 worktree 的子目录）。 */
export function repoNameOf(root) {
  const normalized = String(root).replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const name = at >= 0 ? normalized.slice(at + 1) : normalized;
  return slugify(name, 'repo', 48);
}

export function worktreeRootDir({ repoRoot, worktreeRoot }) {
  const root = String(worktreeRoot ?? '').trim();
  const base = root === '' ? join(resolve(repoRoot, '..'), '.dsh-worktrees') : resolve(root);
  return join(base, repoNameOf(repoRoot));
}

/**
 * worktree 的目标目录：
 *  - 配了 `worktreeRoot` → `<worktreeRoot>/<repo>/<dirName>`
 *  - 否则 → `<仓库父目录>/.dsh-worktrees/<repo>/<dirName>`
 * 放在仓库旁边（隐藏目录）而不是用户主目录：用户一眼能找到，也方便直接拖进编辑器。
 */
export function worktreeDirectory({ repoRoot, worktreeRoot, dirName }) {
  return join(worktreeRootDir({ repoRoot, worktreeRoot }), slugify(dirName, 'worktree'));
}

/** 统一的错误文案：GitError 走短摘要，其余走 message。 */
export function errorMessage(error) {
  if (error === null || error === undefined) return '未知错误。';
  if (typeof error.summary === 'string' && error.summary !== '') return error.summary;
  if (error instanceof Error) return error.message;
  return String(error);
}
