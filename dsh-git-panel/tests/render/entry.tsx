/**
 * 渲染冒烟测试入口：被 `tests/render.test.js` 用 esbuild 打包后 require。
 *
 * 这里不测交互（服务端渲染不跑 effect），只保证**给定真实宿主数据时每个视图都能
 * 画出 HTML 而不抛错**——这是浏览器半在没有真实浏览器时能拿到的最强信号：
 * 漏字段、字段改名、数组/对象形态不一致都会在这里炸出来。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GitPanel } from '../../src/client/components/GitPanel.jsx';
import { ChangesView } from '../../src/client/components/ChangesView.jsx';
import { DiffView } from '../../src/client/components/DiffView.jsx';
import { DiffPage } from '../../src/client/components/DiffPage.jsx';
import { HistoryView } from '../../src/client/components/HistoryView.jsx';
import { WorktreeView } from '../../src/client/components/WorktreeView.jsx';
import { dictionaries } from '../../src/client/locales.js';
import { setDiffTarget, type DiffItem, type DiffTargetState } from '../../src/client/diff-target.js';

const t = (key: string, params?: Record<string, unknown>): string => {
  const template = dictionaries.zh[key] ?? key;
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? `{${name}}`));
};

const noop = () => undefined;
const actions = new Proxy({}, { get: () => async () => ({ ok: true, changes: [], counts: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 } }) });
const api = new Proxy({}, { get: () => async () => ({ ok: true }) });

const render = (element: React.ReactElement): string => renderToStaticMarkup(element);

export function renderChanges(snapshot: unknown, selection: unknown, diff: unknown, extra: Record<string, unknown> = {}): string {
  return render(
    React.createElement(ChangesView, {
      snapshot,
      selection,
      diff,
      diffLoading: false,
      diffError: '',
      busy: '',
      t,
      onSelect: noop,
      onStage: noop,
      onUnstage: noop,
      onDiscard: noop,
      onStageAll: noop,
      onUnstageAll: noop,
      onCommit: noop,
      onOpenFile: noop,
      onShowFileHistory: noop,
      centerAvailable: false,
      ...extra,
    } as never),
  );
}

/** 中心窗口差异页：设置 store 目标 → 在 jsdom 里挂载 → 可选点「下一个 / 关闭」。 */
export async function mountDiffPage(options: {
  state: DiffTargetState;
  diffs: Record<string, unknown>;
  clickNext?: boolean;
  clickClose?: boolean;
}): Promise<{ html: string; afterNext: string; log: string[] }> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const log: string[] = [];
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };

  setDiffTarget(options.state);
  const api = {
    diff: async (_root: string, request: { path: string }) => {
      log.push(`diff:${request.path}`);
      return { ok: true, diff: options.diffs[request.path] ?? null };
    },
  };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  await act(async () => {
    root.render(
      React.createElement(DiffPage, {
        api,
        t,
        close: () => log.push('close'),
        openPreview: (_item: DiffItem, absolute: string) => log.push(`preview:${absolute}`),
      } as never),
    );
  });
  await flush();
  const html = container.innerHTML;
  let afterNext = html;
  if (options.clickNext === true) {
    const next = [...container.querySelectorAll('button')].find((button) => button.getAttribute('title') === '下一个文件');
    await act(async () => {
      next?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();
    afterNext = container.innerHTML;
  }
  if (options.clickClose === true) {
    const close = [...container.querySelectorAll('button')].find((button) => button.getAttribute('title') === '关闭，返回对话');
    await act(async () => {
      close?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
  }
  await act(async () => {
    root.unmount();
  });
  container.remove();
  setDiffTarget(null);
  return { html, afterNext, log };
}

export function renderDiff(files: unknown[], options: Record<string, unknown> = {}): string {
  return render(React.createElement(DiffView, { files, t, ...options } as never));
}

export function renderHistory(props: Record<string, unknown>): string {
  return render(React.createElement(HistoryView, { root: '/repo', api, actions, t, pathFilter: '', onClearPathFilter: noop, onOpenFile: noop, onSnapshot: noop, onError: noop, onNotice: noop, setBusy: noop, busy: '', ...props } as never));
}

export function renderWorktrees(props: Record<string, unknown>): string {
  return render(React.createElement(WorktreeView, { root: '/repo', api, actions, t, onSnapshot: noop, onError: noop, onNotice: noop, busy: '', setBusy: noop, ...props } as never));
}

/**
 * 面板头部的分支行：点一下应当切到历史页并**直接打开**分支选择器
 * （这是「无法切换分支」那个坑的回归断言——入口不能只是装饰）。
 */
export async function clickHeaderBranch(options: { snapshot: unknown; branches: unknown }): Promise<{ before: string; after: string }> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };
  const snapshot = options.snapshot as Record<string, unknown>;
  const api = {
    snapshot: async () => ({ ok: true, ...snapshot }),
    diff: async () => ({ ok: true, diff: { files: [], truncated: false } }),
    history: async () => ({ ok: true, history: { commits: [], hasMore: false, ref: 'HEAD', unborn: false, truncated: false } }),
    // 真实宿主形状：{ ok, root, branches: { local, remote, tags, total } }（见 src/host/routes.js）
    branches: async () => ({ ok: true, root: '/repo', branches: options.branches }),
    commit: async () => ({ ok: true, detail: null, diff: null }),
    worktrees: async () => ({ ok: true, worktrees: [], worktreeTotal: 0, worktreeTruncated: false, suggestedRoot: '', defaultBranchPrefix: '', configuredRoot: '', repo: null }),
  };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  await act(async () => {
    root.render(
      React.createElement(GitPanel, {
        api,
        actions,
        t,
        sessionId: 'session-1',
        useSessions: () => '/repo',
        useTabInfo: () => ({ tab: { visible: true } }),
      } as never),
    );
  });
  await flush();
  const before = container.innerHTML;
  const header = [...container.querySelectorAll('button.dgp-branch')][0];
  await act(async () => {
    header?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  await flush();
  const after = container.innerHTML;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return { before, after };
}

/**
 * 非仓库形态（`repo === null`）：面板要出引导，而不是在 `repo.xxx` 上炸掉。
 * 这一态只有真挂载（跑 effect 拿到快照）才走得到，服务端渲染覆盖不了。
 */
export async function mountNonRepo(reason: string): Promise<string> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };
  const api = {
    snapshot: async () => ({ ok: true, root: '/repo', repo: null, gitMissing: false, reason, changes: [], counts: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 }, truncated: false, contextLines: 3 }),
  };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(GitPanel, { api, actions, t, sessionId: 'session-1', useSessions: () => '/repo' } as never),
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  const html = container.innerHTML;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return html;
}

