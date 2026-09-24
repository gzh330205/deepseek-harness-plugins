/**
 * Tomcat 类型的托管启动（对齐 OneCode 的 `main/launch/tomcat.ts`）。
 *
 * 核心思路：**不复用别人的 CATALINA_HOME 去启动**，而是每个 (工作区, 配置) 一份独立的
 * CATALINA_BASE：只从 CATALINA_HOME/conf 拷最少的配置文件，自己生成 server.xml。
 * 这样做的三个好处：
 *   1. 端口/上下文路径随配置走，不会污染安装目录；
 *   2. 关闭端口绑回环 + 随机 token，只有本机持有 token 的正常请求能停它（见 gracefulStop）；
 *   3. autoDeploy/deployOnStartup 关掉，启动的就是配置里那一个 webapp，不会扫出别的东西。
 */
import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

/** CATALINA_BASE 的根：放 DSH_HOME 下，跟着 profile 之外的运行时数据走。 */
export function tomcatBaseRoot() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return join(home, 'run-env-manager', 'tomcat');
}

/** 每个 (工作区, 配置) 一份独立实例目录。 */
export function instanceBase(root, id) {
  const digest = createHash('sha256').update(`${root}\0${id}`).digest('hex').slice(0, 16);
  return join(tomcatBaseRoot(), digest);
}

export function readTomcatVersion(home) {
  const notes = join(home, 'RELEASE-NOTES');
  if (!existsSync(notes)) return '';
  try {
    const text = readFileSync(notes, 'utf8');
    const match = /Apache Tomcat Version\s+([\w.]+)/i.exec(text);
    return match === null ? '' : match[1];
  } catch {
    return '';
  }
}

/** 校验一个 Tomcat 安装目录（供环境库的「验证并保存」使用）。 */
export function inspectTomcatHome(path) {
  const candidate = String(path ?? '').trim();
  if (candidate === '') return { ok: false, error: '请填写 Tomcat 安装目录。' };
  const required = ['bin/bootstrap.jar', 'lib/catalina.jar', 'conf/server.xml'];
  const missing = required.filter((relative) => !existsSync(join(candidate, relative)));
  if (missing.length > 0) return { ok: false, error: `该目录不是可用的 Tomcat 安装目录（缺 ${missing.join('、')}）。` };
  return { ok: true, home: candidate, version: readTomcatVersion(candidate) };
}

function quoteXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Tomcat 的路径分隔符：Windows 用 ; 其余用 :。 */
function classpathDelimiter() {
  return process.platform === 'win32' ? ';' : ':';
}

/**
 * 生成 server.xml。刻意保持最小：一个 Server、一个 Service、一个 Connector、
 * 一个 Host、一个 Context —— 只服务本配置指定的那一个 webapp。
 */
export function buildServerXml({ port, shutdownPort, shutdownToken, contextPath, docBase }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Server port="${shutdownPort}" shutdown="${quoteXml(shutdownToken)}" address="127.0.0.1">
  <Listener className="org.apache.catalina.core.AprLifecycleListener" SSLEngine="off" />
  <Service name="Catalina">
    <Connector port="${port}" protocol="HTTP/1.1" address="127.0.0.1"
               connectionTimeout="20000" redirectPort="${port}" />
    <Engine name="Catalina" defaultHost="localhost">
      <Host name="localhost" appBase="" unpackWARs="true" autoDeploy="false" deployOnStartup="false">
        <Context path="${quoteXml(contextPath)}" docBase="${quoteXml(docBase)}" reloadable="false" />
      </Host>
    </Engine>
  </Service>
</Server>
`;
}

/**
 * 准备一份独立 CATALINA_BASE。
 * @returns {{base, argv, env, gracefulStop, docBase}}
 */
export function prepareTomcat({ root, id, configuration, tomcatHome, javaExecutable }) {
  const options = configuration.tomcat ?? {};
  const base = instanceBase(root, id);
  const conf = join(base, 'conf');
  for (const directory of [base, conf, join(base, 'logs'), join(base, 'temp'), join(base, 'work'), join(base, 'webapps')]) {
    mkdirSync(directory, { recursive: true });
  }
  // 只拷这几个：web.xml 是部署描述符，catalina.properties 与 logging.properties 是运行时最小配置。
  for (const name of ['web.xml', 'catalina.properties', 'logging.properties']) {
    const source = join(tomcatHome, 'conf', name);
    if (existsSync(source)) copyFileSync(source, join(conf, name));
  }

  // webapp 允许绝对路径，也允许相对项目根。
  const rawWebapp = String(options.webapp ?? '').trim();
  const docBase = isAbsolute(rawWebapp) ? rawWebapp : resolve(root, rawWebapp);
  if (!existsSync(docBase)) throw new Error(`Web 应用目录不存在：${docBase}`);

  const shutdownToken = randomBytes(24).toString('hex');
  const serverXml = buildServerXml({
    port: Number(options.port) || 8080,
    shutdownPort: Number(options.shutdownPort) || 8005,
    shutdownToken,
    contextPath: String(options.contextPath ?? '/'),
    docBase,
  });
  writeFileSync(join(conf, 'server.xml'), serverXml, 'utf8');

  const classpath = [join(tomcatHome, 'bin', 'bootstrap.jar'), join(tomcatHome, 'bin', 'tomcat-juli.jar')].join(classpathDelimiter());
  const argv = [
    javaExecutable,
    ...(Array.isArray(options.jvmArgs) ? options.jvmArgs.filter((value) => typeof value === 'string') : []),
    `-Dcatalina.home=${tomcatHome}`,
    `-Dcatalina.base=${base}`,
    `-Djava.io.tmpdir=${join(base, 'temp')}`,
    `-Djava.util.logging.config.file=${join(conf, 'logging.properties')}`,
    '-Djava.util.logging.manager=org.apache.juli.ClassLoaderLogManager',
    '-classpath',
    classpath,
    'org.apache.catalina.startup.Bootstrap',
    'start',
  ];

  return {
    base,
    argv,
    docBase,
    env: { CATALINA_HOME: tomcatHome, CATALINA_BASE: base },
    /**
     * 优雅关闭：连回环的 shutdown 端口，写 token。server.xml 里的 token 是随机的，
     * 所以只有本进程知道怎么让它正常停止；失败就交给上层的强制终止兜底。
     */
    gracefulStop: () =>
      new Promise((resolvePromise) => {
        const port = Number(options.shutdownPort) || 8005;
        const socket = createConnection({ host: '127.0.0.1', port });
        const done = () => {
          socket.destroy();
          resolvePromise(true);
        };
        socket.setTimeout(2000);
        socket.on('connect', () => socket.end(`${shutdownToken}\n`));
        socket.on('close', done);
        socket.on('timeout', done);
        socket.on('error', done);
      }),
  };
}

export function releaseInstance(root, id) {
  try {
    rmSync(instanceBase(root, id), { recursive: true, force: true });
  } catch {
    // 实例目录清不掉不影响运行，下次启动会覆盖。
  }
}

/** 启动前检查端口是否空闲（只报不杀别人的服务）。 */
export function checkPort(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (inUse) => {
      socket.destroy();
      resolvePromise(inUse);
    };
    socket.setTimeout(800);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

export { basename, dirname };
