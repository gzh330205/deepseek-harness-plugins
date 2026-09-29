// 结构校验：文件齐全、manifest 字段、patch 行、locale、产物契约。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(`dsh-sidebar-width: ${message}`); };
const read = (file) => readFileSync(resolve(root, file), 'utf8');

/* 1. 文件齐全 */
for (const file of ['package.json', 'index.js', 'cordis.patch.yml', 'lib/client.js', 'locale/zh.json', 'locale/en.json', 'tests/client.test.mjs']) {
  if (!existsSync(resolve(root, file))) fail(`缺少文件 ${file}`);
}

/* 2. manifest */
const manifest = JSON.parse(read('package.json'));
if (manifest.name !== 'dsh-sidebar-width') fail('name 必须是 dsh-sidebar-width');
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch 必须是 ./cordis.patch.yml');
if (manifest.dsh?.client?.platform !== 'web') fail('dsh.client.platform 必须是 web');
for (const mod of ['@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-ui-sidebar-right']) {
  if (!(manifest.dsh.client.inject ?? []).includes(mod)) fail(`dsh.client.inject 缺少 ${mod}`);
}
if (manifest.dependencies?.['@deepseek-ai/schemastery'] !== '~3.18.4') fail('schemastery 必须是 ~3.18.4');
if (!(manifest.exports ?? {})['./locale/*.json']) fail('exports 缺少 "./locale/*.json"');

/* 3. host 半区契约 */
const host = read('index.js');
if (/^[ \t]*export[ \t]+default\b/m.test(host)) fail('host 半区不能写 export default');
for (const needle of ["import z from '@deepseek-ai/schemastery'", 'export const Config', 'export const inject', 'export function apply']) {
  if (!host.includes(needle)) fail(`index.js 缺少 ${needle}`);
}
if (!host.includes("SETTINGS_NAMESPACE = 'sidebar-width'")) fail('SETTINGS_NAMESPACE 必须是 sidebar-width');
for (const field of ['enabled', 'sidebarWidth', 'rightbarWidth', 'guideOnLastTab']) {
  if (!host.includes(field)) fail(`Config 缺少字段 ${field}`);
}
if (!/rightbarWidth:[^,\n]*\.volatile\(\)/.test(host)) fail('rightbarWidth 必须标 .volatile()');
// 两个宽度字段必须 volatile，否则写入会整插件重挂
if (!/sidebarWidth:[^,\n]*\.volatile\(\)/.test(host)) fail('sidebarWidth 必须标 .volatile()');

/* 4. patch 行 */
const patch = read('cordis.patch.yml');
if (!/-\s*id:\s*sidebar-width\s*\n\s*name:\s*dsh-sidebar-width/.test(patch)) fail('cordis.patch.yml 缺少 sidebar-width 行');

/* 5. 客户端产物 */
const client = read('lib/client.js');
if (!client.includes('window.__ModuleLoader__.load')) fail('lib/client.js 不是 module-table 产物');
if (!client.includes('dsh-sidebar-width')) fail('lib/client.js 缺少包名 id');
if (client.includes('export default')) fail('lib/client.js 不能含 export default');
for (const needle of ['settings.pluginKit.tab', 'configForms', 'layoutInfo', 'spec']) {
  if (!client.includes(needle)) fail(`lib/client.js 缺少关键实现 ${needle}`);
}
if (client.includes('specDynamic')) fail('lib/client.js 不能使用 specDynamic（客户端服务不暴露它）');
// 必须走布局 store 的 actions，不能再碰 DOM 的列宽（那会让右侧面板溢出）。
for (const needle of ['entries?.("root")', 'setSidebar', 'setRightbar', 'getSnapshot', 'subscribe']) {
  if (!client.includes(needle)) fail(`lib/client.js 缺少 store 通路 ${needle}`);
}
if (client.includes('gridTemplateColumns')) fail('lib/client.js 不应再直接改写 grid-template-columns（面板宽度由引擎决定，改轨道会溢出）');
if (!client.includes('layoutInfo')) fail('lib/client.js 缺少 layoutInfo 读取');
// 「关闭最后一个标签 → 引导页」必须走公开服务，并且判据里要有「pane 已空」这一条
// （只看收起会把手动收起也当成关闭最后一个标签，用户就再也收不起右栏）。
if (!client.includes('openTabFromTarget')) fail('lib/client.js 必须用 ctx.sidebarRight.openTabFromTarget 打开引导页');
if (!client.includes('rightbarShown')) fail('lib/client.js 缺少 rightbarShown 判据');
if (!/tabId\s*!==\s*void 0/.test(client)) fail('lib/client.js 必须用「pane 里还有没有标签」把手动收起区分开');
// 只允许走 store：出现 DOM 列宽/分隔条信号就是在退回旧实现。
for (const forbidden of ['flex-basis', 'data-dragging', 'data-sidebar-collapsed', 'MutationObserver']) {
  if (client.includes(forbidden)) fail(`lib/client.js 不应再出现 ${forbidden}（应只通过布局 store 的 actions 改宽度）`);
}

console.log('dsh-sidebar-width scaffold is valid.');
