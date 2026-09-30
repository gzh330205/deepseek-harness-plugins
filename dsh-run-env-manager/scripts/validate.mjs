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

// 状态圆点语义：灰=未启动/已停止，蓝=运行中（含就绪），黄=过渡，红=异常。
// 曾经 stopped 用的是 state-success（绿色），于是「从没启动过」的服务也是绿点——
// 这类回归在无浏览器环境里看不出来，所以钉成断言。
const styles = read('src/client/styles.css');
// 按「选择器列表里是否含 .renv-dot[data-state=X]」取规则体：运行中/就绪、启动中/停止中
// 是合并写法（`.a,\n.b{…}`），用单条正则匹配会漏掉。
const dotRules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: match[1].split(',').map((part) => part.trim()),
  body: match[2],
}));
const dotRule = (state) =>
  dotRules.filter((rule) => rule.selectors.includes(`.renv-dot[data-state=${state}]`)).map((rule) => rule.body).join(';');
check('停止态不得再用成功色（绿点=没启动过 就是这个 bug）', !/state-success/.test(dotRule('stopped')), dotRule('stopped'));
check('停止态用中性灰', /label-tertiary/.test(dotRule('stopped')), dotRule('stopped'));
check('运行中用蓝', /deepseek-450|state-business|#[0-9a-f]{6}/i.test(dotRule('running')), dotRule('running'));
check('就绪用成功色（绿）', /state-success/.test(dotRule('ready')), dotRule('ready'));
check('异常用红', /state-error/.test(dotRule('failed')), dotRule('failed'));
check('过渡态（启动中/停止中）用黄', /state-warn/.test(dotRule('starting')) && /state-warn/.test(dotRule('stopping')), dotRule('starting') + ' / ' + dotRule('stopping'));

const bundle = read('lib/client.js');
check('状态文案必须本地化（不能再把状态枚举直接贴到界面上）', /statusStopped/.test(bundle) && !/\{run\.status\}/.test(clientEntry), 'bundle/entry');
check('客户端产物必须带 __ModuleLoader__ 注册头', bundle.includes('__ModuleLoader__.load'));
check(`客户端产物注册 id 必须是包名 ${ID}`, bundle.includes(`"${ID}"`));

if (failures.length > 0) {
  console.error(`validate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('validate OK: dsh-run-env-manager 脚手架约定全部满足');
