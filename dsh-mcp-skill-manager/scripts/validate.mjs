import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'package.json',
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'README.md',
  'skills/mcp-skill-maintenance/SKILL.md',
  'examples/mcp-server.template.yml',
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
if (manifest.dsh?.client?.platform !== 'web') {
  console.error('package.json must declare a web dsh.client entry.');
  process.exit(1);
}

const client = readFileSync(resolve(root, 'client.js'), 'utf8');
if (!client.includes("id: 'dsh-mcp-skill-manager'")) {
  console.error('client.js must register its DSH module-loader factory.');
  process.exit(1);
}
if (!client.includes("id: 'mcp'") || !client.includes("id: 'skills'")) {
  console.error('client.js must register separate MCP and Skills Settings tabs.');
  process.exit(1);
}
const host = readFileSync(resolve(root, 'index.js'), 'utf8');
if (!host.includes("IMPORT_ROUTE = '/dsh-mcp-skill-manager/v1'") || !host.includes("symlink(target, destination, 'junction')")) {
  console.error('index.js must expose the protected importer and Skill junction implementation.');
  process.exit(1);
}

const skill = readFileSync(resolve(root, 'skills/mcp-skill-maintenance/SKILL.md'), 'utf8');
if (!/^---\r?\nname: mcp-skill-maintenance\r?\ndescription:/m.test(skill)) {
  console.error('The included skill needs valid name and description frontmatter.');
  process.exit(1);
}

console.log('DSH MCP & Skill Manager scaffold is valid.');
