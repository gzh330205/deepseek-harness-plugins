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
if (!host.includes("SETTINGS_NAMESPACE = 'oneway-usage-monitor'")) throw new Error('Host settings namespace is missing.');
if (!host.includes("ROUTE = '/dsh-oneway-usage/v1'")) throw new Error('Host HTTP route is missing.');
const client = readFileSync(resolve(root, 'client.js'), 'utf8');
if (!client.includes("id: 'dsh-oneway-usage-monitor'")) throw new Error('Client bundle id is missing.');
if (!client.includes("name: 'settings.plugins.tab'") || !client.includes("id: 'oneway-usage'")) throw new Error('Client Settings tab registration is missing.');

console.log('DSH OneWay Usage Monitor scaffold is valid.');
