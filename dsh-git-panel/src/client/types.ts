/**
 * 浏览器半的数据形状：与宿主 `src/host/routes.js` 的 JSON 一一对应。
 * 时间/路径等展示派生量不在这里算（见 `format.ts`）。
 */

export interface ChangeStat {
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface ChangeEntry {
  path: string;
  origPath?: string;
  index: string;
  worktree: string;
  kind: string;
  submodule?: boolean;
  conflicted: boolean;
  untracked: boolean;
  ignored?: boolean;
  stats: { staged: ChangeStat | null; worktree: ChangeStat | null };
}

export interface RepoInfo {
  repoRoot: string;
  name: string;
  subPath: string;
  isWorktree: boolean;
  worktreeName: string;
  bare: boolean;
  state: string;
  stateDetail: string;
  branch: string;
  detached: boolean;
  unborn: boolean;
  head: string;
  upstream: string;
  ahead: number;
  behind: number;
}

export interface Counts {
  total: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
}

export interface Snapshot {
  ok: boolean;
  root: string;
  repo: RepoInfo | null;
  gitMissing?: boolean;
  reason?: string;
  changes: ChangeEntry[];
  counts: Counts;
  truncated: boolean;
  totalChanges?: number;
  contextLines: number;
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'note';
  text: string;
  oldNumber?: number;
  newNumber?: number;
  noNewline?: boolean;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  section: string;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  path: string;
  binary: boolean;
  binaryNote: string;
  renameFrom: string;
  renameTo: string;
  newFile: boolean;
  deletedFile: boolean;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface FileDiffResult {
  path: string;
  origPath: string;
  staged: boolean;
  untracked: boolean;
  context: number;
  file: DiffFile | null;
  additions: number;
  deletions: number;
  empty: boolean;
  truncated: boolean;
  timedOut: boolean;
}

export interface Decoration {
  name: string;
  kind: 'head' | 'tag' | 'remote' | 'local';
}

export interface CommitEntry {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  authoredAt: string;
  parents: string[];
  decorations: Decoration[];
  body: string;
}

export interface HistoryResult {
  commits: CommitEntry[];
  hasMore: boolean;
  ref: string;
  path?: string;
  unborn: boolean;
  truncated: boolean;
}

export interface CommitFile {
  path: string;
  origPath?: string;
  status: string;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface CommitDetail {
  commit: CommitEntry;
  files: CommitFile[];
  totalFiles: number;
  truncatedFiles: boolean;
  merge: boolean;
}

export interface CommitResult {
  detail: CommitDetail;
  diff: { hash: string; files: DiffFile[]; additions: number; deletions: number; truncated: boolean } | null;
}

export interface WorktreeInfo {
  path: string;
  name: string;
  head: string;
  headFull: string;
  branch: string;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  lockReason: string;
  prunable: boolean;
  pruneReason: string;
  main: boolean;
  current: boolean;
  exists: boolean;
  dirty: boolean | null;
  dirtyCount: number | null;
  ancestor: boolean;
  merged: boolean;
}

export interface WorktreeResult {
  repo: RepoInfo | null;
  worktrees: WorktreeInfo[];
  worktreeTotal: number;
  worktreeTruncated: boolean;
  suggestedRoot: string;
  defaultBranchPrefix: string;
  configuredRoot: string;
}

export interface BranchRef {
  name: string;
  fullName: string;
  kind: 'local' | 'remote' | 'tag';
  commit: string;
  subject: string;
  head: boolean;
}

export interface BranchListResult {
  local: BranchRef[];
  remote: BranchRef[];
  tags: BranchRef[];
  truncated: boolean;
  total: { local: number; remote: number; tags: number };
}

export interface GraphStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
}

export interface GraphRow {
  hash: string;
  lane: number;
  created: boolean;
  laneCount: number;
  color: number;
  strokes: GraphStroke[];
}
