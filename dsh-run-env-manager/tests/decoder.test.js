// 输出解码测试：UTF-8 / GB18030 / 跨 chunk 半字符 / 混合流。
// （ANSI 着色不再在宿主侧剥离，改由面板渲染 —— 见 tests/ansi.test.js）
// 运行：node ./tests/decoder.test.js
import { decodeChunk, flushDecoder } from '../src/host/processes.js';

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

const decoder = () => ({ pending: Buffer.alloc(0), encoding: 'utf8' });
const feed = (state, chunks) => chunks.map((chunk) => decodeChunk(state, Buffer.from(chunk))).join('');

const GBK = {
  中文: [0xd6, 0xd0, 0xce, 0xc4],
  测试: [0xb2, 0xe2, 0xca, 0xd4],
  错误: [0xb4, 0xed, 0xce, 0xf3],
  启动成功: [0xc6, 0xf4, 0xb6, 0xaf, 0xb3, 0xc9, 0xb9, 0xa6],
};

/* ── UTF-8 ────────────────────────────────────────────────────────────── */

eq('纯 UTF-8 一次到齐', feed(decoder(), [Buffer.from('中文 OK\n', 'utf8')]), '中文 OK\n');
eq(
  'UTF-8 三字节字符跨 chunk 不产生替换字符',
  feed(decoder(), [Buffer.from([0xe4]), Buffer.from([0xb8]), Buffer.from([0xad])]),
  '中',
);
eq(
  'UTF-8 混合 ASCII 与跨 chunk 中文',
  feed(decoder(), [Buffer.from('log: 中', 'utf8').subarray(0, 7), Buffer.from('log: 中', 'utf8').subarray(7)]),
  'log: 中',
);
check('UTF-8 跨 chunk 结果不含 U+FFFD', !feed(decoder(), [Buffer.from([0xe4]), Buffer.from([0xb8, 0xad])]).includes('�'));

/* ── GB18030 ─────────────────────────────────────────────────────────── */

eq('纯 GBK 字节被正确解码', feed(decoder(), [Buffer.from(GBK.中文)]), '中文');
eq('GBK 长词解码', feed(decoder(), [Buffer.from(GBK.启动成功)]), '启动成功');
eq(
  'GBK 两字节字符跨 chunk',
  feed(decoder(), [Buffer.from([GBK.中文[0]]), Buffer.from(GBK.中文.slice(1))]),
  '中文',
);
eq(
  'GBK 行 + 换行 + 下一行 GBK',
  feed(decoder(), [Buffer.from([...GBK.测试, 0x0a, ...GBK.中文])]),
  '测试\n中文',
);

/* ── 混合流（同一路输出里既有 GBK 又有 UTF-8，逐块判断而非整流定一次）────── */

eq(
  'GBK 行后接 UTF-8 行都能解出来',
  feed(decoder(), [Buffer.from([...GBK.错误, 0x0a]), Buffer.from('UTF-8 行: 中文\n', 'utf8')]),
  '错误\nUTF-8 行: 中文\n',
);

/* ── 收尾 ─────────────────────────────────────────────────────────────── */

const leftover = decoder();
decodeChunk(leftover, Buffer.from([0xe4, 0xb8])); // 半个「中」
check('未完成的字节留在缓冲里', leftover.pending.length === 2, `pending=${leftover.pending.length}`);
check('收尾能把残留解出来（不抛错）', typeof flushDecoder(leftover) === 'string');
eq('收尾后缓冲清空', leftover.pending.length, 0);
eq('空缓冲收尾返回空串', flushDecoder(decoder()), '');

/* ── 汇总 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`decoder.test FAILED: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`decoder.test OK: ${passed} assertions passed`);
