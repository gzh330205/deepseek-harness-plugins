# Agent Note: Git 面板的分支切换——脏工作区交给 git 判据，远程分支必须落成本地分支

Status: implemented

## Problem

「这个插件好像无法切换分支。」拆开是四个互不相干的缺陷，任一个都足以让切换这件事不成
（第 0 条是主因，单独记在
[分支选择器永远是空的](2026-10-12-git-panel-branches-wire-shape.md)）：

0. **选择器里一个分支都没有。** `GET /dsh-git/branches` 回的是 `{ ok, root, branches: … }`，
   客户端按扁平读 `response.local`，拿到 `undefined`，被 `?? []` 吃成空列表——数据一直在
   宿主侧，只是被读丢了。工作树页的基线选择器同一个毛病。
1. **宿主一刀切拒绝。** `POST /dsh-git/checkout` 先跑 `git status --porcelain --untracked-files=no`，
   只要有条目就 400。而 agent 正在跑的工作区几乎总是有未提交改动——实测当前仓库 21 处改动，
   于是连「切回 main」都做不到。讽刺的是 git 自己的判据精确得多：不冲突的改动会跟着切过去，
   只会在「会被覆盖」时拒绝。
2. **客户端没有入口。** 分支选择器只在历史页；历史页那个按钮的字面是 `HEAD`（本意是「日志范围」），
   只有 tooltip 写「切换分支」；而面板顶部那行分支名（默认的变更页上唯一的分支位置）是不可点的 `<span>`。
   习惯点分支名的人点了没反应，就会得到「无法切换」的结论。
3. **远程分支切成了 detached HEAD。** 客户端对远程 ref 发的是 `refs/remotes/origin/x`；
   `git checkout <全名>` 只是把 HEAD 指到那个提交，`git branch --show-current` 为空（实测）。
   用户以为切到了分支，实际上失去了分支（再提交就是游离提交）。

## Decision

**脏不脏由 git 判据。** 宿主 `checkout()`（`src/host/actions.js`）不再预检工作区，
只保留「进行中的 merge/rebase 等操作先拦住」（这时 git 原文很难懂）；
`git checkout` 失败且 stderr 命中 `would be overwritten by checkout` 时，
解析出文件清单，回一句可直接照做的中文（`...会覆盖这些文件的未提交改动：a.txt、b.txt。请先提交、暂存或放弃改动，再切换。`），
其余失败仍走 `GitError`（git 原文摘要）。
清单按「git 缩进一级列出的那些行」取——已跟踪文件与未跟踪文件两种原文都是这个形态，
收尾的 `Please …` / `Aborting` 不缩进，因此不会被误当成文件名。

**远程跟踪分支落成本地分支。** 切换目标先 `rev-parse --verify --quiet --symbolic-full-name <target>`：
只有解析结果是 `refs/remotes/...` 才特殊处理；本地名由 `for-each-ref --format=%(refname:lstrip=3) <refname>` 给出
（`refs/remotes/origin/feature/nested` → `feature/nested`）。`refs/heads/<本地名>` 已存在就切它，
否则 `git checkout -b <本地名> <refname>`——有远端配置时 `autoSetupMerge` 会顺手设好 upstream。
非远程目标（本地分支、tag、`HEAD`、`HEAD~1`）原样交给 `git checkout`。

**unborn 仓库建第一条分支不带起点。** `git checkout -b x HEAD` 在没有提交时是
`fatal: 'HEAD' is not a commit`；`repo.unborn === true` 时用 `git checkout -b x`。

**头部那行分支名就是切换入口。** `GitPanel` 把它从 `<span>` 换成 `<button>`，
点击 = 切到历史页 + 递增 `pickerRequest`；`HistoryView` 用这个 token 打开选择器
（首次挂载时 token>0 也要生效，因为它可能就是被这次点击挂载出来的）。
按钮带 0.5px 边框与尾部 caret，**常显**而不是 hover 才亮——第一版做成「纯文字 + hover
下划线 + tooltip」，用户回来说仍然找不到切换分支的地方；文字起点靠「边框 + 内边距
（0.5 + 4px）用等量负外边距抵消」保持 16px，README 记的「仓库名 / 分支名同列」不破。
历史页那个按钮的文案同时从 `HEAD` 改成当前分支名：它本来就是选择器开关，写 `HEAD` 只是误导。

## 契约：POST /dsh-git/checkout

