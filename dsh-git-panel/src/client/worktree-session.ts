/**
 * 「在工作树里开会话」：把 worktree 目录注册成 DSH 工作区，再保证它有一场可用会话。
 *
 * 为什么必须是这两步：DSH 里**会话的 cwd 在创建时固定在它所属工作区的路径上**，没有
 * 「把已有会话切到另一个目录」的 API（Claude Code 的 `EnterWorktree` 能把 cwd、写权限、
 * 项目配置一起搬过去，DSH 没有这一层）；而 worktree 默认建在项目**旁边**
 * （`<项目父目录>/.dsh-worktrees/<项目名>/<名字>`），不属于任何已注册工作区。
 * 所以「在 worktree 里开发」唯一的正确形态就是让那个目录成为一个工作区。
 *
 * 为什么全在客户端：工作区注册表在宿主侧是 `ctx.workspaceRegistry`，插件没有面向它的
 * 公共写入口；公共入口是浏览器半的 `workspaces` / `uiWorkspace` 服务
 * （`dsh-workspace-category-manager` 的「添加工作区 / 从 Git 导入」也是这个分工）。
 *
 * 入口是**常驻**的：会话被删、被归档、DSH 重启、树被手工删掉后同路径重建——
 * 再点一次都要能用。所以 `enter()` 是「有可用会话就回到它，没有就新建一场」，
 * `newSession()` 是显式的「再来一场」。两个服务一律惰性取（插件热重载会移除重加）。
 */

interface SessionSummary {
  id?: string;
  cwd?: string;
  blank?: boolean;
  updatedAt?: number;
  title?: string;
}

interface WorkspaceView {
  workspaceId?: string;
  path?: string;
  title?: string;
  sessionIds?: string[];
}

interface WorkspacesService {
  create?: (input: { path: string }) => Promise<WorkspaceView>;
  delete?: (workspaceId: string) => Promise<unknown>;
  rename?: (workspaceId: string, title: string) => Promise<unknown>;
  startSession?: (workspaceId: string) => unknown;
  list?: {
    getSnapshot?: () => { items?: WorkspaceView[]; archivedSessionIds?: string[] } | undefined;
  };
}

interface SessionsService {
  create?: (input: { workspaceId: string; sessionId?: string }) => Promise<string>;
  open?: (sessionId: string) => unknown;
  list?: { getSnapshot?: () => { ids?: string[]; byId?: Record<string, SessionSummary> } | undefined };
}

interface UiWorkspaceService {
  startSession?: (workspaceId: string) => unknown;
  openSession?: (sessionId: string) => unknown;
}

export interface WorktreeSessionContext {
  get?: (name: string) => unknown;
}

/** 一个工作树在 DSH 里的登记状态投影，供面板显示。 */
export interface WorktreeBinding {
  registered: boolean;
  workspaceId: string;
  title: string;
  /** 未归档的会话数（含空白会话）。 */
  sessions: number;
  /** 已归档的会话数：它们不会被复用，重建时会被跳过。 */
  archived: number;
}

export interface EnterResult extends WorktreeBinding {
  /** `existing`：回到了一场已有会话；`created`：新建了一场（或复用了一段空白会话）。 */
  opened: 'existing' | 'created';
  sessionId: string;
}

export interface WorktreeSessionOpener {
  available(): boolean;
  /** 能否显式「再来一场」（需要 sessions.create）。 */
  canCreateSession(): boolean;
  /** 当前绑定状态；未注册时 `registered: false`。 */
  binding(path: string): WorktreeBinding;
  /** 幂等注册，然后回到最近一场可用会话；没有可用会话就新建一场。 */
  enter(path: string): Promise<EnterResult>;
  /** 显式新建一场会话（会话坏了 / 想并行开一场时用）。 */
  newSession(path: string): Promise<EnterResult>;
  /** 从工作区列表里移除该路径的登记（没登记过返回 false）。会话记录不受影响。 */
  forget(path: string): Promise<boolean>;
}

/** 路径归一：Windows 上大小写与斜杠都要算同一个目录。 */
function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return normalize(left) === normalize(right);
}

const hasMethod = (target: unknown, name: string): boolean =>
  target !== undefined && target !== null && typeof (target as Record<string, unknown>)[name] === 'function';

const EMPTY_BINDING: WorktreeBinding = { registered: false, workspaceId: '', title: '', sessions: 0, archived: 0 };

