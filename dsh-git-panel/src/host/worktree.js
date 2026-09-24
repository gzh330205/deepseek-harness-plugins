/**
 * 工作树（`git worktree`）：列表、创建、删除、清理。
 *
 * 设计取舍（与参考实现一致，也是有意的安全边界）：
 *  - **不做「自动合回主干」**。合回要先在工作树里自动提交、再在主仓库 merge，
 *    冲突时会把用户留在半完成状态；这不是一个面板该替用户做的决定。面板负责
 *    「建出来 / 看清楚 / 安全删掉」，合并交给用户或 agent 在终端里做。
 *  - **删除前必须知道 dirty 状态**：探测失败（例如被别的进程占着 index）一律按
 *    「不干净」处理，绝不按干净处理。
 *  - **默认 detached**：一棵工作树一个分支会让「同一分支不能在两处 checkout」
 *    这条 git 规则变成用户的负担；需要分支时显式选 branch 形态。
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIMITS, assertBranch, assertRef, badRequest, slugify, worktreeDirectory, worktreeRootDir } from './contract.js';
import { GitError } from './git.js';
import { parseWorktreePorcelain } from './parse.js';

function statDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function statExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** 路径比较：Windows 大小写不敏感，两种分隔符等价，忽略末尾分隔符。 */
export function samePath(left, right) {
  const normalize = (value) =>
    String(value ?? '')
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .join('/')
      .toLowerCase();
  return normalize(left) === normalize(right);
}

function baseName(path) {
  const normalized = String(path ?? '').replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at >= 0 ? normalized.slice(at + 1) : normalized;
}

