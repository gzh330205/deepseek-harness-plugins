/**
 * 开发环境的发现、校验与注入（对齐 OneCode 的 `main/launch/environment.ts`）。
 *
 * 一条贯穿始终的约定：用户填的可以是**安装目录**，也可以是**可执行文件本身**，
 * 所以在真正拼命令行之前，一律先解析成 exe（`executableFor`），再由 exe 反推 home。
 *
 * 版本探测走 node 的 child_process，而不是 ctx.subprocess：探测是短命、有界、需要
 * 拿到完整输出的命令，用不上 Job 容器；本仓库 dsh-workspace-category-manager 调 git
 * 也是同样的做法。
 */
import { execFile } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { ENVIRONMENT_KINDS } from './contract.js';
import { inspectTomcatHome } from './tomcat.js';

const IS_WINDOWS = process.platform === 'win32';
const PROBE_TIMEOUT_MS = 10000;
/** 路径里出现这些字符直接拒绝：要经 shell 执行，防注入。 */
const UNSAFE_PATH = /[\r\n"%&|<>^!]/;
const MAX_PROBE_LINES = 8;

/** kind → 候选可执行文件名（Windows 优先 .cmd/.bat，其次 .exe）。 */
const EXECUTABLE_CANDIDATES = {
  java: ['java.exe', 'java'],
  maven: ['mvn.cmd', 'mvn.bat', 'mvn'],
  python: ['python.exe', 'python3.exe', 'python', 'python3'],
  node: ['node.exe', 'node'],
  go: ['go.exe', 'go'],
  tomcat: ['catalina.bat', 'catalina.sh', 'catalina'],
  ant: ['ant.bat', 'ant.cmd', 'ant'],
};

/** kind → 版本命令的参数。 */
const VERSION_ARGS = {
  java: ['-version'],
  maven: ['-version'],
  ant: ['-version'],
  go: ['version'],
  python: ['--version'],
  node: ['--version'],
};

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** 归一化路径（Python 除外：venv 的位置就是语义，不能 realpath 掉）。 */
function normalizeExecutable(kind, path) {
  if (kind === 'python') return path;
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * 把一个「目录或文件」解析成可执行文件路径。
 * @returns 绝对路径；解析不出来时返回 undefined。
 */
export function executableFor(environment) {
  const raw = String(environment?.path ?? '').trim();
  if (raw === '') return undefined;
  const kind = environment.kind;
  if (isFile(raw)) return normalizeExecutable(kind, raw);
  if (!isDirectory(raw)) return undefined;
  const root = resolve(raw);
  const names = EXECUTABLE_CANDIDATES[kind] ?? [];
  const directories = [join(root, 'bin'), root, join(root, 'Scripts')];
  for (const directory of directories) {
    for (const name of names) {
      const candidate = join(directory, name);
      if (isFile(candidate)) return normalizeExecutable(kind, candidate);
    }
  }
  return undefined;
}

/** 由可执行文件反推 home：`<home>/bin/xxx` → `<home>`，否则就是所在目录。 */
export function homeFor(binPath) {
  const directory = dirname(binPath);
  return basename(directory).toLowerCase() === 'bin' ? dirname(directory) : directory;
}

/** 版本探测的输出解码：先 UTF-8，失败回退 gb18030（Windows 中文环境常见）。 */
function decodeOutput(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buffer);
    } catch {
      return buffer.toString('latin1');
    }
  }
}

/** cmd.exe 的命令行引号：含空格或 cmd 元字符的参数必须整体加引号（路径里的 `"` 已被拒绝）。 */
function quoteForCmd(value) {
  return /[\s&()^|<>;]/.test(value) ? `"${value}"` : value;
}

function runProbe(file, args, cwd) {
  return new Promise((resolvePromise) => {
    const isScript = /\.(cmd|bat)$/i.test(file);
    // .cmd/.bat 不能直接 CreateProcess，必须经 cmd.exe；且 windowsVerbatimArguments
    // 下 Node 不会替我们加引号，所以整条命令行要自己拼、自己包（npm 的做法）。
    const useShell = isScript && IS_WINDOWS;
    const command = useShell ? process.env.ComSpec ?? 'cmd.exe' : file;
    const argv = useShell
      ? ['/d', '/s', '/c', `"${[file, ...args].map(quoteForCmd).join(' ')}"`]
      : args;
    execFile(
      command,
      argv,
      {
        cwd,
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
        // .cmd 经 cmd.exe 时 Node 的 argv 转义会插入多余反斜杠，必须关掉、自行拼命令行。
        windowsVerbatimArguments: useShell,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const combined = `${stdout ?? ''}${stderr ?? ''}`;
        resolvePromise({ failed: error !== null && error !== undefined, output: decodeOutput(Buffer.from(combined)) });
      },
    );
  });
}

