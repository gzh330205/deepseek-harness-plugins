/**
 * 提供给 AI 的工具：读写某个工作区的运行配置。
 *
 * 为什么需要工具而不是文件：运行配置按设计存在 profile 下（用户要求 profile 独立），
 * 不在项目目录里，所以 agent 无法用文件工具直接写。这两个工具就是它的写入口。
 *
 * 可见性：宿主行（profile 根）注册的工具会进入 ToolRuntime 的「全局层」，
 * 被所有 preset 的所有 agent 看见 —— 不需要改任何 preset（web surface 之所以逐行
 * disabled 掉 tool-bash 等行，正是因为「全局注册 = 所有 preset 可见」）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { ENVIRONMENT_KINDS, emptyBindings, validateWorkspaceEntry } from './contract.js';

/** 从执行上下文里定位工作区根：显式参数优先，其次会话的 cwd。 */
function resolveRoot(exec, requested) {
  if (typeof requested === 'string' && requested.trim() !== '') return requested.trim();
  const session = exec?.agent?.session;
  for (const candidate of [session?.cwd, session?.meta?.cwd, session?.header?.cwd, exec?.agent?.meta?.cwd]) {
    if (typeof candidate === 'string' && candidate !== '') return candidate;
  }
  return undefined;
}

function requireRoot(exec, requested) {
  const root = resolveRoot(exec, requested);
  if (root === undefined) {
    throw new Error('无法确定工作区目录：请显式传入 workspacePath（项目根目录的绝对路径）。');
  }
  return root;
}

/** 把工具参数里的扁平字段还原成运行配置形状。 */
function toConfiguration(input) {
  const bindings = { ...emptyBindings() };
  for (const kind of ENVIRONMENT_KINDS) {
    const id = input?.environment?.[kind];
    if (typeof id === 'string' && id !== '') bindings[kind] = id;
  }
  const env = {};
  for (const [name, value] of Object.entries(input?.env ?? {})) {
    if (typeof value === 'string') env[name] = value;
  }
  return {
    id: String(input?.id ?? '').trim(),
    name: String(input?.name ?? '').trim(),
    type: input?.type === 'tomcat' ? 'tomcat' : 'command',
    command: String(input?.command ?? ''),
    cwd: String(input?.cwd ?? '${workspaceFolder}'),
    environment: bindings,
    env,
    readyWhen: { url: String(input?.readyWhenUrl ?? ''), timeoutMs: Number(input?.readyWhenTimeoutMs) || 60000 },
    browserUrl: String(input?.browserUrl ?? ''),
    tomcat: {
      webapp: String(input?.tomcat?.webapp ?? ''),
      contextPath: String(input?.tomcat?.contextPath ?? '/'),
      port: Number(input?.tomcat?.port) || 8080,
      shutdownPort: Number(input?.tomcat?.shutdownPort) || 8005,
      buildCommand: String(input?.tomcat?.buildCommand ?? ''),
      jvmArgs: Array.isArray(input?.tomcat?.jvmArgs) ? input.tomcat.jvmArgs.filter((value) => typeof value === 'string') : [],
    },
  };
}

const CONFIGURATION_PROPERTIES = {
  id: { type: 'string', required: true, description: '配置标识符：字母、数字、下划线、连字符，项目内唯一，例如 web / backend。' },
  name: { type: 'string', required: true, description: '给人看的名称，例如 前端 / 后端。' },
  type: { type: 'string', enum: ['command', 'tomcat'], description: '留空视为 command。' },
  command: { type: 'string', description: '启动命令（type=command 时必填），例如 pnpm dev、mvn spring-boot:run。' },
  cwd: { type: 'string', description: '工作目录，默认 ${workspaceFolder}；相对写法请用 ${workspaceFolder}/子目录。' },
  env: { type: 'object', additionalProperties: true, description: '额外环境变量（仅写确实需要的值，不要写密码）。' },
  environment: {
    type: 'object',
    description: '本服务覆盖的开发环境（值是 run_env_get 返回的环境 id）。普通服务留空以继承项目/全局默认。',
    additionalProperties: true,
  },
  readyWhenUrl: { type: 'string', description: '就绪检测地址（http(s)），服务起来后用于判断 ready；不确定就留空。' },
  readyWhenTimeoutMs: { type: 'number', description: '就绪检测超时毫秒，默认 60000。' },
  browserUrl: { type: 'string', description: '要打开的页面地址（http(s)），与就绪检测地址相互独立；不确定就留空。' },
  tomcat: {
    type: 'object',
    description: '仅 type=tomcat 时使用。',
    additionalProperties: false,
    properties: {
      webapp: { type: 'string', description: 'Web 应用目录（相对项目根或绝对路径）。' },
      contextPath: { type: 'string', description: '上下文路径，以 / 开头，例如 /app。' },
      port: { type: 'number', description: 'HTTP 端口，1024-65535。' },
      shutdownPort: { type: 'number', description: '关闭端口，必须与 HTTP 端口不同。' },
      buildCommand: { type: 'string', description: '启动前的构建命令，例如 ant -f build.xml compile；构建失败不会启动。' },
      jvmArgs: { type: 'array', items: { type: 'string' }, description: '额外 JVM 参数。' },
    },
  },
};

