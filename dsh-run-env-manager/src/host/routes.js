/**
 * 宿主 HTTP 接口：单一前缀 + action 判别。
 *
 * 照搬参考项目 `packages/contracts/src/launch.ts` 的形状约定：
 * **每个动作都回全量快照**（环境库 + 全局默认 + 该工作区配置 + 运行实例），
 * 客户端不做增量推导，也就不需要在多标签之间对账。
 *
 * 门禁：只在本机绑定下注册；写操作要求同源浏览器请求（与 dsh-workspace-category-manager 一致）。
 */
import { statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { detectEnvironments, buildRunEnvironment, executableFor, validateEnvironment as probeEnvironment } from './environment.js';
import { checkPort, inspectTomcatHome, prepareTomcat, releaseInstance } from './tomcat.js';
import {
  ENVIRONMENT_KINDS,
  emptyBindings,
  expandCwd,
  mergeDetectedEnvironments,
  resolveBindings,
  validateLibrary,
  validateWorkspaceEntry,
} from './contract.js';

export const ROUTE = '/dsh-run-env';
const MAX_BODY_BYTES = 256 * 1024;

function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isLoopbackHost(host) {
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]' || name === '::1';
}

function assertSameOrigin(req, writes) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) throw new Error('运行环境接口只允许本机访问。');
  const host = req.headers.host;
  if (typeof host !== 'string' || !isLoopbackHost(host)) throw new Error('请求来源不受信任。');
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) throw new Error('请求来源不受信任。');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new Error('请求来源不受信任。');
  if (writes && origin === undefined) throw new Error('该操作需要同源浏览器请求。');
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
  });
  res.end(JSON.stringify(value));
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('请求体过大。');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('请求体必须是对象。');
    return parsed;
  } catch {
    throw new Error('请求体不是合法 JSON。');
  }
}

function asString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`缺少字段 ${field}。`);
  return value;
}

function requireEnvironmentKinds(bindings) {
  const cleaned = { ...emptyBindings() };
  for (const [kind, id] of Object.entries(bindings ?? {})) {
    if (!ENVIRONMENT_KINDS.includes(kind)) continue;
    if (typeof id === 'string' && id !== '') cleaned[kind] = id;
  }
  return cleaned;
}

