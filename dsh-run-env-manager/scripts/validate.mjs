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

// 命令交给操作系统的规则（Windows 上「带引号的命令」曾经是坏的）：
// 必须自己切引号直接 spawn，只在 shell 语法 / .cmd 目标时才包 cmd.exe。
const processes = read('src/host/processes.js');
for (const needle of ['planCommand', 'tokenizeWindows', 'withNodeShim', 'hasShellSyntax', 'resolveWindowsExecutable']) {
  check(`processes.js 缺少 ${needle}`, processes.includes(needle));
}
check('不得再出现「只包一层 cmd」的老写法 shellArgv', !processes.includes('shellArgv'));
check('spawn 必须补上被 DSH 剥掉的垫片变量', /env:\s*withNodeShim\(env\)/.test(processes));
check('启动路径必须走 planCommand', /planCommand\(configuration\.command/.test(processes));

// 日志：每条运行各自一块可折叠的日志区，按需取（轮询不带日志）；
// 日志里的地址交给系统默认浏览器打开。
const routes = read('src/host/routes.js');
const open = read('src/host/open.js');
check('routes 必须提供 openUrl 动作', /async openUrl\(body\)/.test(routes));
check('openUrl 必须调用宿主侧的默认浏览器实现', routes.includes('openInDefaultBrowser'));
check('openUrl 不得回全量快照（点了链接不该顺带传日志）', /NO_SNAPSHOT\s*=\s*new Set\(\[[^\]]*'openUrl'/.test(routes));
check('status 必须支持只要元数据的 logs=0', /logs.*!==\s*'0'|'logs'\)\s*!==\s*'0'/.test(routes));
check('必须提供一次性取日志尾部的 /log 路由', routes.includes('`${ROUTE}/log`'));
check('open.js 必须只放行 http(s)', /OPENABLE_PROTOCOLS/.test(open) && /'http:'/.test(open) && !/'file:'/.test(open));
check('open.js 必须按平台选命令', /win32/.test(open) && /darwin/.test(open) && /xdg-open/.test(open));
check('Windows 不得走 cmd start（`&` 会被拆成第二条命令）', !/cmd\.exe/.test(open));
check('浏览器进程必须与宿主脱钩（detached + unref）', /detached:\s*true/.test(open) && /\.unref\(\)/.test(open));

const runPanel = read('src/client/components/RunPanel.tsx');
const runCard = read('src/client/components/RunCard.tsx');
const runLog = read('src/client/components/RunLog.tsx');
const urls = read('src/client/urls.js');
for (const file of ['src/client/components/RunCard.tsx', 'src/client/components/RunLog.tsx', 'src/client/urls.js']) {
  check(`缺少文件 ${file}`, existsSync(join(root, file)));
}
check('面板必须把日志交给每张卡片（一个共享日志缓冲就没有「互相独立」了）', runPanel.includes('<RunCard') && !/\blogText\b/.test(runPanel));
check('日志展开态必须按实例 id 记', /openLogs\[configuration\.id\]/.test(runPanel));
check('卡片必须自己持有日志与订阅（展开才连，收起即断）', /new EventSource/.test(runCard) && /api\.log\(/.test(runCard));
check('轮询不得再要日志（logs=false）', /api\.status\(root,\s*false\)/.test(runPanel));
check('日志文本必须经 linkify 渲染成链接', runLog.includes('linkify') && runLog.includes('onOpenUrl'));
check('linkify 必须导出（单测直接跑它）', /export function linkify/.test(urls));
check('地址样式类必须存在', /\.renv-log \.renv-link/.test(styles));

// agent 面：实例启停/日志给模型用，且**与面板同一份实现**（DSH 的「一个操作、两个调用方」）。
const operations = read('src/host/operations.js');
const tools = read('src/host/tools.js');
const agentContext = read('src/host/agent-context.js');
const sharedAnsi = read('src/shared/ansi.js');
check('缺少文件 src/host/operations.js', existsSync(join(root, 'src/host/operations.js')));
check('缺少文件 src/host/agent-context.js', existsSync(join(root, 'src/host/agent-context.js')));
check('缺少文件 src/shared/ansi.js（宿主也要剥色，不能只给面板用）', existsSync(join(root, 'src/shared/ansi.js')));
check('启停只有一份实现：routes 不得直接调 registry.start/stop', !/registry\.(start|stop)\(/.test(routes));
check('启停只有一份实现：routes 必须调 operations 导出的 startRun/stopRun', /import \{ startRun, stopRun \}/.test(routes) && /await startRun\(/.test(routes) && /await stopRun\(/.test(routes));
check('operations 必须承载启动前组装（prepareRun）', /export async function prepareRun/.test(operations));
check('工具必须注册 run_env_get / run_env_instance / run_env_log', ['run_env_get', 'run_env_instance', 'run_env_log'].every((name) => new RegExp(`name: '${name}'`).test(tools)));
check('工具必须与面板共用 operations（不得自己 spawn/组装）', /from '\.\/operations\.js'/.test(tools) && !/from '\.\/processes\.js'/.test(tools));
check('工具必须让模型知道「别再自己起后台服务」', tools.includes('不要再用 bash 起后台服务'));
check('run_env_get 必须带实时实例状态（模型据此复用已有实例）', /runs,\r?\n/.test(tools) && tools.includes('runsOf(registry, root)'));
check('run_env_log 必须剥掉颜色码（模型不需要 ESC 序列）', /logTail\(/.test(operations) && /plainText/.test(operations));
check('run_env_log 必须支持等就绪/等文字，而不是让模型硬等', /waitForRun\(/.test(tools) && /waitForText/.test(tools) && /waitForReady/.test(tools));
check('每轮上下文必须走 systemPrompt.context（动态、可空）', /systemPrompt\.context\(\{/.test(agentContext));
check('上下文的 order 必须是有限数（systemPrompt 会校验）', /const CONTEXT_ORDER = \d+;/.test(agentContext));
check('上下文必须读当次组装的 agent 会话（按 agent 现算工作区）', /context\?\.agent/.test(agentContext));
check('上下文求值不得打断组装（try/catch 回退空串）', /catch \{[\s\S]{0,120}return '';/.test(agentContext));
check('没有实例时上下文必须是空串（空文本会被 systemPrompt 过滤掉）', /if \(live\.length === 0\) return '';/.test(operations));
check('宿主必须把 context 开关放进 Config', /agentContext: z\.boolean\(\)\.default\(true\)\.volatile\(\)/.test(host));
check('宿主只在开关打开时注册上下文', /config\.agentContext\.get\(\) !== false/.test(host));
check('宿主必须把 registry 交给工具（否则实例工具只能看到空列表）', /registerTools\(ctx, \{ store, registry, logTailChars \}\)/.test(host));
check('ansi 只有一份实现（client 不得再留着旧的 src/client/ansi.js）', !existsSync(join(root, 'src/client/ansi.js')) && /export function plainText/.test(sharedAnsi));

const bundle = read('lib/client.js');
check('状态文案必须本地化（不能再把状态枚举直接贴到界面上）', /statusStopped/.test(bundle) && !/\{run\.status\}/.test(clientEntry), 'bundle/entry');
check('客户端产物必须带 __ModuleLoader__ 注册头', bundle.includes('__ModuleLoader__.load'));
check(`客户端产物注册 id 必须是包名 ${ID}`, bundle.includes(`"${ID}"`));
check('lib/client.js 是旧产物：改 src/ 后必须 pnpm build', bundle.includes('collapseLogs') && bundle.includes('renv-link'));

if (failures.length > 0) {
  console.error(`validate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('validate OK: dsh-run-env-manager 脚手架约定全部满足');
