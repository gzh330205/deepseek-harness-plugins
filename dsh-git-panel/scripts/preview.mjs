// 生成 README 截图用的独立渲染预览：临时建一个真实仓库 → 用真实宿主数据渲染各页面 →
// 输出到临时目录的 HTML（自己用浏览器打开截图）。不依赖真实 DSH 宿主。
//
//   node ./scripts/preview.mjs            # 输出目录路径
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { buildSync } from 'esbuild';
import { createGit } from '../src/host/git.js';
import { commitDiff, fileDiff } from '../src/host/diff.js';
import { readBranches, readCommit, readHistory } from '../src/host/history.js';
import { inspectRepository } from '../src/host/repo.js';
import { readStatus } from '../src/host/status.js';
import { addWorktree, readWorktrees } from '../src/host/worktree.js';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const outDir = mkdtempSync(join(tmpdir(), 'dgp-preview-'));
const bundle = join(outDir, 'entry.cjs');

buildSync({
  entryPoints: [join(root, 'tests/render/entry.tsx')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2022', outfile: bundle, jsx: 'automatic',
  loader: { '.css': 'text' },
  external: ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'react-dom/test-utils', 'react/jsx-runtime'],
  logLevel: 'silent',
});
const suite = createRequire(import.meta.url)(bundle);

/* ── 一个带真实历史 / 暂存 / 未跟踪 / 工作树的仓库 ───────────────────── */
const repoDir = mkdtempSync(join(tmpdir(), 'dgp-preview-repo-'));
git(repoDir, ['init', '-q', '-b', 'main']);
git(repoDir, ['config', 'user.email', 'dev@example.com']);
git(repoDir, ['config', 'user.name', 'Dev']);
git(repoDir, ['config', 'core.autocrlf', 'false']);
mkdirSync(join(repoDir, 'src', 'deep', 'nested'), { recursive: true });
mkdirSync(join(repoDir, 'docs', 'guide'), { recursive: true });
mkdirSync(join(repoDir, 'legacy'), { recursive: true });
for (const [path, text] of [
  ['a.txt', 'one\ntwo\nthree\n'], ['README.md', '# Project\n'], ['deleted.txt', 'bye\n'],
  ['src/app.ts', 'export const app = 1;\n'], ['src/util.ts', 'export const u = 1;\n'],
  ['src/deep/nested/module.ts', 'export const m = 1;\n'], ['legacy/old.js', 'module.exports = {};\n'],
]) writeFileSync(join(repoDir, path), text);
git(repoDir, ['add', '-A']);
git(repoDir, ['commit', '-qm', 'chore: initial commit']);
writeFileSync(join(repoDir, 'src/app.ts'), 'export const app = 2;\nexport const extra = 3;\n');
writeFileSync(join(repoDir, 'src/util.ts'), 'export function u() {\n  return 42;\n}\n');
writeFileSync(join(repoDir, 'src/new.tsx'), 'export const N = () => null;\n');
git(repoDir, ['mv', 'legacy/old.js', 'src/legacy.ts']);
git(repoDir, ['add', 'src/app.ts', 'src/util.ts', 'src/new.tsx']);
git(repoDir, ['commit', '-qm', 'feat(app): 支持导出按钮和快捷键']);
git(repoDir, ['checkout', '-q', '-b', 'feature/history']);
writeFileSync(join(repoDir, 'a.txt'), 'one\nTWO\nthree\n');
git(repoDir, ['commit', '-qam', 'fix: 修正大小写与换行\n\n这里是提交正文。']);
git(repoDir, ['checkout', '-q', 'main']);
git(repoDir, ['merge', '-q', '--no-ff', '-m', 'Merge branch feature/history', 'feature/history']);
git(repoDir, ['tag', 'v1.0']);
writeFileSync(join(repoDir, 'src/deep/nested/module.ts'), 'export const m = 1;\nexport const OTHER = 2;\n');
writeFileSync(join(repoDir, 'README.md'), '# Project\n\n## Usage\n');
rmSync(join(repoDir, 'deleted.txt'));
writeFileSync(join(repoDir, 'docs/guide/setup.md'), '# Setup\n');
writeFileSync(join(repoDir, 'src/deep/nested/scratch.ts'), '// scratch\n');

