/**
 * 宿主 HTTP 接口：单一前缀 + action 判别，全部挂在本机 webServer 上。
 *
 * 与 `dsh-run-env-manager` 同一套约定：
 *  - **每个写动作都回全量快照**（仓库事实 + 变更 + 计数），客户端不做增量推导；
 *  - 写操作要求**同源浏览器请求**（Origin 必须存在且等于 Host），并且只在本机绑定时注册；
 *  - 只读接口带 `cache-control: no-store`，绝不缓存。
 *
 * 这里没有任何联网子命令（fetch/pull/push 都不提供），所以插件不接触凭据、
 * 不产生网络流量；能改的只有本地仓库的 index / 工作区 / worktree 登记。
 */
import { LIMITS, assertInt, assertRoot, errorMessage } from './contract.js';
import { changeCounts } from '../shared/git-status.js';
import { abortMerge, checkout, commit, discardWorktree, readPathList, readPaths, stage, stageAll, unstage, unstageAll } from './actions.js';
import { commitDiff, fileDiff } from './diff.js';
import { createGit, resolveGitPath } from './git.js';
import { readBranches, readCommit, readHistory } from './history.js';
import { checkGit, inspectRepository } from './repo.js';
import { readStatus } from './status.js';
import { addWorktree, pruneWorktrees, readWorktrees, removeWorktree } from './worktree.js';

export const ROUTE = '/dsh-git';
const MAX_BODY_BYTES = 1024 * 1024;

function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isLoopbackHost(host) {
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]' || name === '::1';
}

/** 同源门禁：写操作必须带 Origin，且与 Host 一致；跨站请求一律拒绝。 */
function assertSameOrigin(req, writes) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) throw Object.assign(new Error('Git 面板接口只允许本机访问。'), { status: 403 });
  const host = req.headers.host;
  if (typeof host !== 'string' || !isLoopbackHost(host)) throw Object.assign(new Error('请求来源不受信任。'), { status: 403 });
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) throw Object.assign(new Error('请求来源不受信任。'), { status: 403 });
  if (req.headers['sec-fetch-site'] === 'cross-site') throw Object.assign(new Error('请求来源不受信任。'), { status: 403 });
  if (writes && origin === undefined) throw Object.assign(new Error('该操作需要同源浏览器请求。'), { status: 403 });
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
  });
  res.end(JSON.stringify(value));
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('请求体过大。'), { status: 413 });
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON 对象。'), { status: 400 });
  }
}

/** 仓库事实 → 面板需要的公开形状（合并 status 的分支信息）。 */
function publicRepo(repo, branchInfo) {
  return {
    repoRoot: repo.repoRoot,
    name: repo.repoRoot.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '',
    subPath: repo.subPath,
    isWorktree: repo.isWorktree === true,
    worktreeName: repo.worktreeName ?? '',
    bare: repo.bare === true,
    state: repo.state ?? 'clean',
    stateDetail: repo.stateDetail ?? '',
    branch: (branchInfo?.head ?? '') !== '' ? branchInfo.head : repo.branch,
    detached: branchInfo?.detached === true || repo.detached === true,
    unborn: repo.unborn === true || branchInfo?.initial === true,
    head: (branchInfo?.oid ?? '') !== '' ? branchInfo.oid : repo.head,
    upstream: branchInfo?.upstream ?? '',
    ahead: branchInfo?.ahead ?? 0,
    behind: branchInfo?.behind ?? 0,
    worktreeRoot: '',
  };
}

