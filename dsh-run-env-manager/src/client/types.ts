/** 与宿主 `src/host/contract.js` 一一对应的形状（浏览器半只消费，校验在宿主）。 */

export type EnvironmentKind = 'java' | 'maven' | 'python' | 'node' | 'go' | 'tomcat' | 'ant';

export const ENVIRONMENT_KINDS: EnvironmentKind[] = ['java', 'maven', 'python', 'node', 'go', 'tomcat', 'ant'];

export type Bindings = Record<EnvironmentKind, string>;

export interface DevelopmentEnvironment {
  id: string;
  kind: EnvironmentKind;
  name: string;
  path: string;
  version: string;
}

export interface TomcatOptions {
  webapp: string;
  contextPath: string;
  port: number;
  shutdownPort: number;
  buildCommand: string;
  jvmArgs: string[];
}

export interface RunConfiguration {
  id: string;
  name: string;
  type: 'command' | 'tomcat';
  command: string;
  cwd: string;
  environment: Bindings;
  env: Record<string, string>;
  readyWhen: { url: string; timeoutMs: number };
  browserUrl: string;
  tomcat: TomcatOptions;
}

export interface WorkspaceView {
  root: string;
  bindings: Bindings;
  configurations: RunConfiguration[];
}

export type RunStatus = 'starting' | 'running' | 'ready' | 'stopping' | 'stopped' | 'failed';

/** 还活着的状态（日志要有 SSE 增量、停止按钮要可用）。 */
export const LIVE_STATUSES: RunStatus[] = ['starting', 'running', 'ready', 'stopping'];

export interface RunSnapshot {
  id: string;
  name: string;
  root: string;
  command: string;
  cwd: string;
  status: RunStatus;
  exitCode: number | null;
  error?: string;
  url?: string;
  /** 绝对字符偏移：续读日志的起点。 */
  offset: number;
  base: number;
  /**
   * 内存日志尾部。轮询快照（`status?logs=0`）不带它——日志动不动 20 万字符，
   * 每 2 秒回一次全量太重；展开一条日志时走 `/log` 或 SSE 按需取。
   */
  log?: string;
}

/** `GET /log` 的应答：单个实例的日志尾部 + 绝对偏移（展开日志时的首屏）。 */
export interface RunLogPayload extends Omit<RunSnapshot, 'log'> {
  log: string;
}

/** 面板/i18n 的取词函数。 */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

export interface Snapshot {
  platform: string;
  kinds: EnvironmentKind[];
  library: { environments: DevelopmentEnvironment[]; defaults: Bindings };
  workspace?: WorkspaceView;
  runs: RunSnapshot[];
  /** 动作附带的提示（例如探测到的环境数量）。 */
  detected?: number;
  validated?: { kind: EnvironmentKind; version: string; path: string };
}

/** SSE 帧：`text` 是相对客户端已有日志的增量。 */
export interface StreamFrame extends Omit<RunSnapshot, 'log'> {
  text?: string;
}

export function emptyBindings(): Bindings {
  return Object.fromEntries(ENVIRONMENT_KINDS.map((kind) => [kind, ''])) as Bindings;
}

export function emptyConfiguration(id: string): RunConfiguration {
  return {
    id,
    name: '',
    type: 'command',
    command: '',
    cwd: '${workspaceFolder}',
    environment: emptyBindings(),
    env: {},
    readyWhen: { url: '', timeoutMs: 60000 },
    browserUrl: '',
    tomcat: { webapp: '', contextPath: '/', port: 8080, shutdownPort: 8005, buildCommand: '', jvmArgs: [] },
  };
}
