/**
 * 共享契约：数据形状、默认值、三层环境绑定解析、运行配置校验。
 * 宿主与浏览器两半都按这里的形状说话；校验放在宿主，因为浏览器半可能过时。
 */

/** 环境库支持的种类，顺序即界面顺序。 */
export const ENVIRONMENT_KINDS = ['java', 'maven', 'python', 'node', 'go', 'tomcat', 'ant'];

/** 工作目录占位符：运行配置里写 `${workspaceFolder}` 即工作区根。 */
export const WORKSPACE_FOLDER = '${workspaceFolder}';

export const RUN_TYPES = ['command', 'tomcat'];

/** 三层绑定的每一层都是「kind → 环境库条目 id」，空串表示跟随下一层。 */
export function emptyBindings() {
  return Object.fromEntries(ENVIRONMENT_KINDS.map((kind) => [kind, '']));
}

/** 缺省的三层解析顺序：单配置 → 项目 → 全局默认 → 系统环境。 */
export function resolveBindings({ defaults, project, configuration }) {
  const resolved = emptyBindings();
  const sources = { ...(defaults ?? {}) };
  for (const [kind, id] of Object.entries(project ?? {})) {
    if (typeof id === 'string' && id !== '') sources[kind] = id;
  }
  for (const [kind, id] of Object.entries(configuration ?? {})) {
    if (typeof id === 'string' && id !== '') sources[kind] = id;
  }
  for (const kind of ENVIRONMENT_KINDS) {
    const id = sources[kind];
    if (typeof id === 'string' && id !== '') resolved[kind] = id;
  }
  return resolved;
}

