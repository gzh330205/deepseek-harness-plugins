import { ROUTE } from './constants.js';
import type { Bindings, DevelopmentEnvironment, EnvironmentKind, RunConfiguration, Snapshot } from './types.js';

async function request<T>(action: string, body?: unknown): Promise<T> {
  let response: Response;
  const isRead = body === undefined;
  try {
    response = await fetch(isRead ? `${ROUTE}/${action}` : `${ROUTE}/${action}`, {
      method: isRead ? 'GET' : 'POST',
      headers: { accept: 'application/json', ...(isRead ? {} : { 'content-type': 'application/json' }) },
      ...(isRead ? {} : { body: JSON.stringify(body ?? {}) }),
    });
  } catch {
    throw new Error('无法连接 DSH Host 的运行环境接口。');
  }
  let payload: { ok?: boolean; error?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (response.ok !== true || payload === null || payload.ok !== true) {
    throw new Error(payload?.error ?? `HTTP ${response.status}`);
  }
  return payload as T;
}

export interface RunEnvApi {
  status(root: string): Promise<Snapshot>;
  detect(): Promise<Snapshot>;
  saveEnvironment(environment: DevelopmentEnvironment): Promise<Snapshot>;
  removeEnvironment(id: string): Promise<Snapshot>;
  setDefault(kind: EnvironmentKind, id: string): Promise<Snapshot>;
  validateEnvironment(kind: EnvironmentKind, path: string): Promise<Snapshot>;
  saveBindings(root: string, bindings: Bindings): Promise<Snapshot>;
  saveConfiguration(root: string, configuration: RunConfiguration): Promise<Snapshot>;
  saveWorkspace(root: string, workspace: { bindings: Bindings; configurations: RunConfiguration[] }): Promise<Snapshot>;
  removeConfiguration(root: string, id: string): Promise<Snapshot>;
  start(root: string, id: string): Promise<Snapshot>;
  stop(root: string, id: string): Promise<Snapshot>;
  streamUrl(root: string, id: string, from: number): string;
  /** 传给 `useSnapshot` 的读取函数：所有动作都回全量快照。 */
  snapshotOf: (root: string) => Promise<Snapshot>;
}

export function createApi(): RunEnvApi {
  return {
    // 只读快照走 GET（同名动作用 query 参数），其余动作一律 POST + 同源门禁。
    status: (root) => request<Snapshot>(`status?root=${encodeURIComponent(root)}`),
    detect: () => request<Snapshot>('detect', {}),
    saveEnvironment: (environment) => request<Snapshot>('saveEnvironment', { environment }),
    removeEnvironment: (id) => request<Snapshot>('removeEnvironment', { id }),
    setDefault: (kind, id) => request<Snapshot>('setDefault', { kind, id }),
    validateEnvironment: (kind, path) => request<Snapshot>('validateEnvironment', { kind, path }),
    saveBindings: (root, bindings) => request<Snapshot>('saveBindings', { root, bindings }),
    saveConfiguration: (root, configuration) => request<Snapshot>('saveConfiguration', { root, configuration }),
    saveWorkspace: (root, workspace) => request<Snapshot>('saveWorkspace', { root, workspace }),
    removeConfiguration: (root, id) => request<Snapshot>('removeConfiguration', { root, id }),
    start: (root, id) => request<Snapshot>('start', { root, id }),
    stop: (root, id) => request<Snapshot>('stop', { root, id }),
    streamUrl: (root, id, from) => `${ROUTE}/stream?root=${encodeURIComponent(root)}&id=${encodeURIComponent(id)}&from=${from}`,
    snapshotOf: (root) => request<Snapshot>(`status?root=${encodeURIComponent(root)}`),
  };
}

export function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
