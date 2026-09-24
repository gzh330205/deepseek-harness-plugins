/**
 * 提交图泳道布局：纯函数，输入按时间倒序的提交（每个带 `parents`），输出每一行的
 * 泳道与线段坐标（x 是泳道序号，y 是 0..1 的行内相对高度）。
 *
 * 宿主把提交列表给浏览器半，浏览器半用这里算出的坐标画 SVG。之所以放在共享层：
 * 分页 append 之后必须**整表重算**才能保持跨页车道连续，放在渲染侧算一次最省事，
 * 也方便单测。
 *
 * 模型是经典的 active-lanes：`columns[i]` 保存这一列正在等待的提交 hash，
 * `null` 表示空列。每个提交占用它所在的那一列，第一个父提交继承该列；若父提交
 * 已经在别的列上等待，就画一条斜线并过去；额外的父提交（merge）在右侧开新列。
 */
/** 默认最多画几条泳道；超出后叠到最后一条（侧栏很窄，宁可叠也不要挤成一条线）。 */
export const MAX_LANES = 6;

/** 泳道配色档位数，对应样式里的 `--dgp-lane-0..N`。 */
export const LANE_PALETTE = 5;

function firstFree(columns, skip) {
  for (let i = 0; i < columns.length; i += 1) {
    if (columns[i] == null && i !== skip) return i;
  }
  return -1;
}

function compact(columns) {
  const next = columns.slice();
  while (next.length > 0 && next[next.length - 1] == null) next.pop();
  return next;
}

/**
 * 计算每一行的泳道与线段。
 * @param commits - 提交列表，新的在前；每项至少要有 `hash`，可选 `parents`。
 * @param options - `maxLanes` 覆盖默认泳道上限。
 * @returns 每行一项：`{ hash, lane, created, laneCount, color, strokes }`。
 *   `strokes` 里每段是 `{ x1, y1, x2, y2, color }`，坐标单位是「泳道」与「行高比例」。
 */
export function layoutGraph(commits, options = {}) {
  const maxLanes = Math.max(1, Number(options.maxLanes) || MAX_LANES);
  const clamp = (lane) => (lane >= maxLanes ? maxLanes - 1 : lane);
  const rows = [];
  let columns = [];

  for (const commit of commits ?? []) {
    const hash = String(commit?.hash ?? '');
    if (hash === '') continue;
    const before = columns.slice();

    let lane = before.indexOf(hash);
    const created = lane === -1;
    if (created) {
      lane = firstFree(before, -1);
      if (lane === -1) lane = before.length;
    }

    // 同一行里还有别的列在等这个提交 → 它们在本行汇入。
    const merging = [];
    for (let i = 0; i < before.length; i += 1) {
      if (i !== lane && before[i] === hash) merging.push(i);
    }

    const parents = Array.isArray(commit?.parents)
      ? commit.parents.filter((parent) => typeof parent === 'string' && parent !== '')
      : [];

    const after = before.slice();
    after[lane] = null;
    for (const index of merging) after[index] = null;

    // 第一个父提交：本列没有别的列在等它就继承本列，否则斜线并过去。
    let downTo = -1;
    if (parents.length > 0) {
      const existing = after.indexOf(parents[0]);
      if (existing !== -1) {
        downTo = existing;
      } else {
        after[lane] = parents[0];
        downTo = lane;
      }
    }

    // 其余父提交（merge）：复用已有的列，否则找一个空列。
    const forks = [];
    for (let i = 1; i < parents.length; i += 1) {
      const parent = parents[i];
      const existing = after.indexOf(parent);
      if (existing !== -1) {
        forks.push(existing);
        continue;
      }
      let slot = firstFree(after, lane);
      if (slot === -1) slot = after.length;
      after[slot] = parent;
      forks.push(slot);
    }
    const next = compact(after);

    const strokes = [];
    // 1) 本行穿过的列 / 汇入本提交的列。
    for (let i = 0; i < before.length; i += 1) {
      if (before[i] == null || i === lane) continue;
      if (next[i] != null) strokes.push({ x1: i, y1: 0, x2: i, y2: 1, color: clamp(i) });
      else strokes.push({ x1: i, y1: 0, x2: lane, y2: 0.5, color: clamp(i) });
    }
    // 2) 本提交自己那一列：上半段（不是本行新开列时才有）与下半段。
    if (!created) strokes.push({ x1: lane, y1: 0, x2: lane, y2: 0.5, color: clamp(lane) });
    if (downTo !== -1) strokes.push({ x1: lane, y1: 0.5, x2: downTo, y2: 1, color: clamp(downTo) });
    // 3) 额外父提交：从提交点向右下/右下分叉（与第一父同一列时不重复画）。
    for (const slot of forks) {
      if (slot === lane || slot === downTo) continue;
      strokes.push({ x1: lane, y1: 0.5, x2: slot, y2: 1, color: clamp(slot) });
    }

    const lanesUsed = Math.max(
      before.length,
      next.length,
      lane + 1,
      downTo + 1,
      ...forks.map((slot) => slot + 1),
      1,
    );
    rows.push({
      hash,
      lane: clamp(lane),
      created,
      laneCount: Math.min(lanesUsed, maxLanes),
      color: clamp(lane) % LANE_PALETTE,
      strokes: strokes.map((stroke) => ({
        x1: clamp(stroke.x1),
        x2: clamp(stroke.x2),
        y1: stroke.y1,
        y2: stroke.y2,
        color: stroke.color % LANE_PALETTE,
      })),
    });

    columns = next;
  }

  return rows;
}

/** 一次算完整列表：把布局并回提交对象，并给出整个列表需要的泳道总数。 */
export function withGraph(commits, options = {}) {
  const rows = layoutGraph(commits, options);
  const lanes = rows.reduce((max, row) => Math.max(max, row.laneCount), 1);
  return {
    lanes: Math.min(lanes, Math.max(1, Number(options.maxLanes) || MAX_LANES)),
    commits: rows.map((row, index) => ({ ...commits[index], graph: row })),
  };
}
