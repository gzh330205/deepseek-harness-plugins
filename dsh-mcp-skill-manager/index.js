import z from '@deepseek-ai/schemastery';
import { apply as applyMcpClient, inject as mcpInject } from '@deepseek-ai/dsh-mcp-client';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

/** Persistent settings namespace owned by the manager. */
export const SETTINGS_NAMESPACE = 'mcp-skill-manager';
const IMPORT_ROUTE = '/dsh-mcp-skill-manager/v1';
const TOKEN_TTL_MS = 5 * 60 * 1000;
const SAFE_ID = /^[a-z][a-z0-9-]{0,31}$/;
const MCP_SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const HTTP_URL = /^https?:\/\//i;
const MAX_BODY_BYTES = 64 * 1024;

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

const ManagedMcpServer = z.object({
  id: z.string().required().pattern(SAFE_ID),
  label: z.string().default(''),
  enabled: z.boolean().default(true),
  transport: z.union(['stdio', 'streamable-http']).required(),
  serverName: z.string().required().pattern(MCP_SERVER_NAME),
  command: z.string().default(''),
  args: z.array(String).default([]),
  cwd: z.string().default(''),
  url: z.string().default(''),
  /** Literal environment values supplied to a stdio MCP child process. */
  env: z.dict(String).default({}),
  /** Maps MCP environment names to names already present in the DSH Host environment. */
  envVars: z.dict(String).default({}),
  /** Maps HTTP header names to names already present in the DSH Host environment. */
  headerEnvVars: z.dict(String).default({}),
  toolCallTimeoutMs: z.number().min(1).default(60000),
  importedFrom: z.object({ source: z.string(), sourceKey: z.string(), sourcePath: z.string() }),
});

export const Config = z.object({
  mcpServers: z.array(ManagedMcpServer).default([]),
  skills: z.array(ManagedSkill).default([]),
  /** Links physically materialized below $DSH_HOME/skills, never copied Skill content. */
  skillLinks: z.array(ImportedSkillLink).default([]),
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

function mcpClientConfig(server) {
  const common = { serverName: server.serverName, toolCallTimeoutMs: server.toolCallTimeoutMs, failOnStartupError: false };
  return server.transport === 'stdio'
    ? { ...common, transport: 'stdio', command: server.command, args: server.args, ...(server.cwd.trim() === '' ? {} : { cwd: server.cwd }), env: { ...server.env, ...resolveEnvironment(server.envVars) } }
    : { ...common, transport: 'streamable-http', url: server.url, headers: resolveEnvironment(server.headerEnvVars) };
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
  constructor(ctx) { this.ctx = ctx; this.mcpFibers = new Map(); this.skillDisposers = []; this.queue = Promise.resolve(); this.closed = false; }
  sync(config) { this.queue = this.queue.then(() => this.apply(config)).catch((error) => { this.ctx.logger.error('mcp-skill-manager: could not apply settings'); this.ctx.logger.error(error); }); return this.queue; }
  async apply(config) {
    if (this.closed) return;
    validateConfiguration(config);
    const links = new Map(config.skillLinks.filter((link) => link.enabled).map((link) => [link.name, link]));
    for (const link of config.skillLinks.filter((item) => !item.enabled)) try { await removeManagedLink(link); } catch (error) { this.ctx.logger.warn(`mcp-skill-manager: Skill link "${link.name}" could not be disabled`); this.ctx.logger.warn(error); }
    for (const link of links.values()) try { await materializeLink(link); } catch (error) { this.ctx.logger.warn(`mcp-skill-manager: Skill link "${link.name}" unavailable`); this.ctx.logger.warn(error); }
    const enabled = new Map(config.mcpServers.filter((server) => server.enabled).map((server) => [server.id, server]));
    for (const [id, fiber] of this.mcpFibers) if (!enabled.has(id) || fiber.signature !== JSON.stringify(enabled.get(id))) { await fiber.dispose(); this.mcpFibers.delete(id); }
    for (const [id, server] of enabled) {
      if (this.mcpFibers.has(id)) continue;
      try {
        const plugin = Object.assign((childCtx) => applyMcpClient(childCtx, mcpClientConfig(server)), { inject: mcpInject });
        const fiber = await this.ctx.plugin(plugin);
        this.mcpFibers.set(id, { dispose: () => fiber.dispose(), signature: JSON.stringify(server) });
      } catch (error) { this.ctx.logger.error(`mcp-skill-manager: MCP server "${id}" could not start`); this.ctx.logger.error(error); }
    }
    for (const dispose of this.skillDisposers.splice(0)) dispose();
    for (const skill of config.skills) if (skill.enabled) this.skillDisposers.push(this.ctx.skills.register({ name: skill.name, description: skill.description, ...(skill.whenToUse.trim() === '' ? {} : { whenToUse: skill.whenToUse }), content: skill.content, invocation: { modelInvocable: skill.modelInvocable, userInvocable: skill.userInvocable } }));
  }
  async dispose() { this.closed = true; await this.queue; for (const dispose of this.skillDisposers.splice(0)) dispose(); for (const fiber of this.mcpFibers.values()) await fiber.dispose(); this.mcpFibers.clear(); }
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

function installImportRoutes(ctx, scope) {
  if (ctx.webServer.host !== '127.0.0.1') {
    ctx.logger.warn('mcp-skill-manager: local importer is disabled because Web is not bound to 127.0.0.1');
    return;
  }
  const tokens = new Map();
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

/** Install the Host half. Import endpoints exist only on the Web composition. */
export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(SETTINGS_NAMESPACE, Config, { base: {}, applies: 'live', validate: validateConfiguration });
    const runtime = new ManagerRuntime(settingsCtx);
    runtime.sync(scope.get());
    const unwatch = scope.watch((next) => runtime.sync(next));
    settingsCtx.effect(() => async () => { unwatch(); await runtime.dispose(); }, 'mcp-skill-manager runtime');
    settingsCtx.inject(['webServer'], (webCtx) => installImportRoutes(webCtx, scope));
  });
}
export default apply;
