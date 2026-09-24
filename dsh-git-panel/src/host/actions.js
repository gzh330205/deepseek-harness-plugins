/**
 * 写操作：暂存、取消暂存、放弃改动、提交、切换分支、放弃合并。
 *
 * 原则：
 *  - **不做任何隐式操作**。没有「提交并推送」「一键同步」这类把多步打包的动作；
 *    每一步都由用户在面板上显式点。推送/拉取这类联网操作本插件完全不提供。
 *  - **放弃改动必须显式**：`discardWorktree` 只动工作区（已暂存的内容不受影响），
 *    未跟踪文件走 `git clean`，前端必须二次确认。
 *  - **切换分支要求工作区干净**：否则 git 可能把改动带过去或在冲突中停下，
 *    对着正在跑 agent 回合的工作区尤其危险。
 */
import { LIMITS, badRequest, normalizeRepoPath } from './contract.js';
import { GitError } from './git.js';

/** 批量路径校验：数量上限 + 逐个过仓库相对路径护栏。 */
export function readPathList(list, field, options = {}) {
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0 && options.allowEmpty !== true) throw badRequest(`缺少要操作的路径（${field}）。`);
  if (items.length > LIMITS.maxPathsPerAction) throw badRequest(`一次最多操作 ${LIMITS.maxPathsPerAction} 个文件。`);
  return [...new Set(items.map((path) => normalizeRepoPath(path)))];
}

export function readPaths(body) {
  return readPathList(body?.paths, 'paths');
}

async function runOrThrow(git, args, options, label) {
  const result = await git.run(args, options);
  if (result.spawnError !== undefined) throw new GitError(`无法启动 git：${result.spawnError.message}`, { args, ...result });
  if (!result.ok) throw new GitError(label, { args, ...result });
  return result;
}

/** 暂存指定文件（含未跟踪与删除；`-A` 让删除也被暂存）。 */
export async function stage(git, repoRoot, paths) {
  await runOrThrow(git, ['add', '-A', '--', ...paths], { cwd: repoRoot, timeoutMs: 30000 }, '暂存失败');
  return { staged: paths.length };
}

/** 暂存全部（含未跟踪）。 */
export async function stageAll(git, repoRoot) {
  await runOrThrow(git, ['add', '-A'], { cwd: repoRoot, timeoutMs: 60000 }, '暂存失败');
  return { stagedAll: true };
}

/** 取消暂存：unborn 分支上没有 HEAD，`restore --staged` 会失败，退化成 `rm --cached`。 */
export async function unstage(git, repoRoot, paths, options = {}) {
  if (options.unborn === true) {
    await runOrThrow(git, ['rm', '--cached', '-r', '-q', '--', ...paths], { cwd: repoRoot, timeoutMs: 30000 }, '取消暂存失败');
  } else {
    await runOrThrow(git, ['restore', '--staged', '--', ...paths], { cwd: repoRoot, timeoutMs: 30000 }, '取消暂存失败');
  }
  return { unstaged: paths.length };
}

/** 取消全部暂存：`reset` 无路径参数时把整个 index 归位到 HEAD。 */
export async function unstageAll(git, repoRoot, options = {}) {
  if (options.unborn === true) {
    await runOrThrow(git, ['rm', '--cached', '-r', '-q', '--', '.'], { cwd: repoRoot, timeoutMs: 60000 }, '取消暂存失败');
  } else {
    await runOrThrow(git, ['reset', '-q'], { cwd: repoRoot, timeoutMs: 60000 }, '取消暂存失败');
  }
  return { unstagedAll: true };
}

/**
 * 放弃工作区改动。已跟踪文件用 `restore --worktree`（回到 index 的样子），
 * 未跟踪文件用 `clean -f -d`（删除文件/目录，`--` 之后的路径限制住作用域）。
 */
