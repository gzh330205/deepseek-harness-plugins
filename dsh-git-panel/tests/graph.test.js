// 提交图泳道布局测试：线性、分叉、合并、跨页重算。
// 运行：node ./tests/graph.test.js
import { layoutGraph, withGraph, MAX_LANES } from '../src/shared/graph.js';

let passed = 0;
const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
}
const eq = (label, actual, expected) => check(label, JSON.stringify(actual) === JSON.stringify(expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);

const line = (hash, parents = []) => ({ hash, parents });
const lanesOf = (rows) => rows.map((row) => row.lane);

/* ── 线性历史 ─────────────────────────────────────────────────────────── */

const linear = layoutGraph([line('c', ['b']), line('b', ['a']), line('a', [])]);
eq('线性：都在 0 号道', lanesOf(linear), [0, 0, 0]);
eq('线性：首行是新开列（没有上半段）', [linear[0].created, linear[0].strokes.length], [true, 1]);
eq('线性：中间行有上半段 + 下半段', [linear[1].created, linear[1].strokes.length], [false, 2]);
eq('线性：末行没有下半段', linear[2].strokes.length, 1);
eq('线性：泳道数恒为 1', linear.map((row) => row.laneCount), [1, 1, 1]);

/* ── 分叉 + 合并 ──────────────────────────────────────────────────────── */

// m 是合并提交（父 a、b），a 与 b 都由 base 长出。
const branched = layoutGraph([line('m', ['a', 'b']), line('a', ['base']), line('b', ['base']), line('base', [])]);
eq('合并：合并提交在 0 号道', branched[0].lane, 0);
eq('合并：合并提交开出第二条道', [branched[0].laneCount, branched[0].strokes.length], [2, 2]);
eq('合并：a 在 0 号道、b 在 1 号道', [branched[1].lane, branched[2].lane], [0, 1]);
eq('合并：base 回到 0 号道', branched[3].lane, 0);
// b 的父 base 已经在 0 号列等待 → 必须画一条从 1 号道斜回 0 号道的线。
const bStrokes = branched[2].strokes;
check(
  '合并：b 有一条斜线回到 base 所在列',
  bStrokes.some((stroke) => stroke.x1 === 1 && stroke.y1 === 0.5 && stroke.x2 === 0 && stroke.y2 === 1),
  JSON.stringify(bStrokes),
);
check(
  '合并：合并提交有一条分叉线到 1 号道',
  branched[0].strokes.some((stroke) => stroke.x1 === 0 && stroke.y1 === 0.5 && stroke.x2 === 1 && stroke.y2 === 1),
  JSON.stringify(branched[0].strokes),
);
check('合并：所有坐标都在泳道范围内', branched.every((row) => row.strokes.every((stroke) => stroke.x1 >= 0 && stroke.x2 >= 0 && stroke.x1 < 2 && stroke.x2 < 2)));

/* ── 多个头共享同一父（跨页 append 后整表重算） ───────────────────────── */

const shared = layoutGraph([line('x', ['base']), line('y', ['base']), line('base', [])]);
eq('共享父：两条独立头各占一道', [shared[0].lane, shared[1].lane], [0, 1]);
eq('共享父：父提交落回 0 号道', shared[2].lane, 0);
check('共享父：y 斜线回 0 号道', shared[1].strokes.some((stroke) => stroke.x1 === 1 && stroke.x2 === 0));

/* ── 泳道上限 ─────────────────────────────────────────────────────────── */

const wide = layoutGraph([line('m', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'])], { maxLanes: 3 });
check('泳道钳制：所有坐标 < 3', wide[0].strokes.every((stroke) => stroke.x1 < 3 && stroke.x2 < 3), JSON.stringify(wide[0].strokes));
eq('泳道钳制：laneCount 不超过上限', wide[0].laneCount, 3);
eq('默认上限', MAX_LANES, 6);

/* ── withGraph ────────────────────────────────────────────────────────── */

const wrapped = withGraph([line('c', ['b']), line('b', [])]);
eq('withGraph：并回提交对象', wrapped.commits.map((commit) => commit.hash), ['c', 'b']);
eq('withGraph：保留原字段', wrapped.commits[0].graph.lane, 0);
eq('withGraph：泳道总数', wrapped.lanes, 1);
eq('withGraph：空输入', withGraph([]), { lanes: 1, commits: [] });
eq('withGraph：忽略没有 hash 的项', withGraph([{ hash: '' }, line('a', [])]).commits.length, 1);

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`graph.test FAILED (${failures.length}/${passed + failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`graph.test OK (${passed} assertions)`);