const runner = createGit({});
const repo = await inspectRepository(runner, repoDir);
const status = await readStatus(runner, repo.repoRoot);
const history = await readHistory(runner, repo.repoRoot, { limit: 10 });
const branches = await readBranches(runner, repo.repoRoot);
const head = await readCommit(runner, repo.repoRoot, { hash: history.commits[0].hash });
const feature = history.commits.find((commit) => !commit.subject.startsWith('Merge'));
const featureDiff = await commitDiff(runner, repo.repoRoot, { hash: feature.hash, path: 'src/app.ts' });
const worktreeRoot = join(tmpdir(), 'dgp-preview-wt');
const created = await addWorktree(runner, repo, { dirName: 'probe', mode: 'detached', worktreeRoot });
writeFileSync(join(created.path, 'a.txt'), 'one\nTWO\nthree\nwt\n');
const worktrees = await readWorktrees(runner, repo, { worktreeRoot });
const diff = await fileDiff(runner, repo.repoRoot, { path: 'a.txt' });
const snapshot = {
  ok: true, root: repoDir,
  repo: { repoRoot: repo.repoRoot, name: 'dsh-demo-project', subPath: '', isWorktree: false, worktreeName: '', bare: false, state: 'clean', stateDetail: '', branch: 'feature/history', detached: false, unborn: false, head: repo.head, upstream: 'origin/main', ahead: 1, behind: 0 },
  changes: status.entries,
  counts: {
    total: status.entries.length,
    staged: status.entries.filter((e) => e.index !== '.' && e.index !== '?').length,
    unstaged: status.entries.filter((e) => e.worktree !== '.' && e.index !== '?').length,
    untracked: status.entries.filter((e) => e.untracked).length,
    conflicted: 0,
  },
  truncated: false, contextLines: 3,
};

/* ── jsdom 环境（组件在浏览器里跑，预览里给它一个最小 DOM） ───────────── */
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
dom.window.confirm = () => true;

const interaction = await suite.interact({ snapshot, diff });
const historyPage = await suite.mountHistory({
  history: { commits: history.commits, hasMore: true, ref: 'HEAD', unborn: false, truncated: false },
  branches: { local: branches.local, remote: branches.remote, tags: branches.tags, truncated: false, total: branches.total },
  commitDetail: { commit: head.commit, files: head.files, totalFiles: head.totalFiles, truncatedFiles: false, merge: head.merge },
  commitDiff: { hash: feature.hash, files: featureDiff.files, additions: featureDiff.additions, deletions: featureDiff.deletions, truncated: false },
  clickCommit: true,
});
const worktreePage = await suite.mountWorktrees({ repo: null, worktrees: worktrees.worktrees, worktreeTotal: worktrees.total, worktreeTruncated: false, suggestedRoot: worktrees.suggestedRoot, defaultBranchPrefix: 'dsh/', configuredRoot: '' });
const centerPage = await suite.mountDiffPage({
  state: {
    root: repoDir, repoRoot: repo.repoRoot, sessionId: 'session-1', contextLines: 3, index: 2,
    items: [
      { path: 'a.txt', staged: false, untracked: false, kind: 'modified' },
      { path: 'README.md', staged: false, untracked: false, kind: 'modified' },
      { path: 'src/deep/nested/module.ts', staged: false, untracked: false, kind: 'modified' },
    ],
  },
  diffs: { 'a.txt': diff, 'README.md': diff, 'src/deep/nested/module.ts': diff },
});

