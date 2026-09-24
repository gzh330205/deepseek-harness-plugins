/**
 * 运行实例注册表：启动、停止、日志采集、就绪探测。
 *
 * 几个来自 DSH 宿主的硬约束决定了这里的写法：
 *   1. `ctx.subprocess` 的 handle **没有 pid**，所以实例身份只能是「工作区 + 配置 id」
 *      这个键，停止只能 `terminate()`。也因此本插件管不了别处已跑着的进程。
 *   2. Windows 上 `npm`/`pnpm` 是 .cmd 垫片，Job runner 只解析 .com/.exe，必须包一层
 *      `cmd.exe /d /s /c`（POSIX 走 `bash -c`）。
 *   3. 输出**必须用 `stdio: 'pipe'` 自己解码**，不能用 collect 模式：collect 的
 *      `readFrom()` 内部是 `buffer.toString('utf8')`（硬编码、非 fatal），中文 Windows 上
 *      Maven/Gradle/老 CLI 写的是 GB18030 字节流，走 collect 必然是一屏 U+FFFD 乱码。
 *      代价是没有了 collect 的 spill 文件，日志只保留内存尾部（logTailChars）。
 */
import { normalizeRoot } from './contract.js';

const READY_POLL_INTERVAL_MS = 500;
const GRACE_MS = 3000;
const STOP_WAIT_MS = 15000;

export function runKey(root, id) {
  return `${normalizeRoot(root)}\n${id}`;
}

/** 把命令包成宿主能执行的 argv（见文件头注释 2）。 */
export function shellArgv(command, platform = process.platform) {
  return platform === 'win32' ? ['cmd.exe', '/d', '/s', '/c', command] : ['bash', '-c', command];
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

    try {
      run.handle = this.ctx.subprocess.spawn({
        argv: plan?.argv ?? shellArgv(configuration.command),
        cwd,
        stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
        graceMs: GRACE_MS,
        env,
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
        argv: shellArgv(command),
        cwd,
        stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
        graceMs: GRACE_MS,
        env,
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
