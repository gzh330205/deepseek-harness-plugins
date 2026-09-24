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
    branches: async () => ({ ok: true, ...(options.branches ?? { local: [], remote: [], tags: [], truncated: false, total: { local: 0, remote: 0, tags: 0 } }) }),
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
    branches: async () => ({ ok: true, local: [], remote: [], tags: [], truncated: false, total: { local: 0, remote: 0, tags: 0 } }),
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
