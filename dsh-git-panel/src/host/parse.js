/**
 * git 输出的纯解析器：全部是「字符串进、结构体出」，不碰进程与文件系统，
 * 因此可以在 `tests/parse.test.js` 里用真实 git 夹具逐条钉住。
 *
 * 涉及的 git 输出格式（都按实测输出写，不是猜的）：
 *  - `status --porcelain=v2 --branch -z`
 *  - `diff --numstat -z`（含 rename 的「空第三字段 + 两个 NUL 分隔路径」形态）
 *  - `diff-tree --name-status -z`
 *  - `log --format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%P%x1f%b%x1e`
 *  - `worktree list --porcelain -z`
 *  - `for-each-ref --format=%(refname)%1f…%0a`（注意是 `%1f` 不是 `%x1f`）
 *  - 统一 diff 文本
 */
import { codeToKind } from '../shared/git-status.js';

/** 按空白切出固定数量的字段，最后一个字段吃掉剩余全部（路径里可以有空格）。 */
function splitFields(text, count) {
  const fields = [];
  let rest = text;
  for (let i = 0; i < count - 1; i += 1) {
    const at = rest.indexOf(' ');
    if (at === -1) {
      fields.push(rest);
      rest = '';
      continue;
    }
    fields.push(rest.slice(0, at));
    rest = rest.slice(at + 1);
  }
  fields.push(rest);
  return fields;
}

/** 变更条目的展示语义：工作区侧优先（未跟踪/冲突是更强的信号）。 */
function primaryKind(index, worktree) {
  if (index === '?' || worktree === '?') return 'untracked';
  if (index === 'U' || worktree === 'U') return 'conflicted';
  if (worktree !== '.' && worktree !== ' ') return codeToKind(worktree);
  return codeToKind(index);
}

/**
 * 解析 `git status --porcelain=v2 --branch -z --untracked-files=all`。
 * @returns `{ branch: {oid, head, upstream, ahead, behind, initial, detached}, entries: [] }`
 */
export function parsePorcelainV2(text) {
  const tokens = String(text ?? '').split('\0');
  const branch = { oid: '', head: '', upstream: '', ahead: 0, behind: 0, initial: false, detached: false };
  const entries = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '') continue;

    if (token.startsWith('# ')) {
      const space = token.indexOf(' ', 2);
      const key = space === -1 ? token.slice(2) : token.slice(2, space);
      const value = space === -1 ? '' : token.slice(space + 1);
      if (key === 'branch.oid') {
        if (value === '(initial)') branch.initial = true;
        else branch.oid = value;
      } else if (key === 'branch.head') {
        if (value === '(detached)') branch.detached = true;
        else branch.head = value;
      } else if (key === 'branch.upstream') {
        branch.upstream = value;
      } else if (key === 'branch.ab') {
        const match = /\+(\d+)\s+-(\d+)/.exec(value);
        if (match !== null) {
          branch.ahead = Number(match[1]);
          branch.behind = Number(match[2]);
        }
      }
      continue;
    }

    const type = token[0];
    if (type === '1') {
      const fields = splitFields(token.slice(2), 8);
      const path = fields[7];
      entries.push(makeEntry({ path, index: fields[0][0], worktree: fields[0][1], sub: fields[1] }));
    } else if (type === '2') {
      const fields = splitFields(token.slice(2), 9);
      const path = fields[8];
      const origPath = tokens[i + 1] ?? '';
      i += 1;
      entries.push(makeEntry({ path, origPath, index: fields[0][0], worktree: fields[0][1], sub: fields[1] }));
    } else if (type === 'u') {
      const fields = splitFields(token.slice(2), 10);
      const path = fields[9];
      entries.push(makeEntry({ path, index: fields[0][0], worktree: fields[0][1], sub: fields[1], conflicted: true }));
    } else if (type === '?' || type === '!') {
      const path = token.slice(2);
      entries.push(
        makeEntry({ path, index: type, worktree: type, untracked: type === '?', ignored: type === '!' }),
      );
    }
  }

  return { branch, entries };
}

