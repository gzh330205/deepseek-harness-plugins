// 真实 git 集成测试：在临时仓库里跑宿主的全部只读/写路径。
// 没有 git 时整体跳过（打印 SKIP 并返回 0），不阻塞 CI。
// 运行：node ./tests/git.integration.test.js
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commit, discardWorktree, stage, stageAll, unstage, unstageAll } from '../src/host/actions.js';
import { commitDiff, fileDiff } from '../src/host/diff.js';
import { createGit } from '../src/host/git.js';
import { readBranches, readCommit, readHistory } from '../src/host/history.js';
import { inspectRepository } from '../src/host/repo.js';
import { readStatus } from '../src/host/status.js';
import { addWorktree, pruneWorktrees, readWorktrees, removeWorktree } from '../src/host/worktree.js';

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
}
const eq = (label, actual, expected) => check(label, JSON.stringify(actual) === JSON.stringify(expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
const samePath = (left, right) => String(left).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === String(right).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const throwsAsync = async (label, fn) => {
  try {
    await fn();
    check(label, false, '没有抛错');
  } catch (error) {
    check(label, true, String(error));
  }
};

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-git-panel-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'a.txt'), 'one\ntwo\nthree\n');
  writeFileSync(join(dir, 'old name.txt'), 'rename me\n');
  writeFileSync(join(dir, 'delete.txt'), 'bye\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'first commit']);
  return dir;
}

