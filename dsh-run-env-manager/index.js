/**
 * dsh-run-env-manager — 宿主半。
 *
 * 在右侧栏维护项目运行配置、一键启停、实时日志，AI 读项目生成配置。
 * 功能对齐 OneCode 的「运行 / 配置」面板（见 README 引用的 docs/quick-launch.md）。
 *
 * 结构：
 *   src/host/contract.js    数据形状、三层绑定解析、校验
 *   src/host/environment.js 开发环境发现/校验/注入
 *   src/host/store.js       volatile Config 读写
 *   src/host/processes.js   运行实例注册表
 *   src/host/routes.js      HTTP 接口
 *
 * 两个必须记住的宿主约束（详见各模块文件头）：
 *   - 运行配置与环境库都存 volatile 字段，否则每次写入都会让 Loader 整插件重挂；
 *   - 启动命令经 `cmd.exe /d /s /c`（Windows）或 `bash -c`（POSIX），
 *     因为 Windows 上 npm/pnpm 是 .cmd 垫片，Job runner 只解析 .com/.exe。
 */
import z from '@deepseek-ai/schemastery';
import { ENVIRONMENT_KINDS } from './src/host/contract.js';
import { RunRegistry } from './src/host/processes.js';
import { createStore } from './src/host/store.js';
import { installRoutes } from './src/host/routes.js';
import { registerTools } from './src/host/tools.js';

/** 必须等于 cordis.patch.yml 的行 id，也是浏览器半的插件身份。 */
export const SETTINGS_NAMESPACE = 'run-env-manager';

const DEFAULT_LOG_TAIL_CHARS = 200000;
const MIN_LOG_TAIL_CHARS = 1000;

/** 三层绑定的任意一层：kind → 环境库条目 id，空串表示这一层不指定。 */
const EnvironmentBindings = z.object(
  Object.fromEntries(ENVIRONMENT_KINDS.map((kind) => [kind, z.string().default('')])),
).default({});

const DevelopmentEnvironment = z.object({
  id: z.string().required(),
  kind: z.string().required(),
  name: z.string().default(''),
  path: z.string().default(''),
  version: z.string().default(''),
});

const TomcatOptions = z.object({
  webapp: z.string().default(''),
  contextPath: z.string().default('/'),
  port: z.number().default(8080),
  shutdownPort: z.number().default(8005),
  buildCommand: z.string().default(''),
  jvmArgs: z.array(z.string()).default([]),
});

const RunConfiguration = z.object({
  id: z.string().required(),
  name: z.string().default(''),
  /** 'command' 普通命令；'tomcat' 走独立 CATALINA_BASE 的托管启动。 */
  type: z.string().default('command'),
  command: z.string().default(''),
  /** 支持 ${workspaceFolder} 占位符，默认就是工作区根。 */
  cwd: z.string().default('${workspaceFolder}'),
  environment: EnvironmentBindings,
  /** 字面量环境变量：必须显式下发，宿主的敏感变量剥离会拦掉父环境里的同名项。 */
  env: z.dict(String).default({}),
  readyWhen: z.object({ url: z.string().default(''), timeoutMs: z.number().default(60000) }).default({}),
  browserUrl: z.string().default(''),
  tomcat: TomcatOptions.default({}),
});

const WorkspaceEntry = z.object({
  root: z.string().required(),
  bindings: EnvironmentBindings,
  configurations: z.array(RunConfiguration).default([]),
  updatedAt: z.string().default(''),
});

/**
 * 只有 .volatile() 字段能在运行时被写回；非 volatile 的写入会让 Loader 整插件卸载重挂，
 * 等于每改一次配置就把所有跑着的服务掀一次。
 */
export const Config = z.object({
  environments: z.array(DevelopmentEnvironment).default([]).volatile(),
  defaults: EnvironmentBindings.volatile(),
  workspaces: z.array(WorkspaceEntry).default([]).volatile(),
  logTailChars: z.number().default(DEFAULT_LOG_TAIL_CHARS).volatile(),
});

/** 进程能力是硬依赖；webServer 走惰性注入（headless profile 没有它）。 */
export const inject = ['subprocess'];

export function apply(ctx, config) {
  const logTailChars = () => {
    const value = config.logTailChars.get();
    return Number.isFinite(value) && value > MIN_LOG_TAIL_CHARS ? value : DEFAULT_LOG_TAIL_CHARS;
  };

  const store = createStore(ctx, config);
  const registry = new RunRegistry(ctx);

  ctx.inject(['webServer'], (webCtx) => installRoutes(webCtx, { store, registry, logTailChars }));

  // AI 工具：注册在插件自己的上下文，且用 ctx.get('tools')（见 registerTools 注释）。
  ctx.inject(['tools'], () => {
    try {
      registerTools(ctx, { store });
    } catch (error) {
      ctx.logger?.warn?.(`run-env-manager: 注册 AI 工具失败：${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // 卸载（含宿主有序退出）时收掉所有实例。宿主被强杀的情况由 Win32 Job 容器兜底：
  // runner 的 IPC 断开 → 释放 Job 句柄 → 内核杀掉整棵树（阶段 0 已实测）。
  ctx.effect(() => () => registry.disposeAll(), 'run-env-manager: runs');

  ctx.logger?.info?.(`run-env-manager: 宿主已就绪（${process.platform}）`);
}
