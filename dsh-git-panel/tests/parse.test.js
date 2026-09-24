// 纯解析器测试：夹具全部按真实 git 输出写（含 NUL/US/RS 分隔符与 rename 的怪形态）。
// 运行：node ./tests/parse.test.js
import { parseCommitRecord, parseDecorations, parseForEachRef, parseLogRecords, parseNameStatusZ, parseNumstatZ, parsePorcelainV2, parseUnifiedDiff, parseWorktreePorcelain } from '../src/host/parse.js';

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

/* ── status --porcelain=v2 --branch -z ─────────────────────────────────── */

const H1 = '0da48b445f3fa5b5dd9caa6d32786d67133e7826';
const H2 = 'b77b4eb1d946f923f61785536daca5af6909f06';
const H3 = 'de980441c3ab03a8c07dda1ad27b8a11f39deb1e';
const H4 = 'a7bc997eabe8cf84988b83d2e83f1d193124fe59';

const statusFixture = [
  `# branch.oid ${H1}`,
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -3',
  `1 M. N... 100644 100644 100644 ${H3} ${H4} a.txt`,
  `2 R. N... 100644 100644 100644 ${H2} ${H2} R100 renamed.txt`,
  'we ird.txt',
  '1 .M N... 100644 100644 100644 1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 sub/b.txt',
  'u UU N... 100644 100644 100644 100644 1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 3333333333333333333333333333333333333333 conflict.txt',
  '? binary.bin',
  '? new dir/file with spaces.txt',
  '',
].join('\u0000');

const status = parsePorcelainV2(statusFixture);
eq('status: 分支头', status.branch, { oid: H1, head: 'main', upstream: 'origin/main', ahead: 2, behind: 3, initial: false, detached: false });
eq('status: 条目数', status.entries.length, 6);
eq('status: 普通修改（index 侧）', status.entries[0], {
  path: 'a.txt',
  origPath: undefined,
  index: 'M',
  worktree: '.',
  kind: 'modified',
  submodule: false,
  conflicted: false,
  untracked: false,
  ignored: false,
});
eq('status: 重命名带旧路径', [status.entries[1].path, status.entries[1].origPath, status.entries[1].kind], ['renamed.txt', 'we ird.txt', 'renamed']);
eq('status: 工作区侧修改', [status.entries[2].path, status.entries[2].kind], ['sub/b.txt', 'modified']);
eq('status: 冲突条目', [status.entries[3].kind, status.entries[3].conflicted], ['conflicted', true]);
eq('status: 未跟踪条目', [status.entries[4].kind, status.entries[4].untracked], ['untracked', true]);
eq('status: 未跟踪路径含空格', status.entries[5].path, 'new dir/file with spaces.txt');

const unborn = parsePorcelainV2('# branch.oid (initial)\u0000# branch.head main\u0000');
eq('status: unborn', [unborn.branch.initial, unborn.branch.oid, unborn.branch.head], [true, '', 'main']);
const detached = parsePorcelainV2(`# branch.oid ${H1}\u0000# branch.head (detached)\u0000`);
eq('status: detached', [detached.branch.detached, detached.branch.head], [true, '']);

/* ── --numstat -z（rename 形态） ───────────────────────────────────────── */

const numstat = parseNumstatZ('2\t1\ta.txt\u00000\t0\t\u0000we ird.txt\u0000renamed.txt\u0000-\t-\tbinary.bin\u0000');
eq('numstat: 普通条目', numstat.get('a.txt'), { additions: 2, deletions: 1, binary: false });
eq('numstat: rename 同时登记新旧路径', [numstat.get('renamed.txt'), numstat.get('we ird.txt')], [
  { additions: 0, deletions: 0, binary: false, origPath: 'we ird.txt' },
  { additions: 0, deletions: 0, binary: false, origPath: 'we ird.txt' },
]);
eq('numstat: 二进制', numstat.get('binary.bin'), { additions: null, deletions: null, binary: true });

