import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import z from '@deepseek-ai/schemastery';

/**
 * dsh-web-auth — DSH Web 的 HTTP 认证网关（多用户账号密码版）。
 *
 * 面向服务器部署：在 `webServer.server`（node:http）最外层拦截每一条
 * HTTP 请求与 WebSocket 升级，未登录一律 401 登录页；登录后才能进入
 * DSH Web 界面、调用 /api/*、建立 WebSocket 下行通道。
 *
 * 本版本以「用户名 + 密码」账户体系为主：
 *   - 账户存于 DSH 设置文档（$DSH_HOME/settings.yaml 的 `web-auth`
 *     命名空间），密码只存 scrypt 哈希 + 盐，绝不落明文；
 *   - 首次运行（无账户且无主令牌）出现引导页 /__auth__/setup，
 *     创建第一个账户后永久关闭；
 *   - 已登录用户可在 设置 → 插件 → 认证 管理账户（增删、重置密码）；
 *   - 可选的 `token` 主令牌仍然有效（Bearer 头或登录页备用输入），
 *     适合脚本/自动化，不再是唯一认证手段，也不再读环境变量。
 *
 * 工作机制与旧版相同：node:http 的 `request` 事件会把 (req, res) 同步
 * 交给每个监听器，而网关是异步的（登录要读请求体），因此把 webserver
 * 的内部处理器从事件表摘下，认证通过后由网关手动调用；未认证时内部
 * 处理器根本不运行。
 */

export const name = 'web-auth';

const SETTINGS_NAMESPACE = 'web-auth';
const AUTH_PREFIX = '/__auth__';
const LOGIN_PATH = `${AUTH_PREFIX}/login`;
const LOGOUT_PATH = `${AUTH_PREFIX}/logout`;
const STATUS_PATH = `${AUTH_PREFIX}/status`;
const SETUP_PATH = `${AUTH_PREFIX}/setup`;
const USERS_PATH = `${AUTH_PREFIX}/users`;

const MAX_BODY_BYTES = 16 * 1024;
const FAIL_DELAY_BASE_MS = 300;
const FAIL_DELAY_MAX_MS = 2000;
const FAILURES_CAP = 512;
const SESSIONS_CAP = 10000;
const SESSIONS_PRUNE_AT = 4096;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/** 登录后回跳地址白名单：单斜杠开头的普通路径，禁止 `//`、反斜杠与 `/__auth__`。 */
const SAFE_NEXT = /^\/(?!\/|\\)[A-Za-z0-9/._~-]*$/;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 32 };

const scrypt = promisify(scryptCallback);

/** web-auth 设置命名空间的 schema（账户 + 可选主令牌 + 会话参数）。 */
export const SettingsConfig = z.object({
  users: z.array(z.object({
    username: z.string().required().pattern(USERNAME_PATTERN),
    /** scrypt$N$r$p$saltBase64$hashBase64 — 只存哈希，永不存明文。 */
    hash: z.string().required().pattern(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/).role('secret'),
  })).default([]),
  /** 可选主令牌：任何访客用「用户名+密码」外的备选钥匙（脚本用 Bearer）。留空禁用。 */
  token: z.string().default('').role('secret'),
  cookieName: z.string().pattern(COOKIE_NAME_PATTERN).default('dsh_web_auth'),
  sessionTtlSeconds: z.number().min(300).max(30 * 24 * 3600).default(43200),
});

function validateSettings(config) {
  const seen = new Set();
  for (const user of config.users ?? []) {
    if (seen.has(user.username)) throw new Error(`用户名 "${user.username}" 重复。`);
    seen.add(user.username);
  }
  if (config.token !== '' && config.token !== undefined && !/^[A-Za-z0-9+/=_-]{8,256}$/.test(config.token)) {
    throw new Error('主令牌长度需为 8–256 个 URL-safe 字符。');
  }
}

// ── 小工具 ────────────────────────────────────────────────────────────────

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest();
}

/** 常数时间比较两个值的 SHA-256 摘要。 */
function equalDigest(left, right) {
  const a = sha256(left);
  const b = sha256(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key !== '' && value !== '') out[key] = value;
  }
  return out;
}

function bearerTokenOf(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  return token === '' ? undefined : token;
}

