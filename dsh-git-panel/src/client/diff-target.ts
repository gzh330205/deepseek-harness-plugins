/**
 * 「中间窗口差异页」的目标状态：右侧栏 Git 标签页写入，中心 `main` 面板读取。
 *
 * 为什么用一个模块级的极小 store 而不是框架的 store 席位：写入方（会话作用域的
 * 右侧栏 tab 正文）与读取方（root 作用域的中心面板）**作用域不同**，slot store 的
 * 句柄不能跨作用域共享；两边都是本插件的组件，一个订阅式的模块级状态最直接。
 *
 * 面板卸载不清理状态：中心页可能因为切走再切回而重新挂载，丢掉目标会让用户看到
 * 一个空页；真正的「关闭」由 `closeCenterDiff()` 显式写 null。
 */

export interface DiffItem {
  path: string;
  origPath?: string;
  staged: boolean;
  untracked: boolean;
  kind: string;
}

export interface DiffTargetState {
  /** 请求用的工作区根（宿主接口的 root 参数）。 */
  root: string;
  /** 仓库根，用于拼绝对路径与展示。 */
  repoRoot: string;
  /** 文件预览资源地址需要它；缺失时隐藏「打开文件」按钮。 */
  sessionId?: string;
  /** 同一批变更（一个分组）里的全部文件，支持上一个/下一个。 */
  items: DiffItem[];
  index: number;
  /** 打开时的 diff 上下文行数（来自快照），保证与侧栏看到的一致。 */
  contextLines?: number;
}

let state: DiffTargetState | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function getDiffTarget(): DiffTargetState | null {
  return state;
}

export function subscribeDiffTarget(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 打开（或替换）中心差异页的目标。 */
export function setDiffTarget(next: DiffTargetState | null): void {
  state = next;
  emit();
}

/** 在同批文件里前后移动。 */
export function stepDiffTarget(offset: number): void {
  if (state === null || state.items.length === 0) return;
  const total = state.items.length;
  const index = ((state.index + offset) % total + total) % total;
  if (index === state.index) return;
  state = { ...state, index };
  emit();
}

/** 当前项；越界时回落到第一项。 */
export function currentDiffItem(): DiffItem | null {
  if (state === null || state.items.length === 0) return null;
  return state.items[state.index] ?? state.items[0] ?? null;
}
