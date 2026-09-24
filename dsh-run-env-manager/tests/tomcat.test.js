// Tomcat 托管启动的纯逻辑测试：server.xml 生成、CATALINA_BASE 分桶、端口探测、
// 优雅关闭握手（用本地 TCP 服务器接住 token）、安装目录校验。
// 运行：node ./tests/tomcat.test.js
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildServerXml,
  checkPort,
  inspectTomcatHome,
  instanceBase,
  prepareTomcat,
  releaseInstance,
  tomcatBaseRoot,
} from '../src/host/tomcat.js';

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
const has = (label, haystack, needle) => check(label, String(haystack).includes(needle), `未包含 ${needle}`);

const scratch = join(tmpdir(), `run-env-tomcat-test-${process.pid}`);
rmSync(scratch, { recursive: true, force: true });

/* ── server.xml ───────────────────────────────────────────────────────── */

const xml = buildServerXml({ port: 8081, shutdownPort: 8015, shutdownToken: 'tok-123', contextPath: '/app', docBase: 'C:/proj/WebRoot' });
has('server.xml 用给定端口', xml, 'port="8081"');
has('server.xml 关闭端口带 token', xml, 'port="8015" shutdown="tok-123"');
has('server.xml 关闭端口绑回环', xml, 'address="127.0.0.1"');
has('server.xml 关掉自动部署', xml, 'autoDeploy="false"');
has('server.xml 关掉启动时部署', xml, 'deployOnStartup="false"');
has('server.xml 写入上下文路径', xml, 'path="/app"');
has('server.xml 写入 docBase', xml, 'docBase="C:/proj/WebRoot"');
has('server.xml 是 XML 声明', xml, '<?xml version="1.0" encoding="UTF-8"?>');
check('server.xml 转义引号', buildServerXml({ port: 1, shutdownPort: 2, shutdownToken: 'a"b', contextPath: '/', docBase: 'x' }).includes('a&quot;b'));

/* ── 实例分桶 ─────────────────────────────────────────────────────────── */

const baseA = instanceBase('D:/proj', 'web');
eq('同一 (工作区,配置) 的实例目录稳定', instanceBase('D:/proj', 'web'), baseA);
check('不同配置的实例目录不同', instanceBase('D:/proj', 'api') !== baseA);
check('不同工作区的实例目录不同', instanceBase('D:/other', 'web') !== baseA);
check('实例目录在 DSH_HOME 下', baseA.startsWith(tomcatBaseRoot()), baseA);

/* ── 安装目录校验 ─────────────────────────────────────────────────────── */

const bad = inspectTomcatHome(join(scratch, 'nope'));
check('不存在的目录校验失败', bad.ok === false && typeof bad.error === 'string');
const pluginDir = inspectTomcatHome(process.cwd());
check('普通目录不是 Tomcat 安装目录', pluginDir.ok === false);

// 造一个最小 Tomcat 布局
const home = join(scratch, 'tomcat-6.0.53');
for (const relative of ['bin', 'lib', 'conf']) mkdirSync(join(home, relative), { recursive: true });
writeFileSync(join(home, 'bin', 'bootstrap.jar'), '');
writeFileSync(join(home, 'bin', 'tomcat-juli.jar'), '');
writeFileSync(join(home, 'lib', 'catalina.jar'), '');
writeFileSync(join(home, 'conf', 'server.xml'), '<Server/>');
writeFileSync(join(home, 'conf', 'web.xml'), '<web-app/>');
writeFileSync(join(home, 'RELEASE-NOTES'), 'Apache Tomcat Version 6.0.53\n');
const good = inspectTomcatHome(home);
check('最小 Tomcat 布局校验通过', good.ok === true, good.error ?? '');
eq('从 RELEASE-NOTES 读到版本', good.version, '6.0.53');

/* ── 准备实例 ─────────────────────────────────────────────────────────── */

const project = join(scratch, 'proj');
mkdirSync(join(project, 'WebRoot'), { recursive: true });
const instance = prepareTomcat({
  root: project,
  id: 'legacy',
  configuration: { tomcat: { webapp: 'WebRoot', contextPath: '/app', port: 8071, shutdownPort: 8061, jvmArgs: ['-Xmx256m'] } },
  tomcatHome: home,
  javaExecutable: 'C:/jdk/bin/java.exe',
});
check('实例目录里有生成的 server.xml', existsSync(join(instance.base, 'conf', 'server.xml')));
check('实例目录里有拷来的 web.xml', existsSync(join(instance.base, 'conf', 'web.xml')));
const generated = readFileSync(join(instance.base, 'conf', 'server.xml'), 'utf8');
has('生成的 server.xml 用了配置端口', generated, 'port="8071"');
eq('argv[0] 是 java', instance.argv[0], 'C:/jdk/bin/java.exe');
has('argv 带 -Dcatalina.base', instance.argv.join(' '), `-Dcatalina.base=${instance.base}`);
has('argv 带 bootstrap.jar', instance.argv.join(' '), 'bootstrap.jar');
eq('argv 以 Bootstrap start 结尾', instance.argv.slice(-2).join(' '), 'org.apache.catalina.startup.Bootstrap start');
has('jvmArgs 被带进命令行', instance.argv.join(' '), '-Xmx256m');
eq('env 注入 CATALINA_HOME', instance.env.CATALINA_HOME, home);
eq('env 注入 CATALINA_BASE', instance.env.CATALINA_BASE, instance.base);
check('webapp 不存在时报错', (() => {
  try {
    prepareTomcat({ root: project, id: 'x', configuration: { tomcat: { webapp: 'Missing' } }, tomcatHome: home, javaExecutable: 'java' });
    return false;
  } catch {
    return true;
  }
})());

/* ── 优雅关闭握手 ─────────────────────────────────────────────────────── */

const shutdownPort = 18061;
const received = [];
const server = createServer((socket) => {
  socket.on('data', (chunk) => received.push(chunk.toString('utf8').trim()));
  socket.end();
});
await new Promise((resolvePromise) => server.listen(shutdownPort, '127.0.0.1', resolvePromise));
const stoppable = prepareTomcat({
  root: project,
  id: 'legacy',
  configuration: { tomcat: { webapp: 'WebRoot', contextPath: '/', port: 8072, shutdownPort, jvmArgs: [] } },
  tomcatHome: home,
  javaExecutable: 'java',
});
const stopped = await stoppable.gracefulStop();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
const token = /shutdown="([^"]+)"/.exec(readFileSync(join(stoppable.base, 'conf', 'server.xml'), 'utf8'))?.[1];
check('优雅关闭返回 true', stopped === true);
eq('关闭端口收到的正是 server.xml 里的 token', received.join(''), token);
await new Promise((resolvePromise) => { server.close(resolvePromise); });

/* ── 端口探测 ─────────────────────────────────────────────────────────── */

const listener = createServer(() => {});
const busyPort = 18072;
await new Promise((resolvePromise) => listener.listen(busyPort, '127.0.0.1', resolvePromise));
eq('有人监听时端口被判为占用', await checkPort(busyPort), true);
eq('没人监听时端口空闲', await checkPort(busyPort + 1), false);
await new Promise((resolvePromise) => { listener.close(resolvePromise); });

/* ── 清理 ─────────────────────────────────────────────────────────────── */

releaseInstance(project, 'legacy');
check('实例目录可回收', !existsSync(instanceBase(project, 'legacy')));
rmSync(scratch, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`tomcat.test FAILED: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`tomcat.test OK: ${passed} assertions passed`);
