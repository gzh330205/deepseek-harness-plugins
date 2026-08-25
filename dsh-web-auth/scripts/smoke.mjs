/**
 * dsh-web-auth 端到端冒烟测试：不启动完整 DSH，用一个根 Context 装配
 * 「webserver + 真实 settings 提供商（临时文件）+ 本插件 + 测试回退 +
 * 测试 WebSocket 升级路由」，逐项断言网关行为。
 *
 * 场景：
 *   1. 首次部署：无账户 → 初始化引导页 → 创建第一个账户 → 引导页关闭；
 *   2. 用户名+密码登录 / 错误密码 / 登录限速；
 *   3. 账户管理 API（增删、重置密码、撤销会话、禁止删除最后一个账户）；
 *   4. 会话 Cookie 访问页面与 WebSocket 升级；
 *   5. 主令牌（Bearer）仍可用；
 *   6. 卸载网关后内部处理器完好归还。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file';
import { apply as webAuth } from '../index.js';

const ADMIN = 'admin';
const ADMIN_PASSWORD = 'correct-horse-battery';
const TOKEN = 'master-token-123456';

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}`);
}

function get(url, headers = {}) {
  return new Promise((resolve) => {
    const client = http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    client.on('error', (error) => resolve({ status: 0, error }));
  });
}

function request(method, url, headers = {}, body) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const client = http.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    client.on('error', (error) => resolve({ status: 0, error }));
    if (body !== undefined) client.write(body);
    client.end();
  });
}

function postForm(url, fields, headers = {}) {
  const body = new URLSearchParams(fields).toString();
  return request('POST', url, {
    ...headers,
    'content-type': 'application/x-www-form-urlencoded',
    'content-length': String(Buffer.byteLength(body)),
  }, body);
}

function postJson(url, value, headers = {}) {
  const body = JSON.stringify(value);
  return request('POST', url, {
    ...headers,
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body)),
  }, body);
}

function loginForm(base, fields) {
  return postForm(`${base}/__auth__/login`, fields, {
    origin: `http://127.0.0.1:${new URL(base).port}`,
  });
}

function upgrade(port, pathname, cookie) {
  return new Promise((resolve) => {
    const client = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: 'GET',
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'sec-websocket-version': '13',
        ...(cookie === undefined ? {} : { cookie }),
      },
    });
    let settled = false;
    const settle = (status) => {
      if (settled) return;
      settled = true;
      resolve(status);
    };
    client.on('upgrade', (res) => {
      settle(res.statusCode);
      client.destroy();
    });
    client.on('response', (res) => {
      res.resume();
      res.on('end', () => settle(res.statusCode));
    });
    client.on('error', () => settle(0));
    client.end();
  });
}

function cookieOf(responseSetCookie, name) {
  for (const raw of responseSetCookie ?? []) {
    if (raw.startsWith(`${name}=`)) return raw;
  }
  return undefined;
}

async function boot(seed = '') {
  const dir = await mkdtemp(join(tmpdir(), 'web-auth-smoke-'));
  const settingsPath = join(dir, 'settings.yaml');
  if (seed !== '') await writeFile(settingsPath, seed, 'utf8');
  const ctx = new Context();
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  await ctx.plugin(FileSettingsProvider, { path: settingsPath, watch: false });
  const authFiber = await ctx.plugin(webAuth, {});
  ctx.webServer.registerFallback(async (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`fallback-ok:${req.url}|host=${req.headers.host}`);
  });
  ctx.webServer.registerUpgrade({
    path: '/api/test-ws',
    handler: (req, socket) => {
      socket.write([
        'HTTP/1.1 101 Switching Protocols',
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Accept: accepted',
        '',
        '',
      ].join('\r\n'));
      setTimeout(() => socket.destroy(), 25);
    },
  });
  return { ctx, authFiber, dir, port: ctx.webServer.port, settingsPath };
}

async function usersScenario() {
  const { ctx, authFiber, dir, port } = await boot();
  const base = `http://127.0.0.1:${port}`;
  const origin = `http://127.0.0.1:${port}`;
  check('server bound', port > 0, `port=${port}`);

  // 1. 首次部署：任意页面 → 初始化引导页（401/200 均可，页面含“初始化”）
  const first = await get(`${base}/`);
  check('fresh deploy shows setup page', first.body.includes('DSH Web 初始化'));

  // 2. setup 需同源 POST；跨源被拒（真实 Chrome 会带 Origin: null —— 必须放行）
  const crossOrigin = await postForm(`${base}/__auth__/setup`, { username: ADMIN, password: ADMIN_PASSWORD }, { origin: 'http://evil.example' });
  check('setup with cross-site origin is 403', crossOrigin.status === 403);

  // 3. 创建第一个账户（模拟真实 Chrome：Origin: null + 同源站点）
  const setup = await postForm(`${base}/__auth__/setup`, { username: ADMIN, password: ADMIN_PASSWORD }, { origin: 'null', 'sec-fetch-site': 'same-origin' });
  check('setup creates first account with Origin:null (real Chrome)', setup.status === 303 && setup.headers.location.includes('/__auth__/login'));

  // 4. 引导页永久关闭：再访问 setup 只能重定向/404
  const setupAgain = await get(`${base}/__auth__/setup`);
  check('setup page closed after first account', setupAgain.status === 404);
  const setupReplay = await postForm(`${base}/__auth__/setup`, { username: 'hacker', password: 'password123' }, { origin });
  check('setup POST rejected after first account', setupReplay.status === 303 && setupReplay.headers.location.startsWith('/__auth__/login'));

  // 5. 未认证访问 → 401 登录页（用户名+密码表单）
  const anon = await get(`${base}/`);
  check('unauthenticated / is 401 with login form', anon.status === 401 && anon.body.includes('用户名') && anon.body.includes('密码'));
  check('login page never leaks hashes', !anon.body.includes('scrypt$'));

  // 6. 错误密码 → 401 + 无 Cookie
  const badLogin = await loginForm(base, { username: ADMIN, password: 'wrong-password' });
  check('wrong password login is 401', badLogin.status === 401);
  check('wrong password sets no cookie', cookieOf(badLogin.headers['set-cookie'], 'dsh_web_auth') === undefined);

  // 7. 正确用户名+密码 → 303 + Cookie
  const goodLogin = await loginForm(base, { username: ADMIN, password: ADMIN_PASSWORD, next: '/workspace' });
  const setCookie = cookieOf(goodLogin.headers['set-cookie'], 'dsh_web_auth');
  const cookieHeader = setCookie?.split(';')[0];
  check('good login is 303 to next', goodLogin.status === 303 && goodLogin.headers.location === '/workspace');
  check('login sets HttpOnly SameSite cookie', setCookie !== undefined && setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Strict'));

  // 8. 会话可访问页面（回退）
  const home = await get(`${base}/`, { cookie: cookieHeader });
  check('authenticated request reaches fallback', home.status === 200 && home.body.startsWith('fallback-ok:/'));

  // 9. status
  const status = await get(`${base}/__auth__/status`, { cookie: cookieHeader });
  const statusData = JSON.parse(status.body);
  check('status reports authenticated user', status.status === 200 && statusData.authed === true && statusData.user === ADMIN && statusData.mode === 'users');

  // 9b. 已认证 + 非回环 Host → /api 请求的 Host 被规范回环（DSH 信任面兼容）
  const hostProbe = await get(`${base}/api/host-probe`, { cookie: cookieHeader, host: 'my-computer.local:9999' });
  check('non-loopback /api Host is normalized to loopback', hostProbe.status === 200 && hostProbe.body.includes(`host=127.0.0.1:${port}`));
  const hostProbeAnon = await get(`${base}/api/host-probe`, { host: 'my-computer.local:9999' });
  check('unauthenticated non-loopback /api is still 401', hostProbeAnon.status === 401);

  // 10. 账户管理 API
  const usersAnon = await get(`${base}/__auth__/users`);
  check('users API unauthenticated is 401', usersAnon.status === 401);

  const crossApi = await postJson(`${base}/__auth__/users/add`, { username: 'bob', password: 'password123' }, { cookie: cookieHeader, origin: 'http://evil.example' });
  check('users API cross-site is 403', crossApi.status === 403);

  const list = await get(`${base}/__auth__/users`, { cookie: cookieHeader });
  const listData = JSON.parse(list.body);
  check('users API lists accounts', list.status === 200 && listData.users.length === 1 && listData.users[0].username === ADMIN);

  const addBob = await postJson(`${base}/__auth__/users/add`, { username: 'bob', password: 'password123' }, { cookie: cookieHeader, origin });
  check('add account works', addBob.status === 200);

  const addDup = await postJson(`${base}/__auth__/users/add`, { username: 'bob', password: 'password123' }, { cookie: cookieHeader, origin });
  check('duplicate account is 400', addDup.status === 400, `status=${addDup.status} body=${addDup.body.slice(0, 120)}`);

  // bob 登录 → 会话
  const bobLogin = await loginForm(base, { username: 'bob', password: 'password123' });
  const bobCookie = cookieOf(bobLogin.headers['set-cookie'], 'dsh_web_auth')?.split(';')[0];
  check('second account can log in', bobLogin.status === 303 && bobCookie !== undefined);

  // 重置 bob 密码 → bob 会话立即失效
  const reset = await postJson(`${base}/__auth__/users/password`, { username: 'bob', password: 'new-password-123' }, { cookie: cookieHeader, origin });
  check('reset password succeeds', reset.status === 200, `status=${reset.status} body=${reset.body.slice(0, 120)}`);
  const bobAfter = await get(`${base}/`, { cookie: bobCookie });
  check('reset password revokes existing session', bobAfter.status === 401, `status=${bobAfter.status}`);
  const bobNewLogin = await loginForm(base, { username: 'bob', password: 'new-password-123' });
  check('bob logs in with new password', bobNewLogin.status === 303, `status=${bobNewLogin.status}`);

  // 删除 bob
  const delBob = await postJson(`${base}/__auth__/users/remove`, { username: 'bob' }, { cookie: cookieHeader, origin });
  check('remove account works', delBob.status === 200, `status=${delBob.status} body=${delBob.body.slice(0, 120)}`);
  const bobGone = await loginForm(base, { username: 'bob', password: 'new-password-123' });
  check('removed account cannot log in', bobGone.status === 401);

  // 禁止删除最后一个账户
  const delLast = await postJson(`${base}/__auth__/users/remove`, { username: ADMIN }, { cookie: cookieHeader, origin });
  check('removing the last account is 400', delLast.status === 400, `status=${delLast.status} body=${delLast.body.slice(0, 120)}`);

  // 11. WebSocket 升级：未认证 401 / 已认证 101
  const wsAnon = await upgrade(port, '/api/test-ws');
  check('unauthenticated websocket upgrade is 401', wsAnon === 401);
  const wsAuthed = await upgrade(port, '/api/test-ws', cookieHeader);
  check('authenticated websocket upgrade is 101', wsAuthed === 101, `status=${wsAuthed}`);

  // 12. 登出 → 会话撤销
  const logout = await request('POST', `${base}/__auth__/logout`, { cookie: cookieHeader });
  check('logout is 303 with Max-Age=0', logout.status === 303 && (logout.headers['set-cookie'] ?? []).some((raw) => raw.includes('Max-Age=0')));
  const afterLogout = await get(`${base}/`, { cookie: cookieHeader });
  check('revoked session is rejected after logout', afterLogout.status === 401);

  // 13. 卸载网关后内部处理器完好归还
  await authFiber.dispose();
  const restored = await get(`${base}/`);
  check('gate disposal restores webserver handler', restored.status === 200 && restored.body.startsWith('fallback-ok:/'));

  await ctx.fiber.dispose();
  await rm(dir, { recursive: true, force: true });
}

async function tokenScenario() {
  // 无账户 + 主令牌（模拟部署前在 settings.yaml 里预配置 token）
  const seed = ['web-auth:', `  token: ${TOKEN}`, '', ''].join('\n');
  const { ctx, dir, port } = await boot(seed);
  const base = `http://127.0.0.1:${port}`;

  const anon = await get(`${base}/`);
  check('token mode login page shows token field', anon.status === 401 && anon.body.includes('访问令牌') && !anon.body.includes('用户名'));

  const login = await postForm(`${base}/__auth__/login`, { token: TOKEN }, { origin: `http://127.0.0.1:${port}` });
  const cookie = cookieOf(login.headers['set-cookie'], 'dsh_web_auth')?.split(';')[0];
  check('master token login is 303 with cookie', login.status === 303 && cookie !== undefined);

  const bearer = await get(`${base}/`, { authorization: `Bearer ${TOKEN}` });
  check('master token bearer passes gate', bearer.status === 200 && bearer.body.startsWith('fallback-ok:/'));

  const badBearer = await get(`${base}/`, { authorization: 'Bearer wrong' });
  check('wrong bearer is 401', badBearer.status === 401);

  const status = await get(`${base}/__auth__/status`, { cookie: cookie });
  check('token mode status', status.status === 200 && status.body.includes('"authed":true') && status.body.includes('"mode":"token"'));

  await ctx.fiber.dispose();
  await rm(dir, { recursive: true, force: true });
}

async function main() {
  await usersScenario();
  await tokenScenario();
  console.log('──');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