function sanitizeNext(raw) {
  const value = typeof raw === 'string' ? raw : '';
  return SAFE_NEXT.test(value) && !value.startsWith(`${AUTH_PREFIX}/`) ? value : '/';
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  }, JSON.stringify(value));
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(303, {
    location,
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end();
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('请求内容过大。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** 浏览器可用的“同源”判定：Origin（POST 必带）与 Host 一致、且非 cross-site。 */
function isSameOriginRequest(req) {
  const host = req.headers.host;
  if (typeof host !== 'string' || host === '') return false;
  try {
    void new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Host 头是否指向本机回环（127.0.0.1 / localhost / ::1 / 127/8）。 */
function isLoopbackHostHeader(host) {
  if (typeof host !== 'string' || host === '') return false;
  try {
    const hostname = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (hostname === 'localhost' || hostname === '::1') return true;
    const parts = hostname.split('.');
    return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  } catch {
    return false;
  }
}

/**
 * 把非回环请求的 Host/Origin 规范到回环，再做「已认证」判定后的转发。
 *
 * 背景：DSH 自带的 /api 浏览器信任面（DNS 重绑定防护）只认回环或
 * `--trusted-host` 声明的权威；而本网关本身就是认证层——未认证请求在
 * 这里就被拦下，能到达 /api 的必然持有登录主机签发的会话 Cookie
 * （host-only，只绑登录主机）或主令牌，不存在重绑定风险。不改写时，
 * 用计算机名 / mDNS 名 / 局域网 IP / 反代域名访问会出现「登录成功但
 * /api 全 403 forbidden」的断连（DSH 又禁止 0.0.0.0 绑定，这几乎是
 * 远程部署的必经路径）。
 *
 * 只对已认证请求生效；未认证的 /api 请求依旧由网关回 401。
 */
function normalizeHostForTrustFence(req, port) {
  if (isLoopbackHostHeader(req.headers.host)) return;
  req.headers.host = `127.0.0.1:${String(port)}`;
  if (typeof req.headers.origin === 'string' && req.headers.origin !== '') {
    req.headers.origin = `http://127.0.0.1:${String(port)}`;
  }
}

// ── 密码哈希（scrypt） ─────────────────────────────────────────────────────

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(String(password), salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(String(saltB64), 'base64');
    const expected = Buffer.from(String(hashB64), 'base64');
    if (salt.length === 0 || expected.length === 0) return false;
    const key = await scrypt(String(password), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/** 用户不存在时也要做一次同样的哈希验证，避免用“用时差”探测用户是否存在。 */
let dummyHashPromise;
function dummyHash() {
  dummyHashPromise ??= hashPassword('dsh-web-auth-dummy-password');
  return dummyHashPromise;
}

// ── 认证运行时 ────────────────────────────────────────────────────────────

/**
 * 运行时状态：账户配置（来自 `web-auth` 设置命名空间）、会话登记、登录
 * 限速。配置变更（设置页/文件直接改动）经 `sync()` 串行应用，账户增删
 * 经同一个队列串行写入，避免并发丢失更新。
 */
class AuthRuntime {
  constructor(ctx, scope) {
    this.ctx = ctx;
    this.scope = scope;
    this.config = { users: [], token: '', cookieName: 'dsh_web_auth', sessionTtlSeconds: 43200 };
    this.sessions = new Map(); // id -> { user, expiry }
    this.failures = new Map(); // ip -> { count, until }
    this.queue = Promise.resolve();
    this.closed = false;
  }

  sync(next) {
    this.queue = this.queue.then(() => this.apply(next)).catch((error) => {
      this.ctx.logger.error('web-auth: 应用设置失败');
      this.ctx.logger.error(error);
    });
    return this.queue;
  }

  apply(next) {
    const previous = this.config;
    this.config = next;
    // 用户删除 / 密码变更 → 撤销对应会话；其余配置变更不影响已发会话。
    const previousHashes = new Map(previous.users.map((user) => [user.username, user.hash]));
    const nextHashes = new Map(next.users.map((user) => [user.username, user.hash]));
    for (const [id, session] of this.sessions) {
      const hash = nextHashes.get(session.user);
      if (hash === undefined || hash !== previousHashes.get(session.user)) this.sessions.delete(id);
    }
    const previousAccounts = previous.users.length;
    const nextAccounts = next.users.length;
    if (previousAccounts !== nextAccounts || JSON.stringify(previous.users) !== JSON.stringify(next.users)) {
      this.ctx.logger.info(`web-auth: 账户配置已更新（${String(nextAccounts)} 个账户）。`);
    }
  }

  get hasUsers() { return this.config.users.length > 0; }
  get hasToken() { return this.config.token !== ''; }
  get mode() { return this.hasUsers ? 'users' : this.hasToken ? 'token' : 'disabled'; }
  get setupAllowed() { return !this.hasUsers && !this.hasToken; }

  // 修改类操作走同一个队列：读 settings 服务当前已提交的解析值 → 写入
  // 设置（提交会触发 watch → sync 异步应用）。注意不能读 `this.config`：
  // 它由异步 watcher 更新，连续两次写入之间可能仍是旧快照。
  mutate(write) {
    const task = this.queue.then(async () => {
      if (this.closed) throw new Error('运行时已关闭。');
      return write(this.scope.get());
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async addUser(username, password) {
    if (!USERNAME_PATTERN.test(username)) throw new Error('用户名只能包含字母、数字、点、下划线、连字符，长度 1–64。');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('密码长度须为 8–128 位。');
    return this.mutate(async (config) => {
      if (config.users.some((user) => user.username === username)) throw new Error(`用户名 "${username}" 已存在。`);
      const hash = await hashPassword(password);
      await this.scope.update({ users: [...config.users, { username, hash }] });
      return username;
    });
  }

  async removeUser(username) {
    return this.mutate(async (config) => {
      if (config.users.length <= 1) throw new Error('至少保留一个账户。');
      if (!config.users.some((user) => user.username === username)) throw new Error(`账户 "${username}" 不存在。`);
      await this.scope.update({ users: config.users.filter((user) => user.username !== username) });
      return username;
    });
  }

  async changePassword(username, password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('密码长度须为 8–128 位。');
    return this.mutate(async (config) => {
      if (!config.users.some((user) => user.username === username)) throw new Error(`账户 "${username}" 不存在。`);
      const hash = await hashPassword(password);
      await this.scope.update({ users: config.users.map((user) => user.username === username ? { username, hash } : user) });
      return username;
    });
  }

  verifyToken(candidate) {
    return this.config.token !== '' && equalDigest(candidate ?? '', this.config.token);
  }

  async authenticate(username, password) {
    const user = this.config.users.find((entry) => entry.username === username);
    if (user === undefined) {
      await verifyPassword(password, await dummyHash());
      return undefined;
    }
    return await verifyPassword(password, user.hash) ? user : undefined;
  }

  createSession(user) {
    const now = Date.now();
    if (this.sessions.size >= SESSIONS_PRUNE_AT) {
      for (const [id, session] of this.sessions) if (session.expiry <= now) this.sessions.delete(id);
    }
    if (this.sessions.size >= SESSIONS_CAP) throw new Error('会话数量超过上限。');
    const id = randomBytes(24).toString('base64url');
    // 只登记用户名（字符串）：apply() 按用户名 diff，账户变更才能精确撤销。
    this.sessions.set(id, { user: typeof user === 'string' ? user : String(user?.username ?? ''), expiry: now + this.config.sessionTtlSeconds * 1000 });
    return id;
  }

  verifySession(value) {
    if (typeof value !== 'string' || value === '') return undefined;
    const session = this.sessions.get(value);
    if (session === undefined) return undefined;
    if (session.expiry <= Date.now()) {
      this.sessions.delete(value);
      return undefined;
    }
    return session;
  }

  revokeSession(value) {
    if (typeof value === 'string') this.sessions.delete(value);
  }

  throttleMs(ip) {
    const record = this.failures.get(ip);
    if (record === undefined) return 0;
    const delay = record.until - Date.now();
    return delay > 0 ? Math.min(delay, FAIL_DELAY_MAX_MS) : 0;
  }

  recordFailure(ip) {
    const now = Date.now();
    const record = this.failures.get(ip);
    const count = record !== undefined && record.until > now ? record.count + 1 : 1;
    const delay = Math.min(FAIL_DELAY_BASE_MS * 2 ** Math.min(count - 1, 6), FAIL_DELAY_MAX_MS);
    this.failures.set(ip, { count, until: now + delay });
    if (this.failures.size > FAILURES_CAP) {
      for (const [key, value] of this.failures) if (value.until <= now) this.failures.delete(key);
    }
  }

  clearFailures(ip) {
    this.failures.delete(ip);
  }

  async dispose() {
    this.closed = true;
    await this.queue;
    this.sessions.clear();
  }
}

function sessionCookieOf(runtime, sessionId) {
  return `${runtime.config.cookieName}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${String(runtime.config.sessionTtlSeconds)}`;
}

/**
 * 请求是否已认证：会话 Cookie 或 Authorization: Bearer 主令牌。
 * @returns 认证用户名（Cookie 会话）、null（主令牌身份），或 undefined（未认证）。
 */
function authedUserOf(req, runtime) {
  const session = runtime.verifySession(parseCookies(req.headers.cookie)[runtime.config.cookieName]);
  if (session !== undefined) return session.user;
  const bearer = bearerTokenOf(req);
  if (bearer !== undefined && runtime.verifyToken(bearer)) return null; // 主令牌身份：无用户名
  return undefined;
}

// ── 页面（内联、无外部资源、无脚本依赖） ───────────────────────────────────

function pageShell(title, body) {
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    ':root { color-scheme: dark; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;',
    '  background: #0f1115; color: #e6e8ec;',
    '  font: 15px/1.6 system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }',
    '.card { width: min(92vw, 380px); background: #171a21; border: 1px solid #2a3038;',
    '  border-radius: 12px; padding: 28px; }',
    'h1 { font-size: 18px; margin: 0 0 6px; }',
    'p.sub { color: #9aa4b2; margin: 0 0 18px; font-size: 13px; }',
    'label { display: block; font-size: 13px; color: #c7cdd6; margin-bottom: 6px; }',
    'input { width: 100%; padding: 10px 12px; border-radius: 8px;',
    '  border: 1px solid #343b46; background: #0f1115; color: #e6e8ec; font-size: 14px; }',
    'input:focus { outline: 2px solid #3b82f6; outline-offset: 0; border-color: transparent; }',
    'input + label, label + input { margin-top: 12px; }',
    'button { margin-top: 16px; width: 100%; padding: 10px; border: 0; border-radius: 8px;',
    '  background: #3b82f6; color: #fff; font-size: 14px; cursor: pointer; }',
    'button:hover { background: #2f6fd6; }',
    '.note { margin: 12px 0 0; padding: 8px 10px; border-radius: 8px; font-size: 13px; }',
    '.note.error { background: #3a1d20; border: 1px solid #7f2b31; color: #f0878f; }',
    '.note.ok { background: #163325; border: 1px solid #256b40; color: #7fd6a0; }',
    '.hint { margin-top: 14px; font-size: 12px; color: #6b7280; }',
    '</style>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
  ].join('\n');
}

function loginPageHtml(runtime, next, error, loggedOut) {
  const note = error
    ? '<p class="note error">用户名或密码不正确，请重试。</p>'
    : loggedOut
      ? '<p class="note ok">已退出登录。</p>'
      : '';
  const fields = runtime.hasUsers
    ? [
      '<label for="username">用户名</label>',
      '<input id="username" name="username" type="text" autocomplete="username" autocapitalize="off" autofocus required>',
      '<label for="password">密码</label>',
      '<input id="password" name="password" type="password" autocomplete="current-password" required>',
      ...(runtime.hasToken
        ? ['<p class="hint" style="margin-top:12px">或使用主令牌：</p>', '<input name="token" type="password" placeholder="主令牌（可选）">']
        : []),
    ]
    : [
      '<label for="token">访问令牌</label>',
      '<input id="token" name="token" type="password" autocomplete="current-password" autofocus required>',
    ];
  return pageShell('DSH Web 认证', [
    `<form class="card" method="post" action="${LOGIN_PATH}" autocomplete="off">`,
    '<h1>DSH Web 认证</h1>',
    '<p class="sub">请登录后继续</p>',
    ...fields,
    `<input type="hidden" name="next" value="${escapeHtml(sanitizeNext(next))}">`,
    '<button type="submit">登录</button>',
    note,
    runtime.hasUsers
      ? '<p class="hint">账户由部署者管理；忘记密码请联系管理员重置。</p>'
      : '<p class="hint">主令牌由部署配置提供。</p>',
    '</form>',
  ].join('\n'));
}

function setupPageHtml(runtime, error) {
  const note = error ? '<p class="note error">信息无效，请检查后重试。</p>' : '';
  const hint = runtime.setupAllowed
    ? '<p class="hint">这是首次部署：创建第一个账户后，引导页将永久关闭。</p>'
    : '<p class="hint">账户已存在，引导页不可用。</p>';
  return pageShell('DSH Web 初始化', [
    `<form class="card" method="post" action="${SETUP_PATH}" autocomplete="off">`,
    '<h1>DSH Web 初始化</h1>',
    '<p class="sub">创建管理员账户</p>',
    '<label for="username">用户名</label>',
    '<input id="username" name="username" type="text" autocomplete="username" autocapitalize="off" autofocus required>',
    '<label for="password">密码</label>',
    '<input id="password" name="password" type="password" autocomplete="new-password" required minlength="8">',
    '<button type="submit">创建账户并前往登录</button>',
    note,
    hint,
    '</form>',
  ].join('\n'));
}

function servePage(req, res, body, status = 200) {
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
  };
  if (req.method === 'HEAD') {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  res.writeHead(status, headers);
  res.end(body);
}

function serveLogin(req, res, runtime, next, error, loggedOut) {
  servePage(req, res, loginPageHtml(runtime, next, error, loggedOut), 401);
}

function serveSetup(req, res, runtime, error) {
  servePage(req, res, setupPageHtml(runtime, error), runtime.setupAllowed ? 200 : 404);
}

// ── /__auth__/* 端点 ──────────────────────────────────────────────────────

async function handleLogin(req, res, runtime) {
  const url = new URL(req.url ?? '/', 'http://dsh.internal');
  const next = sanitizeNext(url.searchParams.get('next') ?? '');

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (authedUserOf(req, runtime) !== undefined) return redirect(res, next);
    if (runtime.setupAllowed) return serveSetup(req, res, runtime, false);
    return serveLogin(req, res, runtime, next, url.searchParams.get('error') === '1', url.searchParams.get('loggedout') === '1');
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'GET, HEAD, POST' });
    res.end();
    return;
  }

  let username = '';
  let password = '';
  let tokenValue = '';
  let nextValue = next;
  const contentType = (req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase();
  if (contentType === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(await readBody(req));
    username = params.get('username') ?? '';
    password = params.get('password') ?? '';
    tokenValue = params.get('token') ?? '';
    nextValue = sanitizeNext(params.get('next') ?? '');
  } else if (contentType === 'application/json') {
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    username = String(data?.username ?? '');
    password = String(data?.password ?? '');
    tokenValue = String(data?.token ?? '');
    nextValue = sanitizeNext(String(data?.next ?? ''));
  } else {
    res.writeHead(415, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('content type must be application/x-www-form-urlencoded or application/json');
    return;
  }

  const ip = req.socket.remoteAddress ?? 'unknown';
  const delay = runtime.throttleMs(ip);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  let user;
  if (runtime.hasUsers && username !== '' && password !== '') {
    user = await runtime.authenticate(username, password);
  } else if (tokenValue !== '' && runtime.verifyToken(tokenValue)) {
    user = { username: '(token)' };
  }

  if (user === undefined) {
    runtime.recordFailure(ip);
    return serveLogin(req, res, runtime, nextValue, true, false);
  }

  runtime.clearFailures(ip);
  const sessionId = runtime.createSession(user);
  return redirect(res, nextValue, { 'set-cookie': sessionCookieOf(runtime, sessionId) });
}

/**
 * setup 首次引导的同源判定（宽松版）：只拒绝“明显跨站”的提交——
 * 跨站标记，或 Origin 与 Host 不一致。
 *
 * 关键坑：真实 Chrome 对同源表单 POST 有时携带 `Origin: null`
 * （非用户激活的导航/脚本提交会把来源序列化为不透明值），**必须当作
 * 无 Origin 放行**；跨站表单攻击仍会带 `Sec-Fetch-Site: cross-site`
 * 或真实的攻击者 Origin，两者都会被拒绝。
 */
function isSetupOriginOk(req, log) {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    log?.warn(`web-auth: setup rejected (sec-fetch-site=cross-site) host=${String(req.headers.host)}`);
    return false;
  }
  const origin = req.headers.origin;
  if (origin === undefined || origin === 'null' || origin === '') return true;
  try {
    if (new URL(origin).host === req.headers.host) return true;
    log?.warn(`web-auth: setup rejected (origin mismatch) host=${String(req.headers.host)} origin=${origin}`);
    return false;
  } catch {
    log?.warn(`web-auth: setup rejected (origin unparsable) host=${String(req.headers.host)} origin=${origin}`);
    return false;
  }
}

async function handleSetup(req, res, runtime) {
  if (req.method !== 'POST') {
    if (req.method === 'GET' || req.method === 'HEAD') return serveSetup(req, res, runtime, false);
    res.writeHead(405, { allow: 'GET, POST' });
    res.end();
    return;
  }
  if (!runtime.setupAllowed) return redirect(res, LOGIN_PATH);
  if (!isSetupOriginOk(req, runtime.ctx.logger)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    return;
  }
  const contentType = (req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase();
  let username = '';
  let password = '';
  if (contentType === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(await readBody(req));
    username = params.get('username') ?? '';
    password = params.get('password') ?? '';
  } else if (contentType === 'application/json') {
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    username = String(data?.username ?? '');
    password = String(data?.password ?? '');
  } else {
    res.writeHead(415);
    res.end();
    return;
  }
  try {
    await runtime.addUser(username, password);
  } catch (error) {
    return serveSetup(req, res, runtime, true);
  }
  return redirect(res, `${LOGIN_PATH}?setup=1`);
}

function handleLogout(req, res, runtime) {
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' });
    res.end();
    return;
  }
  runtime.revokeSession(parseCookies(req.headers.cookie)[runtime.config.cookieName]);
  return redirect(res, `${LOGIN_PATH}?loggedout=1`, {
    'set-cookie': `${runtime.config.cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
  });
}

function handleStatus(req, res, runtime) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const user = authedUserOf(req, runtime);
  return sendJson(res, 200, {
    authed: user !== undefined,
    user: user ?? null,
    mode: runtime.mode,
    accounts: runtime.config.users.length,
  });
}

/** 已认证账户管理 API（GET 列表 / POST 新增、删除、重置密码）。 */
async function handleUsersApi(req, res, runtime) {
  const url = new URL(req.url ?? '/', 'http://dsh.internal');
  const path = url.pathname;
  const user = authedUserOf(req, runtime);
  if (user === undefined) {
    return sendJson(res, 401, { error: 'unauthorized', login: LOGIN_PATH });
  }

  if (req.method === 'GET' && (path === USERS_PATH || path === `${USERS_PATH}/`)) {
    return sendJson(res, 200, {
      users: runtime.config.users.map((entry) => ({ username: entry.username })),
      me: user ?? null,
      canRemove: runtime.config.users.length > 1,
    });
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'GET, POST' });
    res.end();
    return;
  }
  if (!isSameOriginRequest(req) || req.headers.origin === undefined) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    return;
  }
  const contentType = (req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    res.writeHead(415, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('content type must be application/json');
    return;
  }
  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  try {
    if (path === `${USERS_PATH}/add`) {
      await runtime.addUser(String(data?.username ?? ''), String(data?.password ?? ''));
      return sendJson(res, 200, { ok: true });
    }
    if (path === `${USERS_PATH}/remove`) {
      await runtime.removeUser(String(data?.username ?? ''));
      return sendJson(res, 200, { ok: true });
    }
    if (path === `${USERS_PATH}/password`) {
      await runtime.changePassword(String(data?.username ?? ''), String(data?.password ?? ''));
      return sendJson(res, 200, { ok: true });
    }
    res.writeHead(404);
    res.end();
    return;
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 网关：取下 webserver 内部处理器，认证通过时手动调用 ───────────────────

function installGate(server, runtime, log) {
  const nextRequest = server.listeners('request')[0];
  const nextUpgrade = server.listeners('upgrade')[0];
  if (nextRequest === undefined || nextUpgrade === undefined) {
    throw new Error('web-auth: webserver 内部监听器尚未注册，网关未能挂载');
  }
  const fencePort = server.address()?.port ?? 0;

  const onRequest = (req, res) => {
    gateRequest(req, res, runtime, nextRequest, fencePort).catch((error) => {
      log.warn('web-auth: request gate failed');
      log.warn(error);
      if (res.headersSent) res.destroy();
      else send(res, 500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, 'internal error');
    });
  };
  const onUpgrade = (req, socket, head) => {
    try {
      gateUpgrade(req, socket, head, runtime, nextUpgrade, fencePort);
    } catch (error) {
      log.warn('web-auth: upgrade gate failed');
      log.warn(error);
      socket.destroy();
    }
  };

  server.prependListener('request', onRequest);
  server.prependListener('upgrade', onUpgrade);
  server.removeListener('request', nextRequest);
  server.removeListener('upgrade', nextUpgrade);
  return () => {
    server.removeListener('request', onRequest);
    server.removeListener('upgrade', onUpgrade);
    server.on('request', nextRequest);
    server.on('upgrade', nextUpgrade);
  };
}

async function gateRequest(req, res, runtime, nextRequest, fencePort) {
  let pathname;
  try {
    pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
  } catch {
    return send(res, 400, { 'content-type': 'text/plain; charset=utf-8' }, 'bad request');
  }

  const authedUser = authedUserOf(req, runtime);

  if (pathname === LOGIN_PATH) return handleLogin(req, res, runtime);
  if (pathname === SETUP_PATH) return handleSetup(req, res, runtime);
  if (pathname === LOGOUT_PATH) return handleLogout(req, res, runtime);
  if (pathname === STATUS_PATH) return handleStatus(req, res, runtime);
  if (pathname === USERS_PATH || pathname.startsWith(`${USERS_PATH}/`)) return handleUsersApi(req, res, runtime);
  if (pathname === AUTH_PREFIX || pathname === `${AUTH_PREFIX}/`) return redirect(res, '/');

  if (authedUser !== undefined) {
    if (pathname.startsWith('/api/')) normalizeHostForTrustFence(req, fencePort);
    return nextRequest(req, res);
  }

  // 未认证：/api/* 给 JSON，方便脚本/代理判断；其余一律登录页（401）。
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 401, { error: 'unauthorized', login: LOGIN_PATH });
  }
  if (runtime.setupAllowed) return serveSetup(req, res, runtime, false);
  return serveLogin(req, res, runtime, pathname, false, false);
}

function gateUpgrade(req, socket, head, runtime, nextUpgrade, fencePort) {
  let pathname;
  try {
    pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
  } catch {
    socket.destroy();
    return;
  }
  if (authedUserOf(req, runtime) !== undefined) {
    normalizeHostForTrustFence(req, fencePort);
    return nextUpgrade(req, socket, head);
  }
  const body = 'unauthorized';
  socket.end([
    'HTTP/1.1 401 Unauthorized',
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n'));
}

// ── 插件入口 ──────────────────────────────────────────────────────────────

export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(SETTINGS_NAMESPACE, SettingsConfig, {
      base: {},
      applies: 'live',
      validate: validateSettings,
    });
    const runtime = new AuthRuntime(settingsCtx, scope);
    runtime.sync(scope.get());
    const unwatch = scope.watch((next) => runtime.sync(next));
    settingsCtx.effect(() => async () => {
      unwatch();
      await runtime.dispose();
    }, 'web-auth runtime');
    settingsCtx.inject(['webServer'], (webCtx) => {
      const log = webCtx.logger;
      log.info(`web-auth: 认证网关就绪（${runtime.mode === 'disabled' ? '未配置账户/令牌，开放访问' : runtime.mode + ' 模式，' + String(runtime.config.users.length) + ' 个账户'}）。`);
      webCtx.effect(() => {
        let timer;
        let disposer;
        const attempt = () => {
          const server = webCtx.webServer?.server;
          if (server === undefined) {
            timer = setTimeout(attempt, 75);
            return;
          }
          try {
            disposer = installGate(server, runtime, log);
            const host = webCtx.webServer.host ?? '127.0.0.1';
            const port = webCtx.webServer.port;
            log.info(`web-auth: 网关已挂载 — http://${String(host)}:${String(port)} 需登录后访问。`);
          } catch (error) {
            log.error('web-auth: 网关挂载失败，请检查 DSH 版本兼容性：');
            log.error(error);
          }
        };
        attempt();
        return () => {
          clearTimeout(timer);
          disposer?.();
        };
      }, 'web-auth gate');
    });
  });
}

apply.inject = [];

export default apply;