const themeVars = `:root{
  --dsw-alias-border-l3:#0000001f; --dsw-alias-border-l2:#0000001a;
  --dsw-alias-label-primary:#0f1115; --dsw-alias-label-secondary:#61666b; --dsw-alias-label-tertiary:#81858c;
  --dsw-alias-interactive-bg-hover:#2631480f; --dsw-alias-interactive-bg-hover-accent:#26314824;
  --dsw-alias-file-diff-added-marker:#01a241; --dsw-alias-file-diff-added-gutter:#edf7ed; --dsw-alias-file-diff-added-bg:#e6f4e7;
  --dsw-alias-file-diff-deleted-marker:#ba2723; --dsw-alias-file-diff-deleted-gutter:#fdece9; --dsw-alias-file-diff-deleted-bg:#fce6e2;
  --dsw-alias-state-warn-primary:#f59e0b; --dsw-alias-state-success-primary:#22c55e; --dsw-alias-state-business-primary:#4d6bfe;
  --dsw-alias-brand-primary:#0f1115; --dsw-static-blue-400:#60a5fa; --dsw-static-amber-500:#f59e0b; --dsw-static-red-400:#f25a5a;
  --dsw-static-neutral-600:#545557; --dsw-alias-bg-layer-2:#fff; --dsw-alias-bg-layer-3:#f7f8fa; --dsw-alias-bg-mask-2:#2631480f;
  --dsw-alias-bg-mask-3:#2631481a; --dsw-alias-button-primary-fill:#0f1115; --dsw-alias-button-primary-hover:#43454a;
  --dsw-alias-button-tool-bar-fill:#0000000f; --dsw-alias-label-primary-foreground:#fff; --dsw-alias-bg-base:#ffffff;
  --dsh-content-font-size-secondary:13px; --ds-font-family-code:"SF Mono",Consolas,Menlo,monospace;
  --dsw-font-markdown-code-block:12px/1.6 var(--ds-font-family-code);
  --dsw-font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;
}`;
const css = readFileSync(join(root, 'src/client/styles.css'), 'utf8');
const page = (panels) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>dsh-git-panel preview</title>
<style>${themeVars}
body{margin:0;background:#f4f5f7;font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);padding:14px;}
.frame{display:flex;gap:14px;align-items:flex-start;}
.pane{background:#fff;border-radius:10px;box-shadow:0 1px 3px #0000001f;overflow:hidden;}
.label{font:12px/1.4 monospace;color:#61666b;margin:0 0 6px;}
.column{display:flex;flex-direction:column;}
</style><style>${css}</style></head><body><div class="frame">${panels
  .map((panel) => `<div class="column"><p class="label">${panel.label}</p><div class="pane" style="width:${panel.width}px">${panel.html}</div></div>`)
  .join('')}</div></body></html>`;

const pages = {
  'changes-modes': [
    { label: '列表模式（默认）· 顶部：显示 + 打开', html: interaction.listHtml, width: 430 },
    { label: '目录模式 · 单链压缩 + 目录聚合', html: interaction.treeHtml, width: 430 },
  ],
  'tree-actions': [
    { label: '目录模式（默认展开）', html: interaction.treeHtml, width: 400 },
    { label: '点「折叠」后（只剩目录行）', html: interaction.collapsedHtml, width: 400 },
  ],
  'center-diff': [
    { label: '侧栏：该行高亮，列表不跳走', html: interaction.centerHtml, width: 430 },
    { label: '中间列：差异页（关闭返回对话 / 切换文件）', html: centerPage.html, width: 430 },
  ],
  'history-worktrees': [
    { label: '工作树', html: worktreePage, width: 400 },
    { label: '历史（提交图 + 提交行）', html: historyPage.html, width: 400 },
  ],
  'commit-detail': [{ label: '提交详情', html: historyPage.detailHtml, width: 400 }],
};
for (const [name, panels] of Object.entries(pages)) writeFileSync(join(outDir, `${name}.html`), page(panels), 'utf8');

console.log('预览已生成，用浏览器打开（右侧栏宽度 400~430px 最接近真实）：');
for (const name of Object.keys(pages)) console.log('  ' + join(outDir, `${name}.html`));