/** 工作树的 dirty 探测：读不到状态就返回 `known:false`。 */
async function probeDirty(git, path) {
  const result = await git.probe(['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: path, timeoutMs: LIMITS.worktreeProbeTimeoutMs });
  if (result === undefined) return { known: false, count: 0 };
  const count = result.stdout.split('\0').filter((token) => token !== '' && !token.startsWith('# ')).length;
  return { known: true, count };
}

/** `ancestor` 是不是 `HEAD` 的祖先；用 `merge-base` 的输出比较，而不是退出码。 */
async function isAncestor(git, repoRoot, ancestor) {
  const result = await git.probe(['merge-base', ancestor, 'HEAD'], { cwd: repoRoot, timeoutMs: LIMITS.worktreeProbeTimeoutMs });
  if (result === undefined) return false;
  return result.stdout.trim() === ancestor;
}

async function mergeBaseWithHead(git, repoRoot, rev) {
  const result = await git.probe(['merge-base', rev, 'HEAD'], { cwd: repoRoot, timeoutMs: LIMITS.worktreeProbeTimeoutMs });
  const value = result === undefined ? '' : result.stdout.trim();
  return value === '' ? 'HEAD' : value;
}

async function branchExists(git, repoRoot, branch) {
  const result = await git.probe(['rev-parse', '--verify', '--end-of-options', `refs/heads/${branch}`], { cwd: repoRoot });
  return result !== undefined && result.stdout.trim() !== '';
}

/** worktree 根目录：配置优先，否则仓库旁边的 `.dsh-worktrees`。 */
export function worktreeRootFor(repoRoot, worktreeRoot) {
  return worktreeRootDir({ repoRoot, worktreeRoot });
}

export async function readWorktrees(git, repo, options = {}) {
  const result = await git.exec(['worktree', 'list', '--porcelain', '-z'], { cwd: repo.repoRoot, timeoutMs: 15000 });
  const raw = parseWorktreePorcelain(result.stdout);
  const slice = raw.slice(0, LIMITS.maxWorktreeProbes);

  const worktrees = await Promise.all(
    slice.map(async (item, index) => {
      const exists = statDirectory(item.path);
      const branch = item.branch.startsWith('refs/heads/') ? item.branch.slice('refs/heads/'.length) : item.branch;
      const dirty = exists ? await probeDirty(git, item.path) : { known: true, count: 0 };
      const ancestor = item.head === '' ? false : await isAncestor(git, repo.repoRoot, item.head);
      const main = index === 0 && samePath(item.path, repo.repoRoot);
      return {
        path: item.path,
        name: baseName(item.path),
        head: item.head === '' ? '' : item.head.slice(0, 7),
        headFull: item.head,
        branch,
        detached: item.detached === true || branch === '',
        bare: item.bare === true,
        locked: item.locked === true,
        lockReason: item.lockReason,
        prunable: item.prunable === true,
        pruneReason: item.pruneReason,
        main,
        current: samePath(item.path, repo.repoRoot),
        exists,
        source: item.path,
        dirty: dirty.known ? dirty.count > 0 : null,
        dirtyCount: dirty.known ? dirty.count : null,
        ancestor,
        /** 「已合并且干净」才叫可以安全删除；只看祖先会把满是改动的树标成绿。 */
        merged: main ? false : ancestor && dirty.known && dirty.count === 0,
      };
    }),
  );

  return {
    worktrees,
    truncated: raw.length > LIMITS.maxWorktreeProbes,
    total: raw.length,
    suggestedRoot: worktreeRootFor(repo.repoRoot, options.worktreeRoot),
  };
}

/** 找一个还不存在的目录：`<label>`、`<label>-2`、`<label>-3`… */
function nextDirectory({ repoRoot, worktreeRoot, label }) {
  for (let index = 1; index <= 50; index += 1) {
    const dirName = index === 1 ? label : `${label}-${index}`;
    const path = worktreeDirectory({ repoRoot, worktreeRoot, dirName });
    if (!statExists(path)) return { path, dirName };
  }
  throw badRequest('同名 worktree 目录过多，请换一个名字。');
}

/**
 * 新建工作树。
 * @param request - `{ dirName?, baseRef?, mode?: 'detached'|'branch', branch?, branchPrefix?, worktreeRoot? }`
 */
export async function addWorktree(git, repo, request = {}) {
  const mode = request.mode === 'branch' ? 'branch' : 'detached';
  const baseRef = typeof request.baseRef === 'string' && request.baseRef.trim() !== '' ? assertRef(request.baseRef.trim(), 'baseRef') : 'HEAD';

  const resolved = await git.probe(['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`], { cwd: repo.repoRoot });
  const baseHash = resolved === undefined ? '' : resolved.stdout.trim();
  if (baseHash === '') throw badRequest(`找不到基线提交：${baseRef}`);

  const prefix = typeof request.branchPrefix === 'string' ? request.branchPrefix : '';
  const rawLabel = typeof request.dirName === 'string' && request.dirName.trim() !== '' ? request.dirName.trim() : baseRef;
  const { path, dirName } = nextDirectory({ repoRoot: repo.repoRoot, worktreeRoot: request.worktreeRoot, label: slugify(rawLabel, 'worktree') });

  let branch = '';
  if (mode === 'branch') {
    branch = typeof request.branch === 'string' && request.branch.trim() !== '' ? assertBranch(request.branch.trim()) : `${prefix}${dirName}`;
    if (await branchExists(git, repo.repoRoot, branch)) throw badRequest(`分支 ${branch} 已存在，请换一个分支名或改用 detached 形态。`);
  }

  const args = mode === 'branch'
    ? ['worktree', 'add', '-b', branch, path, baseHash]
    : ['worktree', 'add', '--detach', path, baseHash];
  const added = await git.run(args, { cwd: repo.repoRoot, timeoutMs: 120000 });
  if (!added.ok) throw new GitError('创建 worktree 失败', { args, ...added });

  return { path, dirName, branch, mode, base: baseHash, baseRef, root: worktreeRootFor(repo.repoRoot, request.worktreeRoot) };
}

/** 把工作树里的全部改动（含未提交）导出成补丁文件。 */
async function exportPatch(git, repo, info, request) {
  const base = await mergeBaseWithHead(git, repo.repoRoot, info.headFull === '' ? 'HEAD' : info.headFull);
  const result = await git.run(['diff', '--binary', '--full-index', base], { cwd: info.path, maxBytes: 64 * 1024 * 1024, timeoutMs: 60000 });
  if (!result.ok && !result.truncated) return '';
  if (result.stdout.trim() === '') return '';

  const dir = join(worktreeRootFor(repo.repoRoot, request.worktreeRoot), 'snapshots');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${info.name}-${stamp}.patch`);
  writeFileSync(file, result.stdout, 'utf8');
  return file;
}

/**
 * 删除工作树。守卫链与参考实现一致：主工作区不可删 → 探测不到状态就拒绝 →
 * 脏且未强制则拒绝 → 需要时先导出补丁 → remove → prune。
 */
export async function removeWorktree(git, repo, request = {}) {
  const target = String(request.path ?? '');
  if (target === '') throw badRequest('缺少 worktree 路径。');
  const list = await readWorktrees(git, repo, request);
  const info = list.worktrees.find((item) => samePath(item.path, target));
  if (info === undefined) throw badRequest('找不到这棵工作树，可能已被其他工具清理。');
  if (info.main) throw badRequest('主工作区不能用这里删除。');

  const force = request.force === true;
  if (info.exists && info.dirty === null) throw badRequest('无法读取该工作树的 git 状态（可能被其他进程占用），请稍后重试。');
  if (info.exists && info.dirty === true && !force) {
    throw badRequest(`该工作树还有 ${info.dirtyCount} 处未提交的更改：请先提交或合并，或勾选「强制删除」。`);
  }

  let patchPath = '';
  if (request.exportPatch === true && info.exists && (info.dirty === true || info.merged === false)) {
    patchPath = await exportPatch(git, repo, info, request);
  }

  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(info.path);
  const removed = await git.run(args, { cwd: repo.repoRoot, timeoutMs: 120000 });
  if (!removed.ok && statExists(info.path)) throw new GitError('删除 worktree 失败', { args, ...removed });

  const pruned = await git.run(['worktree', 'prune'], { cwd: repo.repoRoot, timeoutMs: 20000 });
  const retainedBranch = info.branch !== '' && (await branchExists(git, repo.repoRoot, info.branch)) ? info.branch : '';

  return {
    removed: true,
    path: info.path,
    patchPath,
    branch: info.branch,
    retainedBranch,
    dirty: info.dirtyCount ?? 0,
    pruneOutput: pruned.ok ? '' : pruned.stderr.trim(),
  };
}

/** 清理已失效的工作树登记（目录被外部删除后留下的记录）。 */
export async function pruneWorktrees(git, repo) {
  const result = await git.exec(['worktree', 'prune', '--verbose'], { cwd: repo.repoRoot, timeoutMs: 20000 });
  const output = `${result.stdout}${result.stderr}`.trim();
  return { output };
}