function makeEntry({ path, origPath, index, worktree, sub, conflicted, untracked, ignored }) {
  const isConflicted = conflicted === true || index === 'U' || worktree === 'U';
  const isUntracked = untracked === true || index === '?';
  return {
    path: String(path ?? ''),
    origPath: typeof origPath === 'string' && origPath !== '' ? origPath : undefined,
    index,
    worktree,
    kind: isConflicted ? 'conflicted' : primaryKind(index, worktree),
    submodule: typeof sub === 'string' && sub.startsWith('S'),
    conflicted: isConflicted,
    untracked: isUntracked,
    ignored: ignored === true || index === '!',
  };
}

/**
 * 解析 `--numstat -z`。
 * 普通条目是 `A\tD\tpath\0`；重命名/复制是 `A\tD\t\0old\0new\0`（新路径在最后）。
 * @returns `Map<path, { additions, deletions, binary, origPath? }>`，重命名条目同时登记新旧两个键。
 */
export function parseNumstatZ(text) {
  const tokens = String(text ?? '').split('\0');
  const map = new Map();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '') continue;
    const parts = token.split('\t');
    if (parts.length < 3) continue;
    const binary = parts[0] === '-' && parts[1] === '-';
    const additions = parts[0] === '-' ? null : Number(parts[0]);
    const deletions = parts[1] === '-' ? null : Number(parts[1]);
    let path = parts.slice(2).join('\t');
    let origPath;
    if (path === '') {
      origPath = tokens[i + 1] ?? '';
      path = tokens[i + 2] ?? '';
      i += 2;
    }
    if (path === '') continue;
    const stat = { additions: Number.isFinite(additions) ? additions : null, deletions: Number.isFinite(deletions) ? deletions : null, binary };
    if (origPath !== undefined && origPath !== '') stat.origPath = origPath;
    map.set(path, stat);
    if (origPath !== undefined && origPath !== '') map.set(origPath, stat);
  }
  return map;
}

/** 解析 `git diff-tree --name-status -z`。 */
export function parseNameStatusZ(text) {
  const tokens = String(text ?? '').split('\0');
  const files = [];
  for (let i = 0; i < tokens.length; ) {
    const status = tokens[i];
    i += 1;
    if (status === undefined || status === '') continue;
    const letter = status[0];
    if (letter === 'R' || letter === 'C') {
      const origPath = tokens[i] ?? '';
      const path = tokens[i + 1] ?? '';
      i += 2;
      if (path !== '') files.push({ path, origPath, status: letter === 'R' ? 'renamed' : 'copied' });
    } else {
      const path = tokens[i] ?? '';
      i += 1;
      if (path !== '') files.push({ path, status: nameStatusKind(letter) });
    }
  }
  return files;
}

function nameStatusKind(letter) {
  switch (letter) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'M':
      return 'modified';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'T':
      return 'typechange';
    case 'U':
      return 'conflicted';
    default:
      return 'modified';
  }
}

/**
 * 解析 `git log --format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%P%x1f%D%x1f%b%x1e`。
 * 正文放在最后一个字段，即使正文里出现分隔符也只是多切几段，不会被误解。
 */
export function parseLogRecords(text) {
  const records = String(text ?? '').split('\x1e');
  const commits = [];
  for (const raw of records) {
    const record = raw.replace(/^\r?\n/, '');
    if (record.trim() === '') continue;
    const fields = record.split('\x1f');
    if (fields.length < 7) continue;
    commits.push({
      hash: fields[0],
      shortHash: fields[1],
      subject: fields[2],
      author: fields[3],
      authoredAt: fields[4],
      parents: fields[5].split(' ').filter((parent) => parent !== ''),
      decorations: parseDecorations(fields[6]),
      body: fields.slice(7).join('\x1f').replace(/\r?\n$/, ''),
    });
  }
  return commits;
}

/** 解析 `git show --no-patch --format=<同样的字段>`（单条提交）。 */
export function parseCommitRecord(text) {
  const record = String(text ?? '').split('\x1e')[0].replace(/^\r?\n/, '');
  const fields = record.split('\x1f');
  if (fields.length < 7) return null;
  return {
    hash: fields[0],
    shortHash: fields[1],
    subject: fields[2],
    author: fields[3],
    authoredAt: fields[4],
    parents: fields[5].split(' ').filter((parent) => parent !== ''),
    decorations: parseDecorations(fields[6]),
    body: fields.slice(7).join('\x1f').replace(/\r?\n+$/, ''),
  };
}

