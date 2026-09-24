// 读 DSH 会话日志：`.jsonl.zstd` 是**多个 zstd 帧拼接**的追加式日志，
// zstdDecompressSync/流式解压都只解第一个帧，必须按 magic 切帧逐个解。
// 用法：node ./scripts/read-session.mjs <sessionId 片段> [关键字]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

export function readSessionLog(file) {
  const buffer = readFileSync(file);
  const starts = [];
  for (let offset = 0; offset + 4 <= buffer.length; offset += 1) {
    if (buffer.compare(ZSTD_MAGIC, 0, 4, offset, offset + 4) === 0) starts.push(offset);
  }
  let text = '';
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1] : buffer.length;
    try {
      text += zstdDecompressSync(buffer.subarray(starts[index], end)).toString('utf8');
    } catch {
      // 追写中的半帧：跳过即可。
    }
  }
  return text;
}

export function findSession(needle) {
  const root = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'sessions');
  const hits = [];
  for (const directory of readdirSync(root)) {
    for (const session of readdirSync(join(root, directory))) {
      if (!session.includes(needle)) continue;
      const file = join(root, directory, session, 'session.v4.jsonl.zstd');
      try {
        hits.push({ file, mtime: statSync(file).mtimeMs });
      } catch {
        // 没有日志文件的会话跳过。
      }
    }
  }
  return hits.sort((left, right) => right.mtime - left.mtime).map((hit) => hit.file);
}

const [needle, keyword] = process.argv.slice(2);
if (needle !== undefined) {
  const files = findSession(needle);
  console.log(`匹配 ${files.length} 个会话`);
  for (const file of files.slice(0, 3)) {
    const text = readSessionLog(file);
    console.log(`\n== ${file}\n   字节 ${text.length}${keyword === undefined ? '' : ` | 含 ${keyword}: ${text.includes(keyword)}`}`);
    if (keyword !== undefined) continue;
    for (const line of text.split('\n').filter(Boolean).slice(0, 40)) {
      console.log('   >', line.length > 220 ? `${line.slice(0, 220)}…` : line);
    }
  }
}
