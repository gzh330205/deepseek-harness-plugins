/**
 * 运行实例的共享操作层：**面板（HTTP 路由）与 agent 工具都调这里**。
 *
 * DSH 的插件开发约定是「一个操作、两个调用方」（`cordis-plugin-development` 技能的
 * references/user-actions.md）：同一件事只允许有一份实现，UI 动作与 agent 工具都调它，
 * 否则两条路会在环境绑定、Tomcat 计划、日志尾部这些细节上慢慢分叉。
 *
 * 这里只放「与调用方无关」的部分：启动前组装（prepareRun）、实例投影、等待、上下文文案。
 * 谁触发（按钮还是模型）由调用方决定；本插件对两者都不设审批闸门。
 */
import { statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { plainText } from '../shared/ansi.js';
import { expandCwd, normalizeRoot, resolveBindings } from './contract.js';
import { buildRunEnvironment, executableFor } from './environment.js';
import { checkPort, inspectTomcatHome, prepareTomcat, releaseInstance } from './tomcat.js';

/** 运行实例的默认等待上限与轮询间隔（工具与测试都按这个来）。 */
export const WAIT_DEFAULT_MS = 20000;
export const WAIT_MAX_MS = 120000;
const WAIT_POLL_MS = 200;

/** 启动前的环境组装：三层绑定 → 子进程 env + （Tomcat 时）托管启动计划。 */
export async function prepareRun(store, root, configuration) {
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

  // ── Tomcat：独立 CATALINA_BASE + 端口检查 + 构建命令 ─────────────────
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
}

/** 同一个工作区判定：Windows 上大小写与斜杠都要归一。 */
function sameRoot(left, right) {
  return normalizeRoot(left) === normalizeRoot(right);
}

/** 面板/工具共用的实例投影（不含日志正文——日志按需走 /log、SSE 或 run_env_log）。 */
export function runState(run, now = Date.now()) {
  return {
    id: run.id,
    name: run.name,
    root: run.root,
    command: run.command,
    cwd: run.cwd,
    status: run.status,
    ready: run.status === 'ready',
    exitCode: run.exitCode,
    error: run.error ?? null,
    url: run.url ?? '',
    startedAt: run.startedAt,
    elapsedMs: run.startedAt === undefined ? 0 : Math.max(0, now - run.startedAt),
    logChars: run.log.length,
  };
}

/** 某个工作区的全部实例（含已停止/失败的历史条目，与面板一致）。 */
export function runsOf(registry, root) {
  return registry
    .list()
    .filter((run) => sameRoot(run.root, root))
    .map((run) => runState(run));
}

/** 某个工作区里「还活着」的实例——上下文注入只关心这些。 */
export function liveRunsOf(registry, root) {
  return registry.list().filter((run) => sameRoot(run.root, root) && isLive(run));
}

const LIVE_STATUSES = new Set(['starting', 'running', 'ready', 'stopping']);

export function isLive(run) {
  return LIVE_STATUSES.has(run.status);
}

/**
 * 启动一个已配置的实例。返回 registry 的 run 对象（调用方自己投影/取日志）。
 * 与面板按钮走的是同一条路：环境组装、警告写进日志、实例登记全在这里。
 */
export async function startRun({ ctx, store, registry, root, id, logTailChars }) {
  const workspace = store.findWorkspace(root);
  const configuration = workspace?.configurations.find((item) => item.id === id);
  if (configuration === undefined) throw new Error(`工作区里没有运行配置「${id}」。`);
  const prepared = await prepareRun(store, root, configuration);
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
    return run;
  });
}

/** 停止一个实例。实例不存在时抛错（调用方决定怎么说给用户/模型听）。 */
export async function stopRun({ registry, root, id }) {
  return registry.control(root, async () => {
    const run = await registry.stop(root, id);
    if (run === undefined) throw new Error(`工作区里没有运行实例「${id}」。`);
    return run;
  });
}

/** 日志尾部（已剥掉终端颜色码，模型不需要 `ESC[32m`）。 */
export function logTail(run, tailChars) {
  const limit = Math.max(200, Math.min(200000, Math.trunc(tailChars) || 8000));
  const text = plainText(run.log ?? '');
  return { text: text.length > limit ? text.slice(-limit) : text, truncated: text.length > limit, totalChars: text.length };
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * 等到「就绪 / 日志里出现某段文字 / 进程停下 / 超时」为止。工具用它替掉
 * 「让模型自己 sleep 再轮询」——那既慢又容易漏掉已经退出的事实。
 *
 * @returns `{ run, matched, ready, settled, timedOut, waitedMs }`
 */
export async function waitForRun(registry, root, id, options = {}) {
  const timeoutMs = Math.max(0, Math.min(WAIT_MAX_MS, Math.trunc(options.timeoutMs) || WAIT_DEFAULT_MS));
  const pattern = typeof options.waitForText === 'string' && options.waitForText !== '' ? options.waitForText : undefined;
  const wantReady = options.waitForReady === true;
  const started = Date.now();
  const deadline = started + timeoutMs;
  let run = registry.get(root, id);
  if (run === undefined) throw new Error(`工作区里没有运行实例「${id}」。`);

  for (;;) {
    const ready = run.status === 'ready';
    const matched = pattern === undefined ? false : plainText(run.log).includes(pattern);
    // 已经停下（成功退出/失败/被停）就不可能再就绪或再打印了，立刻返回，别让模型白等。
    const settled = !isLive(run);
    if (matched || (wantReady && ready) || settled || timeoutMs === 0 || Date.now() >= deadline) {
      return { run, matched, ready, settled, timedOut: !matched && !(wantReady && ready) && !settled && Date.now() >= deadline, waitedMs: Date.now() - started };
    }
    await sleep(Math.min(WAIT_POLL_MS, Math.max(0, deadline - Date.now())));
    run = registry.get(root, id);
    if (run === undefined) throw new Error(`运行实例「${id}」在等待期间消失。`);
  }
}

/** 已跑时长的短写（3s / 4m / 2h），只用于给模型看的一行摘要。 */
export function shortElapsed(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

/**
 * 「这个工作区现在有什么在跑」的一行摘要，喂给每轮的动态上下文。
 *
 * 两个刻意的选择：
 *  - **空就返回空串**：systemPrompt 的 renderContextSections 会过滤掉空文本，所以
 *    没有实例时这段上下文完全不出现，不占一个字的 prompt；
 *  - **只在有实例时说话**：上下文不是状态面板，它的任务是拦住「agent 又自己起一个」。
 */
export function renderRunningContext(registry, root, options = {}) {
  const live = liveRunsOf(registry, root);
  if (live.length === 0) return '';
  const max = Math.trunc(options.maxInstances) > 0 ? Math.trunc(options.maxInstances) : 6;
  const now = Date.now();
  const shown = live.slice(0, max).map((run) => {
    const state = runState(run, now);
    const where = state.url === '' ? '' : ` · ${state.url}`;
    return `${state.id}（${state.status}${where} · 已跑 ${shortElapsed(state.elapsedMs)}）`;
  });
  const rest = live.length > shown.length ? `，另有 ${live.length - shown.length} 个` : '';
  return [
    `[run-env-manager] 本工作区已有运行中的实例：${shown.join('；')}${rest}。`,
    '测试请直接连这些实例（有地址的用它的地址），不要用 bash 再起一个后台服务；需要新的服务用 run_env_instance 启动，',
    '看输出用 run_env_log。用户在右侧栏「运行」里能看到同样的实例与日志。',
  ].join('');
}
