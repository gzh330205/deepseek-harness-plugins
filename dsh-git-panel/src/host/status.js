/**
 * 工作区状态：一次快照 = 仓库事实 + 变更条目 + 每个条目的增删行数。
 *
 * 只跑三条只读命令：`status --porcelain=v2 --branch -z`（含分支、上游、ahead/behind）、
 * `diff --numstat -z`（工作区侧行数）、`diff --cached --numstat -z`（暂存侧行数）。
 * 全部带 `--no-optional-locks`，因为 agent 可能正在同一工作区里跑回合。
 */
import { LIMITS } from './contract.js';
import { parseNumstatZ, parsePorcelainV2 } from './parse.js';

/** 把 numstat 映射合进条目：暂存侧与工作区侧各存一份（同一个文件可能两边都有改动）。 */
function attachStats(entries, stagedStats, worktreeStats) {
  for (const entry of entries) {
    const worktree = worktreeStats.get(entry.path) ?? null;
    const staged = stagedStats.get(entry.path) ?? null;
    entry.stats = { staged, worktree };
  }
}

/** 工作区侧行数（未跟踪文件没有 diff，返回 null，由 UI 显示「新文件」）。 */
function untrackedStat() {
  return { additions: null, deletions: null, binary: false };
}

export async function readStatus(git, repoRoot) {
  const result = await git.exec(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], { cwd: repoRoot });
  const parsed = parsePorcelainV2(result.stdout);

  const [numstat, numstatCached] = await Promise.all([
    git.probe(['diff', '--numstat', '-z', '-M'], { cwd: repoRoot, timeoutMs: 15000 }),
    git.probe(['diff', '--cached', '--numstat', '-z', '-M'], { cwd: repoRoot, timeoutMs: 15000 }),
  ]);

  const entries = parsed.entries.filter((entry) => entry.ignored !== true);
  attachStats(
    entries,
    numstatCached === undefined ? new Map() : parseNumstatZ(numstatCached.stdout),
    numstat === undefined ? new Map() : parseNumstatZ(numstat.stdout),
  );
  for (const entry of entries) {
    if (entry.untracked === true) entry.stats.worktree = untrackedStat();
  }

  const truncated = result.truncated || entries.length > LIMITS.maxChanges;
  const limited = truncated ? entries.slice(0, LIMITS.maxChanges) : entries;

  return {
    branch: parsed.branch,
    entries: limited,
    totalChanges: entries.length,
    truncated,
    /** 命令本身超时/被截断时也需要让 UI 知道快照不完整。 */
    degraded: result.timedOut || result.truncated,
  };
}
