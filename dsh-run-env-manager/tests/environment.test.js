// 宿主纯逻辑测试：契约解析、环境解析与注入。不依赖 DSH 宿主。
// 运行：node ./tests/environment.test.js
import { dirname, join } from 'node:path';
import { realpathSync } from 'node:fs';
import {
  ENVIRONMENT_KINDS,
  emptyBindings,
  expandCwd,
  mergeDetectedEnvironments,
  normalizeRoot,
  resolveBindings,
  validateLibrary,
  validateWorkspaceEntry,
} from '../src/host/contract.js';
import { buildRunEnvironment, executableFor, extractVersion, homeFor, validateEnvironment } from '../src/host/environment.js';

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
}
const eq = (label, actual, expected) => check(label, Object.is(actual, expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);

/* ── 契约 ─────────────────────────────────────────────────────────────── */

eq('normalizeRoot 正斜杠小写（win32）', normalizeRoot('C:\\Users\\Me\\Proj\\'), process.platform === 'win32' ? 'c:/users/me/proj' : 'C:/Users/Me/Proj');
eq('normalizeRoot 两种写法落到同一个键', normalizeRoot('C:/a/b'), normalizeRoot('C:\\a\\B'.toLowerCase() === 'c:\\a\\b' ? 'C:\\a\\b' : 'C:\\a\\b'));
eq('expandCwd 展开占位符', expandCwd('${workspaceFolder}/app', 'D:/ws'), 'D:/ws/app');
eq('expandCwd 缺省即工作区根', expandCwd('', 'D:/ws'), 'D:/ws');

const bindings = resolveBindings({
  defaults: { java: 'jdk17', node: 'node20' },
  project: { java: 'jdk8', python: '' },
  configuration: { node: 'node18' },
});
eq('三层：单配置覆盖项目', bindings.node, 'node18');
eq('三层：项目覆盖全局默认', bindings.java, 'jdk8');
eq('三层：空串不覆盖（跟随下一层）', bindings.python, '');
eq('三层：未设置保持为空', bindings.go, '');
eq('空绑定覆盖全部 kind', Object.keys(emptyBindings()).length, ENVIRONMENT_KINDS.length);

/* ── 校验 ─────────────────────────────────────────────────────────────── */

check('重复 id 被拒', validateWorkspaceEntry({ configurations: [{ id: 'a', name: 'A', command: 'x' }, { id: 'a', name: 'B', command: 'y' }] }).some((error) => error.includes('重复')));
check('空命令被拒', validateWorkspaceEntry({ configurations: [{ id: 'a', name: 'A', command: '  ' }] }).length > 0);
check('tomcat 端口相同被拒', validateWorkspaceEntry({ configurations: [{ id: 'w', name: 'W', type: 'tomcat', tomcat: { webapp: 'web', contextPath: '/', port: 8080, shutdownPort: 8080 } }] }).some((error) => error.includes('关闭端口')));
check('tomcat 上下文路径必须以 / 开头', validateWorkspaceEntry({ configurations: [{ id: 'w', name: 'W', type: 'tomcat', tomcat: { webapp: 'web', contextPath: 'app', port: 8080, shutdownPort: 8005 } }] }).some((error) => error.includes('上下文路径')));
check('合法配置通过', validateWorkspaceEntry({ configurations: [{ id: 'web', name: '前端', command: 'pnpm dev', readyWhen: { url: 'http://localhost:5173', timeoutMs: 30000 } }] }).length === 0);
check('默认绑定指向不存在环境被拒', validateLibrary({ environments: [], defaults: { java: 'nope' } }).length > 0);
check('默认绑定 kind 不符被拒', validateLibrary({ environments: [{ id: 'x', kind: 'node', name: 'n', path: 'C:/n' }], defaults: { java: 'x' } }).length > 0);

/* ── 探测结果合并 ────────────────────────────────────────────────────── */

const merged = mergeDetectedEnvironments(
  { environments: [{ id: 'e1', kind: 'node', name: 'node', path: 'C:/Node/', version: '18' }] },
  [
    { id: '', kind: 'node', name: 'node', path: 'C:\\Node', version: '20' },
    { id: '', kind: 'go', name: 'go', path: 'C:/Go', version: '1.21' },
  ],
);
eq('同路径只更新版本，不新增', merged.length, 2);
eq('版本被刷新', merged.find((item) => item.kind === 'node').version, '20');
eq('新 kind 追加进来', merged.find((item) => item.kind === 'go').version, '1.21');

/* ── 可执行文件解析与真实探测 ────────────────────────────────────────── */

const nodeExe = process.execPath;
// 解析路径时会 realpath（Python 除外），所以期望值也必须先 realpath —— execPath 通常是指向版本目录的符号链接。
const nodeReal = realpathSync(nodeExe);
eq('直接给可执行文件即原样使用', executableFor({ kind: 'node', path: nodeExe }), nodeReal);
eq('给安装目录时能找到 bin 下的可执行文件', executableFor({ kind: 'node', path: dirname(nodeExe) }) !== undefined, true);
check('不存在的路径解析为 undefined', executableFor({ kind: 'node', path: 'C:/definitely/not/here' }) === undefined);
eq('homeFor 去掉 bin 层', homeFor(join('C:', 'Code', 'jdk', 'bin', 'java.exe')).endsWith(join('jdk')), true);
eq('extractVersion 抽数字', extractVersion('openjdk version "21.0.4" 2024-07-16'), '21.0.4');

const nodeProbe = await validateEnvironment({ kind: 'node', path: nodeExe });
check('真实 node 校验通过', nodeProbe.ok === true, nodeProbe.error ?? '');
check('真实 node 版本看起来像版本号', /^\d+\.\d+/.test(String(nodeProbe.version)), String(nodeProbe.version));
const badProbe = await validateEnvironment({ kind: 'node', path: 'C:/definitely/not/here' });
check('不存在的环境校验失败并给出原因', badProbe.ok === false && typeof badProbe.error === 'string');
const injection = await validateEnvironment({ kind: 'node', path: 'C:/x" & del /f /q C:\\' });
check('带注入字符的路径被拒', injection.ok === false && injection.error.includes('不允许的字符'));

/* ── 环境注入 ─────────────────────────────────────────────────────────── */

const library = {
  environments: [
    // 夹具用真实存在的 node.exe：这里测的是 kind → 环境变量的映射，与文件本身是什么无关。
    { id: 'jdk17', kind: 'java', name: 'JDK 17', path: nodeExe, version: '17' },
    { id: 'node20', kind: 'node', name: 'Node 20', path: nodeExe, version: '20' },
    { id: 'py312', kind: 'python', name: 'Python 3.12', path: nodeExe, version: '3.12' },
  ],
};
const built = buildRunEnvironment({
  library,
  bindings: { java: 'jdk17', node: 'node20', python: 'py312' },
  configuration: { env: { MY_FLAG: '1', API_KEY: 'secret-value' } },
  baseEnv: { PATH: '/usr/bin', PYTHONHOME: '/py', JRE_HOME: '/jre' },
});
check('JDK 的 bin 被前置进 PATH', String(built.env.PATH).startsWith(dirname(nodeReal)), String(built.env.PATH));
check('JAVA_HOME 已注入', built.env.JAVA_HOME === homeFor(nodeReal), String(built.env.JAVA_HOME));
check('JRE_HOME 被显式清掉（防止覆盖 JDK 选择）', built.env.JRE_HOME === undefined);
check('PYTHONHOME 被清掉', built.env.PYTHONHOME === undefined);
eq('运行配置的字面量 env 原样下发（需绕过宿主敏感变量剥离）', built.env.API_KEY, 'secret-value');
eq('字面量 env 的小写键也照发', built.env.MY_FLAG, '1');
const missingBinding = buildRunEnvironment({ library, bindings: { java: 'ghost' }, configuration: {}, baseEnv: { PATH: '' } });
eq('失效绑定被记为缺失', missingBinding.missing.includes('java'), true);
check('失效绑定给出可读告警', missingBinding.warnings.some((warning) => warning.includes('失效')));

/* ── 汇总 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`environment.test FAILED: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`environment.test OK: ${passed} assertions passed`);
