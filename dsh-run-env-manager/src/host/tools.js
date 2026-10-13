/**
 * 提供给 AI 的工具：运行配置的读写 + **运行实例的启停与日志**。
 *
 * 为什么需要工具而不是文件：运行配置按设计存在 profile 下（用户要求 profile 独立），
 * 不在项目目录里，所以 agent 无法用文件工具直接写。配置类工具就是它的写入口。
 *
 * 实例类工具为什么必须存在（用户提的原话）：agent 测试时会**自己用 bash 起一个后台服务**，
 * 于是同一个服务被起了两遍、端口打架、日志分叉。给它「看一眼已有实例 → 用它 / 起一个 →
 * 读它的输出 → 停掉」这条路，加上每轮注入的实例上下文（见 src/host/agent-context.js），
 * 它就没有理由再自己起。
 *
 * 所有实例操作都走 `src/host/operations.js` —— 与面板按钮**同一份实现**
 * （DSH 插件开发约定：one operation, two callers）；本插件对模型的启停不设审批闸门。
 *
 * 可见性：宿主行（profile 根）注册的工具会进入 ToolRuntime 的「全局层」，
 * 被所有 preset 的所有 agent 看见 —— 不需要改任何 preset（web surface 之所以逐行
 * disabled 掉 tool-bash 等行，正是因为「全局注册 = 所有 preset 可见」）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { ENVIRONMENT_KINDS, emptyBindings, validateWorkspaceEntry } from './contract.js';
import { WAIT_DEFAULT_MS, WAIT_MAX_MS, isLive, liveRunsOf, logTail, runsOf, runState, startRun, stopRun, waitForRun } from './operations.js';

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

/** 启动成功后的那句说明：就绪地址、还在起、还是压根没配就绪检测。 */
function startNote(state, readyWhenUrl) {
  if (state.url !== '') return `已启动并就绪：${state.url}。直接连这个地址测试，不要再用 bash 起后台服务。`;
  if (readyWhenUrl === '') return '已启动。这个配置没有配就绪检测地址，所以只能看日志判断是否起来了：用 run_env_log 的 waitForText 等它打印出监听地址。';
  return '已启动，就绪检测还没通过：用 run_env_log 的 waitForReady 等它，或直接看日志尾部。';
}