/* ── diff-tree --name-status -z ────────────────────────────────────────── */

eq('name-status: 修改 + 重命名 + 新增', parseNameStatusZ('M\u0000a.txt\u0000R100\u0000we ird.txt\u0000renamed.txt\u0000A\u0000s.txt\u0000'), [
  { path: 'a.txt', status: 'modified' },
  { path: 'renamed.txt', origPath: 'we ird.txt', status: 'renamed' },
  { path: 's.txt', status: 'added' },
]);
eq('name-status: 空输入', parseNameStatusZ(''), []);

/* ── log --format=…%x1f…%x1e ──────────────────────────────────────────── */

const logFixture = [
  `${H1}\x1f0da48b4\x1fsecond commit\x1fT\x1f2026-09-24T10:35:14+08:00\x1f${H3}\x1fHEAD -> main, origin/main, tag: v1\x1fbody line 1\nbody line 2\n\x1e\n`,
  `${H3}\x1fde98044\x1ffirst commit\x1fT\x1f2026-09-24T10:35:02+08:00\x1f\x1f\x1f\x1e\n`,
].join('');

const commits = parseLogRecords(logFixture);
eq('log: 条数', commits.length, 2);
eq('log: 首条字段', [commits[0].hash, commits[0].shortHash, commits[0].subject, commits[0].author, commits[0].authoredAt], [
  H1,
  '0da48b4',
  'second commit',
  'T',
  '2026-09-24T10:35:14+08:00',
]);
eq('log: 父提交', commits[0].parents, [H3]);
eq('log: 正文', commits[0].body, 'body line 1\nbody line 2');
eq('log: 装饰', commits[0].decorations, [
  { name: 'main', kind: 'head' },
  { name: 'origin/main', kind: 'remote' },
  { name: 'v1', kind: 'tag' },
]);
eq('log: 根提交没有父与装饰', [commits[1].parents, commits[1].decorations, commits[1].body], [[], [], '']);

eq('commit: 单条解析', parseCommitRecord(`${H1}\x1fa\x1fsub\x1fme\x1f2026-01-01T00:00:00+08:00\x1f\x1fHEAD\x1fmsg\n\n`)?.subject, 'sub');
eq('decorations: 空值', parseDecorations(''), []);
eq('decorations: HEAD 单独出现', parseDecorations('HEAD'), [{ name: 'HEAD', kind: 'head' }]);

/* ── worktree list --porcelain -z ──────────────────────────────────────── */

const worktreeFixture = [
  'worktree C:/repo',
  `HEAD ${H1}`,
  'branch refs/heads/main',
  '',
  'worktree C:/repo-wt1',
  `HEAD ${H2}`,
  'detached',
  '',
  'worktree C:/repo-wt2',
  `HEAD ${H3}`,
  'branch refs/heads/feat',
  'locked reason here',
  '',
  'worktree C:/gone',
  `HEAD ${H4}`,
  'branch refs/heads/gone',
  'prunable gitdir file points to non-existent location',
  '',
].join('\u0000');

const trees = parseWorktreePorcelain(worktreeFixture);
eq('worktree: 条数', trees.length, 4);
eq('worktree: 主树', [trees[0].path, trees[0].head, trees[0].branch, trees[0].detached], ['C:/repo', H1, 'refs/heads/main', false]);
eq('worktree: detached', [trees[1].path, trees[1].detached], ['C:/repo-wt1', true]);
eq('worktree: locked', [trees[2].locked, trees[2].lockReason], [true, 'reason here']);
eq('worktree: prunable', [trees[3].prunable, trees[3].pruneReason.startsWith('gitdir')], [true, true]);
eq('worktree: 换行形态也认', parseWorktreePorcelain('worktree /a\nHEAD abc\nbranch refs/heads/x\n\n').length, 1);

/* ── for-each-ref ─────────────────────────────────────────────────────── */

