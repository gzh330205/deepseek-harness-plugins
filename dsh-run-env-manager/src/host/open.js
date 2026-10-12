/**
 * 用系统默认浏览器打开一条 http(s) 地址（日志里点出来的链接走这里）。
 *
 * 三个决定，都是踩过或推演过的坑：
 *
 *   1. **不走 `ctx.subprocess`**：那条路会把子进程收进宿主管理的 Job 容器，
 *      宿主退出（或插件卸载重挂）时容器关闭会连带把浏览器一起杀掉。
 *      这里用 Node 原生 spawn + `detached` + `unref`，让浏览器脱离宿主生命周期
 *      —— 与 dsh 自己的 open-in-app 是同一策略。
 *   2. **Windows 不用 `cmd /c start`**：`&`、`%`、`^` 在 cmd 里是语法，而开发服务
 *      打印的地址经常带查询串（`http://localhost:3000/?a=1&b=2`），
 *      `start` 会把 `&` 后面的部分拆成第二条命令。`rundll32 url.dll,FileProtocolHandler`
 *      只收一个 argv，没有 shell 二次解释。
 *   3. **只放行 http/https**：这个接口的入参来自浏览器，能打开 `file:`/自定义协议
 *      就等于把「让宿主执行任意 shell 关联」的能力交出去。
 */
import { spawn } from 'node:child_process';

/** 允许交给系统打开的协议：只有这两种，别的（file:/javascript:/自定义）一律拒绝。 */
const OPENABLE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * 规范化一条待打开地址。
 * @param value - 候选地址（来自日志或面板）
 * @returns 规范化后的绝对地址；不是 http(s) 或解析不出来时返回 undefined
 */
export function normalizeOpenUrl(value) {
  const text = String(value ?? '').trim();
  if (text === '') return undefined;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return undefined;
  }
  if (!OPENABLE_PROTOCOLS.has(parsed.protocol)) return undefined;
  return parsed.toString();
}

/**
 * 计算「用默认浏览器打开」的命令行（纯函数，便于按平台断言）。
 * @param url - 已经规范化过的地址
 * @param platform - 平台（默认当前）
 * @returns argv：`argv[0]` 是可执行文件，交给 spawn
 */
export function planOpenUrl(url, platform = process.platform) {
  if (platform === 'win32') return ['rundll32.exe', 'url.dll,FileProtocolHandler', url];
  if (platform === 'darwin') return ['open', url];
  return ['xdg-open', url];
}

/**
 * 在默认浏览器里打开地址。等到 spawn 事件才算发出去，这样「系统没有可用浏览器」
 * 这类失败会作为接口错误回到面板，而不是静默什么都不发生。
 *
 * @param url - 待打开地址（内部再做一次协议校验）
 * @param platform - 平台（默认当前）
 * @param spawnImpl - spawn 实现（测试注入用）
 * @returns 规范化后的地址
 */
export async function openInDefaultBrowser(url, platform = process.platform, spawnImpl = spawn) {
  const target = normalizeOpenUrl(url);
  if (target === undefined) throw new Error(`只能打开 http(s) 地址：${String(url ?? '')}`);
  const argv = planOpenUrl(target, platform);
  const child = spawnImpl(argv[0], argv.slice(1), { detached: true, stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  // 父子脱钩：宿主退出不该把用户刚打开的浏览器带走。
  child.unref();
  return target;
}
