import z from '@deepseek-ai/schemastery';
import { apply as applyMcpClient, inject as mcpInject, Config as McpClientConfig } from '@deepseek-ai/dsh-mcp-client';
// 状态探测刻意复用与 dsh-mcp-client 完全相同的 SDK / 传输 / 环境脱敏，
// 这样「探测通过」才真的等价于「模型调用时能连上」。
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

/**
 * Settings namespace owned by the manager. DSH 0.1.7 keys configuration forms by
 * Loader entry id, so this must stay equal to the `id` of this plugin's row in
 * `cordis.patch.yml`; the browser half resolves the same string through
 * `ctx.configForms.get(SETTINGS_NAMESPACE)`.
 */
export const SETTINGS_NAMESPACE = 'mcp-skill-manager';
const IMPORT_ROUTE = '/dsh-mcp-skill-manager/v1';
const TOKEN_TTL_MS = 5 * 60 * 1000;
const SAFE_ID = /^[a-z][a-z0-9-]{0,31}$/;
const MCP_SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const HTTP_URL = /^https?:\/\//i;
const MAX_BODY_BYTES = 64 * 1024;
/**
 * 单个 MCP 服务的状态探测超时。stdio 服务首次 `npx -y` 需要下载包，
 * 所以给得比一次普通调用宽；超时按「连接」和「tools/list」各算一次。
 */
const MCP_PROBE_TIMEOUT_MS = 20000;

const ManagedSkill = z.object({
  name: z.string().required().pattern(SAFE_ID),
  description: z.string().required(),
  whenToUse: z.string().default(''),
  content: z.string().required(),
  enabled: z.boolean().default(true),
  modelInvocable: z.boolean().default(true),
  userInvocable: z.boolean().default(true),
});

const ImportedSkillLink = z.object({
  name: z.string().required().pattern(SAFE_ID),
  source: z.union(['claude-code', 'codex', 'opencode']).required(),
  sourcePath: z.string().required(),
  enabled: z.boolean().default(true),
});

/**
 * 「一条受管 MCP 服务」= 官方 `dsh-mcp-client` 的配置 + 管理器自己的元数据。
 *
 * 关键做法：**继承官方 schema 的 union**，而不是手抄字段表。
 * `McpClientConfig` 是 `z.union([stdio, streamable-http])`，两个分支的对象字面量
 * 通过 `.list[i].dict` 可以取到，于是官方以后新增字段（例如 `reconnect`、
 * `maxInstructionBytes`）会自动出现在这里，不会再出现「官方加了字段、管理器不认识」
 * 的偏差。曾经的实现是手写字段表，结果漏了 `reconnect` / `maxInstructionBytes`，
 * 还把 `failOnStartupError` 硬编码成 false。
 *
 * 管理器元数据（不是官方字段）：
 *   - `id`：本插件内的稳定标识（也是状态检查的键）
 *   - `label`：给人看的名字
 *   - `enabled`：是否挂载（停用后保留配置）
 *   - `envVars` / `headerEnvVars`：把 `${VAR}` 这类「引用宿主环境变量」的表达做成结构化字段
 *   - `importedFrom` / `diagnostics`：导入来源与导入时的提示
 */
const ManagedMcpServer = (() => {
  const branches = McpClientConfig?.list;
  if (!Array.isArray(branches) || branches.length !== 2 || branches.some((branch) => branch?.dict === undefined)) {
    // 官方 schema 结构变了就退回一份最小可用表，至少不要让整个插件载不起来。
    return z.object({
      id: z.string().required().pattern(SAFE_ID),
      label: z.string().default('').volatile(),
      enabled: z.boolean().default(true),
      transport: z.union(['stdio', 'streamable-http']).required(),
      serverName: z.string().required().pattern(MCP_SERVER_NAME),
      command: z.string().default(''),
      args: z.array(String).default([]),
      cwd: z.string().default(''),
      url: z.string().default(''),
      env: z.dict(String).default({}),
      headers: z.dict(String).default({}),
    });
  }
  const extras = {
    id: z.string().required().pattern(SAFE_ID),
    label: z.string().default(''),
    enabled: z.boolean().default(true),
    envVars: z.dict(String).default({}),
    headerEnvVars: z.dict(String).default({}),
    importedFrom: z.object({ source: z.string(), sourceKey: z.string(), sourcePath: z.string() }),
  };
  return z.union(branches.map((branch) => z.object({ ...branch.dict, ...extras })));
})();

/**
 * DSH 0.1.7 replaces plugin-registered settings namespaces: this entry's own Config IS
 * the settings surface, keyed by the Loader entry id (see `SETTINGS_NAMESPACE` and
 * `cordis.patch.yml`), and only `.volatile()` fields are editable. Host-side writes
 * (the import/unlink routes) commit through `configEditor.edit`; ordinary — non-volatile
 * — fields would instead send the whole plugin through Loader's remount path and tear
 * down every running MCP child on each catalog edit.
 */
