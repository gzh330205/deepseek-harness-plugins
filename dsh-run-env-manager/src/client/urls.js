/**
 * 日志文本里的地址 → 可点击片段。
 *
 * 只做一件事：把一段纯文本切成「普通文本 / 链接」两种 token，供面板渲染 <a>。
 * 识别范围刻意收窄：http(s) 全地址，以及开发服务常打印的「主机:端口」——
 * `localhost:5173`、`127.0.0.1:3000`、任意 IPv4 + 端口（`192.168.1.5:8080`，内网/Vite Network 那行）、
 * `[::1]:port`，统统补上 `http://` 再当链接。两条不认：
 *   - **裸域名**（`foo.com`）：日志里更可能是文件名或包名；
 *   - **不带端口的裸 IP**（`1.2.3.4`）：无从判断是不是在说一个服务，且容易撞上版本号。
 * 误判比漏判更烦人，宁可让人手动复制。
 *
 * 纯 JS（与 ansi.js 一致）：解析规则要能被 `node ./tests/urls.test.js` 直接跑。
 *
 * @typedef {{ text: string, href?: string }} LinkToken
 * @typedef {(key: string, params?: Record<string, unknown>) => string} Translator
 */

// IPv4 那一支**必须带端口**：`\d{1,3}(\.\d{1,3}){3}` 单独出现时无法与版本号区分。
const CANDIDATE = /(?:https?:\/\/|localhost:|\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}|\[::1\]:)[^\s<>"'`]+/gi;
/** 句末标点：`see http://x/a.` 的句号不属于地址。 */
const TRAILING = /[.,;:!?…*，。、；：！？]+$/;
/** 右括号只有在**不成对**时才从地址尾巴上剥掉（维基那种 `a_(b)` 要保留）。 */
/** @type {Array<[string, string]>} */
const BRACKETS = [[')', '('], [']', '['], ['}', '{']];

function count(text, char) {
  let total = 0;
  for (const found of text) if (found === char) total += 1;
  return total;
}

/** 剥掉句末标点与多余的右括号（可能交替出现：`x.com/a).`）。 */
function trimCandidate(raw) {
  let text = raw;
  for (;;) {
    const before = text;
    text = text.replace(TRAILING, '');
    for (const [closer, opener] of BRACKETS) {
      while (text.endsWith(closer) && count(text, closer) > count(text, opener)) text = text.slice(0, -1);
    }
    if (text === before) return text;
  }
}

/** 候选串能不能成为一个真地址；返回规范化后的绝对地址（可能补了 http://）。 */
function asHref(candidate) {
  const absolute = /^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(absolute);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  // 主机名必须像样：`https://`、`https://.` 这类残片留在纯文本里。
  const head = parsed.hostname[0] ?? '';
  if (parsed.hostname === '' || !/[A-Za-z0-9[]/.test(head)) return undefined;
  // `0.0.0.0:8080` 是「监听所有网卡」的通配地址，浏览器连不上——href 换成回环，
  // 日志里显示的文字保持原样（不改写用户看到的日志）。
  if (parsed.hostname === '0.0.0.0') parsed.hostname = '127.0.0.1';
  return parsed.toString();
}

/**
 * 把一段文本切成普通文本/链接 token。没有地址时返回单个普通 token。
 * @param text - 已经剥掉 ANSI 转义的纯文本片段
 * @returns token 数组（拼接起来等于入参）
 */
export function linkify(text) {
  if (text === '') return [];
  /** @type {LinkToken[]} */
  const tokens = [];
  let cursor = 0;
  CANDIDATE.lastIndex = 0;
  for (let match = CANDIDATE.exec(text); match !== null; match = CANDIDATE.exec(text)) {
    const url = trimCandidate(match[0]);
    const href = asHref(url);
    if (href === undefined) continue; // 不挪 cursor：这段照旧是纯文本
    const start = match.index;
    if (start > cursor) tokens.push({ text: text.slice(cursor, start) });
    tokens.push({ text: url, href });
    cursor = start + url.length;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor) });
  return tokens;
}

/** 文本里有没有可打开的地址（面板据此决定要不要显示「打开浏览器」按钮）。 */
export function firstUrl(text) {
  return linkify(text).find((token) => token.href !== undefined)?.href;
}
