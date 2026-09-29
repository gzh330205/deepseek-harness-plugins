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
  'tests/probe.test.mjs',
  'tests/fixtures/echo-mcp-server.mjs',
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

// 状态检查：宿主半必须真做一次握手探测，并把命令解析诊断与官方字段继承都保住。
const probeRequired = [
  'probeMcpServer',
  'describeProbeError',
  'explainStdioFailure',
  'resolveStdioCommand',
  "McpClientConfig",
  "/mcp-status",
  'scrubbedParentEnv',
];
for (const needle of probeRequired) {
  if (!host.includes(needle)) {
    console.error(`index.js must keep the MCP status probe (${needle}); see the status-check section of README.md`);
    process.exit(1);
  }
}
// 官方 config 必须是被「继承」的，而不是手抄字段表——手抄过一次就漏了 reconnect/maxInstructionBytes。
if (!/ManagedMcpServer[\s\S]{0,1200}?McpClientConfig\?\.list/.test(host)) {
  console.error('ManagedMcpServer must inherit the official dsh-mcp-client schema branches instead of re-listing fields');
  process.exit(1);
}
// 浏览器半要有状态面板与逐卡片健康行。
for (const needle of ['mcp-status', 'msm-statusBar', 'McpHealth', 'msm-hint']) {
  if (!client.includes(needle)) {
    console.error(`client.js must render the MCP status panel (${needle})`);
    process.exit(1);
  }
}

console.log('DSH MCP & Skill Manager scaffold is valid.');
