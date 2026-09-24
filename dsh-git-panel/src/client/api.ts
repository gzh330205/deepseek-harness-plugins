/**
 * 宿主接口客户端：只读走 GET + query，写操作走 POST + JSON。
 *
 * 约定与 `dsh-run-env-manager` 一致：**每个写动作都回全量快照**，所以这里所有
 * 写方法都返回带 `Snapshot` 字段的对象，调用方直接整份替换即可，不需要增量对账。
 */
import { ROUTE } from './constants.js';
import type {
  BranchListResult,
  CommitResult,
  FileDiffResult,
  HistoryResult,
  Snapshot,
  WorktreeResult,
} from './types.js';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ROUTE}${path}`, {
      headers: { accept: 'application/json', ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...init,
    });
  } catch {
    throw new ApiError('无法连接 DSH Host 的 Git 接口。', 0);
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const record = (payload ?? {}) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (response.ok !== true || record.ok !== true) {
    throw new ApiError(record.error ?? `HTTP ${response.status}`, response.status);
  }
  return record as T;
}

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
};

const post = <T>(action: string, body: Record<string, unknown>): Promise<T> =>
  request<T>(`/${action}`, { method: 'POST', body: JSON.stringify(body) });

export interface DiffRequest {
  path: string;
  orig?: string;
  staged?: boolean;
  untracked?: boolean;
  context?: number;
}

export interface HistoryRequest {
  limit?: number;
  skip?: number;
  ref?: string;
  path?: string;
}

export interface GitApi {
  snapshot(root: string): Promise<Snapshot>;
  branches(root: string): Promise<{ ok: boolean } & BranchListResult>;
  history(root: string, request?: HistoryRequest): Promise<{ ok: boolean } & { history: HistoryResult; repo: unknown }>;
  commit(root: string, hash: string, path?: string, orig?: string): Promise<{ ok: boolean } & CommitResult>;
  diff(root: string, request: DiffRequest): Promise<{ ok: boolean } & { diff: FileDiffResult }>;
  worktrees(root: string): Promise<{ ok: boolean } & WorktreeResult>;
}

export function createApi(): GitApi {
  return {
    snapshot: (root) => request<Snapshot>(`/snapshot?${query({ root })}`),
    branches: (root) => request(`/branches?${query({ root, limit: 300 })}`),
    history: (root, options = {}) =>
      request(`/history?${query({ root, limit: options.limit, skip: options.skip, ref: options.ref, path: options.path })}`),
    commit: (root, hash, path, orig) => request(`/commit?${query({ root, hash, path, orig })}`),
    diff: (root, options) =>
      request(`/diff?${query({
        root,
        path: options.path,
        orig: options.orig,
        staged: options.staged === true ? 1 : undefined,
        untracked: options.untracked === true ? 1 : undefined,
        context: options.context,
      })}`),
    worktrees: (root) => request(`/worktrees?${query({ root })}`),
  };
}

/** 写操作：返回值里既有快照字段，也有该动作自己的字段。 */
export interface ActionApi {
  stage(root: string, paths: string[]): Promise<Snapshot>;
  stageAll(root: string): Promise<Snapshot>;
  unstage(root: string, paths: string[]): Promise<Snapshot>;
  unstageAll(root: string): Promise<Snapshot>;
  discard(root: string, tracked: string[], untracked: string[]): Promise<Snapshot>;
  commit(root: string, message: string, options?: { amend?: boolean; signOff?: boolean }): Promise<Snapshot & { commit?: { hash: string; ref: string; summary: string } }>;
  checkout(root: string, ref: string, newBranch?: string): Promise<Snapshot>;
  abortMerge(root: string): Promise<Snapshot>;
  worktreeAdd(
    root: string,
    request: { dirName?: string; baseRef?: string; mode?: 'detached' | 'branch'; branch?: string },
  ): Promise<Snapshot & WorktreeResult & { created?: { path: string; branch: string; mode: string } }>;
  worktreeRemove(
    root: string,
    request: { path: string; force?: boolean; exportPatch?: boolean },
  ): Promise<Snapshot & WorktreeResult & { removedWorktree?: { path: string; patchPath: string; retainedBranch: string; dirty: number } }>;
  worktreePrune(root: string): Promise<Snapshot & WorktreeResult & { pruneOutput?: string }>;
}

export function createActions(): ActionApi {
  return {
    stage: (root, paths) => post<Snapshot>('stage', { root, paths }),
    stageAll: (root) => post<Snapshot>('stageAll', { root }),
    unstage: (root, paths) => post<Snapshot>('unstage', { root, paths }),
    unstageAll: (root) => post<Snapshot>('unstageAll', { root }),
    discard: (root, tracked, untracked) => post<Snapshot>('discard', { root, tracked, untracked }),
    commit: (root, message, options = {}) =>
      post('commit', { root, message, amend: options.amend === true, signOff: options.signOff === true, confirmAmend: options.amend === true ? true : undefined }),
    checkout: (root, ref, newBranch) => post<Snapshot>('checkout', { root, ref, newBranch }),
    abortMerge: (root) => post<Snapshot>('abortMerge', { root }),
    worktreeAdd: (root, request) => post('worktreeAdd', { root, ...request }),
    worktreeRemove: (root, request) => post('worktreeRemove', { root, ...request }),
    worktreePrune: (root) => post('worktreePrune', { root }),
  };
}

/** 错误对象 → 文案。 */
export function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
