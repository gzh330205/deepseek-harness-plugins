import z from '@deepseek-ai/schemastery';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

/**
 * Settings namespace. DSH 0.1.7 keys configuration forms by Loader entry id, so
 * this value must stay equal to the `id` of this plugin's row in
 * `cordis.patch.yml` — the browser half resolves the same string through
 * `ctx.configForms.get(SETTINGS_NAMESPACE)`.
 */
export const SETTINGS_NAMESPACE = 'workspace-category-manager';
const CATEGORY_ID = /^[a-z][a-z0-9-]{0,31}$/;

const Category = z.object({
  id: z.string().required().pattern(CATEGORY_ID),
  name: z.string().required(),
  color: z.string().default('#4f8cff'),
});

/* Both fields are volatile: DSH 0.1.7 projects an entry's volatile Config fields
 * into the settings form, and the browser page (this plugin's client half) is the
 * only writer. A field left non-volatile would send every write down Loader's
 * ordinary lifecycle path — a full plugin remount — instead of committing in place.
 * The entry id (see cordis.patch.yml) doubles as the settings namespace the client
 * resolves through `ctx.configForms.get(...)`. */
export const Config = z.object({
  categories: z.array(Category).default([]).volatile(),
  /** Workspace ids are intentionally independent of workspace filesystem paths. */
  assignments: z.dict(z.string()).default({}).volatile(),
  /* Sidebar expansion, kept here rather than in browser localStorage because the
   * Host binds Web to a fresh loopback port on every launch: an origin-scoped
   * store would be empty at boot and every category would come back expanded.
   * Both fields hold SUPPRESSION lists (see scripts/validate.mjs), which keeps
   * the persisted value small and the "expanded" default implicit. */
  collapsedCategories: z.array(z.string()).default([]).volatile(),
  expandedWorkspaces: z.array(z.string()).default([]).volatile(),
});

export const inject = [];

/* ==================== Git import (Host half) ====================
 * The browser cannot run git, so "import a project from Git" is a Host
 * capability: the client posts one request to GIT_ROUTE and the Host runs
 * `git clone` with an argument array (never a shell). The route only exists
 * on a loopback-bound Web server, and every request must be a loopback,
 * same-origin browser request carrying a short-lived token issued by the
 * status probe. Paths and the repository URL are validated before use, and a
 * clone that fails or times out removes the directory it created.
 * =============================================================== */
export const GIT_ROUTE = '/dsh-workspace-category-manager/git';
const TOKEN_TTL_MS = 10 * 60 * 1000;
const GIT_PROBE_TIMEOUT_MS = 10 * 1000;
const CLONE_TIMEOUT_MS = 5 * 60 * 1000;
const OUTPUT_CAP = 8 * 1024;
const BODY_CAP = 64 * 1024;
const MAX_URL = 2048;
const MAX_BRANCH = 200;
const MAX_FOLDER = 100;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const SCHEME_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;
const ALLOWED_SCHEME = /^(?:https?|ssh|git|file):\/\//i;
const SCP_LIKE = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[^\s]+$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const INVALID_SEGMENT = /[<>:"/\\|?*\u0000-\u001f]/;

function appendCapped(current, chunk) {
  const next = current + chunk.toString('utf8');
  return next.length <= OUTPUT_CAP ? next : next.slice(next.length - OUTPUT_CAP);
}
function lastLines(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  return lines.slice(-3).join(' / ').slice(0, 600);
}
function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
function isLoopbackHost(host) {
  return /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host ?? '');
}
/** Reject anything that is not a same-origin request from this machine. */
function assertSameOrigin(req, writes) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) throw new Error('Git 导入接口只允许本机访问。');
  const host = req.headers.host;
  if (typeof host !== 'string' || !isLoopbackHost(host)) throw new Error('请求来源不受信任。');
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) throw new Error('请求来源不受信任。');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new Error('请求来源不受信任。');
  if (writes && origin === undefined) throw new Error('Git 导入需要同源浏览器请求。');
}
function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin' });
  res.end(JSON.stringify(value));
}
async function jsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString('utf8');
    if (body.length > BODY_CAP) throw new Error('请求体过大。');
  }
  if (body.trim() === '') return {};
  try { return JSON.parse(body); } catch { throw new Error('请求体不是合法 JSON。'); }
}