export const Config = z.object({
  mcpServers: z.array(ManagedMcpServer).default([]).volatile(),
  skills: z.array(ManagedSkill).default([]).volatile(),
  /** Links physically materialized below $DSH_HOME/skills, never copied Skill content. */
  skillLinks: z.array(ImportedSkillLink).default([]).volatile(),
});

export const inject = ['tools', 'skills'];

function validateConfiguration(config) {
  const ids = new Set();
  const serverNames = new Set();
  const skillNames = new Set();
  const linkNames = new Set();
  for (const server of config.mcpServers) {
    if (ids.has(server.id)) throw new Error(`MCP server id "${server.id}" is duplicated.`);
    ids.add(server.id);
    if (serverNames.has(server.serverName)) throw new Error(`MCP serverName "${server.serverName}" is duplicated.`);
    serverNames.add(server.serverName);
    if (server.transport === 'stdio' && server.command.trim() === '') throw new Error(`MCP server "${server.id}" uses stdio and needs a command.`);
    if (server.transport === 'streamable-http' && !HTTP_URL.test(server.url)) throw new Error(`MCP server "${server.id}" needs an http:// or https:// URL.`);
  }
  for (const skill of config.skills) {
    if (skillNames.has(skill.name)) throw new Error(`Managed Skill name "${skill.name}" is duplicated.`);
    skillNames.add(skill.name);
    if (skill.description.trim() === '') throw new Error(`Managed Skill "${skill.name}" needs a description.`);
  }
  for (const link of config.skillLinks) {
    if (linkNames.has(link.name)) throw new Error(`Imported Skill link name "${link.name}" is duplicated.`);
    if (skillNames.has(link.name)) throw new Error(`Skill "${link.name}" cannot be both managed and linked.`);
    linkNames.add(link.name);
  }
}

function resolveEnvironment(mapping) {
  return Object.fromEntries(Object.entries(mapping).flatMap(([target, source]) => {
    const value = process.env[source];
    return value === undefined ? [] : [[target, value]];
  }));
}

/**
 * 把受管记录变成官方 `dsh-mcp-client` 的配置。
 *
 * **除管理器元数据外一律原样透传**：`reconnect`、`maxInstructionBytes`、
 * `failOnStartupError`、`toolCallTimeoutMs`、`cwd`、`env`、`headers` 都是官方字段，
 * 由官方 schema 在解析时补好默认值，这里只做一件事——把「引用宿主环境变量」的
 * `envVars` / `headerEnvVars` 解引用后并进 `env` / `headers`。
 *
 * 之前这里是逐字段手写映射，任何官方新增字段都会被静默丢掉。
 *
 * @param server - 受管 MCP 服务记录
 * @returns 可直接交给 `applyMcpClient` 的配置对象
 */
function mcpClientConfig(server) {
  const { id, label, enabled, envVars, headerEnvVars, importedFrom, diagnostics, ...official } = server;
  void id; void label; void enabled; void importedFrom; void diagnostics;
  return official.transport === 'stdio'
    ? { ...official, env: { ...(official.env ?? {}), ...resolveEnvironment(envVars ?? {}) } }
    : { ...official, headers: { ...(official.headers ?? {}), ...resolveEnvironment(headerEnvVars ?? {}) } };
}

/* ── MCP 服务状态探测 ──────────────────────────────────────────────────
 *
 * 为什么不能直接问「运行时里的那个 client」：dsh-mcp-client 不提供任何服务
 * （没有 reflect.provide），连接状态与重连计数都在它自己的 fiber 闭包里，外面读不到。
 * 所以这里做一次**独立的真实握手**：起传输 → initialize → tools/list → 关闭。
 * 它回答的是用户真正关心的问题：「我现在照这个配置去连，能不能连上、能列出几个工具、要多久」。
 *
 * 与 dsh-mcp-client 保持一致：同一套 SDK、同样的传输构造（它内部用 cross-spawn +
 * shell:false）、同样的子进程环境脱敏（scrubbedParentEnv）。否则探测可能通过而真实调用失败。
 * -------------------------------------------------------------------- */

/** 把探测错误整理成一行可读文本（spawn ENOENT、HTTP 401、超时…）。
 *
 * @param error - 捕获到的异常
 * @param stderrText - 子进程 stderr（stdio 探测会收集），可为空
 */
