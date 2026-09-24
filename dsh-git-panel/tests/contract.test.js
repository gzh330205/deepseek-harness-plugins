// 契约与共享语义测试：入参护栏、worktree 目录推导、变更分组。
// 运行：node ./tests/contract.test.js
import { LIMITS, assertBranch, assertHash, assertRef, assertRoot, errorMessage, isInside, normalizeRepoPath, repoNameOf, slugify, worktreeDirectory, worktreeRootDir } from '../src/host/contract.js';
import { readPaths } from '../src/host/actions.js';
import { GitError } from '../src/host/git.js';
import { baseName, changeCounts, dirName, groupChanges, isStaged, isUnstaged, kindLetter, kindTone, statBadge } from '../src/shared/git-status.js';

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
const throws = (label, fn) => {
  try {
    fn();
    check(label, false, '没有抛错');
  } catch (error) {
    check(label, error.status === 400, `状态码是 ${error.status}`);
  }
};
const slashes = (value) => String(value).split('\\').join('/');

/* ── 入参护栏 ─────────────────────────────────────────────────────────── */

eq('root：绝对路径通过', assertRoot('D:/ws/proj'), 'D:/ws/proj');
throws('root：相对路径被拒', () => assertRoot('proj'));
throws('root：空串被拒', () => assertRoot('   '));

eq('ref：普通分支', assertRef('main'), 'main');
eq('ref：含斜杠与 ~', assertRef('feature/x~2'), 'feature/x~2');
eq('ref：^{commit} 形态', assertRef('HEAD^{commit}'), 'HEAD^{commit}');
throws('ref：以 - 开头被拒（防参数注入）', () => assertRef('--upload-pack=touch /tmp/x'));
throws('ref：含空格被拒', () => assertRef('main; rm -rf /'));
throws('ref：含 : 被拒', () => assertRef('main:evil'));

eq('hash：7 位短 hash', assertHash('0da48b4'), '0da48b4');
eq('hash：40 位全 hash', assertHash('a'.repeat(40)), 'a'.repeat(40));
throws('hash：太短被拒', () => assertHash('abc'));
throws('hash：非十六进制被拒', () => assertHash('zzzzzz'));

eq('branch：常规名', assertBranch('dsh/fix-login-2'), 'dsh/fix-login-2');
throws('branch：以 - 开头被拒', () => assertBranch('-x'));
throws('branch：含 .. 被拒', () => assertBranch('a..b'));
throws('branch：以 .lock 结尾被拒', () => assertBranch('x.lock'));
throws('branch：以 / 结尾被拒', () => assertBranch('x/'));

eq('path：正斜杠归一', normalizeRepoPath('src//a/./b.txt'), 'src/a/b.txt');
eq('path：反斜杠归一', normalizeRepoPath('src\\a\\b.txt'), 'src/a/b.txt');
eq('path：空格与 Unicode 保留', normalizeRepoPath('目录 with space/文件.txt'), '目录 with space/文件.txt');
throws('path：绝对路径被拒', () => normalizeRepoPath('/etc/passwd'));
throws('path：Windows 盘符被拒', () => normalizeRepoPath('C:/Windows/system32'));
throws('path：跳出仓库被拒', () => normalizeRepoPath('../../etc/passwd'));
throws('path：换行被拒', () => normalizeRepoPath('a\nb'));
throws('path：空路径被拒', () => normalizeRepoPath(''));

eq('批量路径：去重', readPaths({ paths: ['a.txt', 'a.txt', 'b.txt'] }), ['a.txt', 'b.txt']);
throws('批量路径：空列表被拒', () => readPaths({ paths: [] }));
throws('批量路径：超过上限被拒', () => readPaths({ paths: new Array(LIMITS.maxPathsPerAction + 1).fill('a.txt').map((_, index) => `f${index}.txt`) }));

/* ── worktree 目录推导 ────────────────────────────────────────────────── */