/** Run git without a shell; output is capped and a timeout kills the child. */
function runGit(args, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    try {
      child = spawn('git', args, {
        shell: false,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      });
    } catch (error) { rejectPromise(error); return; }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(value);
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      finish({ code: null, timedOut: true, stdout, stderr });
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout = appendCapped(stdout, chunk); });
    child.stderr?.on('data', (chunk) => { stderr = appendCapped(stderr, chunk); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on('close', (code) => finish({ code, timedOut: false, stdout, stderr }));
  });
}

let gitProbeCache;
let gitProbeAt = 0;
/** Whether a usable `git` exists on this Host; successes are cached. */
function gitProbe() {
  const cacheFresh = gitProbeCache !== undefined && (gitProbeCache.available === true || Date.now() - gitProbeAt < 30 * 1000);
  if (cacheFresh) return Promise.resolve(gitProbeCache);
  return runGit(['--version'], GIT_PROBE_TIMEOUT_MS)
    .then(
      (result) => (gitProbeCache = result.code === 0
        ? { available: true, version: result.stdout.trim() || 'git' }
        : { available: false, reason: `git 不可用：${lastLines(result.stderr) || `退出码 ${result.code}`}` }),
      (error) => (gitProbeCache = { available: false, reason: error?.code === 'ENOENT' ? '未找到 git 命令，请先安装 Git 并确保它在 PATH 中可用。' : `无法执行 git：${error instanceof Error ? error.message : String(error)}` }),
    )
    .then((probe) => { gitProbeAt = Date.now(); return probe; });
}

/** Repository folder name derived from a Git URL (mirrored in src/client/utils.ts for the preview). */
export function repoNameFromUrl(value) {
  let url = typeof value === 'string' ? value.trim() : '';
  if (url === '') return '';
  url = url.replace(/[?#][\s\S]*$/, '').replace(/[/\\]+$/, '');
  const scp = /^[^/@\s]+@[^/:\s]+:([\s\S]+)$/.exec(url);
  const tail = scp !== null ? scp[1] : url.replace(SCHEME_LIKE, '');
  const segments = tail.split(/[/\\]/).filter((segment) => segment !== '');
  let name = segments.length === 0 ? '' : segments[segments.length - 1];
  if (name.toLowerCase().endsWith('.git')) name = name.slice(0, -4);
  return name;
}
export function validateRepositoryUrl(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (url === '') throw new Error('请填写 Git 地址。');
  if (url.length > MAX_URL) throw new Error('Git 地址过长。');
  if (CONTROL.test(url)) throw new Error('Git 地址包含控制字符。');
  if (url.startsWith('-')) throw new Error('Git 地址不能以 “-” 开头。');
  if (!ALLOWED_SCHEME.test(url) && !SCP_LIKE.test(url) && !isAbsolute(url)) {
    throw new Error('Git 地址仅支持 http(s)://、ssh://、git://、file://、git@host:path 或本机绝对路径。');
  }
  return url;
}
export function validateFolderName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name === '') throw new Error('项目目录名不能为空：无法从 Git 地址推导时请手动填写。');
  if (name.length > MAX_FOLDER) throw new Error('项目目录名过长（最多 100 个字符）。');
  if (name === '.' || name === '..') throw new Error('项目目录名无效。');
  if (INVALID_SEGMENT.test(name)) throw new Error('项目目录名不能包含 < > : " / \\ | ? * 等字符。');
  if (/[. ]$/.test(name)) throw new Error('项目目录名不能以空格或点结尾。');
  if (RESERVED_NAME.test(name)) throw new Error('项目目录名不能使用系统保留名称。');
  return name;
}
export function validateParentDirectory(value) {
  const parent = typeof value === 'string' ? value.trim() : '';
  if (parent === '') throw new Error('请选择下载目录。');
  if (!isAbsolute(parent)) throw new Error('下载目录必须是绝对路径。');
  let stat;
  try { stat = statSync(parent); } catch { throw new Error(`下载目录不存在：${parent}`); }
  if (!stat.isDirectory()) throw new Error(`下载目录不是文件夹：${parent}`);
  return resolve(parent);
}
export function validateBranch(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const branch = String(value).trim();
  if (branch === '') return undefined;
  if (branch.length > MAX_BRANCH) throw new Error('分支名过长。');
  if (CONTROL.test(branch) || /\s/.test(branch)) throw new Error('分支名包含空白或控制字符。');
  if (branch.startsWith('-')) throw new Error('分支名不能以 “-” 开头。');
  return branch;
}