/** 历史页：挂载 → 可选点开某个提交 / 打开分支选择器。 */
export async function mountHistory(options: {
  history: unknown;
  branches?: unknown;
  commitDetail?: unknown;
  commitDiff?: unknown;
  clickCommit?: boolean;
  clickBranches?: boolean;
}): Promise<{ html: string; detailHtml: string; pickerHtml: string; log: string[] }> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const log: string[] = [];
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };
  const api = {
    history: async () => ({ ok: true, history: options.history }),
    branches: async () => ({ ok: true, root: '/repo', branches: options.branches ?? { local: [], remote: [], tags: [], truncated: false, total: { local: 0, remote: 0, tags: 0 } } }),
    commit: async (_root: string, hash: string) => {
      log.push(`commit:${hash}`);
      return { ok: true, detail: options.commitDetail, diff: options.commitDiff ?? null };
    },
  };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  const click = async (element: Element | undefined | null) => {
    if (element === undefined || element === null) return;
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();
  };
  await act(async () => {
    root.render(
      React.createElement(HistoryView, { root: '/repo', api, actions, t, pathFilter: '', onClearPathFilter: noop, onOpenFile: noop, onSnapshot: noop, onError: noop, onNotice: noop, setBusy: noop, busy: '' } as never),
    );
  });
  await flush();
  const html = container.innerHTML;
  let pickerHtml = '';
  if (options.clickBranches === true) {
    await click([...container.querySelectorAll('button')].find((button) => button.getAttribute('title') === '切换分支'));
    pickerHtml = container.innerHTML;
  }
  let detailHtml = '';
  if (options.clickCommit === true) {
    await click(container.querySelector('.dgp-commititem'));
    detailHtml = container.innerHTML;
  }
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return { html, detailHtml, pickerHtml, log };
}

