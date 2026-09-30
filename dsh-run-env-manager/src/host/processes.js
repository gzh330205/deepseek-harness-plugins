/**
 * 运行实例注册表：启动、停止、日志采集、就绪探测。
 *
 * 几个来自 DSH 宿主的硬约束决定了这里的写法：
 *   1. `ctx.subprocess` 的 handle **没有 pid**，所以实例身份只能是「工作区 + 配置 id」
 *      这个键，停止只能 `terminate()`。也因此本插件管不了别处已跑着的进程。
 *   2. Windows 上 `npm`/`pnpm` 是 .cmd 垫片，Job runner 只解析 .com/.exe，所以 .cmd
 *      目标必须包一层 `cmd.exe /d /s /c`；但「命令里带引号」会让这层包装坏掉，
 *      因此能直接跑的就直接跑——见下面 planCommand 的注释（POSIX 走 `bash -c`）。
 *   3. 输出**必须用 `stdio: 'pipe'` 自己解码**，不能用 collect 模式：collect 的
 *      `readFrom()` 内部是 `buffer.toString('utf8')`（硬编码、非 fatal），中文 Windows 上
 *      Maven/Gradle/老 CLI 写的是 GB18030 字节流，走 collect 必然是一屏 U+FFFD 乱码。
 *      代价是没有了 collect 的 spill 文件，日志只保留内存尾部（logTailChars）。
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeRoot } from './contract.js';

const READY_POLL_INTERVAL_MS = 500;
const GRACE_MS = 3000;
const STOP_WAIT_MS = 15000;

export function runKey(root, id) {
  return `${normalizeRoot(root)}\n${id}`;
}

/* ── 命令怎么交给操作系统（Windows 上的坑都在这里）─────────────────────
 *
 * 只包一层 `cmd.exe /d /s /c` 是**不够**的：Node 在 Windows 上会把每个 argv 元素按
 * 自己的规则加引号、并把内部的 `"` 转义成 `\"`，cmd 再按自己的规则剥一层，于是
 * 「命令里带引号」的写法会被弄坏。真机上量到的结果是：
 *
 *   cmd /d /s /c node.exe -e "process.exit(3)"   → node 收到的是字符串字面量，退出 0（不是 3）
 *   cmd /d /s /c "D:\...\node.exe" -e "..."     → '"D:\...\node.exe"' is not recognized
 *
 * 而这类写法在运行配置里很常见（路径含空格必须加引号、传参常常要引号）。所以：
 *
 *   - 命令里没有 shell 语法，且第一个 token 能解析成真实 .exe/.com
 *     → **自己按引号切成 argv 直接 spawn**，引号交给 Node/libuv 处理（它是为真可执行文件
 *       设计的，结果是正确的）；
 *   - 否则（有 `&&`/`|`/`>`/`%VAR%`，或目标是 npm/pnpm 这种 .cmd 垫片）
 *     → 仍然 `cmd.exe /d /s /c <整条命令>`：DSH 的可执行解析只认 .com/.exe，
 *       .cmd 必须由 shell 来跑。
 *
 * POSIX 侧 `bash -c` 没有这个问题（argv 不做二次引号处理），保持原样。
 * -------------------------------------------------------------------- */

/**
 * 去掉被引号包住的部分（引号内的 `>`、`|`、`=>` 都不是 shell 语法）。
 */
function stripQuoted(command) {
  let text = '';
  let quoted = false;
  let quote = '';
  for (const char of command) {
    if (quoted) {
      if (char === quote) quoted = false;
      continue;
    }
    if (char === '"' || char === "'") {
      quoted = true;
      quote = char;
      continue;
    }
    text += char;
  }
  return { text, balanced: !quoted };
}

/**
 * 有这些字符（**引号外**）就必须交给 shell：管道、串接、重定向、转义符，以及 %VAR% 展开。
 *
 * 只看引号外是必须的：`node -e "console.log('x');setInterval(()=>{},1000)"` 里的 `=>`
 * 曾经被当成重定向、把整条命令推给 cmd，于是引号被弄坏——这正是「裸 node + 引号」跑不起来的原因。
 *
 * @param command - 用户写的命令行
 * @returns 是否必须走 shell
 */
export function hasShellSyntax(command) {
  const { text, balanced } = stripQuoted(command);
  if (!balanced) return true; // 引号不闭合：交给 shell 去报错，别自己猜
  return /[&|<>^]/.test(text) || /%[^%\s]+%/.test(text);
}

