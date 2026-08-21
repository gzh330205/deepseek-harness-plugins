/**
 * dsh-oneway-usage-monitor — Host half.
 *
 * Fetches the OneWay gateway (oneway.eportyun.com) dashboard pages with the
 * user's session cookie, parses the server-rendered HTML into normalized
 * JSON, and serves it to the Web client through same-origin routes.
 *
 * Authentication is WeCom (企业微信) QR scan login implemented host-side:
 * the host drives the oauth.eportyun.com → login.work.weixin.qq.com SSO
 * chain, exposes the QR image to the client, polls the scan status, and
 * captures the gateway session cookie from the final redirect chain.
 */
import z from '@deepseek-ai/schemastery';
import { randomBytes } from 'node:crypto';

/** Persistent settings namespace owned by this plugin. */
export const SETTINGS_NAMESPACE = 'oneway-usage-monitor';
const ROUTE = '/dsh-oneway-usage/v1';
const TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_REDIRECTS = 10;
const REQUEST_TIMEOUT_MS = 20000;
const LOG_CACHE_TTL_MS = 15000;

// OneWay gateway SSO (observed from the /login page).
const SSO_ENTRY = 'https://oauth.eportyun.com/sso/login';
const SSO_CLIENT_ID = '2ff94fad-0c13-4788-a137-ca32d7080537';
const WECOM_LOGIN_ORIGIN = 'https://login.work.weixin.qq.com';
const WECOM_QR = `${WECOM_LOGIN_ORIGIN}/wwlogin/sso/qrcode`;
const WECOM_POLL = `${WECOM_LOGIN_ORIGIN}/wwlogin/monoApi/sso/login/getWebQrCodeStatus`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const Config = z.object({
  /** Gateway base URL. */
  baseUrl: z.string().default('https://oneway.eportyun.com'),
  /** How often the host refreshes the cached usage (seconds). */
  refreshSeconds: z.number().min(30).max(3600).default(120),
  /** Whether the floating widget is shown. */
  showWidget: z.boolean().default(true),
  /** Persisted gateway session cookie jar (serialized JSON). Host-only secret. */
  sessionCookie: z.string().role('secret').default(''),
  /** Deprecated: kept for settings-file compatibility; no longer used. */
  ringCap5h: z.number().min(0).default(0),
  ringCapToday: z.number().min(0).default(0),
  /** Weekly full-ring reference in tokens; 0 = use the current week's usage. */
  ringCapWeek: z.number().min(0).default(0),
});