/** Clone one repository into `<parentPath>/<folderName>` and return the created path. */
const activeTargets = new Set();
export async function cloneRepository(input) {
  const url = validateRepositoryUrl(input?.url);
  const parent = validateParentDirectory(input?.parentPath);
  const requested = typeof input?.folderName === 'string' ? input.folderName.trim() : '';
  const folder = validateFolderName(requested === '' ? repoNameFromUrl(url) : requested);
  const branch = validateBranch(input?.branch);
  const target = join(parent, folder);
  if (existsSync(target)) throw new Error(`目标目录已存在：${target}。请更换目录名或下载目录。`);
  if (activeTargets.has(target)) throw new Error(`该目录正在克隆中，请稍候：${target}`);
  // Claim the target before the first await so two overlapping requests cannot
  // both clone into it (the loser would otherwise delete the winner's result).
  activeTargets.add(target);
  try {
    const probe = await gitProbe();
    if (!probe.available) throw new Error(probe.reason);
    const args = ['clone'];
    if (branch !== undefined) args.push('--branch', branch);
    args.push('--', url, target);
    const result = await runGit(args, CLONE_TIMEOUT_MS);
    if (result.timedOut === true) {
      await rm(target, { recursive: true, force: true }).catch(() => {});
      throw new Error('git clone 超时（5 分钟）。请检查网络后重试。');
    }
    if (result.code !== 0) {
      await rm(target, { recursive: true, force: true }).catch(() => {});
      throw new Error(`git clone 失败：${lastLines(result.stderr) || `退出码 ${result.code}`}`);
    }
    return { path: target };
  } finally {
    activeTargets.delete(target);
  }
}

function installGitRoutes(ctx) {
  if (ctx.webServer.host !== '127.0.0.1') {
    ctx.logger?.warn?.('workspace-category-manager: Git import is disabled because Web is not bound to 127.0.0.1');
    return;
  }
  const tokens = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [token, expiry] of tokens) if (expiry < now) tokens.delete(token);
  }, TOKEN_TTL_MS);
  sweep.unref?.();
  ctx.effect(() => () => { clearInterval(sweep); tokens.clear(); }, 'workspace-category-manager: git import tokens');
  const requireToken = (req) => {
    const header = req.headers['x-dsh-wcm-token'];
    const token = Array.isArray(header) ? header[0] : header;
    const expiry = typeof token === 'string' ? tokens.get(token) : undefined;
    if (expiry === undefined || expiry < Date.now()) throw new Error('Git 导入授权已过期，请重新打开“添加工作区”窗口。');
  };
  ctx.webServer.register({
    kind: 'prefix',
    path: GIT_ROUTE,
    handler: async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? '/', `http://${typeof req.headers.host === 'string' ? req.headers.host : '127.0.0.1'}`);
        const path = requestUrl.pathname;
        if (req.method === 'GET' && path === `${GIT_ROUTE}/status`) {
          assertSameOrigin(req, false);
          const probe = await gitProbe();
          if (!probe.available) return sendJson(res, 200, { ok: true, available: false, reason: probe.reason, token: null, expiresInMs: 0 });
          const token = randomBytes(24).toString('base64url');
          tokens.set(token, Date.now() + TOKEN_TTL_MS);
          return sendJson(res, 200, { ok: true, available: true, gitVersion: probe.version, token, expiresInMs: TOKEN_TTL_MS });
        }
        if (req.method === 'POST' && path === `${GIT_ROUTE}/clone`) {
          assertSameOrigin(req, true);
          requireToken(req);
          if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('请求必须使用 application/json。');
          const payload = await jsonBody(req);
          const result = await cloneRepository(payload);
          return sendJson(res, 200, { ok: true, path: result.path });
        }
        return sendJson(res, 404, { ok: false, error: '接口不存在。' });
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  });
}

/**
 * Install the Host half.
 *
 * DSH 0.1.7 deprecated plugin-registered settings namespaces: the entry's own
 * `Config` (above) IS the settings surface now, so there is nothing to register
 * here — the browser half reads and writes it through `configForms`.
 *
 * `configure({ auto: false })` opts out of the auto-generated configuration page,
 * which would otherwise duplicate the sidebar and section this plugin ships.
 *
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
  ctx.inject(['webServer'], (webCtx) => installGitRoutes(webCtx));
}