export async function discardWorktree(git, repoRoot, paths, options = {}) {
  const tracked = Array.isArray(options.tracked) ? options.tracked.map((path) => normalizeRepoPath(path)) : paths;
  const untracked = Array.isArray(options.untracked) ? options.untracked.map((path) => normalizeRepoPath(path)) : [];
  if (tracked.length > 0) {
    await runOrThrow(git, ['restore', '--worktree', '--', ...tracked], { cwd: repoRoot, timeoutMs: 30000 }, '放弃改动失败');
  }
  if (untracked.length > 0) {
    await runOrThrow(git, ['clean', '-f', '-d', '-q', '--', ...untracked], { cwd: repoRoot, timeoutMs: 30000 }, '删除未跟踪文件失败');
  }
  return { discarded: tracked.length, removed: untracked.length };
}

/** 提交暂存区。只提交 index，不隐式暂存任何东西。 */
export async function commit(git, repoRoot, body = {}) {
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message === '') throw badRequest('提交信息不能为空。');
  if (message.length > 20000) throw badRequest('提交信息过长。');
  const amend = body.amend === true;
  const signOff = body.signOff === true;
  if (amend === true && typeof body.confirmAmend !== 'boolean') {
    // 前端必须显式表达「我知道这会改写提交」，避免一次误点丢掉历史。
    throw badRequest('修改上一次提交需要确认。');
  }

  const args = ['commit', '-m', message];
  if (amend) args.push('--amend');
  if (signOff) args.push('--signoff');

  const result = await git.run(args, { cwd: repoRoot, timeoutMs: 120000 });
  if (result.spawnError !== undefined) throw new GitError(`无法启动 git：${result.spawnError.message}`, { args, ...result });
  if (!result.ok) {
    const text = `${result.stderr}${result.stdout}`;
    if (/nothing to commit|no changes added to commit/i.test(text)) throw badRequest('没有已暂存的改动。');
    if (/Please tell me who you are|unable to auto-detect email address|empty ident name/i.test(text)) {
      throw badRequest('git 还没有配置提交身份：请先执行 `git config --global user.name/user.email`。');
    }
    if (/pre-commit|hook/i.test(text) && /fail|error/i.test(text)) {
      throw new GitError('提交被 hook 拒绝', { args, ...result });
    }
    throw new GitError('提交失败', { args, ...result });
  }

  const summary = `${result.stdout}${result.stderr}`.trim();
  const match = /\[([^\]]+)\s+([0-9a-f]+)\]/.exec(summary);
  return {
    committed: true,
    hash: match === null ? '' : match[2],
    ref: match === null ? '' : match[1],
    summary,
    amended: amend,
  };
}

/**
 * 切换分支 / 新建分支并切换。要求工作区与仓库状态都干净。
 */
export async function checkout(git, repoRoot, repo, body = {}) {
  const target = String(body.ref ?? '').trim();
  if (target === '') throw badRequest('缺少要切换的分支。');
  const newBranch = typeof body.newBranch === 'string' ? body.newBranch.trim() : '';
  if (repo?.state !== undefined && repo.state !== 'clean') {
    throw badRequest(`当前有进行中的 ${repo.state} 操作，请先完成或放弃它。`);
  }
  const status = await git.probe(['status', '--porcelain', '-z', '--untracked-files=no'], { cwd: repoRoot });
  if (status === undefined) throw badRequest('无法读取工作区状态，请稍后重试。');
  const dirty = status.stdout.split('\0').filter((token) => token !== '').length;
  if (dirty > 0) throw badRequest(`工作区还有 ${dirty} 处未提交的改动，切换分支前请先提交或放弃。`);

  const args = newBranch === '' ? ['checkout', target] : ['checkout', '-b', newBranch, target];
  const result = await runOrThrow(git, args, { cwd: repoRoot, timeoutMs: 60000 }, '切换分支失败');
  return { checkedOut: target, newBranch, output: `${result.stdout}${result.stderr}`.trim() };
}

/** 放弃进行中的合并（只在的确有 MERGE_HEAD 时可用）。 */
export async function abortMerge(git, repoRoot, repo) {
  if (repo?.state !== 'merge') throw badRequest('当前没有进行中的合并。');
  await runOrThrow(git, ['merge', '--abort'], { cwd: repoRoot, timeoutMs: 60000 }, '放弃合并失败');
  return { aborted: true };
}
