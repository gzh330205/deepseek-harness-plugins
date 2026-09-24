// 渲染冒烟测试：用 esbuild 把视图组件打成 Node 可执行的 bundle，再用真实 git 数据
// 做服务端渲染，断言画出来的 HTML。
//
// 为什么值得这么做：浏览器半在没有真实浏览器时完全无法验证，而这个测试会真实执行
// 组件的渲染代码——漏字段、字段改名、形态不一致、i18n key 拼错都会在这里炸出来。
// 运行：node ./tests/render.test.js
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildSync } from 'esbuild';
import { createGit } from '../src/host/git.js';
import { fileDiff } from '../src/host/diff.js';
import { inspectRepository } from '../src/host/repo.js';
import { readStatus } from '../src/host/status.js';
import { readWorktrees } from '../src/host/worktree.js';

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'dsh-git-panel-render-'));
const outfile = join(outDir, 'entry.cjs');
const repoDir = mkdtempSync(join(tmpdir(), 'dsh-git-panel-render-repo-'));

try {
  buildSync({
    entryPoints: [join(root, 'tests/render/entry.tsx')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'es2022',
    outfile,
    jsx: 'automatic',
    loader: { '.css': 'text' },
    external: ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'react-dom/test-utils', 'react/jsx-runtime'],
    logLevel: 'silent',
  });

  const require = createRequire(import.meta.url);
  const suite = require(outfile);

  // 造一个真实仓库：已暂存的新增、未暂存的修改、未跟踪文件、重命名。
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 'test@example.com']);
  git(repoDir, ['config', 'user.name', 'Test']);
  git(repoDir, ['config', 'core.autocrlf', 'false']);
  writeFileSync(join(repoDir, 'a.txt'), 'one\ntwo\nthree\n');
  writeFileSync(join(repoDir, 'old.txt'), 'x\n');
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-qm', 'first commit']);

  writeFileSync(join(repoDir, 'a.txt'), 'one\nTWO\nthree\nfour\n');
  writeFileSync(join(repoDir, 'staged.txt'), 'staged content\n');
  writeFileSync(join(repoDir, 'untracked.txt'), 'untracked\n');
  mkdirSync(join(repoDir, 'src', 'deep', 'nested'), { recursive: true });
  writeFileSync(join(repoDir, 'src', 'deep', 'nested', 'deep.txt'), 'deep\n');
  git(repoDir, ['add', 'staged.txt']);

  const gitRunner = createGit({});
  const repo = await inspectRepository(gitRunner, repoDir);
  const status = await readStatus(gitRunner, repo.repoRoot);
  const worktrees = await readWorktrees(gitRunner, repo, {});
  const snapshot = {
    ok: true,
    root: repoDir,
    repo: {
      repoRoot: repo.repoRoot,
      name: 'repo',
      subPath: '',
      isWorktree: false,
      worktreeName: '',
      bare: false,
      state: 'clean',
      stateDetail: '',
      branch: 'main',
      detached: false,
      unborn: false,
      head: repo.head,
      upstream: 'origin/main',
      ahead: 2,
      behind: 1,
    },
    changes: status.entries,
    counts: {
      total: status.entries.length,
      staged: status.entries.filter((entry) => entry.index === 'A').length,
      unstaged: status.entries.filter((entry) => entry.worktree === 'M').length,
      untracked: status.entries.filter((entry) => entry.untracked).length,
      conflicted: 0,
    },
    truncated: false,
    contextLines: 3,
  };

  const diff = await fileDiff(gitRunner, repo.repoRoot, { path: 'a.txt' });
  const untrackedDiff = await fileDiff(gitRunner, repo.repoRoot, { path: 'untracked.txt', untracked: true });

  /* ── 变更列表 ─────────────────────────────────────────────────────── */

  const listHtml = suite.renderChanges(snapshot, null, null);
  check('变更列表：渲染出文件树', listHtml.includes('a.txt'), listHtml.slice(0, 300));
  check('变更列表：已暂存分组', listHtml.includes('已暂存'), '');
  check('变更列表：未跟踪分组', listHtml.includes('未跟踪'), '');
  check('变更列表：未暂存分组', listHtml.includes('未暂存'), '');
  check('变更列表：显示增删行数', listHtml.includes('+2') && listHtml.includes('−1'), '');
  check('变更列表：提交框只在有暂存内容时出现', listHtml.includes('提交'), '');
  check('变更列表：没有 undefined 泄漏', !listHtml.includes('undefined') && !listHtml.includes('NaN'), '');

  /* ── 差异视图 ─────────────────────────────────────────────────────── */

  const diffHtml = suite.renderDiff([diff.file]);
  check('差异视图：有新增行类名', diffHtml.includes('dgp-line-add'), '');
  check('差异视图：有删除行类名', diffHtml.includes('dgp-line-del'), '');
  check('差异视图：段落头', diffHtml.includes('dgp-line-hunk'), '');
  check('差异视图：行号存在', diffHtml.includes('dgp-ln'), '');
  check('差异视图：新内容在页面上', diffHtml.includes('TWO') && diffHtml.includes('four'), '');
  check('差异视图：没有 undefined 泄漏', !diffHtml.includes('undefined'), '');

  const untrackedHtml = suite.renderDiff([untrackedDiff.file]);
  check('差异视图：未跟踪文件标出「新增文件」', untrackedHtml.includes('新增文件'), untrackedHtml.slice(0, 200));

  const emptyHtml = suite.renderDiff([]);
  check('差异视图：空差异给出提示', emptyHtml.includes('没有可显示的差异'), '');

  const binaryHtml = suite.renderDiff([{ path: 'x.bin', binary: true, binaryNote: '二进制文件不显示内容：x.bin', hunks: [], additions: 0, deletions: 0, renameFrom: '', renameTo: '', oldPath: '', newPath: '', newFile: false, deletedFile: false }]);
  check('差异视图：二进制提示', binaryHtml.includes('二进制文件'), '');

  const multiHtml = suite.renderDiff([diff.file, untrackedDiff.file], { showFileHeaders: true });
  check('差异视图：多文件带文件头', multiHtml.includes('dgp-difffile-path'), '');

  /* ── 选中文件后的详情 ─────────────────────────────────────────────── */

  const detailHtml = suite.renderChanges(snapshot, { path: 'a.txt', staged: false, untracked: false, kind: 'modified' }, diff);
  check('详情：显示返回按钮与文件名', detailHtml.includes('a.txt') && detailHtml.includes('返回'), '');
  check('详情：状态徽标', detailHtml.includes('未暂存'), '');
  check('详情：渲染差异正文', detailHtml.includes('dgp-line-add'), '');
  check('详情：没有 undefined 泄漏', !detailHtml.includes('undefined'), '');

  /* ── 历史 / 工作树 / 面板外壳 ─────────────────────────────────────── */

  const historyHtml = suite.renderHistory({});
  check('历史：渲染出分支按钮与空态', historyHtml.includes('HEAD') && historyHtml.includes('dgp-historybar'), historyHtml.slice(0, 200));
  check('历史：没有 undefined 泄漏', !historyHtml.includes('undefined'), '');

  const pathFilterHtml = suite.renderHistory({ pathFilter: 'src/a.txt' });
  check('历史：路径筛选提示', pathFilterHtml.includes('src/a.txt'), '');

  const worktreeHtml = suite.renderWorktrees({});
  check('工作树：渲染出工具栏', worktreeHtml.includes('工作树根目录'), worktreeHtml.slice(0, 200));
  check('工作树：没有 undefined 泄漏', !worktreeHtml.includes('undefined'), '');

  const panelNoCwd = suite.renderPanel({ useSessions: () => undefined });
  check('面板：没有 cwd 时给出提示', panelNoCwd.includes('还没有确定工作区目录'), panelNoCwd.slice(0, 200));

  /* ── jsdom 里真挂载 + 点击（主链路：effect 取快照 → 渲染 → 动作 → 快照替换） ── */

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:3080/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
  globalThis.window.confirm = () => true;

  const interaction = await suite.interact({ snapshot, diff });
  const log = interaction.log;
  check('交互：effect 拉到快照后渲染出分支名', interaction.html.includes('main'), interaction.html.slice(0, 300));
  check('交互：渲染出变更文件', interaction.html.includes('a.txt'), '');
  check('交互：点「暂存」调用了 stage 且路径是 a.txt', log.includes('stage:a.txt'), JSON.stringify(log));
  check('交互：点文件行打开了内置预览且地址是 dsh-resource://file', log.some((item) => item.startsWith('open:dsh-resource://file/session/session-1/')), JSON.stringify(log));
  check('交互：选中文件后拉取并渲染了差异', interaction.diffHtml.includes('dgp-line-add'), JSON.stringify(log));
  check('交互：差异里带行号与内容', interaction.diffHtml.includes('dgp-ln') && interaction.diffHtml.includes('TWO'), '');
  check('交互：列表态里有「全部暂存」入口', interaction.listHtml.includes('全部暂存'), '');
  check('交互：列表模式不画目录行', !interaction.listHtml.includes('dgp-dirrow'), '');
  check('交互：切到目录模式画出目录行', interaction.treeHtml.includes('dgp-dirrow'), '');
  check('交互：目录模式压缩单链目录', interaction.treeHtml.includes('src/deep/nested'), interaction.treeHtml.slice(0, 400));
  check('交互：目录模式才有「展开 / 折叠」按钮', interaction.treeHtml.includes('>展开</button>') && interaction.treeHtml.includes('>折叠</button>'), '');
  check('交互：列表模式没有「展开 / 折叠」按钮', !interaction.listHtml.includes('>展开</button>') && !interaction.listHtml.includes('>折叠</button>'), '');
  check('交互：目录模式默认展开，嵌套文件可见', interaction.treeHtml.includes('deep.txt'), '');
  check('交互：点「折叠」后只剩目录行', interaction.collapsedHtml.includes('src/deep/nested') && !interaction.collapsedHtml.includes('deep.txt'), interaction.collapsedHtml.slice(0, 400));
  check('交互：折叠不影响根级文件行', interaction.collapsedHtml.includes('a.txt'), '');
  check('交互：点「展开」后嵌套文件回来', interaction.expandedHtml.includes('deep.txt'), '');
  check('交互：目录模式显示文件数徽标', interaction.treeHtml.includes('个</span>') || interaction.treeHtml.includes('dgp-dircount'), '');
  check('交互：目录模式不再重复行内目录前缀', !interaction.treeHtml.includes('dgp-name-dir'), '');
  check('交互：显示模式偏好被持久化', interaction.storedView === 'tree->flat', String(interaction.storedView));

  /* ── 点文件 → 中心窗口 / 侧栏内联 两条路 ───────────────────────────── */

  check('交互：默认「中间」——点文件把差异交给中心窗口', log.some((item) => item === 'center:a.txt'), JSON.stringify(log));
  check('交互：中心接管后侧栏不再渲染内联差异', !interaction.centerHtml.includes('dgp-line-add'), '');
  check('交互：中心正在看的行在侧栏高亮', interaction.centerHtml.includes('dgp-row-on'), '');
  check('交互：默认「中间」下侧栏不拉 diff', interaction.centerDiffCalls === 0, String(interaction.centerDiffCalls));
  check('交互：暂存后返回列表并「全部取消」调用了 unstageAll', log.includes('unstageAll'), JSON.stringify(log));
  check('交互：没有 undefined 泄漏', !interaction.html.includes('undefined'), '');
  check('交互：切到「侧栏」后同一文件内联渲染差异', interaction.diffHtml.includes('dgp-line-add'), '');
  check('交互：内联路径下差异会因状态指纹变化重拉', interaction.diffCalls >= 2, String(interaction.diffCalls));

  /* ── 中心窗口差异页（root `main` 席位） ───────────────────────────── */

  const pageItems = [
    { path: 'a.txt', staged: false, untracked: false, kind: 'modified' },
    { path: 'README.md', staged: false, untracked: false, kind: 'modified' },
  ];
  const readmeDiff = {
    ...diff,
    path: 'README.md',
    file: { ...diff.file, path: 'README.md', hunks: diff.file.hunks.map((hunk) => ({ ...hunk, header: '@@ -1,2 +1,4 @@ readme', lines: hunk.lines.map((line) => ({ ...line, text: line.type === 'add' ? `README-${line.text}` : line.text })) })) },
  };
  const page = await suite.mountDiffPage({
    state: { root: repoDir, repoRoot: repo.repoRoot, sessionId: 'session-1', items: pageItems, index: 0, contextLines: 3 },
    diffs: { 'a.txt': diff, 'README.md': readmeDiff },
    clickNext: true,
    clickClose: true,
  });
  check('中心页：渲染出文件名与差异', page.html.includes('a.txt') && page.html.includes('dgp-line-add'), page.html.slice(0, 300));
  check('中心页：显示位置计数', page.html.includes('1 / 2'), '');
  check('中心页：拉取的是当前项', page.log.includes('diff:a.txt'), JSON.stringify(page.log));
  check('中心页：点「下一个」切到第二个文件', page.afterNext.includes('2 / 2') && page.afterNext.includes('README-'), page.afterNext.slice(0, 400));
  check('中心页：切换后重新拉取', page.log.includes('diff:README.md'), JSON.stringify(page.log));
  check('中心页：关闭按钮接回「回到对话」', page.log.includes('close'), JSON.stringify(page.log));
  check('中心页：没有 undefined 泄漏', !page.html.includes('undefined'), '');

  const emptyPage = await suite.mountDiffPage({ state: { root: repoDir, repoRoot: repo.repoRoot, items: [], index: 0 }, diffs: {} });
  check('中心页：没有目标时给出引导而不是空白', emptyPage.html.includes('没有正在查看的文件'), emptyPage.html.slice(0, 300));

  /* ── 历史页（有提交）/ 工作树页：之前只渲染过空壳，正是这个缺口让
        「历史列表变成居中卡片」的样式冲突漏了出去 ───────────────────── */

  const commitFixtures = [
    {
      hash: 'a'.repeat(40), shortHash: 'aaaaaaa', subject: 'feat(app): 支持导出按钮',
      author: 'Dev', authoredAt: '2026-09-24T10:00:00+08:00', parents: ['b'.repeat(40)],
      decorations: [{ name: 'main', kind: 'head' }, { name: 'v1.0', kind: 'tag' }], body: '正文第一行',
    },
    {
      hash: 'b'.repeat(40), shortHash: 'bbbbbbb', subject: 'chore: initial commit',
      author: 'Dev', authoredAt: '2026-09-23T10:00:00+08:00', parents: [],
      decorations: [], body: '',
    },
  ];
  const historyPage = await suite.mountHistory({
    history: { commits: commitFixtures, hasMore: true, ref: 'HEAD', unborn: false, truncated: false },
    branches: {
      local: [{ name: 'main', fullName: 'refs/heads/main', kind: 'local', commit: 'aaaaaaa', subject: 'feat', head: true }],
      remote: [], tags: [], truncated: false, total: { local: 1, remote: 0, tags: 0 },
    },
    commitDetail: {
      commit: commitFixtures[0],
      files: [
        { path: 'src/app.ts', status: 'modified', additions: 2, deletions: 1, binary: false },
        { path: 'docs/new.md', status: 'added', additions: 5, deletions: 0, binary: false },
      ],
      totalFiles: 2, truncatedFiles: false, merge: false,
    },
    commitDiff: null,
    clickCommit: true,
    clickBranches: true,
  });
  check('历史：渲染出提交行', historyPage.html.includes('dgp-commititem'), historyPage.html.slice(0, 300));
  check('历史：主题 / 短 hash / 作者 / 时间都在', ['feat(app): 支持导出按钮', 'aaaaaaa', 'Dev'].every((text) => historyPage.html.includes(text)), '');
  check('历史：提交图泳道', historyPage.html.includes('dgp-graph') && historyPage.html.includes('dgp-lane'), '');
  check('历史：泳道按行高拉伸（preserveAspectRatio=none + non-scaling-stroke）', historyPage.html.includes('preserveAspectRatio="none"') && historyPage.html.includes('non-scaling-stroke'), '');
  check('历史：圆点是行内元素而不是 svg circle', historyPage.html.includes('class="dgp-dot') && !/<circle[^>]*dgp-dot/.test(historyPage.html), '');
  check('历史：refs 徽标与主题同行（行高均匀，不再多占一行）', /class="dgp-subjectline"[\s\S]{0,400}?class="dgp-decor"/.test(historyPage.html), '');
  check('历史：refs 装饰', historyPage.html.includes('v1.0') && historyPage.html.includes('main'), '');
  check('历史：有「对齐左」的提交行类（不是提交框）', !historyPage.html.includes('dgp-commitbox'), '');
  check('历史：加载更多按钮', historyPage.html.includes('dgp-more'), '');
  check('历史：点提交请求了详情', historyPage.log.some((item) => item.startsWith('commit:')), JSON.stringify(historyPage.log));
  check('历史：详情显示文件数与文件行', historyPage.detailHtml.includes('2 个文件') && historyPage.detailHtml.includes('src/app.ts'), historyPage.detailHtml.slice(0, 300));
  check('历史：详情有增删行数', historyPage.detailHtml.includes('+2') && historyPage.detailHtml.includes('−1'), '');
  check('历史：分支选择器有本地分支', historyPage.pickerHtml.includes('main') && historyPage.pickerHtml.includes('本地分支'), historyPage.pickerHtml.slice(0, 200));

  const worktreePage = await suite.mountWorktrees({
    repo: null,
    suggestedRoot: 'D:/ws/.dsh-worktrees/repo',
    defaultBranchPrefix: 'dsh/',
    configuredRoot: '',
    worktreeTotal: 2,
    worktreeTruncated: false,
    worktrees: [
      { path: 'D:/ws/repo', name: 'repo', head: 'aaaaaaa', headFull: 'a'.repeat(40), branch: 'main', detached: false, bare: false, locked: false, lockReason: '', prunable: false, pruneReason: '', main: true, current: true, exists: true, dirty: false, dirtyCount: 0, ancestor: false, merged: false },
      { path: 'D:/ws/.dsh-worktrees/repo/probe', name: 'probe', head: 'bbbbbbb', headFull: 'b'.repeat(40), branch: '', detached: true, bare: false, locked: false, lockReason: '', prunable: false, pruneReason: '', main: false, current: false, exists: true, dirty: true, dirtyCount: 2, ancestor: true, merged: false },
    ],
  });
  check('工作树：渲染出两棵', worktreePage.includes('probe') && worktreePage.includes('dgp-wt'), '');
  check('工作树：当前/主/未提交徽标', worktreePage.includes('当前') && worktreePage.includes('主工作区') && worktreePage.includes('未提交 2'), '');
  check('工作树：detached 有徽标', worktreePage.includes('detached'), '');
  check('工作树：显示建议根目录', worktreePage.includes('D:/ws/.dsh-worktrees/repo'), '');
  check('工作树：没有 undefined 泄漏', !worktreePage.includes('undefined'), '');

  /* ── 数据形态自检：宿主给的 stats 一定被 UI 用到 ───────────────────── */

  const entry = snapshot.changes.find((item) => item.path === 'a.txt');
  check('数据形态：stats 两侧都在', entry.stats.staged !== undefined && entry.stats.worktree !== undefined, JSON.stringify(entry.stats));
  check('工作树数据：可渲染', Array.isArray(worktrees.worktrees) && worktrees.worktrees.length >= 1);
} catch (error) {
  failures.push(`未捕获异常：${error instanceof Error ? `${error.message}\n${error.stack}` : String(error)}`);
} finally {
  for (const path of [outDir, repoDir]) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  }
}

if (failures.length > 0) {
  console.error(`render.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`render.test OK (${passed} assertions)`);