function firstMeaningfulLine(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '') ?? '';
}

/** 从 `version "1.8.0_291"` / `go version go1.21.0 windows/amd64` 这类输出里抽版本号。 */
export function extractVersion(text) {
  const line = firstMeaningfulLine(text);
  const match = /(\d+(?:\.\d+){0,3}(?:[._-]\d+)?)/.exec(line);
  return match === null ? line : match[1];
}

/**
 * Tomcat 不走 `-version`：看目录结构，版本从 RELEASE-NOTES 抽。
 * 结构判断交给 src/host/tomcat.js 的 inspectTomcatHome（启动路径用的是同一份实现）。
 */
function validateTomcat(rawPath) {
  const candidate = String(rawPath ?? '').trim();
  if (candidate === '') return { ok: false, error: '请填写 Tomcat 安装目录。' };
  if (UNSAFE_PATH.test(candidate)) return { ok: false, error: '路径包含不允许的字符。' };
  const direct = inspectTomcatHome(candidate);
  if (direct.ok === true) return { ok: true, version: direct.version, home: direct.home, path: direct.home };
  // 用户可能选到了 bin 目录本身，向上退一级再试。
  const parent = inspectTomcatHome(dirname(candidate));
  if (parent.ok === true) return { ok: true, version: parent.version, home: parent.home, path: parent.home };
  return { ok: false, error: direct.error };
}

/**
 * 校验一个开发环境条目：解析 exe、跑版本命令（Tomcat 走结构检查）。
 * @returns {ok, version?, home?, executable?, error?}
 */
export async function validateEnvironment(environment, { cwd = process.cwd() } = {}) {
  const kind = environment?.kind;
  if (!ENVIRONMENT_KINDS.includes(kind)) return { ok: false, error: `不支持的开发环境种类「${kind}」。` };
  const raw = String(environment?.path ?? '').trim();
  if (raw === '') return { ok: false, error: '请填写环境路径。' };
  if (UNSAFE_PATH.test(raw)) return { ok: false, error: '路径包含不允许的字符（引号、百分号、管道符等）。' };

  if (kind === 'tomcat') {
    const checked = validateTomcat(raw);
    if (!checked.ok) return checked;
    return { ok: true, version: checked.version, home: checked.home, path: checked.home };
  }

  const executable = executableFor({ kind, path: raw });
  if (executable === undefined) {
    return { ok: false, error: '在该路径下没找到可执行文件（可填安装目录，也可直接填可执行文件）。' };
  }
  if (!isAbsolute(executable)) return { ok: false, error: '请使用绝对路径。' };
  const probe = await runProbe(executable, VERSION_ARGS[kind] ?? ['--version'], cwd);
  if (probe.failed && firstMeaningfulLine(probe.output) === '') {
    return { ok: false, error: `执行「${basename(executable)} ${(VERSION_ARGS[kind] ?? []).join(' ')}」失败。` };
  }
  return { ok: true, version: extractVersion(probe.output), home: homeFor(executable), executable, path: executable };
}

/** PATH 探测：Windows 用 where、POSIX 用 which -a，取前若干条逐个校验。 */
async function probePath(commandNames) {
  const args = IS_WINDOWS ? commandNames : ['-a', ...commandNames.slice(0, 1)];
  const tool = IS_WINDOWS ? 'where.exe' : 'which';
  const outcome = await new Promise((resolvePromise) => {
    execFile(tool, args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      resolvePromise({ failed: error !== null && error !== undefined, output: decodeOutput(Buffer.from(stdout ?? '')) });
    });
  });
  if (outcome.failed && outcome.output.trim() === '') return [];
  return outcome.output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, MAX_PROBE_LINES);
}

/**
 * 从 PATH 里发现各 kind 的候选环境。只认「存在且能报出版本」的候选：
 * PATH 里的 WindowsApps 占位程序就是这样被过滤掉的。
 * @param {(message: string) => void} [onProgress] - 逐条进度（探测可能耗时数秒）。
 */
export async function detectEnvironments({ kinds = ENVIRONMENT_KINDS, onProgress } = {}) {
  const found = [];
  for (const kind of kinds) {
    const names = EXECUTABLE_CANDIDATES[kind] ?? [];
    const primary = names[0] ?? kind;
    const candidates = await probePath([primary]);
    for (const candidate of candidates) {
      onProgress?.(`正在校验 ${kind}: ${candidate}`);
      const checked = await validateEnvironment({ kind, path: candidate });
      if (checked.ok !== true) continue;
      found.push({
        id: '',
        kind,
        name: `${kind} · ${checked.version ?? basename(candidate)}`,
        path: checked.executable ?? checked.path ?? candidate,
        version: checked.version ?? '',
      });
      break; // 每种 kind 只取 PATH 里第一个可用的
    }
  }
  return found;
}