| 入参 | 行为 |
|---|---|
| `ref` = 本地分支 / tag / `HEAD~n` | `git checkout <ref>`（原文行为） |
| `ref` = `refs/remotes/<remote>/<b>`（或 `origin/<b>`） | 有 `refs/heads/<b>` → `git checkout <b>`；否则 `git checkout -b <b> <ref>` |
| `ref` + `newBranch` | `git checkout -b <newBranch> <ref>`；`repo.unborn` 时**不带** `<ref>` |
| 进行中的 merge/rebase/cherry-pick/revert/bisect | 400（原文案，不变） |
| git 报「会被覆盖」 | 400 + 中文文件清单 |
| 工作区有未提交改动但与目标不冲突 | **200**，改动留在工作区并跟到新分支 |

`checkedOut` 从此返回**切换完成后 HEAD 上的分支名**（远程分支场合是本地名），不再是入参原文。

## Alternatives considered

- **保留「切换分支要求工作区干净」**（改前状态）：这是原作者写进 README 的显式原则。但它把
  「git 可能会把改动带过去或停在冲突里」这种**可能性**，执行成了「一律不许切」，
  在 agent 工作流里退化为功能不可用。git 自己已经有判据，既不会静默丢改动，也不会把用户卡死。
- **客户端改发 `origin/x`，靠 git 的 DWIM 自动建本地分支**：实测 `git checkout origin/x` 同样 detached——
  DWIM 只在 `git checkout x`（且恰好一个远程有同名分支）时生效，依赖它等于把正确性押在隐式规则上。
- **`git checkout --track <refs/remotes/...>`**：真仓库里能自动命名并设 upstream，看着最省事；
  但远端配置缺失（`git remote remove` 之后残留的远程引用）会直接
  `fatal: cannot set up tracking information`。`-b <本地名> <refname>` 两种情形都成立。
- **前端判断远程分支形态**：客户端手里只有 `kind/name/fullName`，判断与建分支的规则属于仓库事实；
  放宿主才能用 git 自己回答，也顺手覆盖了 `origin/feature/nested` 这类带斜杠的分支名。
- **头部复制一份 picker，或做一个独立下拉**：选择器还要懒加载分支列表、还要「新建分支并切换」表单，
  两份实现必然漂移。「切到历史页 + 请求打开」只递增一个 token，状态仍只有一份。
- **把「工作区脏」降级成警告、再弹一次确认**：确认框本来就有（文案已改成说明改动会留在工作区），
  再加一层只是把同一句话讲两遍。

## Consequences

- 收益：切换分支在脏工作区上恢复可用（不冲突的改动跟着过去，这是 git 的标准语义）；
  远程分支不再把人丢进 detached HEAD；默认停在变更页也能一眼看到并点到切换入口。
- 代价：切分支不再保证工作区「切换前后一模一样」——带过去的改动会出现在新分支的变更页里。
  这是原来 README 承诺的反面，README 与 `checkoutConfirm` 文案已同步。
- 代价：每次切换多 1~3 次只读探测（`rev-parse` / `for-each-ref`），毫秒级。
- 代价：远程分支现在会在本地建分支（以前只 detached、不留分支）。用户若本来就想「只看一眼那个提交」，
  应该用历史页看提交详情，而不是点分支项。
- 同一次改动里还修了一处样式契约：变更列表的**分组正文缩进一级（12px）**。此前组标题与它
  下面的行看起来同级（目录行的折叠三角甚至更靠左），用户直接报「未跟踪 / 未暂存下面的
  文件没有缩进」。代价是文件名列从宿主「文件」页的 552 挪到 564——层级让位给像素对齐，
  README 的像素表与 `validate.mjs` 已同步（缩进只作用于 `.dgp-group > .dgp-rows`，
  历史页提交详情同样用 `.dgp-rows`，那里没有分组、不跟着缩进）。
- 验证：`tests/routes.test.js` 新增「脏工作区带过去 → 200」「会被覆盖 → 400 且带文件清单」
  「远程分支 → 同名本地分支且 `detached === false`」「unborn 仓库建第一条分支 → 200」；
  `tests/render.test.js` + `tests/render/entry.tsx` 新增 jsdom 交互：头部分支按钮 →
  历史页 + 选择器打开，以及**非仓库形态**（`repo === null`）真挂载不崩——后者是这次改动自己引入过的坑
  （头部文案会在 `repo` 为 null 时取值），此前没有任何测试挂载过这条路径。