/** `%D` 的形态：`HEAD -> main, origin/main, tag: v1.0`。 */
export function parseDecorations(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .map((item) => {
      if (item.startsWith('HEAD -> ')) return { name: item.slice('HEAD -> '.length), kind: 'head' };
      if (item === 'HEAD') return { name: 'HEAD', kind: 'head' };
      if (item.startsWith('tag: ')) return { name: item.slice(5), kind: 'tag' };
      if (item.includes('/')) return { name: item, kind: 'remote' };
      return { name: item, kind: 'local' };
    });
}

/**
 * 解析 `git worktree list --porcelain -z`（也接受非 `-z` 的换行形态）。
 * 记录之间以空行/空 token 分隔。
 */
export function parseWorktreePorcelain(text) {
  const source = String(text ?? '');
  const tokens = source.includes('\0') ? source.split('\0') : source.split(/\r?\n/);
  const worktrees = [];
  let current = null;
  const flush = () => {
    if (current !== null && current.path !== '') worktrees.push(current);
    current = null;
  };
  for (const token of tokens) {
    if (token === '') {
      flush();
      continue;
    }
    if (token.startsWith('worktree ')) {
      flush();
      current = { path: token.slice('worktree '.length), head: '', branch: '', detached: false, bare: false, locked: false, lockReason: '', prunable: false, pruneReason: '' };
    } else if (current === null) {
      continue;
    } else if (token.startsWith('HEAD ')) {
      current.head = token.slice('HEAD '.length);
    } else if (token.startsWith('branch ')) {
      current.branch = token.slice('branch '.length);
    } else if (token === 'detached') {
      current.detached = true;
    } else if (token === 'bare') {
      current.bare = true;
    } else if (token === 'locked' || token.startsWith('locked ')) {
      current.locked = true;
      current.lockReason = token.slice('locked'.length).trim();
    } else if (token === 'prunable' || token.startsWith('prunable ')) {
      current.prunable = true;
      current.pruneReason = token.slice('prunable'.length).trim();
    }
  }
  flush();
  return worktrees;
}

/**
 * 解析 `git for-each-ref --format=%(refname)%1f%(objectname:short)%1f%(contents:subject)%1f%(HEAD)%0a`
 * 输出。字段分隔符是 US（0x1f），记录分隔符是 LF。
 */
export function parseForEachRef(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const refs = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    const fields = line.split('\x1f');
    if (fields.length < 2) continue;
    const refname = fields[0];
    const kind = refname.startsWith('refs/heads/') ? 'local' : refname.startsWith('refs/remotes/') ? 'remote' : refname.startsWith('refs/tags/') ? 'tag' : 'other';
    if (kind === 'other') continue;
    if (kind === 'remote' && refname.endsWith('/HEAD')) continue;
    const prefix = kind === 'local' ? 'refs/heads/' : kind === 'remote' ? 'refs/remotes/' : 'refs/tags/';
    refs.push({
      name: refname.slice(prefix.length),
      fullName: refname,
      kind,
      commit: fields[1] ?? '',
      subject: fields[2] ?? '',
      head: (fields[3] ?? '') === '*',
    });
  }
  return refs;
}

