/**
 * 历史：提交列表（分页）、单个提交详情（元信息 + 文件清单 + 行数）、分支/标签列表。
 *
 * 分页按 `--skip` + `--max-count=limit+1`：多取一条只是为了知道还有没有下一页，
 * 不额外跑 `rev-list --count`（大仓库上那一条很贵）。日志用 `--topo-order`，让
 * 提交图的车道在分页时不至于左右横跳。
 *
 * 合并提交的文件清单按「与第一父提交比较」列出（GitHub 的 Files changed 也是
 * 这个口径）；`git diff-tree` 对合并提交默认什么都不输出，必须给两棵树。
 */
import { LIMITS, assertHash, assertRef, badRequest, normalizeRepoPath } from './contract.js';
import { parseCommitRecord, parseForEachRef, parseLogRecords, parseNameStatusZ, parseNumstatZ } from './parse.js';

/** 字段顺序固定，正文（可能含分隔符）放在最后。 */
export const LOG_FORMAT = '%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%P%x1f%D%x1f%b';

export async function readHistory(git, repoRoot, request = {}) {
  const limit = Math.min(LIMITS.maxHistoryLimit, Math.max(1, Number(request.limit) || LIMITS.defaultHistoryLimit));
  const skip = Math.max(0, Number(request.skip) || 0);
  const target = typeof request.ref === 'string' && request.ref !== '' ? assertRef(request.ref) : 'HEAD';
  const path = typeof request.path === 'string' && request.path !== '' ? normalizeRepoPath(request.path) : '';

  const head = await git.probe(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: repoRoot });
  if (head === undefined || head.stdout.trim() === '') {
    return { commits: [], hasMore: false, ref: target, unborn: true, truncated: false };
  }

  const args = ['log', '--no-color', `--max-count=${limit + 1}`, `--skip=${skip}`, '--topo-order', `--format=${LOG_FORMAT}%x1e`, target];
  if (path !== '') args.push('--', path);

  const result = await git.exec(args, { cwd: repoRoot, maxBytes: 8 * 1024 * 1024, timeoutMs: 25000 });
  const records = parseLogRecords(result.stdout);
  const commits = records.slice(0, limit);
  return {
    commits,
    hasMore: records.length > limit,
    ref: target,
    path,
    unborn: false,
    truncated: result.truncated,
  };
}

export async function readCommit(git, repoRoot, request = {}) {
  const sha = assertHash(request.hash, 'hash');
  const meta = await git.exec(['show', '--no-patch', `--format=${LOG_FORMAT}%x1e`, sha], { cwd: repoRoot });
  const commit = parseCommitRecord(meta.stdout);
  if (commit === null) throw badRequest(`无法解析提交 ${sha} 的信息。`);

  const parent = commit.parents[0];
  const nameArgs = parent === undefined
    ? ['diff-tree', '--no-commit-id', '--name-status', '-r', '-M', '-z', '--root', sha]
    : ['diff-tree', '--no-commit-id', '--name-status', '-r', '-M', '-z', parent, sha];
  const statArgs = parent === undefined
    ? ['diff-tree', '--no-commit-id', '--numstat', '-r', '-M', '-z', '--root', sha]
    : ['diff-tree', '--no-commit-id', '--numstat', '-r', '-M', '-z', parent, sha];

  const [names, stats] = await Promise.all([git.probe(nameArgs, { cwd: repoRoot }), git.probe(statArgs, { cwd: repoRoot })]);
  const files = parseNameStatusZ(names === undefined ? '' : names.stdout);
  const numstat = stats === undefined ? new Map() : parseNumstatZ(stats.stdout);

  const detailed = files.map((file) => {
    const stat = numstat.get(file.path) ?? null;
    return {
      ...file,
      additions: stat === null ? null : stat.additions,
      deletions: stat === null ? null : stat.deletions,
      binary: stat !== null && stat.binary === true,
    };
  });

  return {
    commit,
    files: detailed.slice(0, LIMITS.maxCommitFiles),
    totalFiles: detailed.length,
    truncatedFiles: detailed.length > LIMITS.maxCommitFiles,
    merge: commit.parents.length > 1,
  };
}

export async function readBranches(git, repoRoot, request = {}) {
  const result = await git.exec(
    ['for-each-ref', '--format=%(refname)%1f%(objectname:short)%1f%(contents:subject)%1f%(HEAD)%0a', 'refs/heads', 'refs/remotes', 'refs/tags'],
    { cwd: repoRoot, maxBytes: 4 * 1024 * 1024, timeoutMs: 20000 },
  );
  const refs = parseForEachRef(result.stdout);
  const sortLocal = (items) => [...items].sort((left, right) => Number(right.head) - Number(left.head) || left.name.localeCompare(right.name));
  const local = sortLocal(refs.filter((ref) => ref.kind === 'local'));
  const remote = refs.filter((ref) => ref.kind === 'remote').sort((left, right) => left.name.localeCompare(right.name));
  const tags = refs.filter((ref) => ref.kind === 'tag').sort((left, right) => left.name.localeCompare(right.name));
  const limit = Math.min(500, Math.max(1, Number(request.limit) || 300));
  return {
    local: local.slice(0, limit),
    remote: remote.slice(0, limit),
    tags: tags.slice(0, limit),
    truncated: local.length > limit || remote.length > limit || tags.length > limit,
    total: { local: local.length, remote: remote.length, tags: tags.length },
  };
}
