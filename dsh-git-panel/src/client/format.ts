/** 展示层小工具：时间、路径、资源地址。全部是纯函数。 */

export function basename(path: string): string {
  const normalized = String(path ?? '').replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at >= 0 ? normalized.slice(at + 1) : normalized;
}

export function dirname(path: string): string {
  const normalized = String(path ?? '').replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at > 0 ? normalized.slice(0, at) : '';
}

/** 仓库相对路径 → 绝对路径（仓库根使用正斜杠，Windows 下也能直接拼）。 */
export function absolutePath(repoRoot: string, relative: string): string {
  const root = String(repoRoot ?? '').replace(/[\\/]+$/, '');
  const rest = String(relative ?? '').replace(/^[\\/]+/, '');
  if (rest === '') return root;
  if (/^[A-Za-z]:/.test(rest) || rest.startsWith('/')) return rest;
  return `${root}/${rest}`;
}

/**
 * `dsh-resource://file/session/<sessionId>/<path>` 地址。
 * 与 `@deepseek-ai/dsh-util-workspace-path` 的 `fileAddressFor` 同一套语法：
 * 逐段 encodeURIComponent，但保留盘符里的字面冒号。
 */
export function fileAddressFor(sessionId: string, path: string): string {
  const encode = (segment: string): string => encodeURIComponent(segment).replace(/%3A/gi, ':');
  const normalized = String(path ?? '').replace(/\\/g, '/').replace(/^(?:\.\/)+/, '');
  const encoded = normalized.split('/').map(encode).join('/');
  return `dsh-resource://file/session/${encode(sessionId)}/${encoded}`;
}

/** ISO 时间 → 「刚刚 / N 分钟前 / …」；老于一年显示日期。 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso === '' ? '' : iso;
  const delta = Math.max(0, now - time);
  const minute = 60000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return '刚刚';
  if (delta < hour) return `${Math.floor(delta / minute)} 分钟前`;
  if (delta < day) return `${Math.floor(delta / hour)} 小时前`;
  if (delta < 30 * day) return `${Math.floor(delta / day)} 天前`;
  return iso.slice(0, 10);
}

/** 完整时间：`2026-09-24 10:35`（本地时区）。 */
export function fullTime(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const date = new Date(time);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 字节数 → 可读大小。 */
export function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