export function describeProbeError(error, stderrText = '') {
  const text = error instanceof Error ? error.message : String(error);
  const code = error !== null && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
  const base = code !== '' && !text.includes(code) ? `${text}（${code}）` : text;
  // 子进程自己的报错（npx 下载失败、缺依赖、Python traceback…）比 SDK 那句笼统的
  // "Connection closed" 有用得多，取最后两行附在后面。
  const detail = String(stderrText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(-2)
    .join(' · ')
    .slice(0, 400);
  return detail === '' ? base : `${base} — ${detail}`;
}

/** 给任意 promise 加超时；超时只影响判定，真正的资源回收交给调用方的 finally。 */
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* ── Windows 上的命令解析陷阱 ──────────────────────────────────────────
 *
 * macOS/Linux 不会遇到；Windows 上这是「服务明明配了却永远连不上」的头号原因，
 * 所以值得单独诊断：
 *
 *   MCP SDK 用 cross-spawn + `shell: false` 启动 stdio 服务。cross-spawn 的 which
 *   按「先目录、后扩展名（.com/.exe/.bat/.cmd）」的顺序解析裸命令——所以哪个目录在
 *   PATH 里靠前，就决定用的是 `.exe` 还是 `.cmd`。而 DSH Desktop 会把自带的
 *   `resources/runtime/dsh/bin` 放在 PATH 很前面，那里有 `node.cmd` / `pnpm.cmd`；
 *   同时 Node 在 CVE-2024-27980 之后**拒绝在 shell:false 下 spawn .cmd/.bat**，
 *   于是 spawn 直接抛错、连接被判定为关闭。表现为「工具列表里什么都没有、日志只有
 *   一句 Connection closed」，非常难查。用 `npx` / `pnpm` / `yarn` 这类裸命令的服务
 *   （它们几乎都是 .cmd）都会踩到，破解办法是给出真实 .exe 的绝对路径，或用
 *   `cmd /c ...` 包一层。
 * -------------------------------------------------------------------- */

/** Windows 可执行扩展名，顺序与 PATHEXT 默认值一致。 */
const WINDOWS_EXTENSIONS = ['.com', '.exe', '.bat', '.cmd'];

/**
 * 复刻 cross-spawn 的裸命令解析（目录优先、其次扩展名），用于诊断。
 *
 * @param command - 配置里的命令
 * @param env - 子进程环境（取其中的 PATH）
 * @param platform - 平台，默认当前平台（可注入，便于测试）
 * @returns 解析到的绝对路径；找不到返回 null
 */
export function resolveStdioCommand(command, env = {}, platform = process.platform) {
  if (platform !== 'win32') return null;
  const hasSeparator = /[\\/]/.test(command);
  const pathValue = env.PATH ?? env.Path ?? '';
  const dirs = hasSeparator ? [''] : pathValue.split(';').filter((dir) => dir !== '');
  for (const dir of dirs) {
    for (const extension of ['', ...WINDOWS_EXTENSIONS]) {
      const candidate = hasSeparator ? `${command}${extension}` : `${dir}\\${command}${extension}`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * 命令解析层面的失败原因（只在 Windows 上有意义）。
 *
 * @param command - 配置里的命令
 * @param env - 子进程环境
 * @param platform - 平台，默认当前平台
 * @returns 给人看的解释；没问题时返回空串
 */
export function explainStdioFailure(command, env = {}, platform = process.platform) {
  if (platform !== 'win32') return '';
  const resolved = resolveStdioCommand(command, env, platform);
  if (resolved === null) return `在 PATH 里找不到可执行文件 "${command}"。`;
  // 只有 .exe / .com 能被 CreateProcess 直接执行：.cmd/.bat 会被 Node 拒绝
  // （CVE-2024-27980 之后的限制），而无扩展名的文件（npm 附带的那种 shell 脚本）
  // 在 Windows 上根本不是可执行文件。
  if (!/\.(exe|com)$/i.test(resolved)) {
    const why = /\.(cmd|bat)$/i.test(resolved) ? 'Node 拒绝在 shell:false 下执行 .cmd/.bat' : '它不是 Windows 可执行文件';
    return `"${command}" 在 PATH 里解析到 ${resolved}——${why}，所以服务永远起不来。改用真实程序的 .exe 绝对路径（Node 类服务写成：command 指向 node.exe，args 指向该包的 dist 入口）。`;
  }
  return '';
}

/**
 * 按 dsh-mcp-client 的方式构造传输。
 * @param config - `mcpClientConfig()` 的产物
 * @param collectStderr - 收集子进程 stderr 的回调
 * @returns MCP 传输实例
 */
function probeTransport(config, collectStderr) {
  if (config.transport === 'stdio') {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...scrubbedParentEnv(), ...config.env },
      // 'pipe' 让子进程的诊断输出能被收集（SDK 要求在 start 之前挂监听，
      // 所以这里同步挂上，否则会丢掉最早的报错）。
      stderr: 'pipe',
      ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
    });
    transport.stderr?.on('data', (chunk) => collectStderr(String(chunk)));
    return transport;
  }
  return new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } });
}

/**
 * 探测一个 MCP 服务是否可用（initialize + tools/list）。
 *
 * @param server - 配置里的一个 MCP 服务条目
 * @param timeoutMs - 连接与列表各自的超时
 * @returns `{ ok, ms, toolCount, toolNames, serverInfo, error, hint }`；**不抛异常**
 */