eq('slugify：压掉非法字符', slugify('fix login/2!'), 'fix-login-2');
eq('slugify：全非法时回落', slugify('///'), 'worktree');
eq('slugify：保留中文', slugify('修复登录'), '修复登录');
eq('repoNameOf：取末级目录', repoNameOf('D:/ws/my repo/'), 'my-repo');
eq('worktreeRootDir：默认放在仓库旁边', slashes(worktreeRootDir({ repoRoot: 'D:/ws/proj' })), 'D:/ws/.dsh-worktrees/proj');
eq('worktreeRootDir：配置优先', slashes(worktreeRootDir({ repoRoot: 'D:/ws/proj', worktreeRoot: 'E:/wt' })), 'E:/wt/proj');
eq('worktreeDirectory：拼上净化后的目录名', slashes(worktreeDirectory({ repoRoot: 'D:/ws/proj', dirName: 'fix login' })), 'D:/ws/.dsh-worktrees/proj/fix-login');
check('isInside：子路径为真', isInside('D:/ws', 'D:/ws/a/b'));
check('isInside：同路径为真', isInside('D:/ws', 'D:/ws'));
check('isInside：兄弟路径为假', !isInside('D:/ws', 'D:/ws2'));

/* ── 错误文案 ─────────────────────────────────────────────────────────── */

const gitError = new GitError('git status 执行失败', { args: ['status'], code: 128, stderr: 'fatal: not a git repository (or any of the parent directories)', timedOut: false });
eq('GitError：优先 git 自己的错误行', errorMessage(gitError), 'not a git repository (or any of the parent directories)');
eq('GitError：超时文案', errorMessage(new GitError('x', { timedOut: true })), 'git 命令超时。');
eq('普通错误：走 message', errorMessage(new Error('普通错误')), '普通错误');
eq('非错误值', errorMessage('boom'), 'boom');

/* ── 变更分组语义 ─────────────────────────────────────────────────────── */

const entry = (path, index, worktree, extra = {}) => ({ path, index, worktree, kind: 'modified', conflicted: false, untracked: false, ...extra });
const entries = [
  entry('staged-only.txt', 'M', '.'),
  entry('unstaged-only.txt', '.', 'M'),
  entry('both.txt', 'M', 'M'),
  entry('new.txt', '?', '?', { untracked: true, kind: 'untracked' }),
  entry('conflict.txt', 'U', 'U', { conflicted: true, kind: 'conflicted' }),
];

const groups = groupChanges(entries);
eq('分组：已暂存（含 both）', groups.staged.map((item) => item.path), ['staged-only.txt', 'both.txt']);
eq('分组：未暂存', groups.unstaged.map((item) => item.path), ['unstaged-only.txt', 'both.txt']);
eq('分组：未跟踪', groups.untracked.map((item) => item.path), ['new.txt']);
eq('分组：冲突单独一组', groups.conflicts.map((item) => item.path), ['conflict.txt']);
eq('计数', changeCounts(entries), { total: 5, staged: 2, unstaged: 2, untracked: 1, conflicted: 1 });
eq('isStaged：未跟踪为假', isStaged(entries[3]), false);
eq('isUnstaged：未跟踪为真', isUnstaged(entries[3]), true);
eq('isStaged：删除也算暂存', isStaged(entry('d.txt', 'D', '.')), true);

eq('字母与配色', [kindLetter('modified'), kindLetter('untracked'), kindTone('added'), kindTone('deleted'), kindTone('conflicted')], ['M', '?', 'add', 'del', 'conflict']);
eq('statBadge：二进制返回 null', statBadge({ additions: null, deletions: null, binary: true }), null);
eq('statBadge：数字归一', statBadge({ additions: 3, deletions: null, binary: false }), { additions: 3, deletions: 0 });
eq('路径拆分', [baseName('a/b/c.txt'), dirName('a/b/c.txt'), baseName('c.txt'), dirName('c.txt')], ['c.txt', 'a/b', 'c.txt', '']);

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`contract.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`contract.test OK (${passed} assertions)`);