/** 工作树页：挂载并渲染真实列表。 */
export async function mountWorktrees(result: unknown): Promise<string> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };
  const api = { worktrees: async () => ({ ok: true, ...(result as Record<string, unknown>) }) };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  await act(async () => {
    root.render(React.createElement(WorktreeView, { root: '/repo', api, actions, t, onSnapshot: noop, onError: noop, onNotice: noop, busy: '', setBusy: noop } as never));
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  const html = container.innerHTML;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return html;
}

/**
 * 工作树页的会话入口（F1–F5）：用一个假 opener 走完整交互——
 *   1. 建树表单里两个默认勾选项（复制忽略文件 / 建完进会话）；
 *   2. 创建成功后真的去「注册 + 开会话」，并且用的是宿主返回的 created.path；
 *   3. 每行常驻「进入 / 再来一场」，已注册的树显示会话数；
 *   4. 删除确认里的「同时从工作区列表移除」；
 *   5. 会话消失（归档/删除）后再点「进入」→ opener 收到的是同一路径（由 opener 决定重建）。
 */
export async function clickWorktreeSession(options: {
  worktrees: unknown[];
  createdPath?: string;
  copied?: string[];
  openResult?: unknown;
  createResult?: unknown;
}): Promise<{
  html: string;
  afterCreateHtml: string;
  afterEnterHtml: string;
  afterRemoveHtml: string;
  log: string[];
}> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const log: string[] = [];
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };
  const createdPath = options.createdPath ?? '/ws/.dsh-worktrees/repo/wt1';
  const list = () => ({ ok: true, repo: null, worktrees: options.worktrees, worktreeTotal: options.worktrees.length, worktreeTruncated: false, suggestedRoot: '/ws/.dsh-worktrees/repo', defaultBranchPrefix: 'dsh/', configuredRoot: '' });
  const api = { worktrees: async () => list(), branches: async () => ({ ok: true, root: '/repo', branches: { local: [], remote: [], tags: [], truncated: false, total: { local: 0, remote: 0, tags: 0 } } }) };
  const actions = {
    ...({} as Record<string, unknown>),
    worktreeAdd: async (_root: string, request: Record<string, unknown>) => {
      log.push(`add:${String(request.copyIgnored)}`);
      return { ...list(), created: { path: createdPath, branch: '', mode: String(request.mode), copied: options.copied ?? [] } };
    },
    worktreeRemove: async () => {
      log.push('remove');
      return { ...list(), removedWorktree: { path: createdPath, patchPath: '', retainedBranch: '', dirty: 0 } };
    },
  };
  const opener = {
    available: () => true,
    canCreateSession: () => true,
    binding: (path: string) => (path === '/ws/.dsh-worktrees/repo/registered' ? { registered: true, workspaceId: 'w1', title: 'repo · registered', sessions: 2, archived: 1 } : { registered: false, workspaceId: '', title: '', sessions: 0, archived: 0 }),
    enter: async (path: string) => {
      log.push(`enter:${path}`);
      return { registered: true, workspaceId: 'w1', title: 'repo · wt1', sessions: 1, archived: 0, opened: 'created', sessionId: 's-new', ...(options.openResult as Record<string, unknown> ?? {}) };
    },
    newSession: async (path: string) => {
      log.push(`newSession:${path}`);
      return { registered: true, workspaceId: 'w1', title: 'repo · wt1', sessions: 2, archived: 0, opened: 'created', sessionId: 's-2' };
    },
    forget: async (path: string) => {
      log.push(`forget:${path}`);
      return true;
    },
  };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  const click = async (element: Element | undefined | null) => {
    if (element === undefined || element === null) return;
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();
  };
  const byTitle = (label: string) => [...container.querySelectorAll('button')].find((button) => button.getAttribute('title') === label);

  await act(async () => {
    root.render(React.createElement(WorktreeView, { root: '/repo', api, actions, t, onSnapshot: noop, onError: (message: string) => log.push(`error:${message}`), onNotice: (message: string) => log.push(`notice:${message}`), busy: '', setBusy: noop, worktreeSessions: opener } as never));
  });
  await flush();
  const html = container.innerHTML;

  // 1/2：打开表单 → 两个复选框默认已勾 → 创建
  await click(byTitle('新建工作树'));
  const formHtml = container.innerHTML;
  await click([...container.querySelectorAll('button')].find((button) => (button.textContent ?? '').includes('创建')));
  const afterCreateHtml = container.innerHTML;
  log.push(`checkboxesChecked:${(formHtml.match(/<input type="checkbox"[^>]*checked/g) ?? []).length}`);

  // 3：每行「回到该工作树的会话」
  await click(byTitle('回到该工作树的会话'));
  const afterEnterHtml = container.innerHTML;
  await click(byTitle('新建一场会话'));

  // 4：删除确认里的「同时从工作区列表移除」
  await click(byTitle('删除工作树'));
  await click([...container.querySelectorAll('button')].find((button) => (button.textContent ?? '').includes('确认删除')));
  const afterRemoveHtml = container.innerHTML;

  await act(async () => {
    root.unmount();
  });
  container.remove();
  return { html, afterCreateHtml, afterEnterHtml, afterRemoveHtml, log };
}

