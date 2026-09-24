/**
 * 仓库探测：把「一个目录」变成面板需要的仓库事实（根、git 目录、分支、HEAD、
 * 上游 ahead/behind、进行中的合并/rebase 状态）。
 *
 * 所有后续 git 调用都以 `repoRoot` 为 cwd 而不是工作区根：工作区可能是仓库的
 * 子目录，git 的路径输出永远是仓库相对路径，混用两个基准会把路径搞错。
 */
import { existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** 进行中的多步操作在 git 目录里留下的标记文件。 */
const STATE_MARKERS = [
  ['MERGE_HEAD', 'merge'],
  ['rebase-merge', 'rebase'],
  ['rebase-apply', 'rebase'],
  ['CHERRY_PICK_HEAD', 'cherry-pick'],
  ['REVERT_HEAD', 'revert'],
  ['BISECT_LOG', 'bisect'],
];

/** 路径比较用归一化：Windows 上 `--git-common-dir` 可能是相对的、反斜杠的。 */
function sameDirectory(left, right) {
  const normalize = (value) => String(value).replace(/\\/g, '/').replace(/\/+$/, '');
  return normalize(left).toLowerCase() === normalize(right).toLowerCase();
}

function detectState(gitDir) {
  if (gitDir === '') return { state: 'clean', stateDetail: '' };
  for (const [marker, state] of STATE_MARKERS) {
    const target = join(gitDir, marker);
    try {
      if (existsSync(target)) return { state, stateDetail: marker };
    } catch {
      /* 探测失败按干净处理：git 自己会在写操作时报错。 */
    }
  }
  return { state: 'clean', stateDetail: '' };
}

/** git 是否可用；不可用时给出可操作的中文提示。 */
export async function checkGit(git) {
  const result = await git.run(['--version'], { timeoutMs: 8000 });
  if (result.spawnError !== undefined) {
    return { ok: false, error: `找不到 git 可执行文件（${git.gitPath}）。请在插件配置里指定 gitPath，或把 git 加进 PATH。` };
  }
  if (!result.ok) return { ok: false, error: `git 无法执行：${result.stderr.trim() || `退出码 ${result.code}`}` };
  return { ok: true, version: result.stdout.trim() };
}

/**
 * 探测一个目录所属的仓库。
 * @returns
 *  `{ isRepo: false, bare, reason }` 或
 *  `{ isRepo: true, repoRoot, gitDir, commonDir, isWorktree, bare, branch, detached, head, state, stateDetail, subPath }`
 */
export async function inspectRepository(git, root) {
  const inside = await git.run(['rev-parse', '--is-inside-work-tree'], { cwd: root, timeoutMs: 10000 });
  if (inside.spawnError !== undefined) {
    return {
      isRepo: false,
      bare: false,
      gitMissing: true,
      reason: `找不到 git 可执行文件（${git.gitPath}）：请在插件配置里指定 gitPath，或把 git 加进 PATH。`,
    };
  }
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    const bare = await git.probe(['rev-parse', '--is-bare-repository'], { cwd: root });
    const isBare = bare !== undefined && bare.stdout.trim() === 'true';
    return {
      isRepo: false,
      bare: isBare,
      reason: isBare ? '这是一个裸仓库，没有工作区。' : '当前工作区不是 Git 仓库。',
    };
  }

  const top = await git.exec(['rev-parse', '--show-toplevel'], { cwd: root });
  const repoRoot = top.stdout.trim().replace(/\r?\n$/, '');
  if (repoRoot === '') return { isRepo: false, bare: false, reason: '无法解析仓库根目录。' };

  let gitDir = '';
  let commonDir = '';
  const dirs = await git.probe(['rev-parse', '--absolute-git-dir', '--git-common-dir'], { cwd: repoRoot });
  if (dirs !== undefined && dirs.ok) {
    const lines = dirs.stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
    gitDir = (lines[0] ?? '').trim();
    const common = (lines[1] ?? '').trim();
    commonDir = common === '' ? gitDir : common.startsWith('.') ? join(repoRoot, common) : common;
  } else {
    const fallback = await git.probe(['rev-parse', '--git-dir'], { cwd: repoRoot });
    gitDir = fallback === undefined ? '' : fallback.stdout.trim();
  }

  // `symbolic-ref` 在 unborn 分支上也能给出分支名，比 `rev-parse --abbrev-ref HEAD` 稳。
  const symbolic = await git.probe(['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: repoRoot });
  const branchName = symbolic === undefined ? '' : symbolic.stdout.trim();
  const head = await git.probe(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: repoRoot });
  const headOid = head === undefined ? '' : head.stdout.trim();
  const isWorktree = gitDir !== '' && commonDir !== '' && !sameDirectory(gitDir, commonDir);
  const { state, stateDetail } = detectState(gitDir);

  let subPath = '';
  try {
    const rel = relative(repoRoot, root);
    subPath = rel === '' || rel.startsWith('..') ? '' : rel.split('\\').join('/');
  } catch {
    subPath = '';
  }

  return {
    isRepo: true,
    bare: false,
    repoRoot,
    gitDir,
    commonDir,
    isWorktree,
    worktreeName: isWorktree ? (repoRoot.split(/[\\/]/).filter(Boolean).pop() ?? '') : '',
    branch: branchName,
    detached: branchName === '' && headOid !== '',
    head: headOid,
    unborn: headOid === '',
    state,
    stateDetail,
    subPath,
  };
}

/** 判断 gitDir 是否可读（worktree 被外部删掉后 gitDir 可能已经不存在）。 */
export function gitDirExists(repo) {
  if (repo?.gitDir === undefined || repo.gitDir === '') return false;
  try {
    return statSync(repo.gitDir).isDirectory();
  } catch {
    return false;
  }
}