export async function probeMcpServer(server, timeoutMs = MCP_PROBE_TIMEOUT_MS) {
  const config = mcpClientConfig(server);
  const started = Date.now();
  const client = new Client(
    { name: 'dsh-mcp-skill-manager', version: '0.0.1' },
    { capabilities: {}, versionNegotiation: { mode: 'auto' } },
  );
  let transport;
  let stderrTail = '';
  const collectStderr = (chunk) => { stderrTail = `${stderrTail}${chunk}`.slice(-2000); };
  try {
    transport = probeTransport(config, collectStderr);
    const connecting = client.connect(transport);
    // 超时后连接仍可能失败（子进程被杀），先吞掉这个 rejection，避免 unhandled。
    connecting.catch(() => {});
    await withTimeout(connecting, timeoutMs, `连接超时（${timeoutMs} ms）`);
    const capabilities = client.getServerCapabilities();
    const listed = capabilities?.tools === undefined
      ? { tools: [] }
      : await withTimeout(
          client.listTools(undefined, { cacheMode: 'refresh' }),
          timeoutMs,
          `tools/list 超时（${timeoutMs} ms）`,
        );
    const tools = Array.isArray(listed?.tools) ? listed.tools : [];
    const info = typeof client.getServerVersion === 'function' ? client.getServerVersion() : undefined;
    return {
      ok: true,
      ms: Date.now() - started,
      toolCount: tools.length,
      toolNames: tools.map((tool) => tool?.name).filter((name) => typeof name === 'string').slice(0, 50),
      serverInfo: info === undefined || info === null ? null : { name: info.name ?? null, version: info.version ?? null },
      hasTools: capabilities?.tools !== undefined,
    };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: describeProbeError(error, stderrTail),
      // 命令解析层面的诊断（Windows 的 .cmd 陷阱）单独给，UI 里单独显示。
      hint: config.transport === 'stdio' ? explainStdioFailure(config.command, { ...scrubbedParentEnv(), ...config.env }) : '',
    };
  } finally {
    try {
      // 与 dsh-mcp-client 的 closeGeneration 同策略：没 attach 上就直接关传输，
      // 否则超时会留下一个活着的子进程。
      if (client.transport !== undefined) await client.close();
      else await transport?.close();
    } catch {
      // 关闭失败不影响探测结论。
    }
  }
}