let repoDir = '';
const cleanup = [];
try {
  try {
    git(process.cwd(), ['--version']);
  } catch {
    console.log('git.integration.test SKIP（没有可用的 git）');
    process.exit(0);
  }

  repoDir = makeRepo();
  const gitRunner = createGit({});
  const root = repoDir;

  /* ── 仓库探测 ─────────────────────────────────────────────────────── */

  const repo = await inspectRepository(gitRunner, root);
  check('探测：是仓库', repo.isRepo === true);
  eq('探测：分支', repo.branch, 'main');
  eq('探测：不是 worktree', repo.isWorktree, false);
  eq('探测：没有进行中的操作', repo.state, 'clean');
  check('探测：HEAD 非空', repo.head.length === 40, repo.head);
  eq('探测：子路径为空（根就是仓库根）', repo.subPath, '');

  const notRepoDir = mkdtempSync(join(tmpdir(), 'dsh-git-panel-plain-'));
  cleanup.push(notRepoDir);
  const plain = await inspectRepository(gitRunner, notRepoDir);
  eq('探测：非仓库给出原因', [plain.isRepo, typeof plain.reason === 'string' && plain.reason.length > 0], [false, true]);

  /* ── 状态快照 ─────────────────────────────────────────────────────── */

  writeFileSync(join(root, 'a.txt'), 'one\nTWO\nthree\nfour\n');
  writeFileSync(join(root, 'staged.txt'), 'new staged\n');
  writeFileSync(join(root, 'untracked.txt'), 'untracked\n');
  git(root, ['add', 'staged.txt']);

  const status = await readStatus(gitRunner, repo.repoRoot);
  const byPath = new Map(status.entries.map((entry) => [entry.path, entry]));
  check('状态：包含 a.txt', byPath.has('a.txt'));
  check('状态：包含 staged.txt', byPath.has('staged.txt'));
  check('状态：包含 untracked.txt', byPath.has('untracked.txt'));
  eq('状态：a.txt 是未暂存修改', [byPath.get('a.txt').index, byPath.get('a.txt').worktree], ['.', 'M']);
  eq('状态：staged.txt 是已暂存新增', [byPath.get('staged.txt').index, byPath.get('staged.txt').kind], ['A', 'added']);
  eq('状态：untracked.txt 是未跟踪', [byPath.get('untracked.txt').untracked, byPath.get('untracked.txt').kind], [true, 'untracked']);
  eq('状态：a.txt 工作区行数', [byPath.get('a.txt').stats.worktree.additions, byPath.get('a.txt').stats.worktree.deletions], [2, 1]);
  eq('状态：staged.txt 暂存行数', [byPath.get('staged.txt').stats.staged.additions, byPath.get('staged.txt').stats.staged.deletions], [1, 0]);
  eq('状态：分支信息', [status.branch.head, status.branch.upstream], ['main', '']);

  /* ── 差异 ─────────────────────────────────────────────────────────── */

  const unstaged = await fileDiff(gitRunner, repo.repoRoot, { path: 'a.txt' });
  eq('差异：未暂存有内容', [unstaged.empty, unstaged.additions, unstaged.deletions], [false, 2, 1]);
  const addedLines = unstaged.file.hunks.flatMap((hunk) => hunk.lines).filter((line) => line.type === 'add').map((line) => line.text);
  eq('差异：新增行内容', addedLines, ['TWO', 'four']);
  check('差异：行号从 1 开始', unstaged.file.hunks[0].oldStart >= 1);

  const stagedDiff = await fileDiff(gitRunner, repo.repoRoot, { path: 'staged.txt', staged: true });
  eq('差异：已暂存新增文件', [stagedDiff.file.newFile, stagedDiff.additions], [true, 1]);

  const untrackedDiff = await fileDiff(gitRunner, repo.repoRoot, { path: 'untracked.txt', untracked: true });
  eq('差异：未跟踪走 --no-index', [untrackedDiff.empty, untrackedDiff.additions], [false, 1]);

  const renameBefore = await fileDiff(gitRunner, repo.repoRoot, { path: 'a.txt', contextLines: 0 });
  check('差异：上下文行数可配', renameBefore.file.hunks.every((hunk) => hunk.lines.filter((line) => line.type === 'ctx').length <= 0));

  await throwsAsync('差异：绝对路径被拒', () => fileDiff(gitRunner, repo.repoRoot, { path: '/etc/passwd' }));

  /* ── 暂存 / 取消暂存 / 放弃 ───────────────────────────────────────── */

  await stage(gitRunner, repo.repoRoot, ['a.txt']);
  let afterStage = await readStatus(gitRunner, repo.repoRoot);
  const stagedA = afterStage.entries.find((entry) => entry.path === 'a.txt');
  eq('暂存：a.txt 进入 index', [stagedA.index, stagedA.worktree], ['M', '.']);

  await unstage(gitRunner, repo.repoRoot, ['a.txt']);
  afterStage = await readStatus(gitRunner, repo.repoRoot);
  eq('取消暂存：a.txt 回到工作区', [afterStage.entries.find((entry) => entry.path === 'a.txt').index], ['.']);

  await discardWorktree(gitRunner, repo.repoRoot, [], { tracked: ['a.txt'], untracked: ['untracked.txt'] });
  afterStage = await readStatus(gitRunner, repo.repoRoot);
  check('放弃：a.txt 已还原', !afterStage.entries.some((entry) => entry.path === 'a.txt'));
  check('放弃：未跟踪文件已删除', !afterStage.entries.some((entry) => entry.path === 'untracked.txt'));
  eq('放弃：文件内容回到基线', readFileSync(join(root, 'a.txt'), 'utf8'), 'one\ntwo\nthree\n');

  /* ── 提交 ─────────────────────────────────────────────────────────── */

  writeFileSync(join(root, 'a.txt'), 'one\nTWO\nthree\n');
  await stage(gitRunner, repo.repoRoot, ['a.txt']);
  const committed = await commit(gitRunner, repo.repoRoot, { message: 'second: change a.txt' });
  check('提交：拿到 hash', committed.committed === true && committed.hash.length >= 7, JSON.stringify(committed));
  eq('提交：HEAD 前进', git(root, ['log', '-1', '--format=%s']), 'second: change a.txt');

  writeFileSync(join(root, 'a.txt'), 'one\nTHREE\nthree\n');
  await stageAll(gitRunner, repo.repoRoot);
  const amended = await commit(gitRunner, repo.repoRoot, { message: 'second: change a.txt (amended)', amend: true, confirmAmend: true });
  eq('提交：amend 生效', [amended.amended, git(root, ['log', '-1', '--format=%s'])], [true, 'second: change a.txt (amended)']);

  await throwsAsync('提交：空信息被拒', () => commit(gitRunner, repo.repoRoot, { message: '   ' }));
  await throwsAsync('提交：没有暂存内容时报错可读', () => commit(gitRunner, repo.repoRoot, { message: 'nothing' }));

  /* ── 历史 ─────────────────────────────────────────────────────────── */

  const history = await readHistory(gitRunner, repo.repoRoot, { limit: 10 });
  eq('历史：两条提交', history.commits.length, 2);
  eq('历史：HEAD 在第一条', history.commits[0].subject, 'second: change a.txt (amended)');
  eq('历史：HEAD 的父是根提交', history.commits[0].parents, [history.commits[1].hash]);
  check('历史：HEAD 带 head 装饰', history.commits[0].decorations.some((item) => item.kind === 'head'), JSON.stringify(history.commits[0].decorations));
  eq('历史：分页 hasMore=false', history.hasMore, false);

  const paged = await readHistory(gitRunner, repo.repoRoot, { limit: 1 });
  eq('历史：分页 hasMore=true', paged.hasMore, true);
  const paged2 = await readHistory(gitRunner, repo.repoRoot, { limit: 1, skip: 1 });
  eq('历史：第二页是根提交', paged2.commits[0].hash, history.commits[1].hash);

  const detail = await readCommit(gitRunner, repo.repoRoot, { hash: history.commits[0].hash });
  // stageAll 在 amend 之前跑过，所以这一次提交同时包含 a.txt 与 staged.txt。
  eq('提交详情：文件数', detail.files.length, 2);
  eq('提交详情：文件名集合', detail.files.map((file) => file.path).sort(), ['a.txt', 'staged.txt']);
  const detailA = detail.files.find((file) => file.path === 'a.txt');
  eq('提交详情：a.txt 状态与行数', [detailA.status, detailA.additions, detailA.deletions], ['modified', 1, 1]);
  eq('提交详情：不是合并', detail.merge, false);

  const rootDetail = await readCommit(gitRunner, repo.repoRoot, { hash: history.commits[1].hash });
  eq('提交详情：根提交列出全部文件', rootDetail.files.length, 3);
  eq('提交详情：根提交没有父', rootDetail.commit.parents, []);

  const withDiff = await commitDiff(gitRunner, repo.repoRoot, { hash: history.commits[0].hash, path: 'a.txt' });
  eq('提交差异：单文件', [withDiff.files.length, withDiff.additions], [1, 1]);

  /* ── 分支 / 标签 ──────────────────────────────────────────────────── */

  git(root, ['tag', 'v1.0']);
  const branches = await readBranches(gitRunner, repo.repoRoot);
  const main = branches.local.find((ref) => ref.name === 'main');
  eq('分支：main 是当前分支', [main.head, main.kind], [true, 'local']);
  check('分支：标签可见', branches.tags.some((ref) => ref.name === 'v1.0'));

  /* ── 工作树 ───────────────────────────────────────────────────────── */

  const listBefore = await readWorktrees(gitRunner, repo, {});
  eq('工作树：初始只有主工作区', listBefore.worktrees.length, 1);
  eq('工作树：主工作区标记', [listBefore.worktrees[0].main, listBefore.worktrees[0].current], [true, true]);
  check('工作树：给出建议根目录', listBefore.suggestedRoot.includes('.dsh-worktrees'), listBefore.suggestedRoot);

  const created = await addWorktree(gitRunner, repo, { dirName: 'probe', worktreeRoot: join(repoDir, '..', `${'wt-root-'}${process.pid}`), mode: 'detached' });
  cleanup.push(created.path);
  check('工作树：目录已创建', existsSync(created.path), created.path);
  eq('工作树：detached 形态没有分支', created.branch, '');

  const listAfter = await readWorktrees(gitRunner, repo, { worktreeRoot: join(repoDir, '..', `${'wt-root-'}${process.pid}`) });
  eq('工作树：新增后共两棵', listAfter.worktrees.length, 2);
  const probe = listAfter.worktrees.find((item) => samePath(item.path, created.path));
  check('工作树：探测到未提交状态为假', probe.dirty === true || probe.dirty === false, JSON.stringify(probe));
  eq('工作树：干净且是祖先 → merged', [probe.dirty, probe.merged], [false, true]);

  // 在工作树里改点东西：不能无 force 删除，导出补丁后可以强制删。
  writeFileSync(join(created.path, 'a.txt'), 'one\nTWO\nthree\nwt-only\n');
  const dirtyList = await readWorktrees(gitRunner, repo, {});
  const dirtyProbe = dirtyList.worktrees.find((item) => samePath(item.path, created.path));
  eq('工作树：脏状态可见', [dirtyProbe.dirty, dirtyProbe.dirtyCount >= 1], [true, true]);
  await throwsAsync('工作树：脏且未强制时拒绝删除', () => removeWorktree(gitRunner, repo, { path: created.path, worktreeRoot: join(repoDir, '..', `${'wt-root-'}${process.pid}`) }));

  const removed = await removeWorktree(gitRunner, repo, {
    path: created.path,
    force: true,
    exportPatch: true,
    worktreeRoot: join(repoDir, '..', `${'wt-root-'}${process.pid}`),
  });
  eq('工作树：已删除', [removed.removed, existsSync(created.path)], [true, false]);
  check('工作树：补丁已导出', removed.patchPath !== '' && existsSync(removed.patchPath), removed.patchPath);
  if (removed.patchPath !== '') {
    const patch = readFileSync(removed.patchPath, 'utf8');
    check('工作树：补丁里有未提交内容', patch.includes('wt-only'), patch.slice(0, 200));
    cleanup.push(removed.patchPath);
  }

  const pruned = await pruneWorktrees(gitRunner, repo);
  check('工作树：prune 可执行', typeof pruned.output === 'string');

  const branchWorktree = await addWorktree(gitRunner, repo, {
    dirName: 'feat',
    mode: 'branch',
    branchPrefix: 'dsh/',
    worktreeRoot: join(repoDir, '..', `${'wt-root-'}${process.pid}`),
  });
  cleanup.push(branchWorktree.path);
  eq('工作树：branch 形态自动命名', branchWorktree.branch, 'dsh/feat');
  const worktreeList = await readWorktrees(gitRunner, repo, {});
  const branchEntry = worktreeList.worktrees.find((item) => samePath(item.path, branchWorktree.path));
  eq('工作树：分支名去掉 refs/heads 前缀', branchEntry.branch, 'dsh/feat');
  await removeWorktree(gitRunner, repo, { path: branchWorktree.path, force: true, worktreeRoot: join(repoDir, '..', `${'wt-root-'}${process.pid}`) });

  /* ── 未跟踪状态下 cancel 全部暂存 ─────────────────────────────────── */

  writeFileSync(join(root, 'x.txt'), 'x\n');
  writeFileSync(join(root, 'y.txt'), 'y\n');
  await stageAll(gitRunner, repo.repoRoot);
  const stagedAll = await readStatus(gitRunner, repo.repoRoot);
  eq('全部暂存：两个新文件都在 index', stagedAll.entries.filter((entry) => entry.index === 'A').length, 2);
  await unstageAll(gitRunner, repo.repoRoot, { unborn: false });
  const unstagedAll = await readStatus(gitRunner, repo.repoRoot);
  eq('全部取消暂存：回到未跟踪', unstagedAll.entries.filter((entry) => entry.kind === 'untracked').length, 2);
} catch (error) {
  failures.push(`未捕获异常：${error instanceof Error ? `${error.message}\n${error.stack}` : String(error)}`);
} finally {
  for (const path of cleanup) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch {
      /* 清理失败不影响结论。 */
    }
  }
  try {
    if (repoDir !== '') rmSync(repoDir, { recursive: true, force: true });
    const wtRoot = join(repoDir, '..', `wt-root-${process.pid}`);
    rmSync(wtRoot, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
}

if (failures.length > 0) {
  console.error(`git.integration.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`git.integration.test OK (${passed} assertions)`);
