// 宿主 HTTP 接口测试：用假的 webServer/req/res 直接打真实 handler，
// 覆盖同源门禁、只读接口、写动作与动作后快照。
// 运行：node ./tests/routes.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROUTE, installRoutes } from '../src/host/routes.js';

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
}
const eq = (label, actual, expected) => check(label, JSON.stringify(actual) === JSON.stringify(expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const HOST = '127.0.0.1:3080';
const ORIGIN = `http://${HOST}`;

function makeReq({ method = 'GET', url = '/', headers = {}, body, remoteAddress = '127.0.0.1' }) {
  return {
    method,
    url,
    headers: { host: HOST, ...headers },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    },
  };
}

function makeRes() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers ?? {};
    },
    end(chunk) {
      this.body = chunk ?? '';
    },
  };
}

const cleanups = [];
try {
  try {
    git(process.cwd(), ['--version']);
  } catch {
    console.log('routes.test SKIP（没有可用的 git）');
    process.exit(0);
  }

  const root = mkdtempSync(join(tmpdir(), 'dsh-git-panel-routes-'));
  cleanups.push(root);
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'core.autocrlf', 'false']);
  writeFileSync(join(root, 'a.txt'), 'one\ntwo\n');
  writeFileSync(join(root, 'b.txt'), 'bee\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'first commit']);
  writeFileSync(join(root, 'a.txt'), 'one\nTWO\n');

  const config = {
    gitPath: { get: () => '' },
    worktreeRoot: { get: () => '' },
    worktreeBranchPrefix: { get: () => 'dsh' },
    diffContext: { get: () => 3 },
  };

  let handler = null;
  let registered = null;
  const warnings = [];
  const ctx = {
    webServer: {
      host: '127.0.0.1',
      register(route) {
        registered = route;
        handler = route.handler;
      },
    },
    logger: { warn: (message) => warnings.push(message), info: () => undefined },
  };
  installRoutes(ctx, { config });

  check('安装：注册了 prefix 路由', registered !== null && registered.kind === 'prefix' && registered.path === ROUTE);
  check('安装：handler 可用', typeof handler === 'function');

  const call = async (req) => {
    const res = makeRes();
    await handler(req, res);
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      json = null;
    }
    return { status: res.status, json, headers: res.headers };
  };
  const get = (path, headers) => call(makeReq({ url: `${ROUTE}${path}`, headers }));
  const post = (action, body, headers = { origin: ORIGIN }) => call(makeReq({ method: 'POST', url: `${ROUTE}/${action}`, body, headers }));

  /* ── 只读接口 ─────────────────────────────────────────────────────── */

  const snapshot = await get(`/snapshot?root=${encodeURIComponent(root)}`);
  eq('GET snapshot：200', snapshot.status, 200);
  eq('GET snapshot：ok 与仓库名', [snapshot.json.ok, snapshot.json.repo.name], [true, root.split(/[\\/]/).pop()]);
  eq('GET snapshot：分支', snapshot.json.repo.branch, 'main');
  eq('GET snapshot：变更计数', snapshot.json.counts.total, 1);
  eq('GET snapshot：变更条目', [snapshot.json.changes[0].path, snapshot.json.changes[0].worktree], ['a.txt', 'M']);
  eq('GET snapshot：不缓存', snapshot.headers['cache-control'], 'no-store');

  const diff = await get(`/diff?root=${encodeURIComponent(root)}&path=a.txt`);
  eq('GET diff：200 且有段落', [diff.status, diff.json.diff.file.hunks.length], [200, 1]);

  const history = await get(`/history?root=${encodeURIComponent(root)}&limit=5`);
  eq('GET history：一条提交', history.json.history.commits.length, 1);
  eq('GET history：ok', history.status, 200);

  const detail = await get(`/commit?root=${encodeURIComponent(root)}&hash=${history.json.history.commits[0].hash}`);
  eq('GET commit：文件清单', detail.json.detail.files.map((file) => file.path), ['a.txt', 'b.txt']);

  const branches = await get(`/branches?root=${encodeURIComponent(root)}`);
  eq('GET branches：main 是当前分支', branches.json.branches.local[0].name, 'main');

  const worktrees = await get(`/worktrees?root=${encodeURIComponent(root)}`);
  eq('GET worktrees：只有主工作区', worktrees.json.worktrees.length, 1);
  check('GET worktrees：给出建议根目录', typeof worktrees.json.suggestedRoot === 'string' && worktrees.json.suggestedRoot !== '');

  /* ── 门禁 ─────────────────────────────────────────────────────────── */

  const noRoot = await get('/snapshot');
  eq('GET：缺少 root → 400', noRoot.status, 400);
  const relativeRoot = await get(`/snapshot?root=${encodeURIComponent('relative/path')}`);
  eq('GET：相对 root → 400', relativeRoot.status, 400);
  const unknownGet = await get(`/snapshot?root=${encodeURIComponent(root)}&x=1`.replace('/snapshot', '/nope'));
  eq('GET：未知接口 → 404', unknownGet.status, 404);
  const crossSite = await get(`/snapshot?root=${encodeURIComponent(root)}`, { origin: 'http://evil.example' });
  eq('GET：跨站 Origin → 403', crossSite.status, 403);
  const crossSiteFetch = await get(`/snapshot?root=${encodeURIComponent(root)}`, { 'sec-fetch-site': 'cross-site' });
  eq('GET：sec-fetch-site=cross-site → 403', crossSiteFetch.status, 403);
  const remote = await call(makeReq({ url: `${ROUTE}/snapshot?root=${encodeURIComponent(root)}`, remoteAddress: '10.0.0.5' }));
  eq('GET：非回环来源 → 403', remote.status, 403);
  const badHost = await call(makeReq({ url: `${ROUTE}/snapshot?root=${encodeURIComponent(root)}`, headers: { host: 'evil.example' } }));
  eq('GET：非回环 Host → 403', badHost.status, 403);

  const writeNoOrigin = await post('stage', { root, paths: ['a.txt'] }, {});
  eq('POST：写操作缺 Origin → 403', writeNoOrigin.status, 403);
  const writeBadOrigin = await post('stage', { root, paths: ['a.txt'] }, { origin: 'http://evil.example' });
  eq('POST：写操作跨站 Origin → 403', writeBadOrigin.status, 403);
  const putCall = await call(makeReq({ method: 'PUT', url: `${ROUTE}/stage`, headers: { origin: ORIGIN } }));
  eq('PUT → 405', putCall.status, 405);
  const unknownPost = await post('nope', { root });
  eq('POST：未知接口 → 404', unknownPost.status, 404);
  const badJson = await call(makeReq({ method: 'POST', url: `${ROUTE}/stage`, headers: { host: HOST, origin: ORIGIN }, body: undefined }));
  eq('POST：空体当作空对象 → 400（缺少路径）', badJson.status, 400);

  /* ── 写动作 ───────────────────────────────────────────────────────── */

  const staged = await post('stage', { root, paths: ['a.txt'] });
  eq('POST stage：200', staged.status, 200);
  eq('POST stage：快照反映已暂存', staged.json.counts.staged, 1);
  eq('POST stage：index 真的变了', git(root, ['diff', '--cached', '--name-only']), 'a.txt');

  const unstaged = await post('unstage', { root, paths: ['a.txt'] });
  eq('POST unstage：回到未暂存', [unstaged.status, unstaged.json.counts.staged], [200, 0]);

  const badPath = await post('stage', { root, paths: ['../../etc/passwd'] });
  eq('POST stage：跳出仓库的路径 → 400', badPath.status, 400);

  await post('stageAll', { root });
  const committed = await post('commit', { root, message: 'second commit' });
  eq('POST commit：200 且返回 hash', [committed.status, typeof committed.json.commit.hash === 'string' && committed.json.commit.hash.length >= 7], [200, true]);
  eq('POST commit：仓库里确实多了一条提交', git(root, ['log', '-1', '--format=%s']), 'second commit');
  eq('POST commit：提交后工作区干净', git(root, ['status', '--porcelain']), '');

  const emptyCommit = await post('commit', { root, message: '   ' });
  eq('POST commit：空信息 → 400', emptyCommit.status, 400);

  const added = await post('worktreeAdd', { root, dirName: 'route-probe', mode: 'detached' });
  eq('POST worktreeAdd：200', added.status, 200);
  check('POST worktreeAdd：返回创建路径', typeof added.json.created.path === 'string' && added.json.created.path !== '', JSON.stringify(added.json.created));
  eq('POST worktreeAdd：列表里有两棵', added.json.worktrees.length, 2);
  cleanups.push(added.json.created.path);

  const removed = await post('worktreeRemove', { root, path: added.json.created.path, force: true, exportPatch: false });
  eq('POST worktreeRemove：回到一棵', [removed.status, removed.json.worktrees.length], [200, 1]);

  const pruned = await post('worktreePrune', { root });
  eq('POST worktreePrune：200', pruned.status, 200);

  const checkoutDirty = await post('checkout', { root, ref: 'main' });
  eq('POST checkout：切到当前分支也要求干净 → 200', checkoutDirty.status, 200);
  writeFileSync(join(root, 'a.txt'), 'one\nDIRTY\n');
  const checkoutBlocked = await post('checkout', { root, ref: 'main', newBranch: 'feature/x' });
  eq('POST checkout：工作区脏时拒绝', checkoutBlocked.status, 400);
  git(root, ['checkout', '--', 'a.txt']);

  eq('日志：接口错误都会被记录', warnings.length > 0, true);

  /* ── 非回环绑定时不注册 ───────────────────────────────────────────── */

  let registeredOnPublic = null;
  installRoutes(
    { webServer: { host: '0.0.0.0', register: () => { registeredOnPublic = true; } }, logger: { warn: () => undefined } },
    { config },
  );
  check('安装：Web 非回环绑定时不注册任何路由', registeredOnPublic === null);
} catch (error) {
  failures.push(`未捕获异常：${error instanceof Error ? `${error.message}\n${error.stack}` : String(error)}`);
} finally {
  for (const path of cleanups.reverse()) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  }
}

if (failures.length > 0) {
  console.error(`routes.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`routes.test OK (${passed} assertions)`);