export function createWorktreeSessionOpener(ctx: WorktreeSessionContext): WorktreeSessionOpener {
  const workspaces = (): WorkspacesService | undefined => ctx.get?.('workspaces') as WorkspacesService | undefined;
  const uiWorkspace = (): UiWorkspaceService | undefined => ctx.get?.('uiWorkspace') as UiWorkspaceService | undefined;
  const sessions = (): SessionsService | undefined => ctx.get?.('sessions') as SessionsService | undefined;

  const workspaceAt = (path: string): WorkspaceView | undefined =>
    (workspaces()?.list?.getSnapshot?.()?.items ?? []).find((item) => typeof item.path === 'string' && samePath(item.path, path));

  function bindingOf(workspace: WorkspaceView): WorktreeBinding {
    const archived = new Set(workspaces()?.list?.getSnapshot?.()?.archivedSessionIds ?? []);
    const all = workspace.sessionIds ?? [];
    return {
      registered: true,
      workspaceId: typeof workspace.workspaceId === 'string' ? workspace.workspaceId : '',
      title: typeof workspace.title === 'string' ? workspace.title : '',
      sessions: all.filter((id) => !archived.has(id)).length,
      archived: all.filter((id) => archived.has(id)).length,
    };
  }

  /** 该工作区里「没被归档」的会话，最近更新的在前。 */
  const liveSessions = (workspace: WorkspaceView): SessionSummary[] => {
    const snapshot = sessions()?.list?.getSnapshot?.();
    const archived = new Set(workspaces()?.list?.getSnapshot?.()?.archivedSessionIds ?? []);
    const byId = snapshot?.byId ?? {};
    return (workspace.sessionIds ?? [])
      .filter((id) => !archived.has(id))
      .map((id) => byId[id] ?? { id })
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
  };

  const openSession = (sessionId: string): void => {
    const ui = uiWorkspace();
    if (hasMethod(ui, 'openSession')) (ui as UiWorkspaceService).openSession?.(sessionId);
    else if (hasMethod(sessions(), 'open')) (sessions() as SessionsService).open?.(sessionId);
  };

  /** 建/复用该工作区的空白会话并切过去（DSH 自己的语义：只复用空白且未归档的）。 */
  const startSession = async (workspaceId: string): Promise<void> => {
    const ui = uiWorkspace();
    if (hasMethod(ui, 'startSession')) {
      await (ui as UiWorkspaceService).startSession?.(workspaceId);
      return;
    }
    const ws = workspaces();
    if (hasMethod(ws, 'startSession')) {
      await (ws as WorkspacesService).startSession?.(workspaceId);
      return;
    }
    throw new Error('当前部署不支持打开会话：uiWorkspace.startSession / workspaces.startSession 都不可用。');
  };

  /** 幂等注册；新登记时按 `<仓库> · <名字>` 命名（已登记的不动用户自己的选择）。 */
  const ensureRegistered = async (path: string): Promise<{ binding: WorktreeBinding; created: boolean }> => {
    const ws = workspaces();
    if (!hasMethod(ws, 'create')) throw new Error('当前部署不支持注册工作区：缺少 workspaces.create。');
    const target = String(path ?? '').trim();
    if (target === '') throw new Error('工作树路径为空。');
    const existing = workspaceAt(target);
    if (existing !== undefined) return { binding: bindingOf(existing), created: false };

    const created = await (ws as WorkspacesService).create?.({ path: target });
    const workspaceId = typeof created?.workspaceId === 'string' ? created.workspaceId : '';
    if (workspaceId === '') throw new Error('注册工作区后没有拿到 workspaceId，无法开会话。');
    const label = worktreeLabel(target);
    if (label !== '' && hasMethod(ws, 'rename')) {
      try {
        await (ws as WorkspacesService).rename?.(workspaceId, label);
      } catch {
        // 命名失败只是不好看，不该让「开会话」失败。
      }
    }
    return { binding: { ...EMPTY_BINDING, registered: true, workspaceId, title: label, sessions: 0 }, created: true };
  };

  return {
    available() {
      const ws = workspaces();
      return hasMethod(ws, 'create') && (hasMethod(uiWorkspace(), 'startSession') || hasMethod(ws, 'startSession'));
    },

    canCreateSession: () => hasMethod(sessions(), 'create'),

    binding(path) {
      const workspace = workspaceAt(path);
      return workspace === undefined ? { ...EMPTY_BINDING } : bindingOf(workspace);
    },

    async enter(path) {
      const { binding, created } = await ensureRegistered(path);
      if (!created) {
        const workspace = workspaceAt(path);
        const newest = workspace === undefined ? undefined : liveSessions(workspace)[0];
        // 有会话就回到最近那场（用户的预期是「回到我干活的地方」；空白会话也算，它本来空着）。
        if (newest !== undefined && typeof newest.id === 'string') {
          openSession(newest.id);
          return { ...binding, opened: 'existing', sessionId: newest.id };
        }
      }
      await startSession(binding.workspaceId);
      return { ...binding, opened: 'created', sessionId: '' };
    },

    async newSession(path) {
      const { binding } = await ensureRegistered(path);
      const session = sessions();
      if (!hasMethod(session, 'create')) throw new Error('当前部署不支持新建会话：缺少 sessions.create。');
      const sessionId = await (session as SessionsService).create?.({ workspaceId: binding.workspaceId });
      if (typeof sessionId !== 'string' || sessionId === '') throw new Error('新建会话没有返回 sessionId。');
      openSession(sessionId);
      return { ...binding, opened: 'created', sessionId };
    },

    async forget(path) {
      const ws = workspaces();
      if (!hasMethod(ws, 'delete')) return false;
      const existing = workspaceAt(path);
      if (existing === undefined || typeof existing.workspaceId !== 'string' || existing.workspaceId === '') return false;
      await (ws as WorkspacesService).delete?.(existing.workspaceId);
      return true;
    },
  };
}

/**
 * 侧栏项目行的标签：`<仓库目录名> · <工作树目录名>`。
 * 不做这一步，侧栏会多出几个看不出亲缘关系的项目行——Codex 的 worktree 聊天正是被
 * 用户抱怨「归组了但没标出是 worktree」（openai/codex#24386）。
 */
export function worktreeLabel(path: string): string {
  const parts = String(path ?? '')
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .filter((part) => part !== '');
  const name = parts[parts.length - 1] ?? '';
  const repo = parts[parts.length - 2] ?? '';
  if (name === '') return '';
  return repo === '' || repo === name ? name : `${repo} · ${name}`;
}
