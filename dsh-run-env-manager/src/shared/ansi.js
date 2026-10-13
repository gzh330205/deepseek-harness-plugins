/**
 * 极简 ANSI 解析器：把带终端着色的日志切成 [{ text, className, style }]，供面板渲染。
 *
 * 只认 SGR（`ESC[...m`，颜色与字体样式）：清行 `[2K`、光标归位 `[1G` 这类**终端行为**
 * 在日志视图里无法复现，直接丢弃，否则又会变成一串 `[2K` 噪音。
 *
 * 颜色不写死在内联样式里，而是给 CSS 类（`renv-a-fg-31` 之类），
 * 由 styles.css 提供浅色/深色两套调色板（产品用 `body[data-ds-dark-theme]` 切主题）。
 * 只有 256 色/真彩色无法枚举，才回落到内联 color。
 *
 * 不完整的转义序列（被 chunk 切断）在本次解析里丢弃：调用方每次都传**整段**日志，
 * 补齐后自然会在下一次解析里重新出现，所以不需要在这里保留状态。
 */

const ESC = '\u001B';
const SGR_PATTERN = /^\u001B\[([0-9;]*)m/;
const CSI_PATTERN = /^\u001B\[[0-9;?]*[ -/]*[@-~]/;
const OSC_PATTERN = /^\u001B\][\s\S]*?(?:\u0007|\u001B\\)/;
/** 只可能是「还没写完的序列」：ESC，或 ESC[ + 参数（缺终止字节）。 */
const PARTIAL_PATTERN = /^\u001B(?:\[[0-9;?]*[ -/]*|\][\s\S]*)?$/;

const XTERM_BASE = [
  [0, 0, 0], [205, 49, 49], [13, 188, 121], [229, 229, 16], [36, 114, 200], [188, 63, 188], [17, 168, 205], [229, 229, 229],
  [102, 102, 102], [241, 76, 76], [35, 209, 139], [245, 245, 67], [59, 142, 234], [214, 112, 214], [41, 184, 219], [255, 255, 255],
];

const hex = ([r, g, b]) => `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`;

/** xterm 256 色 → #rrggbb。0–15 走 CSS 类，不由这里处理。 */
export function xterm256(index) {
  if (index < 16) return hex(XTERM_BASE[index] ?? XTERM_BASE[7]);
  if (index < 232) {
    const n = index - 16;
    const level = (v) => (v === 0 ? 0 : 55 + v * 40);
    return hex([level(Math.floor(n / 36)), level(Math.floor((n % 36) / 6)), level(n % 6)]);
  }
  const grey = 8 + (index - 232) * 10;
  return hex([grey, grey, grey]);
}

function createStyle() {
  return { fg: undefined, bg: undefined, bold: false, dim: false, italic: false, underline: false, inverse: false, strike: false };
}

/** 把一串 SGR 参数应用到样式状态上。 */
function applySgr(style, params) {
  const codes = params === '' ? [0] : params.split(';').map((value) => (value === '' ? 0 : Number(value)));
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];
    if (code === 0) Object.assign(style, createStyle());
    else if (code === 1) style.bold = true;
    else if (code === 2) style.dim = true;
    else if (code === 3) style.italic = true;
    else if (code === 4) style.underline = true;
    else if (code === 7) style.inverse = true;
    else if (code === 9) style.strike = true;
    else if (code === 22) {
      style.bold = false;
      style.dim = false;
    } else if (code === 23) style.italic = false;
    else if (code === 24) style.underline = false;
    else if (code === 27) style.inverse = false;
    else if (code === 29) style.strike = false;
    else if (code === 39) style.fg = undefined;
    else if (code === 49) style.bg = undefined;
    else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) style.fg = { cls: `renv-a-fg-${code}` };
    else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) style.bg = { cls: `renv-a-bg-${code}` };
    else if (code === 38 || code === 48) {
      const target = code === 38 ? 'fg' : 'bg';
      const mode = codes[index + 1];
      if (mode === 5 && Number.isFinite(codes[index + 2])) {
        const n = codes[index + 2];
        // 0–15 用类（能跟随主题），16 以上无从枚举，用内联色。
        style[target] = n < 16 ? { cls: `renv-a-${target === 'fg' ? 'fg' : 'bg'}-${n < 8 ? 30 + n : 90 + (n - 8)}` } : { color: xterm256(n) };
        index += 2;
      } else if (mode === 2 && [codes[index + 2], codes[index + 3], codes[index + 4]].every((value) => Number.isFinite(value))) {
        style[target] = { color: hex([codes[index + 2], codes[index + 3], codes[index + 4]]) };
        index += 4;
      }
    }
  }
}

function styleToClassName(style) {
  const classes = [];
  if (style.fg?.cls !== undefined) classes.push(style.fg.cls);
  if (style.bg?.cls !== undefined) classes.push(style.bg.cls);
  if (style.bold) classes.push('renv-a-bold');
  if (style.dim) classes.push('renv-a-dim');
  if (style.italic) classes.push('renv-a-italic');
  if (style.underline) classes.push('renv-a-underline');
  if (style.inverse) classes.push('renv-a-inverse');
  if (style.strike) classes.push('renv-a-strike');
  return classes.length === 0 ? undefined : classes.join(' ');
}

function styleToInline(style) {
  const inline = {};
  if (style.fg?.color !== undefined) inline.color = style.fg.color;
  if (style.bg?.color !== undefined) inline.background = style.bg.color;
  return Object.keys(inline).length === 0 ? undefined : inline;
}

/**
 * 解析一段带 ANSI 的文本。
 * @param {string} text
 * @returns {{text: string, className?: string, style?: {color?: string, background?: string}}[]}
 */
export function parseAnsi(text) {
  const segments = [];
  const style = createStyle();
  let buffer = '';
  let cursor = 0;

  const flush = () => {
    if (buffer === '') return;
    segments.push({ text: buffer, className: styleToClassName(style), style: styleToInline(style) });
    buffer = '';
  };

  while (cursor < text.length) {
    const escapeAt = text.indexOf(ESC, cursor);
    if (escapeAt < 0) {
      buffer += text.slice(cursor);
      break;
    }
    buffer += text.slice(cursor, escapeAt);
    const rest = text.slice(escapeAt);

    const sgr = SGR_PATTERN.exec(rest);
    if (sgr !== null) {
      flush(); // 样式变更前先把已积累的文本切出来
      applySgr(style, sgr[1]);
      cursor = escapeAt + sgr[0].length;
      continue;
    }
    const dropped = CSI_PATTERN.exec(rest) ?? OSC_PATTERN.exec(rest);
    if (dropped !== null) {
      flush();
      cursor = escapeAt + dropped[0].length;
      continue;
    }
    if (PARTIAL_PATTERN.test(rest)) {
      // 还没写完的序列：丢掉这截（下次解析整段时它已经补齐）。
      break;
    }
    // 认不出的转义：只丢掉 ESC 本身，后面的文本照常显示。
    cursor = escapeAt + 1;
  }
  flush();
  return segments;
}

/** 只要纯文本（给 AI 排查用：模型不需要颜色码）。 */
export function plainText(text) {
  return parseAnsi(text).map((segment) => segment.text).join('');
}
