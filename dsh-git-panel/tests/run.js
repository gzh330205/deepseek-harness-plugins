// 跑齐全部测试：纯解析 → 泳道布局 → 契约 → 真实 git 集成 → HTTP 接口。
// 任一项失败即整体失败（子进程的输出原样转发）。运行：node ./tests/run.js
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'parse.test.js',
  'graph.test.js',
  'contract.test.js',
  'tree.test.js',
  'client.bundle.test.js',
  'render.test.js',
  'git.integration.test.js',
  'routes.test.js',
];

let failed = 0;
for (const file of files) {
  process.stdout.write(`\n── ${file} ──\n`);
  const result = spawnSync(process.execPath, [join(root, 'tests', file)], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\n测试失败：${failed}/${files.length}`);
  process.exit(1);
}
console.log(`\n全部测试通过（${files.length} 个文件）`);