export function registerTools(ctx, { store }) {
  // 必须用 ctx.get('tools') 而不是 ctx.tools：属性访问要求把 'tools' 写进 inject，
  // 而本插件只在 web/宿主面需要工具 —— 用 get() 就能在缺少工具运行时照样加载插件本体。
  const tools = ctx.get('tools');
  if (tools === undefined) throw new Error('工具运行时不可用（ctx.get("tools") 为空）。');
  tools.register(
    defineTool({
      name: 'run_env_get',
      description:
        '读取一个工作区当前的运行配置与可用的开发环境（id、种类、版本、路径）。' +
        '在为本项目生成或修改启动配置之前，先用它了解现状：已有配置、可绑定的环境 id、项目级/全局默认绑定。',
      parameters: {
        workspacePath: { type: 'string', description: '工作区根目录的绝对路径；省略时用当前会话的工作目录。' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      presentCall: () => ({ card: 'generic', kind: 'read', title: '读取运行配置' }),
      execute: async (args, exec) => {
        const root = requireRoot(exec, args?.workspacePath);
        const data = store.list();
        const workspace = store.findWorkspace(root);
        return {
          workspacePath: root,
          environments: data.environments.map((environment) => ({
            id: environment.id,
            kind: environment.kind,
            name: environment.name,
            version: environment.version,
            path: environment.path,
          })),
          globalDefaults: data.defaults,
          projectBindings: { ...emptyBindings(), ...(workspace?.bindings ?? {}) },
          configurations: workspace?.configurations ?? [],
          note: '配置保存在 DSH 当前 profile 下，不在项目目录里。用 run_env_save 写回；cwd 用 ${workspaceFolder} 表示项目根。',
        };
      },
    }),
  );

  tools.register(
    defineTool({
      name: 'run_env_save',
      description:
        '把一个工作区的运行配置写入 DSH 的运行环境插件（宿主会校验后保存；校验失败会返回错误，请修正后重试）。' +
        '默认全量替换该工作区的配置列表；只传 mode=merge 时才按 id 合并。不要用它启动或停止服务。',
      parameters: {
        workspacePath: { type: 'string', description: '工作区根目录的绝对路径；省略时用当前会话的工作目录。' },
        mode: { type: 'string', enum: ['replace', 'merge'], description: 'replace（默认）全量替换；merge 按 id 覆盖或追加。' },
        configurations: {
          type: 'array',
          required: true,
          description: '要保存的运行配置列表。每个服务一条独立配置。',
          items: { type: 'object', additionalProperties: false, properties: CONFIGURATION_PROPERTIES },
        },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      presentCall: (args) => ({ card: 'generic', kind: 'write', title: `保存运行配置（${(args?.configurations ?? []).length} 条）` }),
      execute: async (args, exec) => {
        const root = requireRoot(exec, args?.workspacePath);
        const incoming = (Array.isArray(args?.configurations) ? args.configurations : []).map(toConfiguration);
        const workspace = store.findWorkspace(root) ?? { root, bindings: emptyBindings(), configurations: [] };
        const mode = args?.mode === 'merge' ? 'merge' : 'replace';
        const merged =
          mode === 'merge'
            ? [...workspace.configurations.filter((item) => !incoming.some((next) => next.id === item.id)), ...incoming]
            : incoming;
        if (merged.length === 0) throw new Error('配置列表为空：请给出至少一条运行配置。');

        const errors = validateWorkspaceEntry({ configurations: merged });
        if (errors.length > 0) throw new Error(errors.join(' '));

        // 绑定必须指向真实存在的同 kind 环境，否则会在启动时静默失效。
        const byId = new Map(store.list().environments.map((environment) => [environment.id, environment]));
        for (const configuration of merged) {
          for (const kind of ENVIRONMENT_KINDS) {
            const id = configuration.environment[kind];
            if (id === '') continue;
            const environment = byId.get(id);
            if (environment === undefined) throw new Error(`配置「${configuration.id}」绑定的 ${kind} 环境「${id}」不存在。`);
            if (environment.kind !== kind) throw new Error(`配置「${configuration.id}」绑定的 ${kind} 环境「${id}」种类不符。`);
          }
        }

        await store.saveWorkspace(root, { ...workspace, configurations: merged });
        return {
          workspacePath: root,
          mode,
          saved: merged.map((configuration) => configuration.id),
          note: '已保存。用户可在右侧栏「运行」里一键启动。',
        };
      },
    }),
  );
}