export function installRoutes(ctx, { config }) {
  if (ctx.webServer.host !== '127.0.0.1') {
    ctx.logger?.warn?.('git-panel: Git 面板接口已禁用，因为 Web 未绑定 127.0.0.1');
    return;
  }

  // 配置可能在运行时被改（volatile 字段），所以每次请求都重新解析 git 路径。
  const runner = () => createGit({ gitPath: resolveGitPath(config.gitPath.get()) });
  const contextLines = () => config.diffContext.get();
  const worktreeRoot = () => config.worktreeRoot.get();
  const branchPrefix = () => {
    const value = String(config.worktreeBranchPrefix.get() ?? '');
    return value === '' || value.endsWith('/') ? value : `${value}/`;
  };

  /** 统一的快照构造：仓库不可用时也回 200 + 明确原因，让面板能显示引导而不是报错。 */
  const snapshotFor = async (root, extra = {}) => {
    const git = runner();
    const repo = await inspectRepository(git, root);
    if (repo.isRepo !== true) {
      return {
        ok: true,
        root,
        repo: null,
        gitMissing: repo.gitMissing === true,
        reason: repo.reason,
        changes: [],
        counts: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
        truncated: false,
        contextLines: contextLines(),
        ...extra,
      };
    }

    const status = await readStatus(git, repo.repoRoot);
    // 计数口径与浏览器半共用一份实现（`src/shared/git-status.js`）。
    const counts = changeCounts(status.entries);

    return {
      ok: true,
      root,
      repo: publicRepo(repo, status.branch),
      gitMissing: false,
      reason: '',
      changes: status.entries,
      counts,
      truncated: status.truncated,
      totalChanges: status.totalChanges,
      contextLines: contextLines(),
      maxDiffBytes: LIMITS.maxDiffBytes,
      ...extra,
    };
  };

  /** 需要仓库的动作统一入口：不可用就抛，让错误横幅给出原因。 */
  const requireRepo = async (root) => {
    const git = runner();
    const repo = await inspectRepository(git, root);
    if (repo.isRepo !== true) {
      const error = new Error(repo.reason ?? '当前工作区不是 Git 仓库。');
      error.status = 400;
      throw error;
    }
    return { git, repo };
  };

  const actions = {
    /* ── 写操作：每个都返回最新快照 ───────────────────────────── */

    async stage(body) {
      const root = assertRoot(body.root);
      const paths = readPaths(body);
      const { git, repo } = await requireRepo(root);
      const extra = await stage(git, repo.repoRoot, paths);
      return { root, ...extra };
    },
    async stageAll(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await stageAll(git, repo.repoRoot);
      return { root, ...extra };
    },
    async unstage(body) {
      const root = assertRoot(body.root);
      const paths = readPaths(body);
      const { git, repo } = await requireRepo(root);
      const extra = await unstage(git, repo.repoRoot, paths, { unborn: repo.unborn === true });
      return { root, ...extra };
    },
    async unstageAll(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await unstageAll(git, repo.repoRoot, { unborn: repo.unborn === true });
      return { root, ...extra };
    },
    async discard(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const tracked = readPathList(body.tracked, 'tracked', { allowEmpty: true });
      const untracked = readPathList(body.untracked, 'untracked', { allowEmpty: true });
      if (tracked.length === 0 && untracked.length === 0) throw Object.assign(new Error('没有要放弃的改动。'), { status: 400 });
      const extra = await discardWorktree(git, repo.repoRoot, [], { tracked, untracked });
      return { root, ...extra };
    },
    async commit(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await commit(git, repo.repoRoot, body);
      return { root, commit: extra };
    },
    async checkout(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await checkout(git, repo.repoRoot, repo, body);
      return { root, ...extra };
    },
    async abortMerge(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await abortMerge(git, repo.repoRoot, repo);
      return { root, ...extra };
    },

    /* ── worktree ──────────────────────────────────────────── */

    async worktreeAdd(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await addWorktree(git, repo, {
        dirName: body.dirName,
        baseRef: body.baseRef,
        mode: body.mode,
        branch: body.branch,
        branchPrefix: branchPrefix(),
        worktreeRoot: worktreeRoot(),
      });
      const worktrees = await readWorktrees(git, repo, { worktreeRoot: worktreeRoot() });
      return { root, created: extra, worktrees: worktrees.worktrees, worktreeTotal: worktrees.total, suggestedRoot: worktrees.suggestedRoot, worktreeTruncated: worktrees.truncated };
    },
    async worktreeRemove(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await removeWorktree(git, repo, {
        path: body.path,
        force: body.force === true,
        exportPatch: body.exportPatch === true,
        worktreeRoot: worktreeRoot(),
      });
      const worktrees = await readWorktrees(git, repo, { worktreeRoot: worktreeRoot() });
      return { root, removedWorktree: extra, worktrees: worktrees.worktrees, worktreeTotal: worktrees.total, suggestedRoot: worktrees.suggestedRoot, worktreeTruncated: worktrees.truncated };
    },
    async worktreePrune(body) {
      const root = assertRoot(body.root);
      const { git, repo } = await requireRepo(root);
      const extra = await pruneWorktrees(git, repo);
      const worktrees = await readWorktrees(git, repo, { worktreeRoot: worktreeRoot() });
      return { root, pruneOutput: extra.output, worktrees: worktrees.worktrees, worktreeTotal: worktrees.total, suggestedRoot: worktrees.suggestedRoot, worktreeTruncated: worktrees.truncated };
    },
  };

  /** 只读接口的分发（GET + query）。 */
  const reads = {
    async snapshot(url) {
      const root = assertRoot(url.searchParams.get('root') ?? '');
      return snapshotFor(root);
    },
    async branches(url) {
      const root = assertRoot(url.searchParams.get('root') ?? '');
      const { git, repo } = await requireRepo(root);
      const branches = await readBranches(git, repo.repoRoot, { limit: assertInt(url.searchParams.get('limit'), 300, 1, 500) });
      return { ok: true, root, branches };
    },
    async history(url) {
      const root = assertRoot(url.searchParams.get('root') ?? '');
      const { git, repo } = await requireRepo(root);
      const history = await readHistory(git, repo.repoRoot, {
        limit: assertInt(url.searchParams.get('limit'), LIMITS.defaultHistoryLimit, 1, LIMITS.maxHistoryLimit),
        skip: assertInt(url.searchParams.get('skip'), 0, 0, 1000000),
        ref: url.searchParams.get('ref') ?? '',
        path: url.searchParams.get('path') ?? '',
      });
      return { ok: true, root, repo: publicRepo(repo, null), history };
    },
    async commit(url) {
      const root = assertRoot(url.searchParams.get('root') ?? '');
      const { git, repo } = await requireRepo(root);
      const detail = await readCommit(git, repo.repoRoot, { hash: url.searchParams.get('hash') ?? '' });
      const path = url.searchParams.get('path') ?? '';
      const diff = path === ''
        ? null
        : await commitDiff(git, repo.repoRoot, {
            hash: detail.commit.hash,
            path,
            origPath: url.searchParams.get('orig') ?? '',
            contextLines: contextLines(),
          });
      return { ok: true, root, detail, diff };
    },
    async diff(url) {
      const root = assertRoot(url.searchParams.get('root') ?? '');
      const { git, repo } = await requireRepo(root);
      const diff = await fileDiff(git, repo.repoRoot, {
        path: url.searchParams.get('path') ?? '',
        origPath: url.searchParams.get('orig') ?? '',
        staged: url.searchParams.get('staged') === '1',
        untracked: url.searchParams.get('untracked') === '1',
        contextLines: assertInt(url.searchParams.get('context'), contextLines(), 0, LIMITS.maxContextLines),
      });
      return { ok: true, root, diff };
    },
    async worktrees(url) {
      const root = assertRoot(url.searchParams.get('root') ?? '');
      const { git, repo } = await requireRepo(root);
      const list = await readWorktrees(git, repo, { worktreeRoot: worktreeRoot() });
      return {
        ok: true,
        root,
        repo: publicRepo(repo, null),
        worktrees: list.worktrees,
        worktreeTotal: list.total,
        worktreeTruncated: list.truncated,
        suggestedRoot: list.suggestedRoot,
        defaultBranchPrefix: branchPrefix(),
        configuredRoot: String(worktreeRoot() ?? ''),
      };
    },
    async version() {
      const check = await checkGit(runner());
      return { ok: true, git: check.ok ? { available: true, version: check.version, path: runner().gitPath } : { available: false, error: check.error, path: runner().gitPath } };
    },
  };

  ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
        const action = url.pathname.slice(ROUTE.length + 1);
        if (action === '') return sendJson(res, 404, { ok: false, error: '缺少接口名。' });

        if (req.method === 'GET') {
          assertSameOrigin(req, false);
          const handler = reads[action];
          if (handler === undefined) return sendJson(res, 404, { ok: false, error: `未知接口 ${action}。` });
          return sendJson(res, 200, await handler(url));
        }

        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: '方法不允许。' });
        assertSameOrigin(req, true);
        const handler = actions[action];
        if (handler === undefined) return sendJson(res, 404, { ok: false, error: `未知接口 ${action}。` });
        const body = await jsonBody(req);
        const result = await handler(body);
        const root = typeof result.root === 'string' ? result.root : '';
        const snapshot = root === ''
          ? { ok: true, root: '', repo: null, changes: [], counts: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 }, truncated: false }
          : await snapshotFor(root);
        return sendJson(res, 200, { ...snapshot, ...result });
      } catch (error) {
        const status = typeof error?.status === 'number' ? error.status : 400;
        const message = errorMessage(error);
        ctx.logger?.warn?.(`git-panel: ${message}`);
        return sendJson(res, status, { ok: false, error: message });
      }
    },
  });
}