function validateConfiguration(config) {
  if (!/^https?:\/\/[^\s/]+$/i.test(config.baseUrl.trim())) throw new Error('网关地址必须是 http(s) URL。');
  if (config.refreshSeconds < 30 || config.refreshSeconds > 3600) throw new Error('刷新间隔需在 30–3600 秒之间。');
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function randomId() { return Math.floor(Math.random() * 1e9).toString(); }

/** Decode a string taken from the NUXT JSON body: "\u002F" means "/". */
function decodeNuxtString(value) {
  return String(value).replace(/\\u002F/g, '/');
}

function unescapeHtml(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

/** Parse a displayed magnitude like "76.70M", "103.1K", "3,411", "49.3分钟", "不限". */
function parseMagnitude(text) {
  if (text === undefined || text === null) return null;
  const raw = unescapeHtml(String(text)).trim();
  if (raw === '' || raw === '不限' || raw === '—' || raw === '-') return null;
  const match = /^([\d,.]+)\s*([MK万亿])?/.exec(raw);
  if (!match) return null;
  let value = Number(match[1].replace(/,/g, ''));
  if (Number.isNaN(value)) return null;
  const unit = match[2];
  if (unit === 'M') value *= 1e6;
  else if (unit === 'K') value *= 1e3;
  else if (unit === '万') value *= 1e4;
  else if (unit === '亿') value *= 1e8;
  return value;
}

function formatTokens(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

/* ------------------------------------------------------------------ */
/* Cookie jar (in-memory + persisted as serialized JSON in settings)   */
/* ------------------------------------------------------------------ */

export class CookieJar {
  constructor() { this.cookies = new Map(); }

  static restore(serialized) {
    const jar = new CookieJar();
    try {
      const list = JSON.parse(serialized);
      if (Array.isArray(list)) for (const item of list) jar.set(item);
    } catch { /* corrupted value is ignored */ }
    return jar;
  }

  set({ name, value, domain = '', path = '/', expires }) {
    if (!name) return;
    this.cookies.set(`${domain}|${path}|${name}`, { name, value, domain, path, expires: expires ?? 0 });
  }

  addFromResponse(requestUrl, setCookieHeaders) {
    const url = new URL(requestUrl);
    for (const header of setCookieHeaders ?? []) {
      const parts = header.split(';');
      const [pair] = parts;
      const sep = pair.indexOf('=');
      if (sep <= 0) continue;
      let name = pair.slice(0, sep).trim();
      let value = pair.slice(sep + 1).trim();
      if (name.startsWith('__Secure-') || name.startsWith('__Host-')) {
        // Host-only cookies still travel to the same host; keep the prefix.
        name = name.replace(/^__(Secure|Host)-/, '');
        value = value;
      }
      let domain = '';
      let path = '/';
      let expires = 0;
      for (const part of parts.slice(1)) {
        const [key, ...rest] = part.trim().split('=');
        const val = rest.join('=');
        if (key.toLowerCase() === 'domain') domain = val.toLowerCase();
        else if (key.toLowerCase() === 'path') path = val || '/';
        else if (key.toLowerCase() === 'expires') expires = Date.parse(val) || 0;
        else if (key.toLowerCase() === 'max-age') expires = Date.now() + (Number(val) || 0) * 1000;
      }
      if (domain === '') domain = url.hostname;
      if (!domain.startsWith('.') && domain !== url.hostname) domain = url.hostname;
      this.set({ name, value, domain, path, expires });
    }
  }

  headerFor(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    const now = Date.now();
    const picked = [];
    for (const cookie of this.cookies.values()) {
      if (cookie.expires > 0 && cookie.expires < now) continue;
      const domain = cookie.domain.toLowerCase();
      const hostMatch = domain.startsWith('.') ? hostname.endsWith(domain) || hostname === domain.slice(1) : hostname === domain;
      if (!hostMatch) continue;
      const path = cookie.path || '/';
      const requestPath = new URL(url).pathname;
      if (!requestPath.startsWith(path)) continue;
      picked.push(`${cookie.name}=${cookie.value}`);
    }
    return picked.join('; ');
  }

  hasFor(url) { return this.headerFor(url) !== ''; }

  serialize() {
    return JSON.stringify([...this.cookies.values()].map(({ name, value, domain, path, expires }) => ({ name, value, domain, path, expires })));
  }
}

/* ------------------------------------------------------------------ */
/* HTML parsing (server-rendered pages of the gateway)                 */
/* ------------------------------------------------------------------ */

const STAT_SECTION_RE = /<h3 class="mb-2 text-xs font-semibold text-slate-500">([^<]+)<\/h3><div class="grid[^"]*">([\s\S]*?)<\/div><\/div>/g;
const STAT_CELL_RE = /<p class="text-xs text-slate-400">([^<]+)<\/p><p class="text-lg font-semibold text-slate-700">([^<]*)<\/p>/g;
const CHANNEL_TABLE_RE = /<h3 class="text-xs font-semibold text-slate-500 mb-2">按渠道用量\s*\/\s*限额<\/h3>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/;
const CHANNEL_ROW_RE = /<tr>(<td[^>]*>[^<]*<\/td>){8}<\/tr>/g;
const MODEL_BLOCK_RE = /<div class="rounded-lg border border-slate-200 px-4 py-3">([\s\S]*?)<\/div><\/div>/g;
const LOG_ROW_RE = /<tr><td class="font-mono[^"]*">([^<]*)<\/td><td class="font-medium">([^<]*)<\/td><td class="text-slate-500">([^<]*)<\/td><td class="text-slate-500">([^<]*)<\/td><td><span class="[^"]*">([^<]*)<\/span><\/td><td class="text-slate-500">([^<]*)<\/td><td class="text-right[^"]*">([^<]*)<\/td><td class="text-right[^"]*">([^<]*)<\/td><td><a href="\/my-requests\/(\d+)[^"]*"[^>]*>/g;

function extractJsonArray(html, marker) {
  const match = new RegExp(`id="${marker}"[\\s\\S]*?var data = (\\[[\\s\\S]*?\\]);`).exec(html);
  if (!match) return [];
  try { return JSON.parse(match[1]); } catch { return []; }
}

/** Parse /my-usage into a normalized usage document. */
export function parseUsage(html, baseUrl) {
  const document = { user: null, apiKey: null, tokens: {}, requests: {}, duration: {}, channels: [], models: [], hourly: [], daily: [], pageUrl: `${baseUrl}/my-usage` };

  const nameMatch = /姓名：([^<]+)</.exec(html);
  if (nameMatch) document.user = unescapeHtml(nameMatch[1]).trim();

  const keyMatch = /<code class="px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono break-all">([^<]+)<\/code>/.exec(html);
  if (keyMatch) document.apiKey = unescapeHtml(keyMatch[1]).trim();

  const sections = { 'Token 用量': 'tokens', '请求次数': 'requests', '使用时长': 'duration' };
  for (const match of html.matchAll(STAT_SECTION_RE)) {
    const label = unescapeHtml(match[1]).trim();
    const target = sections[label];
    if (!target) continue;
    const values = {};
    for (const cell of match[2].matchAll(STAT_CELL_RE)) {
      const key = { '近 5 小时': 'h5', '今日': 'today', '本周': 'week', '本月': 'month', '本年': 'year' }[unescapeHtml(cell[1]).trim()];
      if (key) values[key] = parseMagnitude(cell[2]);
    }
    document[target] = values;
  }

  const tableMatch = CHANNEL_TABLE_RE.exec(html);
  if (tableMatch) {
    const keys = ['channel', 'h5', 'h5Limit', 'today', 'week', 'weekLimit', 'month', 'year'];
    for (const row of tableMatch[1].matchAll(CHANNEL_ROW_RE)) {
      const cells = [...row[0].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((cell) => unescapeHtml(cell[1]).trim());
      if (cells.length !== keys.length) continue;
      const channel = { channel: cells[0] };
      for (let index = 1; index < keys.length; index += 1) channel[keys[index]] = parseMagnitude(cells[index]);
      document.channels.push(channel);
    }
  }

  for (const match of html.matchAll(MODEL_BLOCK_RE)) {
    const block = match[1];
    const nameMatch = /text-sm font-semibold text-slate-700">([^<]+)<\/span>/.exec(block);
    if (!nameMatch) continue;
    const models = [...block.matchAll(/class="text-xs px-2 py-0\.5 rounded bg-blue-50 text-blue-600"[^>]*>([^<]+)<\/span>/g)].map((item) => unescapeHtml(item[1]).trim());
    document.models.push({ channel: unescapeHtml(nameMatch[1]).replace(/^🔗\s*/, '').trim(), count: models.length, models });
  }

  document.hourly = extractJsonArray(html, 'myHourlyChart');
  document.daily = extractJsonArray(html, 'myTrendChart');
  return document;
}

/** Parse /my-requests into a normalized log page. */
export function parseLogs(html, baseUrl, page, pageSize) {
  const rows = [];
  for (const match of html.matchAll(LOG_ROW_RE)) {
    rows.push({
      id: match[9],
      time: unescapeHtml(match[1]).trim(),
      model: unescapeHtml(match[2]).trim(),
      key: unescapeHtml(match[3]).trim(),
      channel: unescapeHtml(match[4]).trim(),
      status: unescapeHtml(match[5]).trim(),
      stream: unescapeHtml(match[6]).trim(),
      latency: unescapeHtml(match[7]).trim(),
      tokens: parseMagnitude(match[8]),
    });
  }
  const totalMatch = /共\s*([\d,]+)\s*条/.exec(html);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : null;
  let pages = null;
  if (total !== null && pageSize > 0) pages = Math.max(1, Math.ceil(total / pageSize));
  return { rows, total, page, pageSize, pages };
}

/* ------------------------------------------------------------------ */
/* Gateway client                                                      */
/* ------------------------------------------------------------------ */

class AuthError extends Error { }

export class GatewayRuntime {
  constructor(scope) {
    this.scope = scope;
    this.jar = CookieJar.restore(scope.get().sessionCookie);
    this.cache = null;          // { data, at, user }
    this.lastError = null;
    this.flow = null;           // active login flow
    this.logCache = null;       // { key, at, payload }
  }

  get baseUrl() { return this.scope.get().baseUrl.trim().replace(/\/+$/, ''); }

  async fetchHtml(path, { followLogin = true } = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': UA, ...(this.jar.headerFor(url) ? { cookie: this.jar.headerFor(url) } : {}) },
    });
    const finalUrl = response.url || url;
    const html = await response.text();
    if (response.status === 401 || response.status === 403 || /\/login(?:\?|$)/.test(finalUrl) || html.includes('<title>登录 -')) {
      throw new AuthError('未登录或会话已过期，请重新扫码登录。');
    }
    return { html, url: finalUrl };
  }

  /** Refresh the cached usage document. */
  async refresh({ force = false } = {}) {
    const config = this.scope.get();
    if (!config.sessionCookie) {
      this.cache = null;
      this.lastError = '尚未登录。';
      return null;
    }
    if (!force && this.cache && Date.now() - this.cache.at < config.refreshSeconds * 1000) return this.cache.data;
    try {
      const { html } = await this.fetchHtml('/my-usage');
      const data = parseUsage(html, this.baseUrl);
      if (!data.user) throw new Error('网关页面结构变化，未能解析用户信息。');
      this.cache = { data, at: Date.now(), user: data.user };
      this.lastError = null;
      return data;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      if (error instanceof AuthError) this.cache = null;
      throw error;
    }
  }

  async fetchLogs({ startDate, endDate, page = 1, pageSize = 10 } = {}) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('page', String(page));
    params.set('pageSize', String(Math.min(Math.max(1, pageSize), 50)));
    const query = params.toString();
    const key = query;
    if (this.logCache && this.logCache.key === key && Date.now() - this.logCache.at < LOG_CACHE_TTL_MS) return this.logCache.payload;
    const { html } = await this.fetchHtml(`/my-requests?${query}`);
    const payload = parseLogs(html, this.baseUrl, page, Math.min(Math.max(1, pageSize), 50));
    this.logCache = { key, at: Date.now(), payload };
    return payload;
  }

  async verifySession() {
    const config = this.scope.get();
    if (!config.sessionCookie) return { ok: false, user: null };
    try {
      await this.refresh({ force: true });
      return { ok: true, user: this.cache?.data.user ?? null };
    } catch {
      return { ok: false, user: null };
    }
  }

  clearSession() {
    this.jar = new CookieJar();
    this.cache = null;
    this.logCache = null;
    this.lastError = null;
    this.scope.update({ sessionCookie: '' }).catch(() => {});
  }

  /* ------------------------- login flow ------------------------- */

  async startLogin({ refresh = false } = {}) {
    // Reuse the in-flight flow unless the client explicitly asks for a fresh QR
    // (e.g. the previous one expired or the user clicked "刷新二维码").
    if (!refresh && this.flow && Date.now() - this.flow.startedAt < 10 * 60 * 1000) return { qrUrl: this.flow.qrUrl };
    const flowJar = new CookieJar();
    const entry = `${SSO_ENTRY}?client_id=${SSO_CLIENT_ID}&scope=snsapi_base`;
    const response = await fetch(entry, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': UA },
    });
    flowJar.addFromResponse(entry, response.headers.getSetCookie?.() ?? []);
    const location = response.headers.get('location');
    if (!location) throw new Error('无法发起企业微信登录：SSO 未返回跳转地址。');
    const wecomUrl = new URL(location, entry).toString();
    const pageResponse = await fetch(wecomUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': UA },
    });
    flowJar.addFromResponse(wecomUrl, pageResponse.headers.getSetCookie?.() ?? []);
    const html = await pageResponse.text();
    const keyMatch = /"web_key":"([a-f0-9]+)"/.exec(html);
    if (!keyMatch) throw new Error('无法解析企业微信扫码页（web_key 缺失）。');
    // The browser completes OAuth with the URL-DECODED state embedded in the page
    // (spaces, not "+"), re-encoded with encodeURIComponent. Reproduce that exact
    // round trip, or the SSO rejects the callback (the state in the Location URL is
    // the raw "+" form and must NOT be used as-is). The NUXT JSON also escapes "/"
    // as \u002F — decode it like a JSON parser would, or the SSO 500s on state.
    let state = '';
    const stateMatch = /"state":"([^"]*)"/.exec(html);
    if (stateMatch) state = decodeNuxtString(stateMatch[1]);
    else {
      const fromUrl = /[?&]state=([^&]+)/.exec(location);
      if (fromUrl) { try { state = decodeURIComponent(fromUrl[1].replace(/\+/g, '%2B')); } catch { state = fromUrl[1]; } }
    }
    this.flow = {
      webKey: keyMatch[1],
      state,
      redirectUri: this.extractRedirectUri(html),
      wecomUrl,
      startedAt: Date.now(),
      lastStatus: 0,
      qrUrl: `${WECOM_QR}?key=${keyMatch[1]}`,
      jar: flowJar,
    };
    return { qrUrl: this.flow.qrUrl };
  }

  extractRedirectUri(html) {
    const match = /"redirect_uri":"([^"]*)"/.exec(html);
    if (!match) return 'https://oauth.eportyun.com/sso/wecom/callback';
    return decodeNuxtString(match[1]);
  }

  async pollLogin() {
    const flow = this.flow;
    if (!flow) return { phase: 'none' };
    if (Date.now() - flow.startedAt > 10 * 60 * 1000) return { phase: 'expired' };
    const body = `webKey=${encodeURIComponent(flow.webKey)}&lastStatus=${flow.lastStatus}&openDataSid=`;
    const response = await fetch(`${WECOM_POLL}?lang=zh_CN&ajax=1&f=json&random=${randomId()}`, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': UA,
        referer: flow.wecomUrl,
        origin: WECOM_LOGIN_ORIGIN,
      },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    const data = payload?.data ?? {};
    const status = typeof data.status === 'string' ? data.status : null;
    if (status === null) return { phase: 'error', message: `扫码状态接口异常：${JSON.stringify(payload).slice(0, 120)}` };
    if (status === 'QRCODE_SCAN_NEVER') { flow.lastStatus = 0; return { phase: 'waiting' }; }
    if (status === 'QRCODE_SCAN_ING') { flow.lastStatus = 1; return { phase: 'scanned' }; }
    if (status === 'QRCODE_SCAN_FAIL' || status === 'QRCODE_SCAN_ERR') return { phase: 'failed', message: '扫码失败，请刷新二维码重试。' };
    if (status === 'QRCODE_SCAN_PC_BIND') return { phase: 'failed', message: '请在 PC 端绑定后重试。' };
    if (status === 'QRCODE_SCAN_SUCC') {
      const authCode = data.auth_code ?? data.code ?? data.authCode;
      if (typeof authCode !== 'string' || authCode === '') {
        return { phase: 'error', message: `扫码成功但未取得授权码（响应：${JSON.stringify(data).slice(0, 200)}），请重试。` };
      }
      try {
        await this.completeLogin(flow, authCode);
        const user = this.cache?.data.user ?? null;
        this.flow = null;
        return { phase: 'success', user };
      } catch (error) {
        return { phase: 'error', message: error instanceof Error ? error.message : String(error) };
      }
    }
    return { phase: 'error', message: `未知扫码状态：${status}` };
  }

  async completeLogin(flow, authCode) {
    const callback = new URL(flow.redirectUri);
    callback.searchParams.set('code', authCode);
    callback.searchParams.set('state', flow.state);
    const jar = new CookieJar();
    // Carry over cookies captured at the SSO entry / WeCom page hops.
    if (flow.jar) for (const cookie of flow.jar.cookies.values()) jar.set(cookie);
    let current = callback.toString();
    let lastStatus = 0;
    for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'user-agent': UA, ...(jar.headerFor(current) ? { cookie: jar.headerFor(current) } : {}) },
      });
      jar.addFromResponse(current, response.headers.getSetCookie?.() ?? []);
      lastStatus = response.status;
      const location = response.headers.get('location');
      if (location && [301, 302, 303, 307, 308].includes(response.status)) {
        current = new URL(location, current).toString();
        continue;
      }
      await response.arrayBuffer();
      break;
    }
    const config = this.scope.get();
    // Some gateways only set the session cookie on the first authenticated page
    // after the SSO handshake; probe the dashboard once before giving up.
    if (!jar.hasFor(config.baseUrl)) {
      const probe = await fetch(`${config.baseUrl}/my-usage`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'user-agent': UA, ...(jar.headerFor(config.baseUrl) ? { cookie: jar.headerFor(config.baseUrl) } : {}) },
      });
      jar.addFromResponse(probe.url || `${config.baseUrl}/my-usage`, probe.headers.getSetCookie?.() ?? []);
      await probe.arrayBuffer();
    }
    if (!jar.hasFor(config.baseUrl)) {
      throw new Error(`登录链路未取得网关会话 Cookie（终点：${current}，HTTP ${lastStatus}）。如网关登录页有验证码或需手动确认，请改用浏览器登录后复制 Cookie。`);
    }
    this.jar = jar;
    await this.scope.update({ sessionCookie: jar.serialize() });
    // Verify by fetching the real dashboard.
    try {
      await this.refresh({ force: true });
    } catch (error) {
      await this.scope.update({ sessionCookie: '' });
      this.jar = new CookieJar();
      throw new Error(`登录成功但校验失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  cancelLogin() { this.flow = null; }

  /* ------------------------- rings ------------------------- */
  /**
   * Ring capacity = THIS WEEK's usage (the reference for the full ring).
   * The week ring always reads 100%; today and the last 5 hours scale
   * against it. `ringCapWeek > 0` overrides the reference with a fixed
   * weekly target.
   */
  computeCaps(summary) {
    const config = this.scope.get();
    const tokens = summary?.tokens ?? {};
    let reference = (config.ringCapWeek ?? 0) > 0 ? config.ringCapWeek : (tokens.week ?? 0);
    if (!reference || reference <= 0) reference = (tokens.month ?? 0) || 1;
    return { h5: reference, today: reference, week: reference, auto: { h5: reference, today: reference, week: reference } };
  }
}

/* ------------------------------------------------------------------ */
/* HTTP routes                                                         */
/* ------------------------------------------------------------------ */

async function jsonBody(req, maxBytes = 16 * 1024) {
  let body = '';
  for await (const part of req) {
    body += part;
    if (Buffer.byteLength(body) > maxBytes) throw new Error('请求内容过大。');
  }
  return body === '' ? {} : JSON.parse(body);
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

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function assertSameOrigin(req, writes = false) {
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (!isLoopback(req.socket.remoteAddress) || host === undefined || !/^127\.0\.0\.1(?::\d+)?$/.test(host)) {
    throw new Error('该接口只允许本机 loopback 访问。');
  }
  if ((origin !== undefined && origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') {
    throw new Error('来源不受信任。');
  }
  if (writes && origin === undefined) throw new Error('写操作需要同源浏览器请求。');
}

function dateParam(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : undefined;
}

export function installRoutes(ctx, runtime) {
  const tokens = new Map();
  const requireToken = (req) => {
    const token = req.headers['x-dsh-owm-token'];
    const expiry = typeof token === 'string' ? tokens.get(token) : undefined;
    if (expiry === undefined || expiry < Date.now()) throw new Error('操作授权已过期，请刷新页面重试。');
  };

  ctx.webServer.register({ kind: 'prefix', path: ROUTE, handler: async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const path = requestUrl.pathname;
      if (req.method === 'GET' && path === `${ROUTE}/bootstrap`) {
        assertSameOrigin(req);
        const token = randomBytes(24).toString('base64url');
        tokens.set(token, Date.now() + TOKEN_TTL_MS);
        return sendJson(res, 200, { token, expiresInMs: TOKEN_TTL_MS });
      }
      const writes = req.method === 'POST';
      assertSameOrigin(req, writes);
      if (writes) requireToken(req);

      if (req.method === 'GET' && path === `${ROUTE}/usage`) {
        const config = runtime.scope.get();
        if (config.sessionCookie) {
          try { await runtime.refresh(); }
          catch { /* failures are surfaced through lastError / authenticated */ }
        }
        const summary = runtime.cache?.data ?? null;
        return sendJson(res, 200, {
          ok: true,
          authenticated: Boolean(config.sessionCookie) && summary !== null,
          user: runtime.cache?.user ?? null,
          lastError: runtime.lastError,
          refreshedAt: runtime.cache?.at ?? null,
          refreshSeconds: config.refreshSeconds,
          caps: runtime.computeCaps(summary),
          usage: summary,
        });
      }

      if (req.method === 'GET' && path === `${ROUTE}/logs`) {
        const startDate = dateParam(requestUrl.searchParams.get('startDate'));
        const endDate = dateParam(requestUrl.searchParams.get('endDate'));
        const page = Math.max(1, Number(requestUrl.searchParams.get('page')) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(requestUrl.searchParams.get('pageSize')) || 10));
        const payload = await runtime.fetchLogs({ startDate, endDate, page, pageSize });
        return sendJson(res, 200, { ok: true, ...payload });
      }

      if (req.method === 'POST' && path === `${ROUTE}/login/start`) {
        const body = await jsonBody(req);
        const result = await runtime.startLogin({ refresh: body?.refresh === true });
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (req.method === 'POST' && path === `${ROUTE}/login/poll`) {
        const result = await runtime.pollLogin();
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (req.method === 'POST' && path === `${ROUTE}/login/cancel`) {
        runtime.cancelLogin();
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && path === `${ROUTE}/logout`) {
        runtime.clearSession();
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && path === `${ROUTE}/refresh`) {
        await runtime.refresh({ force: true });
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { error: '未找到接口。' });
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }});
}

/* ------------------------------------------------------------------ */
/* Host apply                                                          */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(SETTINGS_NAMESPACE, Config, {
      base: {},
      applies: 'live',
      validate: validateConfiguration,
    });
    const runtime = new GatewayRuntime(scope);
    let timer = null;

    const armTimer = () => {
      if (timer !== null) clearInterval(timer);
      timer = setInterval(() => {
        const config = scope.get();
        if (!config.sessionCookie || config.refreshSeconds <= 0) return;
        runtime.refresh().catch(() => { /* stale refresh is tolerated; /usage surfaces lastError */ });
      }, Math.max(30, scope.get().refreshSeconds) * 1000);
    };

    armTimer();
    const unwatch = scope.watch(() => armTimer());
    settingsCtx.effect(() => async () => {
      unwatch();
      if (timer !== null) clearInterval(timer);
      runtime.cancelLogin();
    }, 'oneway-usage-monitor runtime');

    settingsCtx.inject(['webServer'], (webCtx) => installRoutes(webCtx, runtime));
  });
}

export default apply;
