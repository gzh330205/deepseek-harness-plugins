// 变更目录树测试：排序、单链压缩、聚合（文件数与增删行数）、未知行数。
// 运行：node ./tests/tree.test.js
import { buildChangeTree, collectDirectoryPaths, countTreeFiles } from '../src/shared/change-tree.js';

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

const stat = (additions, deletions) => ({ additions, deletions, binary: false });
const none = { additions: null, deletions: null, binary: false };
const file = (path, worktree = none, staged = none) => ({ path, stats: { worktree, staged } });

const entries = [
  file('src/a.txt', stat(2, 1)),
  file('src/b.txt', stat(0, 3)),
  file('src/deep/nested/c.txt', none, stat(5, 0)),
  file('README.md', stat(1, 0)),
  file('untracked.txt'),
  file('pkg/file10.txt', stat(1, 1)),
  file('pkg/file2.txt', stat(1, 1)),
  file('lib/x.txt', stat(0, 1)),
  file('lib/sub/y.txt', stat(0, 1)),
];

const root = buildChangeTree(entries);
const names = (nodes) => nodes.map((node) => node.name);

eq('根：目录在前、文件在后，各自自然序', names(root.children), ['lib', 'pkg', 'src', 'README.md', 'untracked.txt']);
eq('根：文件总数', root.files, entries.length);
eq('根：不压缩自己（name 保持空）', root.name, '');
eq('自然序：file2 在 file10 前', names(root.children[1].children), ['file2.txt', 'file10.txt']);

const src = root.children.find((node) => node.name === 'src');
eq('src：目录先于文件', names(src.children), ['deep/nested', 'a.txt', 'b.txt']);
eq('单链压缩：deep/nested 合成一行', src.children[0].path, 'src/deep/nested');
eq('单链压缩：保留子文件', names(src.children[0].children), ['c.txt']);
eq('单链压缩：目录自身没有文件时不额外占层', src.children[0].type, 'dir');
eq('src：聚合文件数', src.files, 3);
eq('src：聚合工作区行数（子目录不误算）', src.worktree, { additions: 2, deletions: 4, binary: false, unknown: false });
eq('src：聚合暂存行数', src.staged, { additions: 5, deletions: 0, binary: false, unknown: false });
eq('src 的文件行：叶子自带 stats 未被改写', [src.children[1].entry.path, src.children[1].entry.stats.worktree], ['src/a.txt', stat(2, 1)]);

const lib = root.children.find((node) => node.name === 'lib');
eq('有自己文件的目录不压缩', names(lib.children), ['sub', 'x.txt']);
eq('lib：聚合总数', lib.files, 2);

eq('未跟踪文件：目录聚合标记 unknown', root.children.find((node) => node.name === 'untracked.txt').entry.stats.worktree, none);
const untrackedOnly = buildChangeTree([file('a/b/untracked.txt')]);
eq('未跟踪目录：unknown 为真、不显示 0/0', untrackedOnly.children[0].worktree, { additions: 0, deletions: 0, binary: false, unknown: true });

/* ── 目录路径收集（全部折叠用） ───────────────────────────────────────── */

eq('collect：含压缩后的链', collectDirectoryPaths(root).sort(), ['lib', 'lib/sub', 'pkg', 'src', 'src/deep/nested']);
eq('collect：空树', collectDirectoryPaths(buildChangeTree([])), []);
eq('collect：只有根文件', collectDirectoryPaths(buildChangeTree([file('a.txt')])), []);
eq('collect：非目录节点安全', collectDirectoryPaths({ type: 'file' }), []);
eq('collect：单层', collectDirectoryPaths(buildChangeTree([file('a/x.txt'), file('b/y.txt')])), ['a', 'b']);
eq('collect：先序（父目录在前）', collectDirectoryPaths(buildChangeTree([file('a/b/c/d.txt'), file('a/e.txt')])), ['a', 'a/b/c']);

/* ── 边界 ─────────────────────────────────────────────────────────────── */

eq('空输入：没有子节点', buildChangeTree([]).children, []);
eq('空输入：countTreeFiles 为 0', countTreeFiles(buildChangeTree([])), 0);
eq('忽略空路径', buildChangeTree([file(''), file('a.txt')]).files, 1);
eq('顶层多个目录不压缩', names(buildChangeTree([file('a/x.txt'), file('b/y.txt')]).children), ['a', 'b']);
eq('单个顶层目录仍然是一行目录', names(buildChangeTree([file('a/x.txt')]).children), ['a']);
eq('路径以 / 开头也能解析', names(buildChangeTree([file('/a/x.txt')]).children), ['a']);
eq('Unicode 目录名', names(buildChangeTree([file('组件/按钮.tsx')]).children), ['组件']);
eq('二进制文件聚合标 binary', buildChangeTree([file('bin/a.dat', { additions: null, deletions: null, binary: true })]).children[0].worktree, {
  additions: 0,
  deletions: 0,
  binary: true,
  unknown: false,
});
eq('countTreeFiles 统计叶子', countTreeFiles(root), entries.length);
eq('同层同名目录不会重复创建', buildChangeTree([file('a/1.txt'), file('a/2.txt')]).children.length, 1);

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`tree.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`tree.test OK (${passed} assertions)`);