export function registerTools(ctx, { store, registry, logTailChars }) {
  // 必须用 ctx.get('tools') 而不是 ctx.tools：属性访问要求把 'tools' 写进 inject，
  // 而本插件只在 web/宿主面需要工具 —— 用 get() 就能在缺少工具运行时照样加载插件本体。
  const tools = ctx.get('tools');
  if (tools === undefined) throw new Error('工具运行时不可用（ctx.get("tools") 为空）。');
  tools.register(
    defineTool({
      name: 'run_env_get',
      description:
        '读取一个工作区当前的运行配置、可用的开发环境（id、种类、版本、路径），以及**运行实例的实时状态**' +
        '（启动中/运行中/就绪/已停止、就绪地址、退出码、已跑时长）。' +
        '在为本项目生成或修改启动配置之前先用它了解现状；**开始测试之前也先用它**：' +
        '用户可能已经在右侧栏把服务起好了，直接连那个地址，不要再用 bash 起后台服务。',
      parameters: {
        workspacePath: { type: 'string', description: '工作区根目录的绝对路径；省略时用当前会话的工作目录。' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      presentCall: () => ({ card: 'generic', kind: 'read', title: '读取运行配置与实例状态' }),
      execute: async (args, exec) => {
        const root = requireRoot(exec, args?.workspacePath);
        const data = store.list();
        const workspace = store.findWorkspace(root);
        const runs = runsOf(registry, root);
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
          runs,
          liveRuns: liveRunsOf(registry, root).length,
          note:
            '配置保存在 DSH 当前 profile 下，不在项目目录里。用 run_env_save 写回；cwd 用 ${workspaceFolder} 表示项目根。' +
            '实例由本插件管理：启动/停止用 run_env_instance，读某个实例的输出用 run_env_log；' +
            '面板右侧栏「运行」里能看到同一批实例与日志。',
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

  tools.register(
    defineTool({
      name: 'run_env_instance',
      description:
        '启动或停止一个运行配置的实例（与用户在右侧栏点同一个按钮，走完全相同的环境绑定与启动方式）。' +
        'start 是幂等的：已经在跑就直接把它返回给你，不会起第二遍——要测一个服务时用它，' +
        '不要再用 bash 起后台进程。stop 会收掉整个进程树（Windows 上由 Job 容器保证）。' +
        '返回状态、就绪地址与最近的日志尾部，起完可以直接连地址做测试。',
      parameters: {
        workspacePath: { type: 'string', description: '工作区根目录的绝对路径；省略时用当前会话的工作目录。' },
        action: { type: 'string', enum: ['start', 'stop'], required: true, description: 'start 启动（已跑则原样返回）；stop 停止。' },
        id: { type: 'string', required: true, description: '运行配置 id，见 run_env_get 的 configurations[].id。' },
        logTailChars: { type: 'number', description: 'start 成功后回带的日志尾部字符数，默认 4000，上限 40000。' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      presentCall: (args) => ({
        card: 'generic',
        kind: 'write',
        title: `${args?.action === 'stop' ? '停止' : '启动'}运行实例 ${typeof args?.id === 'string' ? args.id : ''}`.trim(),
      }),
      execute: async (args, exec) => {
        const root = requireRoot(exec, args?.workspacePath);
        const id = typeof args?.id === 'string' ? args.id.trim() : '';
        if (id === '') throw new Error('缺少要操作的运行配置 id（见 run_env_get 的 configurations[].id）。');
        const action = args?.action === 'stop' ? 'stop' : 'start';
        const tailChars = Math.max(0, Math.min(40000, Math.trunc(Number(args?.logTailChars)) || 4000));

        if (action === 'stop') {
          const run = await stopRun({ registry, root, id });
          return { workspacePath: root, action, run: runState(run), note: '已停止。' };
        }

        const configured = store.findWorkspace(root)?.configurations.find((item) => item.id === id);
        const readyWhenUrl = String(configured?.readyWhen?.url ?? '');
        // 幂等：已经在跑时 registry.start 直接把它还回来，这里如实告诉模型，避免它以为「又起了一个」。
        const before = registry.get(root, id);
        const alreadyRunning = before !== undefined && isLive(before);
        const started = await startRun({ ctx, registry, store, root, id, logTailChars });
        const state = runState(started);
        const tail = tailChars === 0 ? { text: '', truncated: false, totalChars: 0 } : logTail(started, tailChars);
        return {
          workspacePath: root,
          action,
          alreadyRunning,
          run: state,
          url: state.url,
          logTail: tail.text,
          logTailTruncated: tail.truncated,
          note: alreadyRunning
            ? '该实例本来就在跑，没有重复启动。'
            : startNote(state, readyWhenUrl),
        };
      },
    }),
  );

  tools.register(
    defineTool({
      name: 'run_env_log',
      description:
        '读一个运行实例的输出（尾部，已剥掉终端颜色码），可选等到某个条件成立再返回：' +
        'waitForReady 等它变成就绪，waitForText 等日志里出现某段文字（例如 "listening on"、报错关键字）。' +
        '用它代替「sleep 一会儿再猜」：实例已经退出、就绪、或命中文字时会立刻返回，超时也会明确说。',
      parameters: {
        workspacePath: { type: 'string', description: '工作区根目录的绝对路径；省略时用当前会话的工作目录。' },
        id: { type: 'string', required: true, description: '运行配置 id，见 run_env_get 的 configurations[].id。' },
        tailChars: { type: 'number', description: '回带的日志尾部字符数，默认 8000，上限 60000。' },
        waitForReady: { type: 'boolean', description: '为 true 时等到状态变成「就绪」（需要配置里配了 readyWhenUrl；没配就直接返回并说明）。' },
        waitForText: { type: 'string', description: '等到日志里出现这段文字为止（区分大小写）。' },
        timeoutMs: { type: 'number', description: `等待上限毫秒，默认 ${WAIT_DEFAULT_MS}，上限 ${WAIT_MAX_MS}。` },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      presentCall: (args) => ({ card: 'generic', kind: 'read', title: `读取实例日志 ${typeof args?.id === 'string' ? args.id : ''}`.trim() }),
      execute: async (args, exec) => {
        const root = requireRoot(exec, args?.workspacePath);
        const id = typeof args?.id === 'string' ? args.id.trim() : '';
        if (id === '') throw new Error('缺少要读取的运行配置 id（见 run_env_get 的 configurations[].id）。');
        const tailChars = Math.max(200, Math.min(60000, Math.trunc(Number(args?.tailChars)) || 8000));
        const configured = store.findWorkspace(root)?.configurations.find((item) => item.id === id);
        const readyWhenUrl = String(configured?.readyWhen?.url ?? '');
        // 「没配就绪检测」时等 waitForReady 必然等到超时：不浪费这一轮时间，直接说明。
        const wanted = typeof args?.waitForText === 'string' && args.waitForText !== ''
          || args?.waitForReady === true && readyWhenUrl !== '';

        const waited = wanted
          ? await waitForRun(registry, root, id, { waitForReady: args?.waitForReady === true, waitForText: args?.waitForText, timeoutMs: args?.timeoutMs })
          : undefined;
        const run = waited?.run ?? registry.get(root, id);
        if (run === undefined) throw new Error(`工作区里没有运行实例「${id}」（先用 run_env_instance 或 run_env_get 看看）。`);

        const tail = logTail(run, tailChars);
        const state = runState(run);
        const waiting = waited === undefined
          ? {}
          : {
              waitedMs: waited.waitedMs,
              matched: waited.matched,
              ready: waited.ready,
              settled: waited.settled,
              timedOut: waited.timedOut,
            };
        return {
          workspacePath: root,
          id,
          ...state,
          ...waiting,
          log: tail.text,
          logTruncated: tail.truncated,
          logTotalChars: tail.totalChars,
          note: args?.waitForReady === true && readyWhenUrl === ''
            ? '这个配置没有配就绪检测地址（readyWhenUrl），所以等「就绪」没有意义：看日志里的监听地址，或用 waitForText 等它打印出来。'
            : waited !== undefined && waited.timedOut
              ? `等待超时（${waited.waitedMs}ms）：条件还没成立。上面的状态与日志就是此刻的事实。`
              : state.status === 'ready' && state.url !== ''
                ? `实例就绪：${state.url}。`
                : '',
        };
      },
    }),
  );
}
