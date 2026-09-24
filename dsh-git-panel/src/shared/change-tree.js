/**
 * 变更条目 → 目录树：纯函数，宿主与浏览器半共用（目前只有浏览器半用它渲染
 * 「目录」显示模式，放在共享层是为了方便单测，也避免以后宿主侧要用时再抄一份）。
 *
 * 规则：
 *  - 每层目录在前、文件在后，各自按自然序（大小写不敏感、数字按数值）排列；
 *  - **单链压缩**：一个目录只有唯一一个子目录、自己没有文件时合并成一行
 *    （`src/client/components` 而不是三层各占一行），与主流 IDE 的文件树一致；
 *  - 目录节点聚合子树里的文件数与增删行数（暂存侧、工作区侧各存一份，由调用方按
 *    分组选一侧显示）；未跟踪文件没有行数，聚合结果标记 `unknown`。
 */

function makeDirectory(name, path) {
  return {
    type: 'dir',
    name,
    path,
    children: [],
    files: 0,
    staged: { additions: 0, deletions: 0, binary: false, unknown: true },
    worktree: { additions: 0, deletions: 0, binary: false, unknown: true },
  };
}

const compareNames = (left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });

function mergeStats(target, stat) {
  if (stat === null || stat === undefined) return;
  const known = typeof stat.additions === 'number' || typeof stat.deletions === 'number' || stat.binary === true;
  if (!known) return;
  target.unknown = false;
  if (typeof stat.additions === 'number') target.additions += stat.additions;
  if (typeof stat.deletions === 'number') target.deletions += stat.deletions;
  if (stat.binary === true) target.binary = true;
}

function aggregate(node) {
  if (node.type === 'file') return node;
  for (const child of node.children) {
    aggregate(child);
    if (child.type === 'file') {
      node.files += 1;
      mergeStats(node.staged, child.entry?.stats?.staged);
      mergeStats(node.worktree, child.entry?.stats?.worktree);
    } else {
      node.files += child.files;
      for (const side of ['staged', 'worktree']) {
        if (child[side].unknown === false) {
          node[side].unknown = false;
          node[side].additions += child[side].additions;
          node[side].deletions += child[side].deletions;
          node[side].binary = node[side].binary || child[side].binary;
        }
      }
    }
  }
  return node;
}

/** 排序 + 单链压缩；`isRoot` 为真时不压缩自己（它是虚拟根，不画出来）。 */
function normalize(node, isRoot) {
  if (node.type === 'file') return node;
  node.children = node.children.map((child) => normalize(child, false));
  node.children.sort((left, right) => (left.type === right.type ? compareNames(left, right) : left.type === 'dir' ? -1 : 1));
  while (!isRoot && node.children.length === 1 && node.children[0].type === 'dir') {
    const only = node.children[0];
    node.name = `${node.name}/${only.name}`;
    node.path = only.path;
    node.children = only.children;
    node.files = only.files;
    node.staged = only.staged;
    node.worktree = only.worktree;
  }
  return node;
}

/**
 * 构造目录树。
 * @param entries - 变更条目（`{ path, stats }`），路径用 `/` 分隔。
 * @returns 虚拟根节点；渲染时画 `root.children`，不要画根自己。
 */
export function buildChangeTree(entries) {
  const root = makeDirectory('', '');
  for (const entry of entries ?? []) {
    const path = String(entry?.path ?? '');
    if (path === '') continue;
    const segments = path.split('/').filter((segment) => segment !== '');
    if (segments.length === 0) continue;
    let node = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      let child = node.children.find((candidate) => candidate.type === 'dir' && candidate.name === segment);
      if (child === undefined) {
        child = makeDirectory(segment, node.path === '' ? segment : `${node.path}/${segment}`);
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ type: 'file', name: segments[segments.length - 1], path, entry });
  }
  aggregate(root);
  return normalize(root, true);
}

/**
 * 收集树里全部目录节点的 path（「全部折叠 / 全部展开」用）。
 * @param node - `buildChangeTree` 的返回值或任意子树。
 * @returns 目录路径数组，先序遍历（父目录在子目录之前）。
 */
export function collectDirectoryPaths(node) {
  if (node === null || node === undefined || node.type !== 'dir') return [];
  const paths = [];
  for (const child of node.children ?? []) {
    if (child.type !== 'dir') continue;
    paths.push(child.path);
    paths.push(...collectDirectoryPaths(child));
  }
  return paths;
}

/** 树里的文件总数（目录模式的标题用）。 */
export function countTreeFiles(node) {
  if (node.type === 'file') return 1;
  return node.children.reduce((sum, child) => sum + countTreeFiles(child), 0);
}
