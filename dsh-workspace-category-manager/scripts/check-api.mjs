// DSH API surface checker for dsh-workspace-category-manager.
// Run before shipping after a DSH upgrade:
//   node scripts/check-api.mjs [dshRoot]
// dshRoot defaults to $DSH_ROOT or `npm root -g`/@deepseek-ai/dsh.
//
// Every token the client adapter (createDshApi) relies on is derived from
// src/client and verified against the provider's CONTRACT interface
// (ISessions / IWorkspaces / UiWorkspace), not against any same-named method
// anywhere in the package: 0.1.6 removed ISessions.open while an unrelated
// private Session.open() still matched the old text scan, which is exactly how
// "clicking a session no longer switches the conversation" slipped through.
// Tokens that only exist as legacy fallback branches are reported as [soft].
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const sources = new Map(); // pkg -> concatenated runtime lib source
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

// Recursive declaration source per package: the provider's own contract.
const typeSources = new Map();
for (const pkg of packages) {
  let text = '';
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.d.ts')) text += readFileSync(full, 'utf8') + '\n';
    }
  };
  walk(join(scoped, pkg, 'lib', 'types'));
  typeSources.set(pkg, text);
}

const providerOf = new Map(); // service name -> provider package
for (const [pkg, src] of sources) {
  for (const m of src.matchAll(/(?:super\(ctx,\s*|reflect\.provide\(|provide\()\s*"([a-z][a-zA-Z]+)"\)?/g)) {
    const name = m[1];
    if (!providerOf.has(name)) providerOf.set(name, pkg);
  }
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
/** Body of the first matching interface declaration, or undefined. */
const interfaceBody = (src, names) => {
  for (const name of names) {
    const match = new RegExp(`(?:export\\s+)?interface\\s+${name}\\b[^{]*\\{`).exec(src);
    if (match === null) continue;
    let depth = 0;
    for (let i = match.index + match[0].length - 1; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) return src.slice(match.index, i + 1); }
    }
  }
  return undefined;
};
/** Contract interface for a service: ISessions / IWorkspaces / UiWorkspace. */
const contractBody = (pkg, service) => {
  const cap = service.charAt(0).toUpperCase() + service.slice(1);
  return interfaceBody(stripComments(typeSources.get(pkg) ?? ''), [`I${cap}`, cap, `I${cap}Face`]);
};
/** Broad occurrence scan, kept only as the fallback when no contract is found. */
const methodAnywhere = (pkg, method) => new RegExp(`\\b(?:async\\s+)?${method}\\s*\\(`).test(sources.get(pkg) ?? '');
/** Declared as an interface member (start of a declaration line), not as a parameter name. */
const methodDeclared = (pkg, service, method) => {
  const body = contractBody(pkg, service);
  if (body === undefined) return methodAnywhere(pkg, method);
  return new RegExp(`^[ \\t]*(?:(?:readonly|static|get|set)\\s+)*${method}\\s*(?:<[^>]*>)?\\s*[(:?]`, 'm').test(body);
};

const results = [];
const check = (label, ok, hint = '') => results.push({ label, ok, hint });

// 1. Hard-injected services must have a provider.
for (const svc of ['workspaces', 'sessions', 'settingsScope', 'slots', 'locale']) {
  check(`service "${svc}" provided`, providerOf.has(svc), `expected provider package for ${svc}`);
}

// 2. Derive the adapter's actual token usage from the plugin source (src/client).
// Service names: ctx.get('name'); methods: <service>.<method>( — verified per provider contract.
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
// Fallback branches: a missing token only means the legacy path is unavailable.
const SOFT = new Set([
  'uiWorkspace.openSession', 'uiWorkspace.startSession', 'uiWorkspace.pickDirectory', 'uiWorkspace.archiveSession',
  'workspaces.startSession', 'workspaces.pickDirectory', 'sessions.open',
]);
for (const [svc, methods] of methodTokens) {
  const pkg = providerOf.get(svc) ?? (svc === 'uiWorkspace' ? 'dsh-client-ui-workspace' : undefined);
  if (!pkg) continue;
  for (const m of methods) {
    const soft = SOFT.has(`${svc}.${m}`);
    check(`${svc}.${m} (${pkg})${soft ? ' [soft — legacy fallback]' : ''}`, methodDeclared(pkg, svc, m), `method ${m} not declared on the ${svc} contract in ${pkg}`);
  }
}

// 3. Hard-injected packages in package.json must exist.
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
for (const dep of manifest.dsh?.client?.inject ?? []) {
  const base = dep.replace(/^@deepseek-ai\//, '');
  check(`manifest dsh.client.inject "${dep}"`, packages.includes(base), `package ${dep} not installed`);
}

// 4. Workspace controller shape.
const wsPkg = providerOf.get('workspaces');
if (wsPkg) {
  const wsSrc = sources.get(wsPkg) ?? '';
  check(`workspaces.list observable (${wsPkg})`, wsSrc.includes('get list') || wsSrc.includes('this.list = model') || /list\s*=/.test(wsSrc), 'list observable shape may have changed');
} else {
  check('workspaces provider found', false, 'no provider — plugin cannot run');
}

// 5. Session UI-status surface: 0.1.6+ sessionStatus, <=0.1.2 pendingInteractions.
// Either generation is acceptable; both missing means the status dots silently stop working.
const uiSessionPkg = providerOf.get('uiSession') ?? 'dsh-client-ui-session';
const uiSessionSrc = sources.get(uiSessionPkg) ?? '';
const hasStatus = /\bsessionStatus\b/.test(uiSessionSrc);
const hasPending = /\bpendingInteractions\b/.test(uiSessionSrc);
check(`uiSession status store (${uiSessionPkg})`, hasStatus || hasPending,
  'neither sessionStatus (0.1.6+) nor pendingInteractions (<=0.1.2) found — running/completion/waiting dots degrade');
console.log(`     uiSession generation: ${hasStatus ? 'sessionStatus (0.1.6+)' : ''}${hasStatus && hasPending ? ' + ' : ''}${hasPending ? 'pendingInteractions (<=0.1.2)' : ''}`);

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