export function installRoutes(ctx, { store, registry, logTailChars }) {
  if (ctx.webServer.host !== '127.0.0.1') {
    ctx.logger?.warn?.('run-env-manager: 运行环境接口已禁用，因为 Web 未绑定 127.0.0.1');
    return;
  }

  const snapshotFor = (root) => {
    const data = store.list();
    const workspace = typeof root === 'string' && root !== '' ? store.findWorkspace(root) : undefined;
    return {
      ok: true,
      platform: process.platform,
      kinds: ENVIRONMENT_KINDS,
      library: { environments: data.environments, defaults: data.defaults },
      workspace:
        workspace === undefined
          ? undefined
          : { root: workspace.root, bindings: workspace.bindings, configurations: workspace.configurations },
      runs: registry.list(),
    };
  };

  /** 保存前一律先整体校验：坏配置只报错、不落盘，但也不拦住面板打开。 */
  const commitEnvironments = async (environments) => {
    const errors = validateLibrary({ environments, defaults: store.list().defaults });
    if (errors.length > 0) throw new Error(errors.join(' '));
    await store.saveEnvironments(environments);
  };

  const commitWorkspace = async (root, workspace) => {
    const errors = validateWorkspaceEntry(workspace);
    if (errors.length > 0) throw new Error(errors.join(' '));
    await store.saveWorkspace(root, workspace);
  };

  /** 启动前的环境组装：三层绑定 → 子进程 env + （Tomcat 时）托管启动计划。 */
  const prepareRun = async (root, configuration) => {
    const data = store.list();
    const workspace = store.findWorkspace(root);
    const bindings = resolveBindings({
      defaults: data.defaults,
      project: workspace?.bindings,
      configuration: configuration.environment,
    });
    const built = buildRunEnvironment({
      library: { environments: data.environments },
      bindings,
      configuration,
      baseEnv: process.env,
    });
    const cwd = expandCwd(configuration.cwd, root);
    if (!isAbsolute(cwd)) throw new Error(`工作目录必须是绝对路径：${cwd}`);
    let exists = false;
    try {
      exists = statSync(resolve(cwd)).isDirectory();
    } catch {
      exists = false;
    }
    if (!exists) throw new Error(`工作目录不存在或不是目录：${cwd}`);

    if (configuration.type !== 'tomcat') {
      return { env: built.env, cwd, warnings: built.warnings };
    }

    // ── Tomcat：独立 CATALINA_BASE + 端口检查 + 构建命令 ───────────────
    const byId = new Map(data.environments.map((environment) => [environment.id, environment]));
    const tomcatEnvironment = byId.get(bindings.tomcat ?? '');
    const javaEnvironment = byId.get(bindings.java ?? '');
    if (tomcatEnvironment === undefined) throw new Error('请先为项目或本配置选择 Tomcat 环境。');
    if (javaEnvironment === undefined) throw new Error('请先为项目或本配置选择 Java / JDK 环境。');
    // Tomcat 的 path 本身就是 home（启动用 java + bootstrap.jar，不经过 catalina 脚本），
    // 所以这里直接拿路径做结构校验，不走 executableFor。
    const javaExecutable = executableFor(javaEnvironment);
    if (javaExecutable === undefined) throw new Error(`Java 环境「${javaEnvironment.name || javaEnvironment.id}」找不到可执行文件。`);
    const inspected = inspectTomcatHome(String(tomcatEnvironment.path ?? ''));
    if (inspected.ok !== true) throw new Error(inspected.error);
    const tomcatHome = inspected.home;

    const port = Number(configuration.tomcat?.port) || 8080;
    const shutdownPort = Number(configuration.tomcat?.shutdownPort) || 8005;
    for (const candidate of [port, shutdownPort]) {
      if (await checkPort(candidate)) {
        // 只报不动手：本插件不会去关掉别人的服务。
        throw new Error(`端口 ${candidate} 已被占用，请修改运行配置。`);
      }
    }

    const prepared = prepareTomcat({
      root,
      id: configuration.id,
      configuration,
      tomcatHome,
      javaExecutable,
    });
    return {
      env: { ...built.env, ...prepared.env },
      cwd,
      warnings: built.warnings,
      plan: {
        argv: prepared.argv,
        buildCommand: String(configuration.tomcat?.buildCommand ?? '').trim(),
        gracefulStop: prepared.gracefulStop,
        release: () => releaseInstance(root, configuration.id),
      },
    };
  };

  const actions = {
    async saveEnvironment(body) {
      const environment = body.environment;
      if (environment === null || typeof environment !== 'object') throw new Error('缺少环境条目。');
      const current = store.list().environments;
      const next = [...current.filter((item) => item.id !== environment.id), environment];
      await commitEnvironments(next);
      return undefined;
    },
    async removeEnvironment(body) {
      const id = asString(body.id, 'id');
      const current = store.list();
      const next = current.environments.filter((item) => item.id !== id);
      // 顺带清掉指向它的默认绑定与各工作区绑定：留着就是「必然失效的引用」，
      // 而面板的下拉会因为找不到选项而静默显示成「跟随全局默认」——比直接清掉更误导。
      const defaults = { ...current.defaults };
      for (const kind of ENVIRONMENT_KINDS) if (defaults[kind] === id) defaults[kind] = '';
      await commitEnvironments(next);
      await store.saveDefaults(defaults);
      for (const workspace of current.workspaces) {
        const bindings = { ...emptyBindings(), ...workspace.bindings };
        const cleared = ENVIRONMENT_KINDS.some((kind) => {
          if (bindings[kind] !== id) return false;
          bindings[kind] = '';
          return true;
        });
        if (cleared) await store.saveWorkspace(workspace.root, { ...workspace, bindings });
      }
      return undefined;
    },
    async setDefault(body) {
      const kind = asString(body.kind, 'kind');
      if (!ENVIRONMENT_KINDS.includes(kind)) throw new Error(`不支持的开发环境种类「${kind}」。`);
      const id = typeof body.id === 'string' ? body.id : '';
      const defaults = { ...store.list().defaults, [kind]: id };
      const errors = validateLibrary({ environments: store.list().environments, defaults });
      if (errors.length > 0) throw new Error(errors.join(' '));
      await store.saveDefaults(defaults);
      return undefined;
    },
    async validateEnvironment(body) {
      const kind = asString(body.kind, 'kind');
      const checked = await probeEnvironment({ kind, path: String(body.path ?? '') }, { cwd: process.cwd() });
      if (checked.ok !== true) throw new Error(checked.error);
      return { validated: { kind, version: checked.version ?? '', path: checked.path ?? checked.executable ?? body.path } };
    },
    async detect() {
      const found = await detectEnvironments({});
      const merged = mergeDetectedEnvironments({ environments: store.list().environments }, found);
      await commitEnvironments(merged);
      return { detected: found.length };
    },
    async saveBindings(body) {
      const root = asString(body.root, 'root');
      const workspace = store.findWorkspace(root) ?? { root, bindings: emptyBindings(), configurations: [] };
      const bindings = requireEnvironmentKinds(body.bindings);
      const byId = new Map(store.list().environments.map((item) => [item.id, item]));
      for (const [kind, id] of Object.entries(bindings)) {
        if (id === '') continue;
        const environment = byId.get(id);
        if (environment === undefined) throw new Error(`${kind} 选择的环境「${id}」不存在。`);
        if (environment.kind !== kind) throw new Error(`${kind} 选择的环境「${id}」种类不符。`);
      }
      await commitWorkspace(root, { ...workspace, bindings });
      return undefined;
    },
    async saveConfiguration(body) {
      const root = asString(body.root, 'root');
      const configuration = body.configuration;
      if (configuration === null || typeof configuration !== 'object') throw new Error('缺少运行配置。');
      const workspace = store.findWorkspace(root) ?? { root, bindings: emptyBindings(), configurations: [] };
      const next = [
        ...workspace.configurations.filter((item) => item.id !== configuration.id),
        configuration,
      ];
      await commitWorkspace(root, { ...workspace, configurations: next });
      return undefined;
    },
    /** 「编辑 JSON」的落点：整份工作区条目全量替换（校验不过就不落盘）。 */
    async saveWorkspace(body) {
      const root = asString(body.root, 'root');
      const workspace = body.workspace;
      if (workspace === null || typeof workspace !== 'object') throw new Error('缺少工作区配置。');
      await commitWorkspace(root, {
        root,
        bindings: requireEnvironmentKinds(workspace.bindings),
        configurations: Array.isArray(workspace.configurations) ? workspace.configurations : [],
      });
      return undefined;
    },
    async removeConfiguration(body) {
      const root = asString(body.root, 'root');
      const id = asString(body.id, 'id');
      const workspace = store.findWorkspace(root);
      if (workspace === undefined) throw new Error('该工作区还没有运行配置。');
      await commitWorkspace(root, {
        ...workspace,
        configurations: workspace.configurations.filter((item) => item.id !== id),
      });
      return undefined;
    },
    async start(body) {
      const root = asString(body.root, 'root');
      const id = asString(body.id, 'id');
      const workspace = store.findWorkspace(root);
      const configuration = workspace?.configurations.find((item) => item.id === id);
      if (configuration === undefined) throw new Error(`工作区里没有运行配置「${id}」。`);
      const prepared = await prepareRun(root, configuration);
      return registry.control(root, async () => {
        for (const warning of prepared.warnings) ctx.logger?.warn?.(`run-env-manager: ${warning}`);
        const run = await registry.start({
          root,
          configuration,
          env: prepared.env,
          cwd: prepared.cwd,
          plan: prepared.plan,
          logTailChars: logTailChars(),
        });
        for (const warning of prepared.warnings) {
          registry.appendLog(run, `\n[run-env-manager] ${warning}\n`, logTailChars());
        }
        return undefined;
      });
    },
    async stop(body) {
      const root = asString(body.root, 'root');
      const id = asString(body.id, 'id');
      await registry.control(root, async () => {
        const run = await registry.stop(root, id);
        if (run === undefined) throw new Error(`工作区里没有运行实例「${id}」。`);
      });
      return undefined;
    },
  };

  ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
        const path = url.pathname;

        if (req.method === 'GET' && path === `${ROUTE}/status`) {
          assertSameOrigin(req, false);
          return sendJson(res, 200, snapshotFor(url.searchParams.get('root') ?? ''));
        }

        if (req.method === 'GET' && path === `${ROUTE}/stream`) {
          assertSameOrigin(req, false);
          const run = registry.get(url.searchParams.get('root') ?? '', url.searchParams.get('id') ?? '');
          if (run === undefined) return sendJson(res, 404, { ok: false, error: '运行实例不存在。' });
          return openStream(req, res, run, Number(url.searchParams.get('from') ?? '0'));
        }

        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: '方法不允许。' });
        assertSameOrigin(req, true);
        const action = path.slice(ROUTE.length + 1);
        const handler = actions[action];
        if (handler === undefined) return sendJson(res, 404, { ok: false, error: '接口不存在。' });
        const body = await jsonBody(req);
        const extra = await handler(body);
        return sendJson(res, 200, { ...snapshotFor(typeof body.root === 'string' ? body.root : ''), ...(extra ?? {}) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger?.warn?.(`run-env-manager: ${message}`);
        return sendJson(res, 400, { ok: false, error: message });
      }
    },
  });
}

/** SSE：先补发 from 之后的历史，再持续推送增量（偏移量语义，多标签互不吞噬）。 */
function openStream(req, res, run, from) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
  });
  let cursor = Number.isFinite(from) ? from : 0;
  const send = () => {
    const start = Math.max(0, cursor - run.base);
    const text = run.log.slice(start);
    cursor = run.base + run.log.length;
    const { log, ...rest } = publicRunForStream(run);
    res.write(`data: ${JSON.stringify({ ...rest, text })}\n\n`);
  };
  send();
  run.listeners.add(send);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  heartbeat.unref?.();
  const cleanup = () => {
    clearInterval(heartbeat);
    run.listeners.delete(send);
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
  req.on('close', cleanup);
}

/** 流里不带整份日志：正文由 `text` 增量给出，避免每帧都重传全量。 */
function publicRunForStream(run) {
  return {
    id: run.id,
    name: run.name,
    root: run.root,
    command: run.command,
    cwd: run.cwd,
    status: run.status,
    exitCode: run.exitCode,
    error: run.error,
    url: run.url,
    offset: run.base + run.log.length,
    base: run.base,
  };
}