const refFixture = [
  `refs/heads/main\x1f${H1.slice(0, 7)}\x1ffirst commit\x1f*\n`,
  `refs/remotes/origin/main\x1f${H1.slice(0, 7)}\x1ffirst commit\x1f \n`,
  `refs/remotes/origin/HEAD\x1f${H1.slice(0, 7)}\x1fFIRST\x1f \n`,
  `refs/tags/v1\x1f${H1.slice(0, 7)}\x1ftag subject\x1f \n`,
  '\n',
].join('');
const refs = parseForEachRef(refFixture);
eq('refs: symref HEAD 被跳过', refs.length, 3);
eq('refs: 本地分支', refs[0], { name: 'main', fullName: 'refs/heads/main', kind: 'local', commit: H1.slice(0, 7), subject: 'first commit', head: true });
eq('refs: 远程与标签', [refs[1].kind, refs[2].kind], ['remote', 'tag']);

/* ── 统一 diff ────────────────────────────────────────────────────────── */

const diffText = [
  'diff --git a/a.txt b/a.txt',
  'index a7bc997..bd2b3e3 100644',
  '--- a/a.txt',
  '+++ b/a.txt',
  '@@ -2,3 +2,4 @@ section header',
  ' B',
  ' c',
  '-c',
  '+C',
  '+e',
  '\\ No newline at end of file',
  'diff --git a/new.txt b/new.txt',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/new.txt',
  '@@ -0,0 +1,2 @@',
  '+one',
  '+two',
  'diff --git a/bin.dat b/bin.dat',
  'index 1111111..2222222 100644',
  'Binary files a/bin.dat and b/bin.dat differ',
].join('\n');

const parsedDiff = parseUnifiedDiff(diffText);
eq('diff: 文件数', parsedDiff.files.length, 3);
eq('diff: 第一段路径', [parsedDiff.files[0].oldPath, parsedDiff.files[0].newPath], ['a.txt', 'a.txt']);
eq('diff: 第一段段落', [parsedDiff.files[0].hunks.length, parsedDiff.files[0].hunks[0].oldStart, parsedDiff.files[0].hunks[0].newLines, parsedDiff.files[0].hunks[0].section], [1, 2, 4, 'section header']);
eq('diff: 行号与类型', parsedDiff.files[0].hunks[0].lines.map((line) => [line.type, line.text, line.oldNumber, line.newNumber]), [
  ['ctx', 'B', 2, 2],
  ['ctx', 'c', 3, 3],
  ['del', 'c', 4, undefined],
  ['add', 'C', undefined, 4],
  ['add', 'e', undefined, 5],
  ['note', 'No newline at end of file', undefined, undefined],
]);
eq('diff: 无换行标记', parsedDiff.files[0].hunks[0].lines[4].noNewline, true);
eq('diff: 增删统计', [parsedDiff.files[0].additions, parsedDiff.files[0].deletions], [2, 1]);
eq('diff: 新增文件', [parsedDiff.files[1].newFile, parsedDiff.files[1].oldPath, parsedDiff.files[1].path], [true, '', 'new.txt']);
eq('diff: 二进制', [parsedDiff.files[2].binary, parsedDiff.files[2].hunks.length], [true, 0]);
eq('diff: 总统计', [parsedDiff.additions, parsedDiff.deletions], [4, 1]);

const renameDiff = parseUnifiedDiff(['diff --git a/old.txt b/new.txt', 'similarity index 100%', 'rename from old.txt', 'rename to new.txt', 'diff --git a/del.txt b/del.txt', 'deleted file mode 100644', '--- a/del.txt', '+++ /dev/null', '@@ -1 +0,0 @@', '-gone'].join('\n'));
eq('diff: rename', [renameDiff.files[0].renameFrom, renameDiff.files[0].renameTo, renameDiff.files[0].path], ['old.txt', 'new.txt', 'new.txt']);
eq('diff: 删除文件', [renameDiff.files[1].deletedFile, renameDiff.files[1].path], [true, 'del.txt']);

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`parse.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`parse.test OK (${passed} assertions)`);