/** 工作区路径归一化：同一目录的 `C:\a\b` 与 `C:/a/b` 必须落成同一个键。 */
export function normalizeRoot(root) {
  const slashed = String(root ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
}

/** 把 `${workspaceFolder}` 展开成工作区根，并归一化分隔符。 */
export function expandCwd(cwd, root) {
  const raw = typeof cwd === 'string' && cwd.trim() !== '' ? cwd.trim() : WORKSPACE_FOLDER;
  return raw.split(WORKSPACE_FOLDER).join(root);
}

export function clampTimeout(value, fallback = 60000) {
  // 手写或 AI 写盘的配置可能给越界值：收敛而不是报错，
  // 否则一个字段就能让整个面板「读取失败」。
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(300000, Math.max(1000, Math.round(number)));
}

const SAFE_ID = /^[\w-]{1,64}$/;
const CONTEXT_PATH = /^\/[\w./-]*$/;
const URL_PATTERN = /^https?:\/\//i;

/**
 * 校验一个工作区的运行配置集合。返回错误信息数组，空数组表示通过。
 * 与参考项目一致：坏配置只报错不抛，UI 仍要能打开去修它。
 */
export function validateWorkspaceEntry(entry) {
  const errors = [];
  const seen = new Set();
  for (const configuration of entry?.configurations ?? []) {
    const id = String(configuration?.id ?? '').trim();
    if (!SAFE_ID.test(id)) {
      errors.push(`运行配置 id「${id}」不合法：只允许字母、数字、下划线与连字符。`);
      continue;
    }
    if (seen.has(id)) errors.push(`运行配置 id「${id}」重复。`);
    seen.add(id);
    const name = String(configuration?.name ?? '').trim();
    if (name === '') errors.push(`运行配置「${id}」缺少名称。`);
    const type = configuration?.type ?? 'command';
    if (!RUN_TYPES.includes(type)) {
      errors.push(`运行配置「${id}」的类型「${type}」不支持。`);
      continue;
    }
    if (type === 'command' && String(configuration?.command ?? '').trim() === '') {
      errors.push(`运行配置「${id}」是命令类型，启动命令不能为空。`);
    }
    if (type === 'tomcat') {
      const tomcat = configuration?.tomcat ?? {};
      if (String(tomcat.webapp ?? '').trim() === '') errors.push(`Tomcat 配置「${id}」缺少 Web 应用路径。`);
      if (!CONTEXT_PATH.test(String(tomcat.contextPath ?? ''))) errors.push(`Tomcat 配置「${id}」的上下文路径必须以 / 开头。`);
      const port = Number(tomcat.port);
      const shutdownPort = Number(tomcat.shutdownPort);
      if (!(port >= 1024 && port <= 65535)) errors.push(`Tomcat 配置「${id}」的端口必须在 1024-65535 之间。`);
      if (port === shutdownPort) errors.push(`Tomcat 配置「${id}」的端口与关闭端口不能相同。`);
    }
    const readyWhen = configuration?.readyWhen;
    if (readyWhen !== undefined && String(readyWhen?.url ?? '') !== '' && !URL_PATTERN.test(String(readyWhen.url))) {
      errors.push(`运行配置「${id}」的就绪检测地址必须是 http(s) 地址。`);
    }
    const browserUrl = configuration?.browserUrl;
    if (browserUrl !== undefined && String(browserUrl) !== '' && !URL_PATTERN.test(String(browserUrl))) {
      errors.push(`运行配置「${id}」的浏览器地址必须是 http(s) 地址。`);
    }
  }
  return errors;
}

/** 环境库校验：id 唯一、默认绑定必须指向存在的同 kind 条目。 */
export function validateLibrary(library) {
  const errors = [];
  const byId = new Map();
  for (const environment of library?.environments ?? []) {
    const id = String(environment?.id ?? '');
    if (!SAFE_ID.test(id)) {
      errors.push(`开发环境 id「${id}」不合法。`);
      continue;
    }
    if (byId.has(id)) errors.push(`开发环境 id「${id}」重复。`);
    if (!ENVIRONMENT_KINDS.includes(environment?.kind)) errors.push(`开发环境「${id}」的种类「${environment?.kind}」不支持。`);
    if (String(environment?.path ?? '').trim() === '') errors.push(`开发环境「${id}」缺少路径。`);
    byId.set(id, environment);
  }
  for (const [kind, id] of Object.entries(library?.defaults ?? {})) {
    if (typeof id !== 'string' || id === '') continue;
    const environment = byId.get(id);
    if (environment === undefined) errors.push(`全局默认里 ${kind} 指向的环境「${id}」不存在。`);
    else if (environment.kind !== kind) errors.push(`全局默认里 ${kind} 指向的环境「${id}」种类不符。`);
  }
  return errors;
}

/** 环境身份：kind + 归一化路径，用于探测时去重（同路径只更新版本，不新增条目）。 */
export function environmentIdentity(kind, path) {
  const normalized = String(path ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  return `${kind}:${process.platform === 'win32' ? normalized.toLowerCase() : normalized}`;
}

/** 把任意文本压成可用作 id 的片段。 */
function slug(value) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return normalized === '' ? 'env' : normalized;
}

/** 生成稳定且不冲突的环境 id，例如 `node-26-7-0`、`java-21-0-4-2`。 */
export function stableEnvironmentId(kind, candidate, used) {
  const base = `${slug(kind)}-${slug(candidate?.version ?? candidate?.name ?? '')}`;
  let id = base;
  for (let index = 2; used.has(id) && index < 1000; index += 1) id = `${base}-${index}`;
  return id;
}

/** 从 PATH 探测结果里合并环境：已存在则只更新 version，不新建条目。 */
export function mergeDetectedEnvironments(current, detected) {
  const environments = [...(current?.environments ?? [])];
  const used = new Set(environments.map((environment) => environment.id));
  const index = new Map(environments.map((environment, position) => [environmentIdentity(environment.kind, environment.path), position]));
  for (const candidate of detected) {
    const key = environmentIdentity(candidate.kind, candidate.path);
    const position = index.get(key);
    if (position === undefined) {
      const id = candidate.id !== undefined && candidate.id !== ''
        ? candidate.id
        : stableEnvironmentId(candidate.kind, candidate, used);
      used.add(id);
      index.set(key, environments.length);
      environments.push({ ...candidate, id });
    } else if (candidate.version !== undefined && candidate.version !== '') {
      environments[position] = { ...environments[position], version: candidate.version };
    }
  }
  return environments;
}
