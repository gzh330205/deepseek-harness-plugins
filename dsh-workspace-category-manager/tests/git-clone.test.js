// Host-half tests for the Git import feature (index.js).
// Covers URL / folder / parent validation, a real local clone through
// cloneRepository, and the HTTP route's loopback + same-origin + token gates.
// Run: node ./tests/git-clone.test.js
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  GIT_ROUTE,
  apply,
  cloneRepository,
  repoNameFromUrl,
  validateBranch,
  validateFolderName,
  validateParentDirectory,
  validateRepositoryUrl,
} from '../index.js';

let failures = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`OK   ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name} — ${error?.message ?? error}`); }
};
const eq = (actual, expected, label) => { if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
const ok = (condition, label) => { if (!condition) throw new Error(label); };
const rejects = async (fn, pattern, label) => {
  try { await fn(); } catch (error) { if (pattern.test(error.message)) return; throw new Error(`${label}: unexpected error "${error.message}"`); }
  throw new Error(`${label}: expected an error`);
};

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function makeSourceRepo(dir) {
  mkdirSync(dir, { recursive: true });
  git(['-c', 'init.defaultBranch=main', 'init', '-q', '.'], dir);
  writeFileSync(join(dir, 'README.md'), '# demo repository\n');
  git(['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'add', '.'], dir);
  git(['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-qm', 'init'], dir);
}

/* ---------------- route harness ---------------- */
function fakeContext(host = '127.0.0.1') {
  const routes = [];
  const effects = [];
  const logger = { warn() {}, info() {}, error() {} };
  const effect = (factory) => { effects.push(factory); return () => {}; };
  const ctx = {
    logger,
    effect,
    inject(names, callback) {
      if (names.includes('settings')) return; // settings registration is not under test
      if (names.includes('webServer')) callback({ webServer: { host, register(route) { routes.push(route); return () => {}; } }, logger, effect });
    },
  };
  return { ctx, routes, effects };
}
function mockRequest({ method = 'GET', url, host = '127.0.0.1:3081', origin, remoteAddress = '127.0.0.1', headers = {}, body } = {}) {
  return {
    method,
    url,
    headers: { host, ...(origin === undefined ? {} : { origin }), ...headers },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(body); },
  };
}
function mockResponse() {
  let status = 0;
  let body = '';
  return {
    writeHead(next) { status = next; },
    end(chunk) { body += chunk === undefined ? '' : String(chunk); },
    result() { return { status, json: body === '' ? null : JSON.parse(body) }; },
  };
}
const callRoute = async (route, request) => { const res = mockResponse(); await route.handler(request, res); return res.result(); };

const workdir = mkdtempSync(join(tmpdir(), 'wcm-git-'));
const sourceRepo = join(workdir, 'orig', 'demo');
try {
  makeSourceRepo(sourceRepo);
  const sourceUrl = pathToFileURL(sourceRepo).href;

  /* ---------------- pure helpers ---------------- */
  await test('repoNameFromUrl derives the folder name from every URL form', () => {
    eq(repoNameFromUrl('https://github.com/org/repo.git'), 'repo', 'https');
    eq(repoNameFromUrl('https://github.com/org/repo/'), 'repo', 'trailing slash');
    eq(repoNameFromUrl('git@github.com:org/repo.git'), 'repo', 'scp-like');
    eq(repoNameFromUrl('ssh://git@host:2222/org/repo.git'), 'repo', 'ssh with port');
    eq(repoNameFromUrl('https://host/org/repo?ref=x#y'), 'repo', 'query and hash');
    eq(repoNameFromUrl('D:\\projects\\demo'), 'demo', 'windows path');
    eq(repoNameFromUrl(''), '', 'empty');
  });

  await test('repository URLs outside the allow list are rejected', () => {
    validateRepositoryUrl('https://github.com/org/repo.git');
    validateRepositoryUrl('git@github.com:org/repo.git');
    for (const bad of ['', '   ', '-oProxyCommand=calc', 'repo.git', 'ftp://host/repo.git', 'https://host/repo\n--upload-pack=x']) {
      let threw = false;
      try { validateRepositoryUrl(bad); } catch { threw = true; }
      ok(threw, `expected rejection for ${JSON.stringify(bad)}`);
    }
  });

  await test('folder and parent validation reject paths that escape the target', () => {
    eq(validateFolderName(' repo '), 'repo', 'trim');
    eq(validateFolderName('trailing '), 'trailing', 'trailing space is trimmed');
    eq(validateBranch('feature/x'), 'feature/x', 'branch');
    eq(validateBranch(''), undefined, 'empty branch');
    for (const bad of ['', '..', 'a/b', 'a\\b', 'a:b', 'trailing.', 'CON', 'x'.repeat(101)]) {
      let threw = false;
      try { validateFolderName(bad); } catch { threw = true; }
      ok(threw, `expected rejection for folder ${JSON.stringify(bad)}`);
    }
    for (const bad of ['', 'relative/path', join(workdir, 'missing')]) {
      let threw = false;
      try { validateParentDirectory(bad); } catch { threw = true; }
      ok(threw, `expected rejection for parent ${JSON.stringify(bad)}`);
    }
    eq(validateParentDirectory(workdir), workdir, 'absolute parent resolves');
  });

  /* ---------------- real clone ---------------- */
  await test('cloneRepository clones a real repository and derives the folder name', async () => {
    const parent = join(workdir, 'clones');
    mkdirSync(parent, { recursive: true });
    const result = await cloneRepository({ url: sourceUrl, parentPath: parent });
    eq(result.path, join(parent, 'demo'), 'clone target');
    ok(existsSync(join(result.path, 'README.md')), 'cloned file missing');
    ok(existsSync(join(result.path, '.git')), 'cloned .git missing');
  });

  await test('cloneRepository honours an explicit folder name and branch', async () => {
    const parent = join(workdir, 'clones-named');
    mkdirSync(parent, { recursive: true });
    const result = await cloneRepository({ url: sourceUrl, parentPath: parent, folderName: 'renamed', branch: 'main' });
    eq(result.path, join(parent, 'renamed'), 'named target');
    eq(readFileSync(join(result.path, 'README.md'), 'utf8').trim(), '# demo repository', 'content');
  });

  await test('cloneRepository refuses an existing target and leaves no partial clone', async () => {
    const parent = join(workdir, 'clones');
    await rejects(() => cloneRepository({ url: sourceUrl, parentPath: parent }), /目标目录已存在/, 'existing target');
    const missing = join(workdir, 'clones-missing');
    mkdirSync(missing, { recursive: true });
    await rejects(() => cloneRepository({ url: pathToFileURL(join(workdir, 'nope')).href, parentPath: missing }), /git clone 失败/, 'failed clone');
    ok(!existsSync(join(missing, 'nope')), 'failed clone must not leave a directory behind');
  });

  await test('two overlapping clones into the same target cannot both run', async () => {
    const parent = join(workdir, 'clones-race');
    mkdirSync(parent, { recursive: true });
    const input = { url: sourceUrl, parentPath: parent, folderName: 'race' };
    const settled = await Promise.allSettled([cloneRepository(input), cloneRepository(input)]);
    const rejected = settled.filter((entry) => entry.status === 'rejected');
    eq(rejected.length, 1, 'exactly one clone must be rejected');
    ok(/正在克隆中|已存在/.test(rejected[0].reason.message), `unexpected rejection: ${rejected[0].reason.message}`);
    ok(existsSync(join(parent, 'race', 'README.md')), 'the winning clone must survive');
  });

  /* ---------------- HTTP route gates ---------------- */
  const { ctx, routes } = fakeContext();
  apply(ctx);
  const route = routes.find((entry) => entry.path === GIT_ROUTE);
  await test('apply registers the Git route once', () => { ok(route !== undefined, 'route not registered'); });

  await test('apply skips the route when Web is not bound to loopback', () => {
    const other = fakeContext('0.0.0.0');
    apply(other.ctx);
    eq(other.routes.length, 0, 'routes on 0.0.0.0');
  });

  let token;
  await test('GET status issues a token for a same-origin loopback request', async () => {
    const result = await callRoute(route, mockRequest({ url: `${GIT_ROUTE}/status` }));
    eq(result.status, 200, 'status code');
    eq(result.json.available, true, 'available');
    ok(typeof result.json.token === 'string' && result.json.token.length > 10, 'token');
    token = result.json.token;
  });

  await test('GET status rejects cross-origin and non-loopback callers', async () => {
    const crossOrigin = await callRoute(route, mockRequest({ url: `${GIT_ROUTE}/status`, origin: 'http://evil.test' }));
    eq(crossOrigin.status, 400, 'cross-origin status');
    const rebound = await callRoute(route, mockRequest({ url: `${GIT_ROUTE}/status`, host: 'evil.test' }));
    eq(rebound.status, 400, 'dns-rebinding host');
    const remote = await callRoute(route, mockRequest({ url: `${GIT_ROUTE}/status`, remoteAddress: '10.0.0.5' }));
    eq(remote.status, 400, 'remote address');
  });

  await test('POST clone without a token or without an origin is rejected', async () => {
    const body = JSON.stringify({ url: sourceUrl, parentPath: workdir });
    const noToken = await callRoute(route, mockRequest({ method: 'POST', url: `${GIT_ROUTE}/clone`, origin: 'http://127.0.0.1:3081', headers: { 'content-type': 'application/json' }, body }));
    eq(noToken.status, 400, 'no token');
    const noOrigin = await callRoute(route, mockRequest({ method: 'POST', url: `${GIT_ROUTE}/clone`, headers: { 'content-type': 'application/json', 'x-dsh-wcm-token': token }, body }));
    eq(noOrigin.status, 400, 'no origin');
    const wrongType = await callRoute(route, mockRequest({ method: 'POST', url: `${GIT_ROUTE}/clone`, origin: 'http://127.0.0.1:3081', headers: { 'x-dsh-wcm-token': token }, body }));
    eq(wrongType.status, 400, 'content type');
  });

  await test('POST clone with a token clones through the route', async () => {
    const parent = join(workdir, 'route-clones');
    mkdirSync(parent, { recursive: true });
    const body = JSON.stringify({ url: sourceUrl, parentPath: parent, folderName: 'via-route' });
    const result = await callRoute(route, mockRequest({ method: 'POST', url: `${GIT_ROUTE}/clone`, origin: 'http://127.0.0.1:3081', headers: { 'content-type': 'application/json', 'x-dsh-wcm-token': token }, body }));
    eq(result.status, 200, 'status code');
    eq(result.json.path, join(parent, 'via-route'), 'path');
    ok(existsSync(join(parent, 'via-route', 'README.md')), 'cloned content missing');
  });

  await test('POST clone rejects a URL that git would read as an option', async () => {
    const body = JSON.stringify({ url: '--upload-pack=calc', parentPath: workdir });
    const result = await callRoute(route, mockRequest({ method: 'POST', url: `${GIT_ROUTE}/clone`, origin: 'http://127.0.0.1:3081', headers: { 'content-type': 'application/json', 'x-dsh-wcm-token': token }, body }));
    eq(result.status, 400, 'option injection');
  });

  await test('unknown sub-routes answer 404', async () => {
    const result = await callRoute(route, mockRequest({ url: `${GIT_ROUTE}/nope` }));
    eq(result.status, 404, 'unknown route');
  });
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} host test(s) failed.`);
  process.exit(1);
}
console.log('\nhost tests OK: URL/folder/parent validation, real clone, cleanup, loopback + same-origin + token route gates');