export function renderPanel(props: Record<string, unknown>): string {
  return render(React.createElement(GitPanel, { api, actions, t, sessionId: 'session-1', ...props } as never));
}

export interface InteractOptions {
  snapshot: unknown;
  diff: unknown;
  stageLabel?: string;
  unstageAllLabel?: string;
}

/**
 * 在 jsdom 里真挂载 GitPanel 并点几下：验证「effect 拿快照 → 渲染 → 点击 → 调动作
 * → 用响应里的快照整体替换」这条主链路（服务端渲染覆盖不到）。
 * 全局的 window/document 由测试侧注入。
 */
export async function interact(options: InteractOptions): Promise<{
  html: string;
  diffHtml: string;
  listHtml: string;
  treeHtml: string;
  collapsedHtml: string;
  expandedHtml: string;
  centerHtml: string;
  storedView: string;
  log: string[];
  diffCalls: number;
  centerDiffCalls: number;
}> {
  const ReactDomClient: typeof import('react-dom/client') = await import('react-dom/client');
  const testUtils = (await import('react-dom/test-utils')) as unknown as { act: (task: () => void | Promise<void>) => Promise<void> };
  // React 18.3+ 自带 act；优先用它，避免 test-utils 的弃用告警。
  const act = (React as unknown as { act?: (task: () => void | Promise<void>) => Promise<void> }).act ?? testUtils.act;
  const log: string[] = [];
  const dom = globalThis as unknown as { document: Document; window: Window & typeof globalThis };

  const snapshotResponse = () => ({ ok: true, ...(options.snapshot as Record<string, unknown>) });
  const base = options.snapshot as { changes: Array<Record<string, unknown>> } & Record<string, unknown>;
  // 暂存后返回一份「a.txt 已经进 index」的快照：用来验证差异会自动重拉。
  const stagedSnapshot = () => ({
    ok: true,
    ...base,
    changes: base.changes.map((entry) =>
      entry.path === 'a.txt' ? { ...entry, index: 'M', worktree: '.', stats: { staged: (entry.stats as Record<string, unknown>)?.worktree ?? null, worktree: null } } : entry,
    ),
  });
  let diffCalls = 0;
  const worktreeStub = () => ({ ...snapshotResponse(), worktrees: [], worktreeTotal: 0, worktreeTruncated: false, suggestedRoot: '', defaultBranchPrefix: '', configuredRoot: '' });
  const api = {
    snapshot: async () => snapshotResponse(),
    diff: async () => {
      diffCalls += 1;
      return { ok: true, diff: options.diff };
    },
    history: async () => ({ ok: true, history: { commits: [], hasMore: false, ref: 'HEAD', unborn: false, truncated: false } }),
    commit: async () => ({ ok: true, detail: null, diff: null }),
    branches: async () => ({ ok: true, root: '/repo', branches: { local: [], remote: [], tags: [], truncated: false, total: { local: 0, remote: 0, tags: 0 } } }),
    worktrees: async () => ({ ok: true, worktrees: [], worktreeTotal: 0, worktreeTruncated: false, suggestedRoot: '/repo/.dsh-worktrees/repo', defaultBranchPrefix: 'dsh/', configuredRoot: '', repo: null }),
  };
  const actions = {
    stage: async (_root: string, paths: string[]) => {
      log.push(`stage:${paths.join(',')}`);
      return stagedSnapshot();
    },
    stageAll: async () => {
      log.push('stageAll');
      return snapshotResponse();
    },
    unstage: async (_root: string, paths: string[]) => {
      log.push(`unstage:${paths.join(',')}`);
      return snapshotResponse();
    },
    unstageAll: async () => {
      log.push('unstageAll');
      return snapshotResponse();
    },
    discard: async (_root: string, tracked: string[], untracked: string[]) => {
      log.push(`discard:${[...tracked, ...untracked].join(',')}`);
      return snapshotResponse();
    },
    commit: async (_root: string, message: string) => {
      log.push(`commit:${message}`);
      return snapshotResponse();
    },
    checkout: async () => snapshotResponse(),
    abortMerge: async () => snapshotResponse(),
    worktreeAdd: async () => worktreeStub(),
    worktreeRemove: async () => worktreeStub(),
    worktreePrune: async () => worktreeStub(),
  };

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDomClient.createRoot(container);
  setDiffTarget(null);
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  const click = async (element: Element | undefined | null) => {
    if (element === undefined || element === null) return;
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();
  };
  const byTitle = (label: string) => [...container.querySelectorAll('button')].find((button) => button.getAttribute('title') === label);
  const byText = (label: string) => [...container.querySelectorAll('button')].find((button) => (button.textContent ?? '').includes(label));

  await act(async () => {
    root.render(
      React.createElement(GitPanel, {
        api,
        actions,
        t,
        sessionId: 'session-1',
        useSessions: () => '/repo',
        useTabInfo: () => ({ tab: { visible: true, actions: { openResource: (address: string) => log.push(`open:${address}`) } } }),
        diffCenterAvailable: true,
        openDiffInCenter: (state: DiffTargetState) => {
          setDiffTarget(state);
          const item = state.items[state.index];
          log.push(`center:${item?.path ?? ''}`);
        },
      } as never),
    );
  });
  await flush();

  // 顺序：先记下列表态 → 点 a.txt 行看差异 → 在内置预览打开 → 在详情里暂存
  // → 返回（此时 a.txt 已进 index，列表重新渲染）→ 全部取消暂存。
  const listHtml = container.innerHTML;
  // 切到「目录」模式再切回「列表」：验证两种显示模式与偏好持久化。
  await click(byText('目录'));
  const treeHtml = container.innerHTML;
  const storedAfterTree = dom.window.localStorage.getItem('dsh-git-panel/changes-view') ?? '';
  // 目录模式下：全部折叠 → 全部展开。
  await click(byText('折叠'));
  const collapsedHtml = container.innerHTML;
  await click(byText('展开'));
  const expandedHtml = container.innerHTML;
  await click(byText('列表'));
  const storedView = storedAfterTree === 'tree' && dom.window.localStorage.getItem('dsh-git-panel/changes-view') === 'flat' ? 'tree->flat' : `${storedAfterTree}->${dom.window.localStorage.getItem('dsh-git-panel/changes-view')}`;

  // ① 默认「打开位置 = 中间」：点文件走中心窗口，侧栏不显示内联差异，行保持高亮。
  const fileRow = () => [...container.querySelectorAll('.dgp-name')].find((button) => (button.textContent ?? '').includes('a.txt'));
  await click(fileRow());
  const centerHtml = container.innerHTML;
  const centerDiffCalls = diffCalls;

  // ② 切到「打开位置 = 侧栏」：同一个文件改为内联详情，差异在侧栏里渲染。
  await click(byText('侧栏'));
  await click(fileRow());
  const diffHtml = container.innerHTML;
  await click(byTitle('在内置预览中打开'));
  await click(byTitle(options.stageLabel ?? '暂存'));
  await click(byTitle('返回'));
  await click(byText(options.unstageAllLabel ?? '全部取消'));
  const html = container.innerHTML;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  setDiffTarget(null);
  return { html, diffHtml, listHtml, treeHtml, collapsedHtml, expandedHtml, centerHtml, storedView, log, diffCalls, centerDiffCalls };
}

export { t };
