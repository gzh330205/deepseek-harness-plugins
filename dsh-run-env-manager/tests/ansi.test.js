// 客户端 ANSI 解析测试：颜色/样式片段、丢弃终端行为序列、截断序列、纯文本转换。
// 运行：node ./tests/ansi.test.js
import { parseAnsi, plainText, xterm256 } from '../src/client/ansi.js';

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
const shape = (segments) => segments.map((segment) => [segment.text, segment.className ?? null, segment.style === undefined ? null : JSON.stringify(segment.style)]);

/* ── 基本着色 ─────────────────────────────────────────────────────────── */

const colored = parseAnsi('\u001b[32mINFO\u001b[39m: \u001b[36mok\u001b[39m');
eq('片段数量：无色文本 + 两段着色', colored.length, 3);
eq('前缀是纯文本', colored[0].text, 'INFO');
eq('绿色走类名（跟随主题）', colored[0].className, 'renv-a-fg-32');
eq('未着色片段没有类名', colored[1].className, undefined);
eq('青色走类名', colored[2].className, 'renv-a-fg-36');
eq('拼接回来等于剥掉转义的原文本', plainText('\u001b[32mINFO\u001b[39m: \u001b[36mok\u001b[39m'), 'INFO: ok');

eq('无转义时只有一段且无样式', shape(parseAnsi('plain 中文\n')).length, 1);
eq('无转义时不产生类名', parseAnsi('plain').className === undefined, true);

/* ── 样式修饰 ─────────────────────────────────────────────────────────── */

eq('粗体 + 下划线', parseAnsi('\u001b[1;4mX\u001b[0m')[0].className, 'renv-a-bold renv-a-underline');
eq('复位后回到无色', parseAnsi('\u001b[1mX\u001b[0mY').at(-1).className, undefined);
eq('22 关掉粗体', parseAnsi('\u001b[1mA\u001b[22mB').at(-1).className, undefined);
eq('前景色 + 粗体并存', parseAnsi('\u001b[31;1mX')[0].className, 'renv-a-fg-31 renv-a-bold');
eq('背景色走 bg 类', parseAnsi('\u001b[41mX')[0].className, 'renv-a-bg-41');
eq('亮色 90-97', parseAnsi('\u001b[91mX')[0].className, 'renv-a-fg-91');
eq('反显走 inverse 类', parseAnsi('\u001b[7mX')[0].className, 'renv-a-inverse');

/* ── 256 色 / 真彩色 ──────────────────────────────────────────────────── */

eq('38;5 的低 16 色仍走类名', parseAnsi('\u001b[38;5;9mX')[0].className, 'renv-a-fg-91');
eq('38;5 的高位色用内联色', JSON.stringify(parseAnsi('\u001b[38;5;196mX')[0].style), JSON.stringify({ color: '#ff0000' }));
eq('38;2 真彩色用内联色', JSON.stringify(parseAnsi('\u001b[38;2;18;52;86mX')[0].style), JSON.stringify({ color: '#123456' }));
eq('48;2 真彩背景', JSON.stringify(parseAnsi('\u001b[48;2;1;2;3mX')[0].style), JSON.stringify({ background: '#010203' }));
eq('灰度档 232 起', xterm256(232), '#080808');
eq('256 色块起始', xterm256(16), '#000000');
eq('256 色块末尾', xterm256(231), '#ffffff');

/* ── 终端行为序列：丢弃，但文本要留下 ─────────────────────────────────── */

eq('清行 + 光标归位被丢掉', plainText('\u001b[2K\u001b[1Grewritten'), 'rewritten');
eq('OSC 窗口标题被丢掉', plainText('\u001b]0;title\u0007visible'), 'visible');
eq('未知转义只丢 ESC 本身', plainText('\u001b(X'), '(X');

/* ── 被切断的序列 ─────────────────────────────────────────────────────── */

eq('尾部半截序列不吐出来', plainText('log: \u001b[3'), 'log: ');
eq('尾部孤立 ESC 不吐出来', plainText('text\u001b'), 'text');
eq('补齐后颜色正常渲染', parseAnsi('log: \u001b[32mINFO')[1].className, 'renv-a-fg-32');
eq('空串安全', parseAnsi('').length, 0);

/* ── 实际日志样式 ─────────────────────────────────────────────────────── */

const REAL = '[2026-09-24 10:20:07] \u001b[32mINFO\u001b[39m: \u001b[36mpostgres connection established\u001b[39m';
eq('真实日志的纯文本', plainText(REAL), '[2026-09-24 10:20:07] INFO: postgres connection established');
eq(
  '真实日志的片段样式',
  JSON.stringify(shape(parseAnsi(REAL))),
  JSON.stringify([
    ['[2026-09-24 10:20:07] ', null, null],
    ['INFO', 'renv-a-fg-32', null],
    [': ', null, null],
    ['postgres connection established', 'renv-a-fg-36', null],
  ]),
);

/* ── 汇总 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`ansi.test FAILED: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`ansi.test OK: ${passed} assertions passed`);
