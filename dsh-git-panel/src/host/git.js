/**
 * git 进程运行器：argv 数组直传（永不过 shell）、字节上限、超时、显式 PATH 兜底。
 *
 * 三条不变量（都踩过坑，改这个文件前务必保留）：
 *  1. **`--no-optional-locks`**：DSH 的 agent 可能正在同一个工作区里跑回合，
 *     普通 `git status` 会尝试刷新 index，撞上 `index.lock` 就整条命令失败。
 *  2. **`--literal-pathspecs`**：面板里的路径来自 git 自己，但形如 `a[1].txt`
 *     的路径会被当成 glob，于是「暂存这一个文件」变成暂存别的文件。
 *  3. **不过 shell**：`execFile`/`spawn` 直传数组，分支名、路径、提交信息都不会
 *     被 shell 解释；这也是不做任何字符串拼接的原因。
 *
 * 只读 + 本地写操作，不跑任何联网子命令（fetch/pull/push 一律不提供），
 * 因此不需要也不接触任何凭据。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_TIMEOUT_MS = 20000;
/** 单条命令的默认输出上限（超过就截断并终止子进程）。 */
export const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

/** 每个 git 调用都带上的全局参数。 */
export const BASE_ARGS = [
  '--no-optional-locks',
  '--literal-pathspecs',
  '-c',
  'core.quotepath=false',
  '-c',
  'i18n.logOutputEncoding=UTF-8',
  '-c',
  'color.ui=false',
  '-c',
  'advice.detachedHead=false',
];

/** 子进程环境：绝不弹交互式提示，绝不打开编辑器/分页器。 */
export function gitEnv(env = process.env) {
  return {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    GIT_EDITOR: 'true',
  };
}

/**
 * 定位 git 可执行文件。Windows 上从 GUI 启动的进程常常没有 Git 的 bin 目录在
 * PATH 里，所以除了 PATH 还要探测几个常规安装位置。
 * @param configured - 配置里显式指定的路径（优先）。
 * @param options - 便于测试注入 `platform` / `env` / `exists`。
 */
export function resolveGitPath(configured, options = {}) {
  const explicit = String(configured ?? '').trim();
  if (explicit !== '') return explicit;
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  if (platform === 'win32') {
    const roots = [env.ProgramFiles, env.ProgramW6432, env['ProgramFiles(x86)'], env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Programs') : ''];
    for (const root of roots) {
      if (typeof root !== 'string' || root === '') continue;
      for (const relative of ['Git/cmd/git.exe', 'Git/bin/git.exe', 'Git/mingw64/bin/git.exe']) {
        const candidate = join(root, relative);
        if (exists(candidate)) return candidate;
      }
    }
  }
  return 'git';
}

export class GitError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'GitError';
    this.args = detail.args ?? [];
    this.code = detail.code ?? null;
    this.stdout = detail.stdout ?? '';
    this.stderr = detail.stderr ?? '';
    this.timedOut = detail.timedOut === true;
    this.truncated = detail.truncated === true;
    this.spawnFailed = detail.spawnFailed === true;
  }

  /** 给 UI 的短摘要：优先 git 自己的错误行，其次退出码。 */
  get summary() {
    const text = `${this.stderr}\n${this.stdout}`;
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '');
    const interesting = lines.find((line) => /^(fatal|error|warning):/i.test(line)) ?? lines[0];
    if (this.spawnFailed) return this.message;
    if (this.timedOut) return 'git 命令超时。';
    if (this.truncated) return 'git 输出超过上限，已截断。';
    if (interesting !== undefined) return interesting.replace(/^(fatal|error|warning):\s*/i, '');
    return `git 退出码 ${this.code ?? '未知'}。`;
  }
}

/** 去掉 git 可能带上的 BOM 与末尾换行（调用方多数只关心内容）。 */
function decode(buffer) {
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

/**
 * 跑一次 git。
 * @param gitPath - git 可执行文件。
 * @param args - 子命令与参数（不含 BASE_ARGS）。
 * @param options - `cwd` 必填；`timeoutMs` / `maxBytes` / `env` / `signal` 可选。
 * @returns 永不带 reject 的结果对象：`{ ok, code, stdout, stderr, truncated, timedOut, spawnError }`。
 */
export function runGit(gitPath, args, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : DEFAULT_MAX_BYTES;

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(gitPath, [...BASE_ARGS, ...args], {
        cwd: options.cwd,
        env: gitEnv(options.env ?? process.env),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, code: null, stdout: '', stderr: '', truncated: false, timedOut: false, spawnError: error });
      return;
    }

    const outChunks = [];
    const errChunks = [];
    let outBytes = 0;
    let errBytes = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    timer.unref?.();

    const onAbort = () => child.kill();
    if (options.signal !== undefined) {
      if (options.signal.aborted) child.kill();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout.on('data', (chunk) => {
      if (outBytes >= maxBytes) {
        truncated = true;
        return;
      }
      outBytes += chunk.length;
      outChunks.push(chunk);
      if (outBytes >= maxBytes) {
        truncated = true;
        child.kill();
      }
    });
    child.stderr.on('data', (chunk) => {
      // stderr 只用来报错，留 64KB 就够。
      if (errBytes >= 65536) return;
      errBytes += chunk.length;
      errChunks.push(chunk);
    });

    const finish = (code, spawnError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener?.('abort', onAbort);
      const stdout = decode(Buffer.concat(outChunks));
      const stderr = decode(Buffer.concat(errChunks));
      resolve({
        ok: spawnError === undefined && code === 0 && !timedOut,
        code: code ?? null,
        stdout,
        stderr,
        truncated,
        timedOut,
        spawnError,
      });
    };

    child.on('error', (error) => finish(null, error));
    child.on('close', (code) => finish(code, undefined));
  });
}

/**
 * 绑定好路径与默认值的运行器。宿主各处只拿这个对象，不直接 spawn。
 */
export function createGit(options = {}) {
  const gitPath = resolveGitPath(options.gitPath, options);
  const defaults = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    env: options.env,
  };

  const run = (args, runOptions = {}) => runGit(gitPath, args, { ...defaults, ...runOptions });

  /** 失败即抛 GitError；`allowCodes` 里的退出码按成功处理（例如 `diff --no-index` 的 1）。 */
  const exec = async (args, runOptions = {}) => {
    const result = await run(args, runOptions);
    const allow = runOptions.allowCodes ?? [0];
    if (result.spawnError !== undefined) {
      throw new GitError(`无法启动 git（${gitPath}）：${result.spawnError.message}`, { args, ...result });
    }
    if (!allow.includes(result.code ?? -1) || result.timedOut) {
      throw new GitError(`git ${args.join(' ')} 执行失败`, { args, ...result });
    }
    return result;
  };

  /** 失败返回 `undefined`，用于「探测」语义（是不是仓库、有没有 upstream…）。 */
  const probe = async (args, runOptions = {}) => {
    const result = await run(args, runOptions);
    return result.ok && result.spawnError === undefined ? result : undefined;
  };

  return { gitPath, run, exec, probe };
}
