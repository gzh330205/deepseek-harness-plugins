import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'package.json',
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'README.md',
  'scripts/smoke.mjs',
];

const missing = requiredFiles.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) {
  console.error(`Missing required files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
  console.error('package.json must declare dsh.bundle.patch as ./cordis.patch.yml');
  process.exit(1);
}
if (manifest.dsh?.client?.platform !== 'web' || manifest.exports?.['./client'] !== './client.js') {
  console.error('package.json must declare a web dsh.client entry and the ./client export.');
  process.exit(1);
}

const patch = readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8');
if (!patch.includes('id: web-auth') || !patch.includes("name: dsh-web-auth")) {
  console.error('cordis.patch.yml must insert the web-auth row.');
  process.exit(1);
}

const host = readFileSync(resolve(root, 'index.js'), 'utf8');
for (const token of [
  "prependListener('request'",
  "prependListener('upgrade'",
  "const SETUP_PATH",
  "const USERS_PATH",
  'async function hashPassword',
  'async function verifyPassword',
]) {
  if (!host.includes(token)) {
    console.error(`index.js is missing expected marker: ${token}`);
    process.exit(1);
  }
}
if (host.includes('DSH_WEB_AUTH_TOKEN')) {
  console.error('index.js must not read auth from environment variables.');
  process.exit(1);
}

const client = readFileSync(resolve(root, 'client.js'), 'utf8');
if (!client.includes("id: 'dsh-web-auth'") || !client.includes("settings.plugins.tab") || !client.includes("/__auth__/users")) {
  console.error('client.js must register the auth settings tab wired to the users API.');
  process.exit(1);
}

console.log('DSH Web Auth plugin scaffold is valid.');
