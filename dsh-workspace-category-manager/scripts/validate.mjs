import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = ['package.json', 'cordis.patch.yml', 'index.js', 'README.md', 'tsconfig.json', 'src/client/index.ts', 'src/client/api.ts', 'src/client/styles.css', 'lib/client.js', 'scripts/build-client.mjs', 'scripts/check-api.mjs'];
const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) throw new Error(`Missing required files: ${missing.join(', ')}`);

const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('Bundle patch metadata is missing.');
if (manifest.dsh?.client?.platform !== 'web') throw new Error('Web client metadata is missing.');
if (manifest.exports?.['./client'] !== './lib/client.js') throw new Error('Client export must point at the built bundle.');

const host = readFileSync(resolve(root, 'index.js'), 'utf8');
if (!host.includes("SETTINGS_NAMESPACE = 'workspace-category-manager'")) throw new Error('Host settings namespace is missing.');
/* Sidebar expansion must ride the Host Config: DSH binds Web to a fresh
 * loopback port on every launch, so an origin-scoped browser store is empty at
 * boot and every category would reopen expanded. */
for (const field of ['collapsedCategories', 'expandedWorkspaces']) {
  if (!host.includes(`${field}: z.array(z.string())`)) throw new Error(`Host Config is missing the ${field} field.`);
}
const sidebar = readFileSync(resolve(root, 'src/client/components/CategorySidebar.tsx'), 'utf8');
const utils = readFileSync(resolve(root, 'src/client/utils.ts'), 'utf8');
if (sidebar.includes('localStorage.getItem') || sidebar.includes('localStorage.setItem') || utils.includes('localStorage.getItem') || utils.includes('localStorage.setItem')) throw new Error('Sidebar expansion must not go back to origin-scoped localStorage (it is lost on every launch).');
if (!sidebar.includes('persistExpansion(scope, field, retainIds(next, existingIds()))')) {
  throw new Error('Sidebar expansion must be written to the Host Config on toggle.');
}
/* A toggle must paint from local state first: rendering straight from the Config
 * makes every click wait for the settings round trip. */
if (!sidebar.includes('setCollapseOverrides((previous) =>') || !sidebar.includes('isWorkspaceOpen(id)') || !sidebar.includes('isCollapsed(f.id)')) {
  throw new Error('Expansion must render from an optimistic local override, not only from the Config snapshot.');
}
/* The animated panel keeps its rows inside ONE inner layer: as direct grid
 * tracks every row stayed 34px tall while the panel claimed to be collapsed. */
for (const inner of ['wcm-sessionsInner', 'wcm-folderProjectsInner']) {
  if (!sidebar.includes(inner)) throw new Error(`Animated panel ${inner} wrapper is missing.`);
}
const css = readFileSync(resolve(root, 'src/client/styles.css'), 'utf8');
if (/grid-template-rows\s*:\s*0fr/.test(css)) throw new Error('Collapsed panels must not use grid tracks; their children would keep their own row height.');
if (!/\.wcm-sessions\.wcm-closed[^{]*\{[^}]*height:0/.test(css)) throw new Error('A collapsed panel must collapse its height (height:0).');
if (!/wcm-closed \.wcm-folderProjectsInner|wcm-closed .wcm-sessionsInner/.test(css)) throw new Error('A collapsed panel must hide its inner layer (visibility:hidden).');

const entry = readFileSync(resolve(root, 'src/client/index.ts'), 'utf8');
if (!entry.includes("id: 'workspace-categories'")) throw new Error('Client settings section id is missing.');
if (!entry.includes("name: 'sidebar.workspaces'") || !entry.includes('priority: -1')) throw new Error('Client sidebar registration is missing.');
if (!entry.includes('createDshApi') || !entry.includes('CategorySidebar') || !entry.includes('CategorySection')) throw new Error('Client entry wiring is incomplete.');

const api = readFileSync(resolve(root, 'src/client/api.ts'), 'utf8');
if (!api.includes('export function createDshApi')) throw new Error('DSH API adapter export is missing.');
if (!api.includes("ctx.get('uiWorkspace')")) throw new Error('uiWorkspace must be soft-detected, not injected.');

console.log('DSH Workspace Category Manager scaffold is valid.');