function dshHome() { return resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh')); }
function skillsRoot() { return join(dshHome(), 'skills'); }

function stableId(value) {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return SAFE_ID.test(normalized) ? normalized : `import-${createHash('sha1').update(String(value)).digest('hex').slice(0, 8)}`;
}
function nextAvailableId(base, used) {
  if (!used.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base.slice(0, Math.max(1, 32 - String(index).length - 1))}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('无法为导入项生成唯一标识符。');
}
function isEnvironmentReference(value) {
  const match = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/.exec(String(value).trim());
  return match?.[1];
}
function sourceRoots() {
  const home = homedir();
  return {
    'claude-code': [join(home, '.claude', 'skills')],
    // .agents is Codex's documented shared-Skills root. This importer never
    // writes to an external Harness root.
    codex: [join(home, '.agents', 'skills')],
    opencode: [join(home, '.config', 'opencode', 'skills')],
  };
}
function mcpConfigPaths() {
  const home = homedir();
  return {
    'claude-code': join(home, '.claude.json'),
    codex: join(home, '.codex', 'config.toml'),
    opencode: join(home, '.config', 'opencode', 'opencode.json'),
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
function tomlScalar(text) {
  const raw = text.trim().replace(/\s+#.*$/, '');
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  if (/^['"]/.test(raw)) {
    const quoted = /^'([^']*)'$/.exec(raw) ?? /^"((?:\\.|[^"\\])*)"$/.exec(raw);
    return quoted ? quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : raw;
  }
  if (/^\[/.test(raw)) return [...raw.matchAll(/'([^']*)'|"((?:\\.|[^"\\])*)"/g)].map((item) => (item[1] ?? item[2]).replace(/\\"/g, '"'));
  return raw;
}
/** Narrow, deliberately non-executing parser for Codex MCP tables. */
function parseCodexMcp(text, sourcePath) {
  const servers = new Map();
  let current;
  let env;
  for (const line of text.split(/\r?\n/)) {
    const section = /^\s*\[mcp_servers\.([^\].]+)(?:\.(env|env_vars|http_headers|env_http_headers))?\]\s*$/.exec(line);
    if (section) {
      current = section[1].replace(/^['"]|['"]$/g, '');
      env = section[2];
      if (!servers.has(current)) servers.set(current, { key: current, sourcePath, type: 'stdio', args: [], envVars: {}, headerEnvVars: {}, diagnostics: [] });
      continue;
    }
    const pair = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!current || !pair) continue;
    const record = servers.get(current);
    const [_, key, raw] = pair;
    const value = tomlScalar(raw);
    if (env === 'env' || env === 'env_vars') {
      const ref = isEnvironmentReference(value);
      if (ref) record.envVars[key] = ref;
      else record.diagnostics.push(`环境变量 ${key} 是明文值，未导入。`);
    } else if (env === 'http_headers' || env === 'env_http_headers') {
      const ref = isEnvironmentReference(value);
      if (ref) record.headerEnvVars[key] = ref;
      else record.diagnostics.push(`HTTP Header ${key} 是明文值，未导入。`);
    } else if (key === 'command') record.command = String(value);
    else if (key === 'args') record.args = Array.isArray(value) ? value.map(String) : [];
    else if (key === 'cwd') record.cwd = String(value);
    else if (key === 'url') { record.type = 'streamable-http'; record.url = String(value); }
    else if (key === 'enabled') record.enabled = Boolean(value);
    else if (key === 'bearer_token_env_var') record.headerEnvVars.Authorization = String(value);
  }
  return [...servers.values()];
}
function normalizeMcp(source, sourcePath, key, entry) {
  const id = stableId(key);
  const enabled = entry.enabled !== false;
  const diagnostics = [...(entry.diagnostics ?? [])];
  const sourceKey = key;
  // Source paths are intentionally host-only. The browser gets a sanitized
  // display path during scanning, never a retained local filesystem locator.
  const base = { id, label: entry.name ?? key, enabled, serverName: stableId(key).replace(/-/g, '_'), envVars: {}, headerEnvVars: {}, toolCallTimeoutMs: 60000, importedFrom: { source, sourceKey, sourcePath: basename(sourcePath) } };
  const copyReferences = (input, output, label) => {
    for (const [target, value] of Object.entries(input ?? {})) {
      const reference = isEnvironmentReference(value);
      if (reference) output[target] = reference;
      else diagnostics.push(`${label} ${target} 含明文值，未导入。`);
    }
  };
  if (entry.type === 'streamable-http' || entry.type === 'http' || entry.url) {
    copyReferences(entry.headers ?? entry.headerEnvVars, base.headerEnvVars, 'HTTP Header');
    copyReferences(entry.environment ?? entry.env ?? entry.envVars, base.envVars, '环境变量');
    if (entry.bearer_token_env_var) base.headerEnvVars.Authorization = String(entry.bearer_token_env_var);
    return { ...base, transport: 'streamable-http', command: '', args: [], cwd: '', url: String(entry.url ?? ''), diagnostics };
  }
  const commandParts = Array.isArray(entry.command) ? entry.command : undefined;
  copyReferences(entry.environment ?? entry.env ?? entry.envVars, base.envVars, '环境变量');
  return { ...base, transport: 'stdio', command: String(commandParts?.[0] ?? entry.command ?? ''), args: (commandParts ? commandParts.slice(1) : entry.args ?? []).map(String), cwd: String(entry.cwd ?? ''), url: '', diagnostics };
}
async function scanMcp(source) {
  const path = mcpConfigPaths()[source];
  if (path === undefined || !existsSync(path)) return { source, path, entries: [], available: false };
  try {
    let rawEntries = [];
    if (source === 'codex') rawEntries = parseCodexMcp(await readFile(path, 'utf8'), path);
    else {
      const value = await readJson(path);
      const catalog = source === 'claude-code' ? value.mcpServers ?? {} : value.mcp ?? {};
      rawEntries = Object.entries(catalog).map(([key, entry]) => ({ key, sourcePath: path, ...(entry ?? {}) }));
    }
    return { source, path, available: true, entries: rawEntries.map((entry) => normalizeMcp(source, path, entry.key, entry)) };
  } catch (error) {
    return { source, path, available: true, entries: [], error: `无法解析配置：${error instanceof Error ? error.message : String(error)}` };
  }
}
async function skillSummary(source, root, name) {
  const directory = join(root, name);
  const skillFile = join(directory, 'SKILL.md');
  try {
    const text = await readFile(skillFile, 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
    const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    const declared = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? name;
    return { source, key: `${source}:${root}:${name}`, name: stableId(declared), displayName: declared, description, sourcePath: directory, root };
  } catch { return undefined; }
}
async function scanSkills(source) {
  const roots = sourceRoots()[source] ?? [];
  const entries = [];
  for (const root of roots) {
    try {
      const { readdir } = await import('node:fs/promises');
      for (const item of await readdir(root, { withFileTypes: true })) {
        if (item.name.startsWith('.')) continue;
        // Dirent#isDirectory() is false for a Windows junction / directory
        // symlink. Resolve it before deciding: a valid linked directory with a
        // direct SKILL.md is an importable Skill just like a physical folder.
        let isSkillDirectory = item.isDirectory();
        if (!isSkillDirectory && item.isSymbolicLink()) {
          try { isSkillDirectory = (await lstat(await realpath(join(root, item.name)))).isDirectory(); }
          catch { isSkillDirectory = false; }
        }
        if (!isSkillDirectory) continue;
        const summary = await skillSummary(source, root, item.name);
        if (summary !== undefined) entries.push(summary);
      }
    } catch { /* Missing roots are normal and are shown as unavailable. */ }
  }
  return { source, roots, available: entries.length > 0, entries };
}
async function materializeLink(link) {
  const destination = join(skillsRoot(), link.name);
  await mkdir(skillsRoot(), { recursive: true });
  const target = await realpath(link.sourcePath);
  const root = await realpath(skillsRoot()).catch(() => skillsRoot());
  if (target.toLowerCase().startsWith(`${root.toLowerCase()}\\`)) throw new Error('不允许将 DSH 自身 Skills 目录链接回自身。');
  const targetState = await lstat(target);
  if (!targetState.isDirectory() || !existsSync(join(target, 'SKILL.md'))) throw new Error(`链接目标 "${link.name}" 必须是含 SKILL.md 的目录。`);
  try {
    const state = await lstat(destination);
    if (!state.isSymbolicLink()) throw new Error(`目标名称 "${link.name}" 已由非本插件链接占用。`);
    const existing = await realpath(destination);
    if (existing.toLowerCase() === target.toLowerCase()) return;
    throw new Error(`目标名称 "${link.name}" 已链接到另一目录。`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try { await symlink(target, destination, 'junction'); }
  catch (error) { throw new Error(`无法创建目录链接：${error instanceof Error ? error.message : String(error)}`); }
}
async function removeManagedLink(link) {
  const destination = join(skillsRoot(), link.name);
  try {
    const state = await lstat(destination);
    if (!state.isSymbolicLink()) throw new Error(`拒绝删除 "${link.name}"：它不是本插件管理的链接。`);
    const actual = await realpath(destination);
    const expected = await realpath(link.sourcePath);
    if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`拒绝删除 "${link.name}"：链接目标已变化。`);
    // unlink removes the junction/reparse point itself, never the linked source.
    await unlink(destination);
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
}

class ManagerRuntime {
  constructor(ctx) {
    this.ctx = ctx;
    this.mcpFibers = new Map();
    /**
     * 每个 MCP 服务的挂载结果：`{ ok, at, error? }`。
     * 它与「实时探测」互补：实时探测回答「现在照这份配置去连，连得上吗」，
     * 挂载结果回答「DSH 启动时这个服务到底有没有被载起来」。`applyMcpClient`
     * 抛错时这里留下错误文本，而 dsh-mcp-client 自己只把错误写进日志。
     */
    this.mcpMounts = new Map();
    this.skillDisposers = [];
    this.queue = Promise.resolve();
    this.closed = false;
  }
  /** 读取某个服务的挂载结果（没记过返回 null）。 */
  mount(id) { return this.mcpMounts.get(id) ?? null; }
  sync(config) { this.queue = this.queue.then(() => this.apply(config)).catch((error) => { this.ctx.logger.error('mcp-skill-manager: could not apply settings'); this.ctx.logger.error(error); }); return this.queue; }
  async apply(config) {
    if (this.closed) return;
    validateConfiguration(config);
    const links = new Map(config.skillLinks.filter((link) => link.enabled).map((link) => [link.name, link]));
    for (const link of config.skillLinks.filter((item) => !item.enabled)) try { await removeManagedLink(link); } catch (error) { this.ctx.logger.warn(`mcp-skill-manager: Skill link "${link.name}" could not be disabled`); this.ctx.logger.warn(error); }
    for (const link of links.values()) try { await materializeLink(link); } catch (error) { this.ctx.logger.warn(`mcp-skill-manager: Skill link "${link.name}" unavailable`); this.ctx.logger.warn(error); }
    const enabled = new Map(config.mcpServers.filter((server) => server.enabled).map((server) => [server.id, server]));
    for (const [id, fiber] of this.mcpFibers) if (!enabled.has(id) || fiber.signature !== JSON.stringify(enabled.get(id))) { await fiber.dispose(); this.mcpFibers.delete(id); this.mcpMounts.delete(id); }
    for (const [id, server] of enabled) {
      if (this.mcpFibers.has(id)) continue;
      try {
        const plugin = Object.assign((childCtx) => applyMcpClient(childCtx, mcpClientConfig(server)), { inject: mcpInject });
        const fiber = await this.ctx.plugin(plugin);
        this.mcpFibers.set(id, { dispose: () => fiber.dispose(), signature: JSON.stringify(server) });
        this.mcpMounts.set(id, { ok: true, at: Date.now() });
      } catch (error) {
        this.mcpMounts.set(id, {
          ok: false,
          at: Date.now(),
          error: describeProbeError(error),
          hint: server.transport === 'stdio' ? explainStdioFailure(server.command, process.env) : '',
        });
        this.ctx.logger.error(`mcp-skill-manager: MCP server "${id}" could not start`);
        this.ctx.logger.error(error);
      }
    }
    for (const dispose of this.skillDisposers.splice(0)) dispose();
    for (const skill of config.skills) if (skill.enabled) this.skillDisposers.push(this.ctx.skills.register({ name: skill.name, description: skill.description, ...(skill.whenToUse.trim() === '' ? {} : { whenToUse: skill.whenToUse }), content: skill.content, invocation: { modelInvocable: skill.modelInvocable, userInvocable: skill.userInvocable } }));
  }
  async dispose() { this.closed = true; await this.queue; for (const dispose of this.skillDisposers.splice(0)) dispose(); for (const fiber of this.mcpFibers.values()) await fiber.dispose(); this.mcpFibers.clear(); this.mcpMounts.clear(); }
}

async function jsonBody(req) {
  let body = '';
  for await (const part of req) {
    body += part;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('请求内容过大。');
  }
  return body === '' ? {} : JSON.parse(body);
}
function sendJson(res, status, value) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin' }); res.end(JSON.stringify(value)); }
function isLoopback(address) { return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'; }
function assertSameOrigin(req, writes = false) {
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (!isLoopback(req.socket.remoteAddress) || host === undefined || !/^127\.0\.0\.1(?::\d+)?$/.test(host)) throw new Error('该接口只允许本机 loopback 访问。');
  if ((origin !== undefined && origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') throw new Error('来源不受信任。');
  if (writes && origin === undefined) throw new Error('写操作需要同源浏览器请求。');
}
function isSource(value) { return value === 'claude-code' || value === 'codex' || value === 'opencode'; }

function installImportRoutes(ctx, scope, runtime) {
  if (ctx.webServer.host !== '127.0.0.1') {
    ctx.logger.warn('mcp-skill-manager: local importer is disabled because Web is not bound to 127.0.0.1');
    return;
  }
  const tokens = new Map();
  /** 同一个服务的并发探测共享同一次结果：连点「重新检查」不会反复起子进程。 */
  const probesInFlight = new Map();
  const requireToken = (req) => {
    const token = req.headers['x-dsh-msm-token'];
    const expiry = typeof token === 'string' ? tokens.get(token) : undefined;
    if (expiry === undefined || expiry < Date.now()) throw new Error('导入授权已过期，请重新打开导入窗口。');
  };
  ctx.webServer.register({ kind: 'prefix', path: IMPORT_ROUTE, handler: async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const path = requestUrl.pathname;
      if (req.method === 'GET' && path === `${IMPORT_ROUTE}/bootstrap`) {
        assertSameOrigin(req);
        const token = randomBytes(24).toString('base64url');
        tokens.set(token, Date.now() + TOKEN_TTL_MS);
        return sendJson(res, 200, { token, expiresInMs: TOKEN_TTL_MS });
      }
      const writes = req.method === 'POST';
      assertSameOrigin(req, writes);
      if (writes) requireToken(req);
      if (req.method === 'GET' && path === `${IMPORT_ROUTE}/scan`) {
        const kind = requestUrl.searchParams.get('kind');
        if (kind !== 'mcp' && kind !== 'skill') throw new Error('无效的导入类型。');
        const scans = kind === 'mcp' ? await Promise.all(['claude-code', 'codex', 'opencode'].map(scanMcp)) : await Promise.all(['claude-code', 'codex', 'opencode'].map(scanSkills));
        return sendJson(res, 200, { scans });
      }
      if (req.method === 'GET' && path === `${IMPORT_ROUTE}/mcp-status`) {
        // 只读探测：不写任何配置，但会按配置真实起一次连接（stdio 会拉子进程），
        // 所以仍然要求同源 + loopback（assertSameOrigin 已在上面执行）。
        const wantedId = requestUrl.searchParams.get('id');
        const servers = scope.get().mcpServers;
        if (wantedId !== null && !servers.some((server) => server.id === wantedId)) throw new Error(`未找到 MCP 服务 "${wantedId}"。`);
        const targets = wantedId === null ? servers.filter((server) => server.enabled) : servers.filter((server) => server.id === wantedId);
        const results = await Promise.all(targets.map(async (server) => {
          const report = {
            id: server.id,
            serverName: server.serverName,
            enabled: server.enabled,
            transport: server.transport,
            target: server.transport === 'stdio' ? [server.command, ...(server.args ?? [])].join(' ') : server.url,
            mount: runtime.mount(server.id),
          };
          if (!server.enabled) return { ...report, probe: { ok: false, skipped: true } };
          const running = probesInFlight.get(server.id) ?? probeMcpServer(server);
          probesInFlight.set(server.id, running);
          try {
            return { ...report, probe: await running };
          } finally {
            if (probesInFlight.get(server.id) === running) probesInFlight.delete(server.id);
          }
        }));
        return sendJson(res, 200, { checkedAt: Date.now(), servers: results });
      }
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('请求必须使用 application/json。');
      const payload = await jsonBody(req);
      if (!isSource(payload.source)) throw new Error('不支持的导入来源。');
      if (req.method === 'POST' && path === `${IMPORT_ROUTE}/import-mcp`) {
        const scan = await scanMcp(payload.source);
        const wanted = new Set(Array.isArray(payload.keys) ? payload.keys : []);
        const chosen = scan.entries.filter((entry) => wanted.has(entry.importedFrom.sourceKey));
        if (chosen.length === 0) throw new Error('没有选择可导入的 MCP 服务。');
        const current = scope.get();
        const next = [...current.mcpServers];
        const usedIds = new Set(next.map((server) => server.id));
        const usedNames = new Set(next.map((server) => server.serverName));
        for (const entry of chosen) {
          const id = nextAvailableId(entry.id, usedIds);
          const serverName = nextAvailableId(entry.serverName.replace(/_/g, '-'), new Set([...usedNames].map((name) => name.replace(/_/g, '-')))).replace(/-/g, '_');
          usedIds.add(id); usedNames.add(serverName);
          next.push({ ...entry, id, serverName });
        }
        await scope.update({ mcpServers: next });
        return sendJson(res, 200, { imported: chosen.map((entry) => entry.importedFrom.sourceKey) });
      }
      if (req.method === 'POST' && path === `${IMPORT_ROUTE}/link-skill`) {
        const scan = await scanSkills(payload.source);
        const selected = scan.entries.find((entry) => entry.key === payload.key);
        if (selected === undefined) throw new Error('所选 Skill 已不存在或不在允许的来源目录内。');
        const name = stableId(payload.name ?? selected.name);
        const current = scope.get();
        if (current.skills.some((skill) => skill.name === name) || current.skillLinks.some((link) => link.name === name)) throw new Error(`Skill 名称 "${name}" 已存在。`);
        const link = { name, source: payload.source, sourcePath: selected.sourcePath, enabled: true };
        await materializeLink(link);
        try { await scope.update({ skillLinks: [...current.skillLinks, link] }); }
        catch (error) { await removeManagedLink(link); throw error; }
        return sendJson(res, 200, { link });
      }
      if (req.method === 'POST' && path === `${IMPORT_ROUTE}/unlink-skill`) {
        const name = stableId(payload.name);
        const current = scope.get();
        const link = current.skillLinks.find((item) => item.name === name);
        if (link === undefined) throw new Error('该 Skill 不是本插件管理的链接。');
        await removeManagedLink(link);
        await scope.update({ skillLinks: current.skillLinks.filter((item) => item.name !== name) });
        return sendJson(res, 200, { unlinked: name });
      }
      return sendJson(res, 404, { error: '未找到接口。' });
    } catch (error) { return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) }); }
  }});
}

/**
 * Wrap the volatile Config refs in the `get()/update()` shape the runtime and the
 * import routes already consume. `get()` reads the refs directly (always the latest
 * resolved value); `update(patch)` merges only the listed keys — replacing the whole
 * config would drop the other two catalogs.
 *
 * @param ctx - Host plugin context.
 * @param config - Validated plugin config whose volatile fields are live refs.
 * @returns The settings face this plugin's runtime reads and writes.
 */
function createSettingsScope(ctx, config) {
  return {
    get: () => ({
      mcpServers: config.mcpServers.get() ?? [],
      skills: config.skills.get() ?? [],
      skillLinks: config.skillLinks.get() ?? [],
    }),
    update: async (patch) => {
      const entry = ctx.fiber.entry;
      const editor = ctx.get('configEditor');
      if (entry === undefined || editor === undefined) throw new Error('当前部署不支持写入配置。');
      await editor.edit(entry, (current) => ({ ...current, ...patch }));
    },
  };
}

/** Install the Host half. Import endpoints exist only on the Web composition. */
export function apply(ctx, config) {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber), 'mcp-skill-manager settings presentation');
  });

  const scope = createSettingsScope(ctx, config);
  const runtime = new ManagerRuntime(ctx);
  const sync = () => {
    const next = scope.get();
    // 跨字段校验（重复 id / serverName / Skill 名）：schemastery 表达不了，旧的
    // `settings.register(..., { validate })` 写入前钩子在新模型里没有对应物，改由
    // 这里守住 —— 不合法就保持上一份已生效的目录，只记日志。
    try { validateConfiguration(next); } catch (error) { ctx.logger.warn('mcp-skill-manager: 目录配置无效，已忽略本次变更'); ctx.logger.warn(error); return; }
    void runtime.sync(next);
  };
  sync();
  // volatile 字段原地提交后 Loader 才发这个事件；回调里重新读引用即可。
  ctx.on('loader/volatile-update', sync);
  ctx.effect(() => async () => { await runtime.dispose(); }, 'mcp-skill-manager runtime');
  ctx.inject(['webServer'], (webCtx) => installImportRoutes(webCtx, scope, runtime));
}
