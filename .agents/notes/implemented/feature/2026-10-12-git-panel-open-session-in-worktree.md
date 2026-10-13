# Agent Note: 工作树接上「一场会话」——注册工作区 + 打开/新建会话

Status: implemented

## Problem

面板能建 worktree，但建完就断了：`已创建工作树：<path>` 之后，那个目录既不是 DSH 工作区，
也没有任何「在这里开会话」的入口。用户要自己跑到左侧栏「添加工作区 → 浏览 → 选中
`.dsh-worktrees/...` → 再新建会话」，四步手工，用户原话是「这个操作很割裂」。

第二个要求同样重要：**入口必须常驻**。只在「刚建完」那一刻给一次按钮是不够的——会话会被删、
被归档、DSH 会重启、树可能被手工删掉再在同一路径重建；只要入口是一次性的，用户就会第二次卡在
同一个地方。

两个约束决定了方案的边界（都读过 DSH 实现核实）：

1. **会话的 cwd 在创建时固定 = 它所属工作区的路径**。DSH 没有 Claude Code 的 `EnterWorktree`
   那种「把已有会话的 cwd、写权限、项目配置一起搬过去」的能力。
2. **沙箱 `workspace-write` 的边界 = 会话 cwd**（`dsh-sandbox-policy`：
   `workspaceRoot = resolveWorkspaceRoot(session.header.cwd)`）。worktree 默认建在项目**旁边**，
   所以在项目会话里 `cd` 过去只能读不能写。

## Decision

面板把「在这个工作树里干活」实现成**把目录注册成工作区 + 保证它有一场可用会话**，
入口挂在「工作树」页上，全部在**浏览器半**完成。

- **注册**：`ctx.get('workspaces').create({ path })`。宿主先 `workspaceRegistry.resolveByPath(path)`，
  命中就返回既有工作区，所以按路径幂等；新登记时再 `workspaces.rename(id, '<仓库名> · <名字>')`，
  **已登记的不动用户自己的命名**。
- **打开/新建会话**：`ctx.get('uiWorkspace').startSession(id)`（内部建/复用该工作区的空白会话并切过去），
  降级链 `uiWorkspace.startSession` → `workspaces.startSession` → `sessions.create` + `openSession`。
- **为什么必须在客户端**：工作区注册表在宿主侧是 `ctx.workspaceRegistry`，插件没有面向它的公共写入口；
  公共入口是浏览器半的 `workspaces` / `uiWorkspace` 服务。`dsh-workspace-category-manager` 的
  「添加工作区 / 从 Git 导入」也是这个分工（宿主只 clone，注册与开会话由客户端发起）。
- **两个服务一律惰性 `ctx.get()`**：插件热重载会移除重加，模块启动顺序也没有保证。服务缺失时
  相关入口**不渲染**，而不是点了报错。

面板上的四个入口（缺服务时前三个不出现）：

| 入口 | 行为 |
|---|---|
| 创建表单「建完直接在新会话里打开」（默认勾选） | 一次点击得到「树 + 侧栏项目行 + 该目录的一场会话」 |
| 创建表单「复制被忽略的启动文件」（默认勾选） | 宿主把仓库根下白名单内、确实被 git 忽略的普通文件复制进新树 |
| 行上「回到该工作树的会话」 | 有未归档会话就回到最近一场；没有（被删/被归档/从未建）就新建一场 |
| 行上「新建一场会话」 | 显式 `sessions.create({ workspaceId })`，会话坏了或想并行开一场时用 |
| 删除确认「同时从工作区列表移除」（默认勾选） | `workspaces.delete(id)`；**只移除侧栏项目行，不动会话记录**（会话落到「未分类」） |

