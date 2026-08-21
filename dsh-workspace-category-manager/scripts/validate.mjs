import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = ['package.json', 'cordis.patch.yml', 'index.js', 'client.js', 'README.md'];
const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) throw new Error(`Missing required files: ${missing.join(', ')}`);

const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('Bundle patch metadata is missing.');
if (manifest.dsh?.client?.platform !== 'web') throw new Error('Web client metadata is missing.');

const host = readFileSync(resolve(root, 'index.js'), 'utf8');
if (!host.includes("SETTINGS_NAMESPACE = 'workspace-category-manager'")) throw new Error('Host settings namespace is missing.');
const client = readFileSync(resolve(root, 'client.js'), 'utf8');
if (!client.includes("id: 'dsh-workspace-category-manager'") || !client.includes("name: 'settings.section'") || !client.includes("id: 'workspace-categories'")) throw new Error('Client Settings section registration is missing.');

console.log('DSH Workspace Category Manager scaffold is valid.');