/** 解析一份统一 diff（可含多个文件）。 */
export function parseUnifiedDiff(text) {
  const lines = String(text ?? '').split('\n');
  // 输出总以换行结尾：split 出来的最后一个空串不是上下文行，丢掉。
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const files = [];
  let file = null;
  let hunk = null;
  let oldNumber = 0;
  let newNumber = 0;

  const startFile = () => {
    file = {
      oldPath: '',
      newPath: '',
      path: '',
      touched: false,
      binary: false,
      binaryNote: '',
      renameFrom: '',
      renameTo: '',
      newFile: false,
      deletedFile: false,
      hunks: [],
      additions: 0,
      deletions: 0,
    };
    files.push(file);
    hunk = null;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      startFile();
      continue;
    }
    if (file === null) {
      // 有些命令（例如 --no-index 之外的路径）可能没有 diff 头，容忍。
      if (line.startsWith('--- ') || line.startsWith('@@')) startFile();
      else continue;
    }
    if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/.exec(line);
      if (match === null) continue;
      hunk = {
        header: line,
        oldStart: Number(match[1]),
        oldLines: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newLines: match[4] === undefined ? 1 : Number(match[4]),
        section: match[5] ?? '',
        lines: [],
      };
      oldNumber = hunk.oldStart;
      newNumber = hunk.newStart;
      file.hunks.push(hunk);
      file.touched = true;
      continue;
    }
    if (hunk !== null) {
      if (line.startsWith('+')) {
        hunk.lines.push({ type: 'add', text: line.slice(1), newNumber: newNumber });
        newNumber += 1;
        file.additions += 1;
        continue;
      }
      if (line.startsWith('-')) {
        hunk.lines.push({ type: 'del', text: line.slice(1), oldNumber: oldNumber });
        oldNumber += 1;
        file.deletions += 1;
        continue;
      }
      if (line.startsWith(' ')) {
        hunk.lines.push({ type: 'ctx', text: line.slice(1), oldNumber: oldNumber, newNumber: newNumber });
        oldNumber += 1;
        newNumber += 1;
        continue;
      }
      if (line.startsWith('\\')) {
        const previous = hunk.lines[hunk.lines.length - 1];
        if (previous !== undefined) previous.noNewline = true;
        hunk.lines.push({ type: 'note', text: line.slice(1).trim() });
        continue;
      }
      if (line === '') {
        // 有些生成器把空上下文行写成真正的空行。
        hunk.lines.push({ type: 'ctx', text: '', oldNumber: oldNumber, newNumber: newNumber });
        oldNumber += 1;
        newNumber += 1;
        continue;
      }
      // 其他行（例如 `\ No newline`）之后的元信息，结束当前 hunk。
      hunk = null;
      continue;
    }
    if (line.startsWith('--- ')) {
      file.touched = true;
      file.oldPath = stripDiffPrefix(line.slice(4).trim());
      if (file.oldPath === '') file.newFile = true;
      continue;
    }
    if (line.startsWith('+++ ')) {
      file.touched = true;
      file.newPath = stripDiffPrefix(line.slice(4).trim());
      if (file.newPath === '') file.deletedFile = true;
      const candidate = file.newPath !== '' ? file.newPath : file.oldPath;
      if (candidate !== '') file.path = candidate;
      continue;
    }
    if (line.startsWith('rename from ')) {
      file.touched = true;
      file.renameFrom = line.slice('rename from '.length).trim();
      continue;
    }
    if (line.startsWith('rename to ')) {
      file.touched = true;
      file.renameTo = line.slice('rename to '.length).trim();
      continue;
    }
    if (line.startsWith('copy from ')) {
      file.touched = true;
      file.renameFrom = line.slice('copy from '.length).trim();
      continue;
    }
    if (line.startsWith('copy to ')) {
      file.touched = true;
      file.renameTo = line.slice('copy to '.length).trim();
      continue;
    }
    if (line.startsWith('new file mode ')) {
      file.touched = true;
      file.newFile = true;
      continue;
    }
    if (line.startsWith('deleted file mode ')) {
      file.touched = true;
      file.deletedFile = true;
      continue;
    }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      file.touched = true;
      file.binary = true;
      file.binaryNote = line.replace(/^GIT binary patch$/, 'GIT binary patch');
      continue;
    }
  }

  for (const item of files) {
    if (item.path === '') item.path = item.renameTo !== '' ? item.renameTo : item.oldPath;
  }
  const kept = files.filter((item) => item.touched === true);
  return {
    files: kept,
    additions: kept.reduce((sum, item) => sum + item.additions, 0),
    deletions: kept.reduce((sum, item) => sum + item.deletions, 0),
  };
}

function stripDiffPrefix(value) {
  if (value === '/dev/null') return '';
  if (value.startsWith('a/') || value.startsWith('b/')) return value.slice(2);
  return value;
}
