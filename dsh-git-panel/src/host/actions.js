/**
 * 写操作：暂存、取消暂存、放弃改动、提交、切换分支、放弃合并。
 *
 * 原则：
 *  - **不做任何隐式操作**。没有「提交并推送」「一键同步」这类把多步打包的动作；
 *    每一步都由用户在面板上显式点。推送/拉取这类联网操作本插件完全不提供。
 *  - **放弃改动必须显式**：`discardWorktree` 只动工作区（已暂存的内容不受影响），
 *    未跟踪文件走 `git clean`，前端必须二次确认。
 *  - **切换分支不预设「工作区必须干净」**：git 自己才是唯一正确的判据——不冲突的
 *    未提交改动会跟着切过去，会被覆盖时 git 拒绝并列出文件。一刀切拒绝会让 agent
 *    正在跑的工作区永远切不了分支（连「切回去」都不行）。
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
 * 把 `git checkout` 的目标解析成真正的 argv。
 *
 * 远程跟踪分支不能直接把 `refs/remotes/origin/x` 交给 `git checkout`：那只会
 * detached HEAD（`origin/x` 缩写同样如此），用户以为切到了分支，实际失去了分支。
 * 正确形态是「有同名本地分支就切过去，没有就建一个同名本地分支并跟踪它」——
 * `git checkout -b <local> <refs/remotes/...>`，有远端配置时 git 会自己设 upstream。
 *
 * @returns `{ args, branch }`：`branch` 是切换完成后 HEAD 上的分支名。
 */
async function switchArgs(git, repoRoot, target) {
  const resolved = await git.probe(['rev-parse', '--verify', '--quiet', '--symbolic-full-name', target], { cwd: repoRoot });
  const refname = (resolved?.stdout ?? '').trim();
  if (!refname.startsWith('refs/remotes/')) return { args: ['checkout', target], branch: target };

  // `refname:lstrip=3` 剥掉 `refs/remotes/<remote>/`，剩下的就是本地分支名。
  const short = await git.probe(['for-each-ref', '--format=%(refname:lstrip=3)', refname], { cwd: repoRoot });
  const local = (short?.stdout ?? '').trim();
  if (local === '') return { args: ['checkout', target], branch: target };

  const exists = await git.probe(['rev-parse', '--verify', '--quiet', `refs/heads/${local}`], { cwd: repoRoot });
  return exists === undefined
    ? { args: ['checkout', '-b', local, refname], branch: local }
    : { args: ['checkout', local], branch: local };
}

/** git 的「会被覆盖」原文 → 一句能直接照着做的中文（带上文件清单）。 */
function overwriteMessage(text, target) {
  const lines = String(text ?? '').split(/\r?\n/);
  const at = lines.findIndex((line) => /would be overwritten by checkout/i.test(line));
  // 文件清单是 git 缩进一级列出来的（已跟踪文件与未跟踪文件两种原文都是这个形态），
  // 收尾的 Please … / Aborting 不缩进，正好被过滤掉。
  const files = at === -1
    ? []
    : lines.slice(at + 1).filter((line) => /^[\t ]+\S/.test(line)).map((line) => line.trim());
  const list = files.length === 0 ? '' : `：${files.join('、')}`;
  return `切换到 ${target} 会覆盖这些文件的未提交改动${list}。请先提交、暂存或放弃改动，再切换。`;
}

/**
 * 切换分支 / 新建分支并切换。
 *
 * 工作区不干净**不再直接拒绝**：只拦「进行中的 merge/rebase 等操作」（这时 git 的
 * 原文很难懂），其余交给 git——不冲突的改动跟着过去，会被覆盖时翻译成可操作的中文。
 */
export async function checkout(git, repoRoot, repo, body = {}) {
  const target = String(body.ref ?? '').trim();
  if (target === '') throw badRequest('缺少要切换的分支。');
  const newBranch = typeof body.newBranch === 'string' ? body.newBranch.trim() : '';
  if (repo?.state !== undefined && repo.state !== 'clean') {
    throw badRequest(`当前有进行中的 ${repo.state} 操作，请先完成或放弃它。`);
  }

  const plan = newBranch === ''
    ? await switchArgs(git, repoRoot, target)
    // unborn 分支上 `HEAD` 还不是一次提交，`-b x HEAD` 会失败；不带起点即可，
    // 这正是「在全新仓库里建第一条分支」的正确形态。
    : { args: ['checkout', '-b', newBranch, ...(repo?.unborn === true ? [] : [target])], branch: newBranch };

  let result;
  try {
    result = await runOrThrow(git, plan.args, { cwd: repoRoot, timeoutMs: 60000 }, '切换分支失败');
  } catch (error) {
    const text = error instanceof GitError ? `${error.stderr}${error.stdout}` : '';
    if (/would be overwritten by checkout/i.test(text)) throw badRequest(overwriteMessage(text, target));
    throw error;
  }
  return { checkedOut: plan.branch, newBranch, output: `${result.stdout}${result.stderr}`.trim() };
}

/** 放弃进行中的合并（只在的确有 MERGE_HEAD 时可用）。 */
export async function abortMerge(git, repoRoot, repo) {
  if (repo?.state !== 'merge') throw badRequest('当前没有进行中的合并。');
  await runOrThrow(git, ['merge', '--abort'], { cwd: repoRoot, timeoutMs: 60000 }, '放弃合并失败');
  return { aborted: true };
}