/**
 * 把 Windows 命令行按引号规则切成 argv（自行实现，不依赖 shell）。
 * 支持双引号包裹、`\"` 转义；引号本身不进结果。
 *
 * @param command - 用户写的命令行
 * @returns argv 数组（可能为空）
 */
export function tokenizeWindows(command) {
  const tokens = [];
  let current = '';
  let started = false;
  let quoted = false;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === '\\' && command[index + 1] === '"') {
      current += '"';
      started = true;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      started = true;
      continue;
    }
    if (!quoted && /\s/.test(char)) {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += char;
    started = true;
  }
  if (started) tokens.push(current);
  return tokens;
}

/** 只有 .com/.exe 能被直接 CreateProcess（.cmd/.bat 得靠 shell，见上面注释）。 */
function directExecutable(candidate) {
  return /\.(exe|com)$/i.test(candidate) && existsSync(candidate) ? candidate : undefined;
}

/**
 * 解析第一个 token 到真实可执行文件；解析不到（或缺扩展名）就返回 undefined，调用方回落 shell。
 *
 * @param token - 命令的第一个 token
 * @param env - 子进程环境（取 PATH）
 * @returns 绝对路径或 undefined
 */
export function resolveWindowsExecutable(token, env = process.env) {
  if (token === undefined || token === '') return undefined;
  if (/[\\/]/.test(token)) return directExecutable(resolve(token));
  const pathValue = env.PATH ?? env.Path ?? '';
  for (const dir of String(pathValue).split(';').filter((part) => part !== '')) {
    for (const extension of ['.exe', '.com']) {
      const found = directExecutable(resolve(dir, `${token}${extension}`));
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * DSH 的 `scrubbedParentEnv()` 会剥掉所有 `DSH_*` 变量，却保留 PATH；而宿主 PATH 前面就是
 * `resources/runtime/dsh/bin`，那里的 `node.cmd` / `pnpm.cmd` 垫片只有在
 * `DSH_DESKTOP_NODE_EXECUTABLE` 存在时才能工作——否则走 `else node %*` 分支、
 * 又解析回它自己，**自递归后静默退出 1（没有任何输出）**。
 * app 内部 spawn 时正是这么设的（app.asar 注释："the bundled node shim uses it"），
 * 这里照做，把同一份事实显式转发给子进程。
 *
 * 只在能确认「这个 execPath 确实是 node」时才设：
 *   - CLI / headless：process.execPath 就是 node(.exe)；
 *   - 桌面端：process.execPath 是 DSH Desktop.exe，但宿主带着 ELECTRON_RUN_AS_NODE=1，
 *     垫片用它启动即 Node 模式。
 * 两者都不满足就宁可不设，避免让垫片去启动一个 GUI 程序。
 *
 * @param env - 已经算好的子进程环境
 * @param execPath - 当前进程的可执行文件
 * @returns 补过变量的环境（不修改入参）
 */
export function withNodeShim(env, execPath = process.execPath) {
  if (env.DSH_DESKTOP_NODE_EXECUTABLE !== undefined) return env;
  const base = String(execPath ?? '');
  const isNode = /(^|[\\/])node(\.exe)?$/i.test(base);
  const electronNode = String(env.ELECTRON_RUN_AS_NODE ?? '') === '1';
  if (!isNode && !electronNode) return env;
  return { ...env, DSH_DESKTOP_NODE_EXECUTABLE: base };
}

/**
 * 决定一条命令怎么跑。
 *
 * @param command - 用户写的命令行
 * @param platform - 平台
 * @param env - 子进程环境（用于 PATH 解析）
 * @returns `{ argv, via }`：argv 直接交给 `ctx.subprocess.spawn`；via 说明走法，供日志解释
 */
export function planCommand(command, platform = process.platform, env = process.env) {
  if (platform !== 'win32') return { argv: ['bash', '-c', command], via: 'shell' };
  if (hasShellSyntax(command)) return { argv: ['cmd.exe', '/d', '/s', '/c', command], via: 'shell' };
  const tokens = tokenizeWindows(command);
  const executable = resolveWindowsExecutable(tokens[0], env);
  if (executable === undefined) return { argv: ['cmd.exe', '/d', '/s', '/c', command], via: 'shell' };
  // 用解析出来的绝对路径当 argv[0]：DSH 的解析层就不必再猜，含空格的路径也由 Node 正确加引号。
  return { argv: [executable, ...tokens.slice(1)], via: 'direct' };
}

/* ── 输出解码（见文件头注释 3）────────────────────────────────────────── */

function createDecoder() {
  return { pending: Buffer.alloc(0), encoding: 'utf8' };
}

function tryDecode(buffer, encoding, fatal) {
  return new TextDecoder(encoding, fatal ? { fatal: true } : undefined).decode(buffer);
}

/**
 * 增量解码一块字节。UTF-8 优先，跨 chunk 的半字符留在 pending 里等下一块；
 * 判定不是 UTF-8 时整块转 GB18030。
 *
 * 已知边界：**同一路输出里混用两种编码**无法两全 —— GB18030 的字节空间覆盖太广，
 * 一个既有 GBK 又有 UTF-8 的缓冲块按 UTF-8 解不动、按 GB18030 又能解，只能整体按
 * GB18030 走，其中的 UTF-8 部分就成了乱码。真实工具（Maven / Gradle / javac / 现代
 * CLI）一路输出只会有一种编码，所以这里不为此增加逐行嗅探的复杂度。
 */
export function decodeChunk(state, chunk) {
  state.pending = state.pending.length === 0 ? chunk : Buffer.concat([state.pending, chunk]);
  const buffer = state.pending;
  if (buffer.length === 0) return '';

  // 1) 整块是合法 UTF-8 —— 绝大多数现代工具走这里
  try {
    const text = tryDecode(buffer, 'utf-8', true);
    state.pending = Buffer.alloc(0);
    state.encoding = 'utf8';
    return text;
  } catch {
    // 继续往下判
  }

  // 2) UTF-8 但尾部被切断：把末尾 1–3 个字节留到下一块，先输出能解的部分。
  //    上界必须是 `<=`：trim 到 buffer.length 时前缀为空串（必然可解），
  //    表示「整块都是被切断的半字符」，此时应当全部留着等下一块。
  for (let trim = 1; trim <= 3 && trim <= buffer.length; trim += 1) {
    const prefix = buffer.subarray(0, buffer.length - trim);
    try {
      const text = tryDecode(prefix, 'utf-8', true);
      state.pending = Buffer.from(buffer.subarray(prefix.length));
      state.encoding = 'utf8';
      return text;
    } catch {
      // 继续 trim
    }
  }

  // 3) 不是 UTF-8 → 按 GB18030 解（同样保留可能被截断的尾部）
  for (let trim = 0; trim <= 3 && trim <= buffer.length; trim += 1) {
    const prefix = trim === 0 ? buffer : buffer.subarray(0, buffer.length - trim);
    try {
      const text = tryDecode(prefix, 'gb18030', true);
      state.pending = Buffer.from(buffer.subarray(prefix.length));
      state.encoding = 'gb18030';
      return text;
    } catch {
      // 继续 trim
    }
  }

  // 4) 不足 4 字节时先别下结论：GB18030 与 UTF-8 的单字符最多 4 字节，这点数据
  //    可能只是被切断的半字符，等下一块再判（收尾时由 flushDecoder 兜底）。
  if (buffer.length < 4) return '';

  // 5) 两种编码都解不动：按上次判定的编码松解，别让字节永久卡在缓冲里
  const text = tryDecode(buffer, state.encoding === 'gb18030' ? 'gb18030' : 'utf-8', false);
  state.pending = Buffer.alloc(0);
  return text;
}

/** 进程结束时把残留字节解掉（此时不可能再等到后续字节）。 */
export function flushDecoder(state) {
  if (state.pending.length === 0) return '';
  const text = tryDecode(state.pending, state.encoding === 'gb18030' ? 'gb18030' : 'utf-8', false);
  state.pending = Buffer.alloc(0);
  return text;
}

/* 注：ANSI 转义**不在这里剥离**。日志保留原始序列，由面板渲染成颜色
 * （见 src/client/ansi.js）：宿主侧剥掉就再也画不出颜色了。给 AI 的纯文本
 * 在客户端构造提示词时再转（agent.ts 用 plainText()）。 */

export class RunRegistry {
  constructor(ctx) {
    this.ctx = ctx;
    this.runs = new Map();
    /** 按工作区串行化：连点启动不会起两个进程，一个服务卡住也不阻塞别的服务。 */
    this.locks = new Map();
  }

  /** 唯一的启停入口：同工作区的操作排成一条链。 */
  control(root, task) {
    const key = normalizeRoot(root);
    const previous = this.locks.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    this.locks.set(key, next.catch(() => {}));
    return next;
  }

  get(root, id) {
    return this.runs.get(runKey(root, id));
  }

  list() {
    return [...this.runs.values()].map((run) => publicRun(run));
  }

  appendLog(run, text, logTailChars) {
    if (text === '') return;
    run.log += text;
    if (run.log.length > logTailChars) {
      const dropped = run.log.length - logTailChars;
      run.log = run.log.slice(dropped);
      run.base += dropped; // 绝对偏移：SSE 客户端据此续读，截断也不会错位
    }
    this.notify(run);
  }

  notify(run) {
    for (const listener of run.listeners) listener();
  }

  decoderFor(run, key) {
    if (run.decoders[key] === undefined) run.decoders[key] = createDecoder();
    return run.decoders[key];
  }

  /** 把一路输出接上解码器：pipe 模式是推送式的，不再需要轮询读取。 */
  attachStream(stream, run, key) {
    if (stream === undefined || stream === null) return;
    stream.on('data', (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      const text = decodeChunk(this.decoderFor(run, key), bytes);
      if (text !== '') this.appendLog(run, text, run.logTailChars);
    });
  }

  /** 收尾：把所有解码器里残留的半字符解出来，否则最后几个字节会丢。 */
  flushDecoders(run) {
    for (const [key, decoder] of Object.entries(run.decoders)) {
      const text = flushDecoder(decoder);
      if (text !== '') this.appendLog(run, text, run.logTailChars);
    }
  }

  async start({ root, configuration, env, cwd, logTailChars, plan }) {
    const existing = this.get(root, configuration.id);
    if (existing !== undefined && ['starting', 'running', 'ready', 'stopping'].includes(existing.status)) {
      return existing; // 幂等：已在运行就不重复启动
    }
    const run = {
      id: configuration.id,
      name: configuration.name,
      root,
      command: configuration.type === 'tomcat' ? `tomcat ${configuration.tomcat?.contextPath ?? '/'}` : configuration.command,
      cwd,
      status: 'starting',
      exitCode: null,
      error: undefined,
      url: undefined,
      log: '',
      base: 0,
      logTailChars,
      decoders: {},
      listeners: new Set(),
      handle: undefined,
      readyTimer: undefined,
      probeStarted: false,
      gracefulStop: plan?.gracefulStop,
      release: plan?.release,
      startedAt: Date.now(),
    };
    this.runs.set(runKey(root, configuration.id), run);

    // Tomcat 的构建阶段：构建失败**不启动**服务（对齐参考项目的行为）。
    if (plan?.buildCommand !== undefined && plan.buildCommand !== '') {
      const code = await this.runBuild(run, plan.buildCommand, cwd, env);
      if (code !== 0) {
        run.status = 'failed';
        run.exitCode = code;
        run.error = `构建失败（退出码 ${code}），未启动服务。`;
        this.appendLog(run, `\n[run-env-manager] ${run.error}\n`, logTailChars);
        this.finish(run);
        return run;
      }
    }

    const launched = plan?.argv !== undefined
      ? { argv: plan.argv, via: 'direct' }
      : planCommand(configuration.command, process.platform, env);
    if (launched.via === 'shell' && plan?.argv === undefined) {
      // 让日志自己解释「为什么这条命令是被 cmd 包着跑的」——含引号的命令在这里有已知限制。
      this.appendLog(run, `[run-env-manager] 经 cmd.exe 执行：${configuration.command}\n`, logTailChars);
    }

    try {
      run.handle = this.ctx.subprocess.spawn({
        argv: launched.argv,
        cwd,
        stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
        graceMs: GRACE_MS,
        env: withNodeShim(env),
      });
    } catch (error) {
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : String(error);
      this.appendLog(run, `${run.error}\n`, logTailChars);
      return run;
    }

    run.status = 'running';
    this.attachStream(run.handle.stdout, run, 'mainOut');
    this.attachStream(run.handle.stderr, run, 'mainErr');
    this.startReadiness(run, configuration);

    run.handle.done.then(
      (outcome) => {
        run.exitCode = outcome.exitCode;
        run.status = run.status === 'stopping' || outcome.exitCode === 0 ? 'stopped' : 'failed';
        this.finish(run);
      },
      (error) => {
        run.status = 'failed';
        run.error = error instanceof Error ? error.message : String(error);
        this.appendLog(run, `${run.error}\n`, logTailChars);
        this.finish(run);
      },
    );
    return run;
  }

  /**
   * 跑构建命令（Tomcat 的 buildCommand），把输出并进同一个日志流。
   * 构建是有界命令，等它结束再看退出码；失败由调用方决定不启动服务。
   * 用独立的解码器：构建输出与主进程输出是两个流，混用一个解码器会互相污染缓冲。
   */
  async runBuild(run, command, cwd, env) {
    this.appendLog(run, `\n[run-env-manager] 构建：${command}\n`, run.logTailChars);
    let handle;
    try {
      handle = this.ctx.subprocess.spawn({
        argv: planCommand(command, process.platform, env).argv,
        cwd,
        stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
        graceMs: GRACE_MS,
        env: withNodeShim(env),
      });
    } catch (error) {
      this.appendLog(run, `构建启动失败：${error instanceof Error ? error.message : String(error)}\n`, run.logTailChars);
      return -1;
    }
    this.attachStream(handle.stdout, run, 'buildOut');
    this.attachStream(handle.stderr, run, 'buildErr');
    try {
      const outcome = await handle.done;
      for (const key of ['buildOut', 'buildErr']) {
        if (run.decoders[key] === undefined) continue;
        const text = flushDecoder(run.decoders[key]);
        if (text !== '') this.appendLog(run, text, run.logTailChars);
      }
      return outcome.exitCode ?? -1;
    } catch (error) {
      this.appendLog(run, `构建失败：${error instanceof Error ? error.message : String(error)}\n`, run.logTailChars);
      return -1;
    }
  }

  /** 就绪探测：命中即 ready；超时只提示，**不杀进程**（服务可能仍在正常启动）。 */
  startReadiness(run, configuration) {
    const url = configuration.readyWhen?.url;
    if (typeof url !== 'string' || url === '' || run.probeStarted) return;
    run.probeStarted = true;
    const timeoutMs = Number.isFinite(Number(configuration.readyWhen?.timeoutMs))
      ? Math.min(300000, Math.max(1000, Number(configuration.readyWhen.timeoutMs)))
      : 60000;
    const deadline = Date.now() + timeoutMs;
    const tick = async () => {
      if (run.status !== 'running' && run.status !== 'ready') return;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (response.ok) {
          run.status = 'ready';
          run.url = url;
          this.appendLog(run, `\n[run-env-manager] 已就绪：${url}\n`, run.logTailChars);
          this.stopReadiness(run);
          return;
        }
      } catch {
        // 还没起来，继续探。
      }
      if (Date.now() >= deadline) {
        this.appendLog(run, `\n[run-env-manager] 就绪检测超时（${timeoutMs}ms），进程仍在运行，请检查日志。\n`, run.logTailChars);
        this.stopReadiness(run);
      }
    };
    run.readyTimer = setInterval(() => void tick(), READY_POLL_INTERVAL_MS);
    run.readyTimer.unref?.();
  }

  stopReadiness(run) {
    if (run.readyTimer !== undefined) clearInterval(run.readyTimer);
    run.readyTimer = undefined;
  }

  finish(run) {
    this.stopReadiness(run);
    this.flushDecoders(run);
    this.notify(run);
    this.ctx.logger?.info?.(`run-env-manager: ${run.id} → ${run.status}${run.exitCode === null ? '' : ` (exit ${run.exitCode})`}`);
  }

  async stop(root, id) {
    const run = this.get(root, id);
    if (run === undefined) return undefined;
    if (run.handle !== undefined && !['stopped', 'failed'].includes(run.status)) {
      run.status = 'stopping';
      // Tomcat 先走优雅关闭（shutdown 端口 + 随机 token）；5 秒宽限后再强杀进程树。
      // terminate() 在受管范围已空时是 no-op，所以后面无条件调用是安全的。
      if (typeof run.gracefulStop === 'function') {
        try {
          await Promise.race([run.gracefulStop(), new Promise((resolvePromise) => setTimeout(resolvePromise, 5000))]);
        } catch {
          this.appendLog(run, '\n[run-env-manager] 优雅关闭失败，改为强制终止。\n', run.logTailChars);
        }
      }
      run.handle.terminate(); // Job 容器负责整棵树
      try {
        await Promise.race([
          run.handle.waitForExit(),
          new Promise((resolvePromise) => setTimeout(resolvePromise, STOP_WAIT_MS)),
        ]);
      } catch (error) {
        run.error = error instanceof Error ? error.message : String(error);
      }
    }
    this.stopReadiness(run);
    if (run.status === 'stopping') run.status = 'stopped';
    this.flushDecoders(run);
    // 实例目录（CATALINA_BASE）随停止一起清掉：下次启动会重新生成。
    run.release?.();
    this.notify(run);
    return run;
  }

  /** 插件卸载（含宿主有序退出）时收掉所有实例；强杀场景由 Job 容器兜底。 */
  disposeAll() {
    for (const run of this.runs.values()) {
      this.stopReadiness(run);
      run.handle?.terminate();
      run.release?.();
    }
  }
}

function publicRun(run) {
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
    /** 绝对字符偏移，客户端续读日志用。 */
    offset: run.base + run.log.length,
    base: run.base,
    log: run.log,
  };
}