/* ── 环境注入 ─────────────────────────────────────────────────────────── */

/** Windows 的环境变量名大小写不敏感：写入前先清掉同名项。 */
function makeEnvWriter(base) {
  const target = { ...base };
  return {
    set(name, value) {
      if (IS_WINDOWS) {
        for (const key of Object.keys(target)) {
          if (key.toUpperCase() === name.toUpperCase() && key !== name) delete target[key];
        }
      }
      target[name] = value;
    },
    delete(name) {
      for (const key of Object.keys(target)) {
        if (IS_WINDOWS ? key.toUpperCase() === name.toUpperCase() : key === name) delete target[key];
      }
    },
    value: target,
  };
}

function pathDelimiter() {
  return IS_WINDOWS ? ';' : ':';
}

/**
 * 按三层绑定组装子进程环境。
 * @param {{library, bindings, configuration, baseEnv?}} input
 *   bindings 已是 `resolveBindings()` 的结果；configuration.env 是运行配置里的字面量。
 * @returns {{env: Record<string,string>, warnings: string[], missing: string[]}}
 */
export function buildRunEnvironment({ library, bindings, configuration, baseEnv = process.env }) {
  const writer = makeEnvWriter(baseEnv);
  const warnings = [];
  const missing = [];
  const prestend = [];
  const byId = new Map((library?.environments ?? []).map((environment) => [environment.id, environment]));

  for (const kind of ENVIRONMENT_KINDS) {
    const id = bindings?.[kind];
    if (typeof id !== 'string' || id === '') continue;
    const environment = byId.get(id);
    if (environment === undefined) {
      // 绑定失效要报出来，但不要拦住启动 —— UI 会给出修复入口。
      warnings.push(`${kind} 的环境绑定已失效（${id}），请在运行面板修复绑定或重新选择开发环境。`);
      missing.push(kind);
      continue;
    }
    // Tomcat 的 path 就是 home：启动走 java + bootstrap.jar，不经过 catalina 脚本，
    // 所以这里只要把 CATALINA_HOME 指对即可，不需要（也不该）要求可执行文件存在。
    if (kind === 'tomcat') {
      const home = String(environment.path ?? '').trim();
      if (home === '') {
        warnings.push(`${kind} 的环境「${environment.name || id}」没有填安装目录。`);
        missing.push(kind);
        continue;
      }
      writer.set('CATALINA_HOME', home);
      continue;
    }

    const executable = executableFor(environment);
    if (executable === undefined) {
      warnings.push(`${kind} 的环境「${environment.name || id}」找不到可执行文件：${environment.path}`);
      missing.push(kind);
      continue;
    }
    const home = homeFor(executable);
    const bin = dirname(executable);
    prestend.push(bin);
    switch (kind) {
      case 'java':
        writer.set('JAVA_HOME', home);
        // 系统里若设了 JRE_HOME，会盖过我们选的 JDK，必须显式清掉。
        writer.delete('JRE_HOME');
        break;
      case 'ant':
        writer.set('ANT_HOME', home);
        break;
      case 'maven':
        writer.set('MAVEN_HOME', home);
        writer.set('M2_HOME', home);
        break;
      case 'go':
        writer.set('GOROOT', home);
        break;
      case 'python': {
        prestend.push(join(bin, 'Scripts'));
        const virtualEnv = isFile(join(home, 'pyvenv.cfg'));
        if (virtualEnv) {
          writer.set('VIRTUAL_ENV', home);
          writer.delete('PYTHONHOME');
        } else {
          writer.delete('PYTHONHOME');
        }
        break;
      }
      default:
        break;
    }
  }

  const basePath = String(baseEnv.PATH ?? baseEnv.Path ?? '');
  const delimiter = pathDelimiter();
  const seen = new Set();
  const merged = [...prestend, ...basePath.split(delimiter)]
    .filter((entry) => entry !== '')
    .filter((entry) => {
      const key = IS_WINDOWS ? entry.toLowerCase() : entry;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(delimiter);
  // 先清掉旧 PATH 的大小写变体——注意 writer.delete 在 Windows 上是大小写不敏感的，
  // 所以清完就不能再对它调 delete，否则会把刚写进去的值一起删掉。
  writer.delete('PATH');
  writer.set('PATH', merged);

  // 运行配置里的字面量最后写入：它优先级最高，且必须显式下发才能绕过宿主的敏感变量剥离。
  for (const [name, value] of Object.entries(configuration?.env ?? {})) {
    if (typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) writer.set(name, value);
  }

  return { env: writer.value, warnings, missing };
}