行上还显示绑定状态（未注册 / 无会话 / N 场会话），这是 Codex 的教训：它的 worktree 聊天
被抱怨「归组在源工作区下但没标出是 worktree」（[openai/codex#24386](https://github.com/openai/codex/issues/24386)）。

### 会话失效后怎么办

`enter()` 是「有可用会话就回到它，没有就新建」，所以入口是常驻的：

| 情形 | 点「回到该工作树的会话」会发生什么 |
|---|---|
| 会话被删除 | 它已不在 `workspace.sessionIds` 里 → 新建一场并切过去 |
| 会话被归档 | 归档 id 在 `archivedSessionIds` 里，复用逻辑显式跳过 → 新建一场（旧的那场仍在归档区） |
| DSH 重启 | 工作区登记是宿主持久化的，行上仍显示已注册，入口仍在 |
| 会话文件损坏/丢失 | 快照里没有它 → 等同「被删除」 |
| 树被手工删掉后同路径重建 | 工作区按路径仍匹配 → 直接给一场会话，cwd 就是那个路径 |
| 被另一个客户端占用 | `connectWorkspace` 内部对 `session/writer-held` 已有降级：另建一场 |

### 对标：三家怎么做（官方文档 / 仓库实测）

| | 入口 | 树放哪 | 会话与树的绑定 |
|---|---|---|---|
| Claude Code | `claude --worktree <name>`；桌面端新建会话时选 worktree | 仓库内 `.claude/worktrees/<name>`（建议加进 `.gitignore`） | **强绑定**：会话记住自己的树，`--resume` 回到它；`EnterWorktree`/`ExitWorktree`；并强制隔离（禁止改主检出、禁止 cwd 落在主检出、禁止 git 重定向） |
| Codex（桌面） | 新聊天时选 Local / Worktree / Cloud | 由 Codex 管 | 每个 worktree 聊天是一场聊天，侧栏归组在源工作区下 |
| zcode-executor（本机 ZCode，本身是 DSH 插件） | 任务派发，一次任务=一场会话 | 仓库外 `~/.zcode-executor/worktrees/<repo>`，当沙箱 | 一次任务=一棵树=一场会话；右侧栏实时显示每个会话的状态 |
| 本插件 | 工作树页的常驻入口 | 仓库旁边 `.dsh-worktrees/<repo>/<name>` | 树 ⇄ 工作区 ⇄ 会话，由面板维护 |

共同形态是：**「在哪跑」是新建会话时的一个选择，树是会话的属性**（DSH 里受限于「会话 cwd 固定」，
只能拆成「注册工作区 + 开会话」两步，但对用户是同一个动作）。另一条抄来的是 Claude Code 的
[`.worktreeinclude`](https://code.claude.com/docs/en/worktrees)：新树是干净检出，缺 `.env` 就跑不起来。

### 树放在哪（默认保持 A）

- **A（默认）**：`<项目父目录>/.dsh-worktrees/<项目名>/<名字>`。不在项目里 → 主仓库 `git status`
  永不被污染；代价是必须注册工作区才有会话说。
- **B（Claude Code 风格）**：项目内 + 写进 `.gitignore`。它在项目边界内，`workspace-write` 下主会话
  也能写（但 cwd 仍是项目根，仍要 `cd`）；代价是路径在仓库里，需要用户维护 ignore 规则。
- **C（zcode 风格）**：用户目录下当沙箱。与项目彻底分离，代价是路径远。

B/C 都能通过现有配置 `worktreeRoot` 达到，默认不改。

## Alternatives considered

- **不注册工作区，只在现有项目会话里 `git -C` / `cd` 操作**：今天就能做，但 cwd 仍是项目根，
  agent 的文件工具与 diff 都按项目算，`workspace-write` 下写 worktree 会被拒。
- **只在创建成功的提示里给按钮（不默认勾选）**：这是最初的提案（「建树只是先看看时不该往侧栏塞项目」）。
  用户明确选了默认勾选——他要的就是「建完直接开工」，手动加工作区正是他觉得割裂的地方；
  不想进会话的人取消勾选即可。提示里的按钮仍保留为每行的常驻入口。
- **自动注册但不开会话**：侧栏多一行而没有会话，用户还得再点一次，等于把割裂往后挪一格。
- **让 worktree 项目行成为源项目的子项**：DSH 侧栏层级是分类 → 项目 → 会话，没有子项目；
  只能靠命名与分类归属缓解。Codex 能做归组是因为它的侧栏模型不同。
- **改 DSH 核心支持「会话切换 cwd」**：等于同时实现 `EnterWorktree` 与它的隔离强制，
  远超插件边界，且牵动沙箱与文件工具策略。
- **复制整个项目（clone 一份）**：语义不同（独立对象库、要推拉同步），也不是 worktree 的隔离方式。
- **复制全部被忽略文件（对标 `.worktreeinclude` 的字面能力）**：会把 `node_modules`、构建产物、
  本地数据库一起搬过去，既慢又可能不一致。取保守白名单（`.env*`、`.npmrc`、`.nvmrc`、
  `.tool-versions`、`.python-version`，≤ 64 KiB，只看仓库根）。
- **用 `git check-ignore` 判断「是否被忽略」**：实现时踩到了——BASE_ARGS 里的
  `--literal-pathspecs` 会让它直接 fatal（`pathspec magic not supported by this command: 'literal'`），
  于是每次都判成「没被忽略」、一个文件都复制不了。改用 `git ls-files --others --ignored
  --exclude-standard -z -- <name>`（被忽略才打印路径），并加了一条 validate 断言禁止再退回 `check-ignore`。
- **复制未被忽略的启动文件**：会让新树直接变脏（`?? .env`），面板的「未提交」徽标与删除流程
  都会因此多出噪音。所以「被忽略」是硬条件，不满足就跳过并在 `copySkipped` 里说明原因。

## Consequences

- 用户视角：「新建工作树」一次点击 → 侧栏出现 `<仓库> · <名字>` 项目行 → 会话 cwd 就是那棵树；
  之后每次回来点一下行上的入口即可（会话没了的场景由 `enter()` 兜住）。
- 收益：沙箱边界、文件工具根、git 面板与会话 cwd 四件事对齐；新树能直接跑起来（`.env`/`.npmrc` 已带上）。
- 代价：**一棵树多一个侧栏项目行**。这是 DSH「会话 cwd 固定」模型的必然结果，命名前缀只能让它们
  认得出亲缘，不能真正嵌套。连多一行都不接受的话，只剩「不注册、手工 cd」这条路。
- 代价：复制只覆盖白名单小文件；`node_modules`、本地数据库等仍需用户在新树里初始化一次。
- 边界：在文件管理器里手工删树不会自动清理工作区登记（侧栏可手工删，行上会显示「目录已不存在」）
  ——只有走面板删除路径才有那个默认勾选的清理项。
- 边界：删工作区**不等于**删会话（DSH 的行为），所以那一步可逆；确认文案里已写明会话会落到「未分类」。
- 未做（第二步）：把「在哪跑」搬进新建会话的语境（类 Codex 的 Local/Worktree 选择器），
  那要动侧栏/添加工作区流程，可能是另一个插件。

## Testing

- `node ./tests/run.js`：9 个文件、441 条断言全绿。新增：
  - `tests/git.integration.test.js`（真实 git + 真实文件系统）：复制了 `.env`/`.npmrc` 且内容正确、
    已跟踪文件不靠复制、未忽略的普通文件不动、**不勾选时一个都不复制**；
  - `tests/render.test.js` + `tests/render/entry.tsx`：表单两个复选框默认勾选、创建时把
    `copyIgnored` 交给宿主、创建成功后按宿主返回的 `created.path` 开会话、创建提示里带被复制的文件、
    已注册行显示会话数、未注册行显示「未注册」、两个常驻入口、**进入用的是该行路径**（会话失效后
    走同一条路重建）、删除时按勾选 `forget`、没有 opener 时入口与徽标都不渲染；
  - `tests/client.bundle.test.js`：产物里注入了 `worktreeSessions`，且服务缺失时 `available()` 为 false、
    `enter()` 抛出可读错误而不是 TypeError。
- `node ./scripts/validate.mjs`：新增 17 条契约断言（惰性取服务、按路径幂等、三级回退、跳过归档会话、
  显式 `newSession`、`<仓库> · <名字>` 命名、`forget`、视图不直接碰 `ctx`、宿主侧白名单与
  `--ignored`、禁止 `check-ignore`、复制必须 opt-in）。
- `npx tsc --noEmit -p tsconfig.json` 与 `node ./scripts/build-client.mjs` 均通过。
- **未验证**：真机点「在新会话里打开」时侧栏项目行的实际观感与 `startSession` 在本机桌面端的
  时序（没有可截图的视图），以及「用户自己的仓库里 `.env` 是否真在 ignore 规则内」——
  后者由 `copySkipped` 的文案暴露，面板会提示跳过了什么。
