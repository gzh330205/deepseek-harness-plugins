// DSH API surface checker for dsh-workspace-category-manager.
// Run before shipping after a DSH upgrade:
//   node scripts/check-api.mjs [dshRoot]
// dshRoot defaults to $DSH_ROOT or `npm root -g`/@deepseek-ai/dsh.
// Verify each token the plugin's client adapter (createDshApi) relies on.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
let dshRoot = args[0] || process.env.DSH_ROOT;
if (!dshRoot) {
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    dshRoot = join(globalRoot, '@deepseek-ai', 'dsh');
  } catch { /* fallthrough */ }
}
if (!dshRoot || !existsSync(join(dshRoot, 'package.json'))) {
  console.error(`check-api: cannot locate the dsh install (pass a path: node scripts/check-api.mjs <dshRoot>) — probed: ${dshRoot}`);
  process.exit(2);
}

const scoped = join(dshRoot, 'node_modules', '@deepseek-ai');
const packages = readdirSync(scoped).filter((name) => name.startsWith('dsh-client') || name.startsWith('dsh-api') || name.startsWith('dsh-host'));
const sources = new Map(); // pkg -> concatenated client source
for (const pkg of packages) {
  const lib = join(scoped, pkg, 'lib');
  let text = '';
  try {
    for (const f of readdirSync(lib).filter((x) => x.endsWith('.js') && !x.endsWith('.map') && !x.includes('typert'))) {
      text += readFileSync(join(lib, f), 'utf8') + '\n';
    }
  } catch { /* no lib */ }
  sources.set(pkg, text);
}

const providerOf = new Map(); // service name -> provider package
for (const [pkg, src] of sources) {
  for (const m of src.matchAll(/(?:super\(ctx,\s*|reflect\.provide\(|provide\()\s*"([a-z][a-zA-Z]+)"\)?/g)) {
    const name = m[1];
    if (!providerOf.has(name)) providerOf.set(name, pkg);
  }
}
const methodIn = (pkg, method) => {
  const src = sources.get(pkg) ?? '';
  return new RegExp(`\\b(?:async\\s+)?${method}\\s*\\(`).test(src);
};

const results = [];
const check = (label, ok, hint = '') => results.push({ label, ok, hint });

// 1. Hard-injected services must have a provider.
for (const svc of ['workspaces', 'sessions', 'settingsScope', 'slots', 'locale']) {
  check(`service "${svc}" provided`, providerOf.has(svc), `expected provider package for ${svc}`);
}

// 0. Derive the adapter's actual token usage from the plugin source (src/client).
// Service names: ctx.get('name') / ctx.<name>; methods: <service>.<method>( — verified per provider package.
const pluginRoot = join(process.cwd());
const readPlugin = (rel) => readFileSync(join(pluginRoot, rel), 'utf8');
const pluginApiSrc = readPlugin('src/client/api.ts') + '\n' + readPlugin('src/client/index.ts');
const serviceTokens = new Set([...pluginApiSrc.matchAll(/ctx\.get\('([a-z][A-Za-z]+)'\)/g)].map((m) => m[1]));
const methodTokens = new Map(); // service -> Set(methods)
for (const m of pluginApiSrc.matchAll(/\b(uiWorkspace|workspaces|sessions|settingsScope)\.([a-zA-Z]+)\(/g)) {
  if (!methodTokens.has(m[1])) methodTokens.set(m[1], new Set());
  methodTokens.get(m[1]).add(m[2]);
}
for (const svc of serviceTokens) {
  check(`adapter uses service "${svc}"`, providerOf.has(svc), `no provider found for ${svc}`);
}
for (const [svc, methods] of methodTokens) {
  const pkg = providerOf.get(svc) ?? (svc === 'uiWorkspace' ? 'dsh-client-ui-workspace' : undefined);
  if (!pkg) continue;
  for (const m of methods) {
    const soft = svc === 'uiWorkspace' || (svc === 'workspaces' && (m === 'startSession' || m === 'pickDirectory'));
    check(`${svc}.${m} (${pkg})${soft ? ' [soft — legacy fallback branch]' : ''}`, methodIn(pkg, m), `method ${m} missing from ${pkg}`);
  }
}

// 2. Hard-injected packages in package.json must exist.
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
for (const dep of manifest.dsh?.client?.inject ?? []) {
  const base = dep.replace(/^@deepseek-ai\//, '');
  check(`manifest dsh.client.inject "${dep}"`, packages.includes(base), `package ${dep} not installed`);
}

// 3. Workspace controller API.
const wsPkg = providerOf.get('workspaces');
if (wsPkg) {
  for (const m of ['create', 'rename', 'delete', 'insertBefore', 'archiveSession']) {
    check(`workspaces.${m} (${wsPkg})`, methodIn(wsPkg, m), `method ${m} missing from ${wsPkg}`);
  }
  const wsSrc = sources.get(wsPkg) ?? '';
  check(`workspaces.list observable`, wsSrc.includes('get list') || wsSrc.includes('this.list = model') || /list\s*=/.test(wsSrc), 'list observable shape may have changed');
} else {
  check('workspaces provider found', false, 'no provider — plugin cannot run');
}

// 4. Session controller API.
const ssPkg = providerOf.get('sessions');
if (ssPkg) {
  for (const m of ['open', 'create', 'fork', 'binding']) {
    check(`sessions.${m} (${ssPkg})`, methodIn(ssPkg, m), `method ${m} missing from ${ssPkg}`);
  }
} else {
  check('sessions provider found', false, 'no provider — plugin cannot run');
}

// 5. Soft feature: uiWorkspace (startSession / pickDirectory) — adapter has fallbacks; warn only.
const uwPkg = providerOf.get('uiWorkspace') ?? 'dsh-client-ui-workspace';
for (const m of ['startSession', 'pickDirectory']) {
  check(`uiWorkspace.${m} (${uwPkg}) [soft — fallback exists]`, methodIn(uwPkg, m), `adapter falls back to workspaces/sessions paths`);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'MISS'} ${r.label}${!r.ok && r.hint ? '  — ' + r.hint : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.some((r) => !r.label.includes('[soft'))) {
  console.error('check-api: hard API surface broken — fix these before shipping.');
  process.exit(1);
}
console.log('check-api: only soft-optional bits missing; adapter fallbacks cover them.');
