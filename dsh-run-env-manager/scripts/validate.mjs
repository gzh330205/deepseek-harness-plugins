// Scaffold regression assertions: the conventions this bundle must keep are
// checked as literals, so breaking one fails the script instead of the plugin
// silently going dormant at boot. Run: node ./scripts/validate.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const failures = [];
const check = (label, condition) => {
  if (!condition) failures.push(label);
};

const ID = 'dsh-run-env-manager';
const NAMESPACE = 'run-env-manager';

for (const file of ['package.json', 'cordis.patch.yml', 'index.js', 'lib/client.js', 'src/client/index.ts', 'README.md']) {
  check(`缺少文件 ${file}`, existsSync(join(root, file)));
}

const pkg = JSON.parse(read('package.json'));
check('dsh.bundle.patch 必须是 ./cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml');
check('dsh.client.platform 必须是 web', pkg.dsh?.client?.platform === 'web');
check("exports['./client'] 必须指向 ./lib/client.js", pkg.exports?.['./client'] === './lib/client.js');
check('schemastery 必须锁 ~3.18.4（.volatile() 从 3.18.4 才有）', pkg.dependencies?.['@deepseek-ai/schemastery'] === '~3.18.4');

const host = read('index.js');
check(`宿主必须声明 SETTINGS_NAMESPACE = '${NAMESPACE}'`, host.includes(`SETTINGS_NAMESPACE = '${NAMESPACE}'`));
// unwrapExports() 遇到 default 会丢掉整个模块命名空间，Config/inject 一起失效。
check('宿主不得写 export default（会吞掉 Config/inject）', !/export\s+default/.test(host));
check('宿主必须导出 apply', /export function apply/.test(host));
check('宿主必须声明 inject', /export const inject/.test(host));

const patch = read('cordis.patch.yml');
check(`patch 行 id 必须等于 ${NAMESPACE}`, new RegExp(`id:\\s*${NAMESPACE}\\b`).test(patch));
check(`patch 行 name 必须是 ${ID}`, new RegExp(`name:\\s*${ID}\\b`).test(patch));

const clientEntry = read('src/client/index.ts');
check('客户端必须注册 sidebar.right.pane.tab', clientEntry.includes("'sidebar.right.pane.tab'"));
check('客户端必须注册 tab 类型', clientEntry.includes('sidebarRightTabs.register'));
// 客户端插件外抛会让整页 boot 失败（web boot: N entry did not activate）。
check('客户端 apply 必须有 try/catch 降级', /catch\s*\(/.test(clientEntry));

const bundle = read('lib/client.js');
check('客户端产物必须带 __ModuleLoader__ 注册头', bundle.includes('__ModuleLoader__.load'));
check(`客户端产物注册 id 必须是包名 ${ID}`, bundle.includes(`"${ID}"`));

if (failures.length > 0) {
  console.error(`validate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('validate OK: dsh-run-env-manager 脚手架约定全部满足');
