/**
 * 差异生成与结构化：把 git 的统一 diff 文本变成渲染层可以直接铺的结果。
 *
 * 三个视角共用一套代码：
 *  - 工作区某文件的未暂存改动（`git diff`）
 *  - 某文件的已暂存改动（`git diff --cached`）
 *  - 未跟踪文件（`git diff --no-index -- /dev/null <path>`，退出码 1 表示「有差异」）
 *  - 某个提交里的某文件或整个提交（`git show --format= <sha>`）
 */
import { LIMITS, normalizeRepoPath } from './contract.js';
import { GitError } from './git.js';
import { parseUnifiedDiff } from './parse.js';

function clampContext(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return LIMITS.defaultContextLines;
  return Math.min(LIMITS.maxContextLines, Math.max(0, Math.trunc(number)));
}

function uniquePaths(paths) {
  return [...new Set(paths.filter((path) => typeof path === 'string' && path !== ''))];
}

function parseDiffText(result) {
  return parseUnifiedDiff(result.stdout);
}

/**
 * 一个文件在某个视角下的差异。
 * @param request - `{ path, origPath?, staged?, untracked?, contextLines? }`
 */
export async function fileDiff(git, repoRoot, request) {
  const path = normalizeRepoPath(request.path);
  const origPath = typeof request.origPath === 'string' && request.origPath !== '' ? normalizeRepoPath(request.origPath, 'origPath') : '';
  const staged = request.staged === true;
  const untracked = request.untracked === true;
  const context = clampContext(request.contextLines);
  const pathspecs = uniquePaths([path, origPath]);

  let args;
  let allowCodes = [0];
  if (untracked) {
    args = ['diff', '--no-index', '--no-color', '--no-ext-diff', `-U${context}`, '--', '/dev/null', path];
    allowCodes = [0, 1];
  } else if (staged) {
    args = ['diff', '--cached', '--no-color', '--no-ext-diff', '-M', `-U${context}`, '--', ...pathspecs];
  } else {
    args = ['diff', '--no-color', '--no-ext-diff', '-M', `-U${context}`, '--', ...pathspecs];
  }

  const result = await git.run(args, { cwd: repoRoot, maxBytes: LIMITS.maxDiffBytes, timeoutMs: 25000 });
  if (result.spawnError !== undefined) throw new GitError(`无法启动 git：${result.spawnError.message}`, { args, ...result });
  if (!allowCodes.includes(result.code ?? -1) && !result.timedOut && !result.truncated) {
    throw new GitError('读取差异失败', { args, ...result });
  }

  const parsed = parseDiffText(result);
  const file = parsed.files[0] ?? null;
  return {
    path,
    origPath,
    staged,
    untracked,
    context,
    file: file === null ? null : { ...file, binaryNote: binaryNoteOf(file, path) },
    additions: parsed.additions,
    deletions: parsed.deletions,
    empty: file === null,
    truncated: result.truncated === true,
    timedOut: result.timedOut === true,
  };
}

function binaryNoteOf(file, path) {
  if (file.binary !== true) return '';
  return `二进制文件不显示内容：${path}`;
}

/**
 * 提交内的差异；给定 `path` 时只看该文件（重命名时同时带上旧路径）。
 * @param request - `{ hash, path?, origPath?, contextLines? }`
 */
export async function commitDiff(git, repoRoot, request) {
  const hash = String(request.hash ?? '');
  const context = clampContext(request.contextLines);
  const args = ['show', '--no-color', '--no-ext-diff', '-M', `-U${context}`, '--format=', hash];
  if (typeof request.path === 'string' && request.path !== '') {
    const pathspecs = uniquePaths([
      normalizeRepoPath(request.path),
      typeof request.origPath === 'string' && request.origPath !== '' ? normalizeRepoPath(request.origPath, 'origPath') : '',
    ]);
    args.push('--', ...pathspecs);
  }

  const result = await git.run(args, { cwd: repoRoot, maxBytes: LIMITS.maxDiffBytes, timeoutMs: 25000 });
  if (result.spawnError !== undefined) throw new GitError(`无法启动 git：${result.spawnError.message}`, { args, ...result });
  if (!result.ok && !result.timedOut && !result.truncated) throw new GitError('读取提交差异失败', { args, ...result });

  const parsed = parseDiffText(result);
  return {
    hash,
    files: parsed.files,
    additions: parsed.additions,
    deletions: parsed.deletions,
    truncated: result.truncated === true,
  };
}
