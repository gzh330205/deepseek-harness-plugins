# 让「今天运行过的会话」一眼可见 —— 设计与落地方案

对象：`dsh-workspace-category-manager`（本仓库，v0.2.0）。
运行环境：DSH Desktop 自带内核 `0.2.0-rc.2`（`app.asar → dsh/desktop-runtime.json` 的 `dsh` 字段）；
下文用 `A` 代表 `app.asar → dsh/node_modules/@deepseek-ai/`，用 `R` 代表 npm 全局 `G:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`（0.1.7-rc.2，插件声明的兼容起点）。
行号均指该文件内实际行号。

## 0. 结论

**在现有分类树顶部加一个固定分组「今天」，里面平铺今天动过的会话（跨项目、按时间倒序、带项目名与时刻、状态点照旧），点击一步切换。**

- 基础形态（P0）零 Host 改动、零数据迁移、零 Config 新字段：`updatedAt` 已经在会话列表快照里下发，折叠状态复用现成的 `collapsedCategories`（合成 id `__today__`）；后续的「临时移除」（§4.6）才需要 Host 侧多一个 `hiddenToday` 字段。
- 改动集中在 `src/client/`：新增一个纯选择器 + 侧栏顶部一段渲染分支，约 150 行；`index.js`、`cordis.patch.yml`、持久化 schema 全不动。
- 关键约束只有一个：`updatedAt = max(createdAt, lastPromptAt)`，即**「我发过话」而不是「有人在跑」**。因此纳入规则是「今天发过话/今天新建」∪「当前运行中」（兜底跨天仍在跑的长任务）。

**变更记录（2026-10-12 之二）：窗口模型整体废弃，改为「显式注册表」**（Config `currentSessions`）。
本栏目最终确认的语义是：只显示**正在运行 / 刚跑完还没看 / 刚看过且没隐藏**的会话；这份「要显示的会话」由一份注册表持有，
**隐藏就是把这一条从注册表里删掉**。于是历史会话不会自己冒出来（从没登记过），删掉的也不会自己回来（除非再次运行）。
关键实现点：

- 登记是**观测型**的，而且**只看运行**：客户端把上一次看到的会话状态放在 ref 里，只在观察到跃迁时登记 —— ①`running` 由假变真、②活动戳前进（新提示词）。**打开不登记**（翻看一下不该多出条目），打开只给已登记条目刷新 `viewedAt`（清掉「还没看」的加粗）；
- 重启后 ref 为空，**首次观测什么都不登记**（没有可比较的跃迁），所以「隐藏过的会话还在跑」不会让它自己回来，历史也不会被导进来；
- 行上「跑完了还没看过」用标题加粗表示（`unseen` = 活动戳晚于 `viewedAt`），`viewedAt` 在它成为当前会话时刷新；
- 「隐藏」按钮的写盘沿用同一套乐观值 + 剪枝（写入时丢掉快照里已不存在的 id）；
- 归档仍然只在右键菜单（行内不放假入口），归档过的会话即使登记过也不显示；分类树完全不受影响。

顺带删掉的：时间窗口常量、跨零点定时器、「临时移除」记录（`hiddenToday`）与它的回显判定 —— 注册表本身就是「要显示什么」的唯一真相。
**变更记录（2026-10-12）：窗口从「本地今日 00:00 起」改为「最近 7 天内有活动」**（`CURRENT_WINDOW_DAYS = 7`，一处常量）。
原因：项目目录下会话多，这一栏要的是「最近在用的那几条」，不是「今天」；跨天还在跑的会话本来就有独立的 `running` 通道，
所以窗口放宽不会漏掉正在跑的。副作用与取舍：

- 「跨零点重算」的定时器被删掉了 —— 滚动窗口没有过零点这件事，只在回到前台时重算一次时间戳格式即可；
- 时间戳显示仍按「本地今日」决定 `HH:mm` 还是 `M/D`，与筛选窗口解耦；
- 运行中但活动戳落在窗口外的会话，行提示语从「运行中（今天没有新消息）」改成「运行中（较早已有活动）」；
- 「可配置窗口」（今天 / 近 3 天 / 近 7 天 / 全部）仍是 P1，本次只是把默认值从 1 天放宽到 7 天。

**状态：P0、「今天」按项目分组（§4.2）与「临时移除」（§4.6）已落地**（`src/client/` 客户端改动 + 测试 + `validate` 回归门），`pnpm build && pnpm test && node scripts/validate.mjs` 全绿。`cordis.patch.yml` 与持久化 schema 未改动（`hiddenToday` 走 schema 默认值，无需改任何 profile 配置）；`index.js` 只为临时移除新增了这一个 Config 字段。三个实现期发现的细节已并入下文：会话列表 `phase: 'pending'` 时不能把「还没拉到」当成「今天没有」（§4.5）、跨天运行中的行用日期而不是时刻（§4.2）、以及临时移除记录必须容错（§4.6）。

## 1. 问题与根因

现状（`src/client/index.ts:26`）：本插件以 `priority: -1` 遮蔽原版 Workspace Browser，把 `sidebar.workspaces` 这个 single slot 整体换成 **分类 → 项目 → 会话** 三级树（`src/client/components/CategorySidebar.tsx:129-131`）。

于是「找到某个会话」的成本是：先在脑子里定位它在哪个项目里 → 找到那个分类文件夹 → 展开文件夹 → 展开项目 → 点会话。项目一多，这就是用户说的「切来切去」。

被遮蔽的原版浏览器本来有三件能缓解这件事的能力，插件接管后都消失了（README 自己记了前两件）：

| 原版能力 | 现状 | 与本需求的关系 |
|---|---|---|
| 会话内容/标题搜索 | 插件未提供 | 需要先知道标题才搜得到 |
| 会话手动拖拽排序 | 插件未提供 | 与「今天」无关 |
| **跨工作区平铺列表**（`groupBy: 'flat'`） | 插件未提供 | **这是现有唯一「一处看全部会话」的入口** |

证据：原版有 `SessionGroupBy = 'workspace' | 'workspace-tree' | 'flat'`（`R/dsh-client-ui-workspace/lib/types/client/stores.d.ts`），平铺视图由 `deriveFlat` 派生（`A/dsh-client-ui-workspace/lib/client.js:539`），按 `updatedAt` 排序（Host 列表本身即 `items.sort((left, right) => right.updatedAt - left.updatedAt)`，`A/dsh-api-session-controller/lib/index.js:1904`）。

**本机真实负载（今天 = 2026-10-12）**：从 325 条会话投影记录（`~/.dsh/storages/session_projcache/sessions/*.json`）按 `max(createdAt, lastPromptAt)` 统计，今天有 **9 条**记录、分布在 **5 个项目**；其中 4 条是 `delegationDepth: 1` 的子代理会话（同一分钟出现，标题为 system-reminder），真实根会话是 **5 条 / 5 个项目**：

```text
10:52  deepseek-harness-plugins  优化插件今日运行会话视图
10:48  rea                        研究 rea 项目的功能用途      ← 另 4 条 depth=1 子会话
10:38  deepseek-harness-desktop   Electron集成侧边栏浏览器功能
10:36  one-lab                    生成项目运行配置
09:59  one-bot                    修复RPA网关消息乱序问题
```

5 个项目、5 次展开、5 次点击——正好是这套方案要压成「一眼 + 一次点击」的量级。

## 2. 数据从哪来（已在运行版本逐条核对）

| 需要的事实 | 来源 | 证据 |
|---|---|---|
| 全部会话（跨项目） | `sessions.list` 快照 `SessionListState`：`ids` / `byId` | `A/dsh-api-session-controller/lib/client.js:2947` 一带的 `projectList` |
| 行字段 | `id` `title?` `displayTitle` `cwd?` `origin?` `parentId?` `running` `blank` `updatedAt` `retainedBy` | `R/dsh-api-session-controller/lib/types/client/sessions/service.d.ts`（`SessionSummary`） |
| **今天动过** | `updatedAt = max(header.createdAt, sessionListMetadata.lastPromptAt)` | Host：`A/dsh-api-session-controller/lib/index.js:2040`；Client：`.../lib/client.js:2947` |
| `lastPromptAt` 何时推进 | 仅 `event.type === 'user/message'` 且 `data.source.kind === 'user'` | `A/dsh-api-session-controller/lib/index.js:1807-1809`（`applySessionListMetadata`），schema 见同文件 `:1791` |
| 实时性 | 用户消息落盘时 Host 推 `api-session/activity(sessionId, updatedAt)`，Client `handleSessionActivity` 直接推进该行 | `A/dsh-api-session-controller/lib/client.js:3624`、同文件 `handleSessionActivity` |
| 子代理识别 | 线协议带 `origin: 'subagent'` | Host `A/.../index.js:2046`（`listFields`），Client 判据 `A/.../client.js:2861` |
| 归档集合 | `workspaces.list` 快照的 `archivedSessionIds`（同快照还有 `pinnedSessionIds`） | `R/dsh-api-workspace-controller/lib/types/client/model.d.ts`（`WorkspaceSnapshot`） |
| 运行/待处理/未读 | `uiSession.sessionStatus`（`Map<id,{running,pendingInteraction,completionUnread}>`） | `A/dsh-client-ui-session/lib/client.js:148`；插件已有适配与降级：`src/client/components/CategorySidebar.tsx:9-19` |

三条重要推论：

1. **语义刚好对**：`updatedAt` 推进的时机就是「我今天在这个会话里发过话」；`createdAt` 兜底覆盖「今天新建但还没发话」。
2. **只看不发的不算**：纯阅读会话、只让 agent 自己跑而不插话的会话不会出现在「今天」里 —— 但**跨天仍在跑**的会话会被漏掉，所以纳入规则必须并上 `running === true`。
3. **不需要新 Host 接口**：`index.js` 一行不改。P0 完全不碰 Host。

## 3. 方案对比

| 方案 | 形态 | 成本 | 优点 | 代价/风险 |
|---|---|---|---|---|
| **A. 顶部固定分组「今天」（推荐）** | 分类树第一行的可折叠分组，展开为跨项目会话平铺列表 | 小（≈150 行，纯客户端） | 零点击可见、不改变现有视图语义、复用折叠动画与 Config | 侧栏顶部多占一行；与项目下的同一会话重复出现（是「视图」不是「移动」，符合预期） |
| B. 「分类 / 今天」视图模式切换 | 头部 chip 切换整个侧栏内容 | 中 | 今天视图独占整屏、无分类干扰 | 需要一次点击；切走后看不到分类；用户要的是「一眼」，默认视图还得是它 |
| C. 独立「今日」面板 | `sidebar.panellist` + 主面板（或右侧 `sidebar.right.pane.tab`） | 大 | 空间大：可搜索、按项目分组、显示耗时/token | 要离开侧栏；要注册 main panel 与图标，升级面变大 |
| D. 只给会话行加相对时间 + 全局按时间排序 | 现有树不动 | 很小 | 无结构变化 | 不解决「跨项目一眼看全」，仍要逐项目展开 |
| E. 快捷键/命令唤起「今日」切换器 | `dsh-client-shortcuts` + 弹层 | 中 | 键盘流很爽 | 藏起来了，不符合「一眼看到」；与 A 可叠加 |

**推荐 A**，并把 B/C/D/E 作为后续增量（见 §7）。

## 4. 推荐方案 A 的交互设计

### 4.1 位置与形态

```text
侧栏
├─ [视图选项] [加分类] [加工作区]        ← 头部不动
├─ 🕘 今天                        5      ← 新：可折叠分组，默认展开
│   ├─ ● 10:52  优化插件今日运行会话视图        deepseek-harness-plugins
│   ├─ ● 10:48  研究 rea 项目的功能用途         rea
│   ├─ ● 10:38  Electron集成侧边栏浏览器功能     deepseek-harness-desktop
│   ├─ ● 10:36  生成项目运行配置                one-lab
│   └─ ○ 09:59  修复RPA网关消息乱序问题         one-bot
├─ 🏷 客户项目 (3)
│   └─ …
└─ 🏷 未分类 (2)
```

- 行结构复用现有 `.wcm-folderRow`（图标 + 标题 + 右侧数量）与 `.wcm-sessions` / `.wcm-sessionsInner` / `.wcm-closed` 展开动画（`src/client/styles.css:21-24`），不新增动画机制。
- 图标换一个时钟/太阳（`icons.tsx` 新增 `IconClock16`），与分类的「标签」图标区分；不使用分类色。
- rail（窄轨）模式下沿用现成规则：分组行显示图标+数量，会话列表随 `.wcm-sidebarRail .wcm-sessions{display:none}` 隐藏，点击展开侧栏（与分类一致）。

**一键「全部收起 / 全部展开」**：页头一个按钮把**分类与项目自身**一次性收拢或摊开。细节：

- 复用 `collapsedCategories` / `expandedWorkspaces` 两个既有列表，不新增只为它服务的字段；点击当下给每个 id 立乐观值（立刻重绘），两个字段各写一次；
- 「当前」分组不是分类、也不在 `folders` 里，折叠位会被原样带过去（测试锁住：全部收起后「当前」的折叠位不变）；
- 方向由真实展开状态推导（有任何一个分类或项目是开的 → 本次为「全部收起」，否则为「全部展开」），按钮给出对应 title；图标是**一对**而不是一个旋转：收拢态双箭头朝上、展开态双箭头朝下——16px 下「方向」是最容易分辨的差别（早先试过「横线 + 汇聚/散开」，两个状态几乎一样，已废弃）；
- 曾经误做成「把整棵分类目录藏起来」，那是错的需求：目录容器整体隐藏既不能单独摊开某个项目，也把「当前」之外的上下文一次抹掉了。`validate.mjs` 守住它不许回来。

### 4.2 会话行内容

> 分组显示名已定为**「当前」**。窗口后来也改过（见 §0 的变更记录）：**不再是「本地今日 00:00 起」，而是最近 `CURRENT_WINDOW_DAYS`（默认 7）天内有活动**，跨天仍在跑的会话照旧不受窗口限制。代码名/字段名里的 `today` 是历史命名。下文为叙述连贯沿用「今天」指这个分组。

```text
▾ 今天                        5
   ▾ deepseek-harness-plugins  1        ← 项目分组标题（可折叠，项目名只出现一次）
      ● 10:52  优化插件今日运行会话视图     ← [状态点] [HH:mm] [标题] [悬停出现：隐藏]
   ▾ rea                        1
      ● 10:48  研究 rea 项目的功能用途
```

**项目名单独成组、可折叠**（原先是逐行跟在标题右侧）：

- 同一项目的会话收在一个分组标题下，**行内不再重复项目名**（这是分组的主要收益：行里只剩 状态点 + 时刻 + 标题）；
- 组内按 `updatedAt` 倒序；分组之间按「组里最新那条」排序——最近动过的项目排最上面；
- **分组键是身份不是显示名**：有归属工作区时用 `w:<workspaceId>`，工作区已删除时回退 `p:<cwd>`。所以重命名项目/文件夹不会丢折叠状态，同名的两个目录也不会被并成一组；
- 折叠状态复用**同一套抑制列表 + 乐观覆盖**机制（新增 `collapsedTodayGroups` 字段，只存收起的那一侧 → 默认全部展开，不会藏住任何会话）；分组 id 全集取自「今天实际出现过的分组」，`retainIds` 会在下次写入时清掉不再出现的键；
- 没有归属项目的会话（例如工作区已删除且 `cwd` 也拿不到）落进一个无标签分组，渲染成「未分类」；
- **分组标题不放任何项目操作按钮**（重命名 / 删除工作区只在分类树里右键项目行）：分组标题只负责折叠与显示条数，行内也只保留会话自己的「隐藏」按钮。

行的其余细节：

- **HH:mm**：24 小时制，本地时区；不写「3 小时前」——在今天这个窗口里「几点」比「多久前」更利于对照记忆。跨天运行中的会话显示日期（`M/D`）而不是时刻。
- 状态点沿用现有统一状态语言（`sessionStatusOf`，`CategorySidebar.tsx:19`）：待处理=琥珀、运行中=追逐动画（`StateDot state="ongoing"`）、完成未读=绿。
- hover 的 `title` 给「项目 · 完整路径」；右键复用现有会话菜单（重命名 / 分叉 / 归档）。
- 点击整行 = `api.openSession(id)`（走 `uiWorkspace.openSession`，`src/client/api.ts:43-48`），一步切换。
- **行内两个动作**（都是悬停/聚焦时露出、占位固定所以互不挤压）：**定位到会话** = 把该会话在左侧分类树里露出来（展开所属分类与项目 → 滚动到那一行 → 闪一下高亮；展开复用同一套乐观 + 落盘写盘，所以点击当下就重绘；只对被工作区记账的会话出现，树里没有行的会话不给一个点了没反应的按钮）；**隐藏** = 从「当前」临时移除（§4.6）。

### 4.3 纳入 / 排除 / 排序

```text
纳入：max(createdAt, updatedAt) >= now - CURRENT_WINDOW_DAYS * 86400000（滚动窗口，默认 7 天；与「本地零点」无关）
   ∪  running === true（跨天仍在跑的会话，行上带「运行中」标记）
排除：origin === 'subagent'            （本机今天 9 条里有 4 条是子代理）
      归档集合 archivedSessionIds 内的
      blank === true（当前正在用的那个新会话除外，与现有 sessionsOf 一致）
      重复 id
排序：updatedAt 倒序；同刻按 displayTitle
```

「运行中是否置顶」默认**否**：纯时间倒序最可预期，状态点已经承担「哪个在跑/哪个等你」的表达。若你更想要「待处理/运行中置顶」，这是一个两行的开关（见 §7 P2）。

### 4.4 跨零点与休眠

- 每次渲染用 `Date.now()` 现算「今日 0 点」（本地日期构造，**不要**用 `ts % 86400000`，否则遇到时区/夏令时会错）。
- 组件内挂一个对齐到下一个本地 0 点的 `setTimeout`，触发时 `setTick(t => t + 1)` 并重排下一个；再监听 `visibilitychange`，休眠/后台节流后回到前台立刻重算。
- 不用 `setInterval(1000)`：既费电又会让「跨零点」这件事看起来像抖动。

### 4.5 空态与规模

- 今天没有任何会话：分组行显示 `今天 0`，展开后一行灰字「今天还没有运行过会话」。始终显示分组，保证功能可发现（也避免「今天有没有东西」变成猜谜）。**例外**：会话列表快照 `phase: 'pending'`（首次拉取还没落地）时只显示 `今天 0`、不显示这句空态——按契约那表示「还没到」，不表示「今天没有」（`undefined` 视为旧版快照，直接放行）。
- 规模：本机 `sessions.list` 约 300+ 行。单遍过滤 + `useMemo`（依赖 `sessionState`、`dayStart`）即可，纳秒级；不做分页。

### 4.6 临时移除（「从「当前」隐藏」）

行悬停时右侧出现「从「当前」隐藏」（它左边是「定位到会话」）。**归档不做行内按钮**：会话右键菜单本来就支持 rename / fork / archive，行内只留「定位」和「临时隐藏」两个动作，避免把破坏性更强的归档放到一次误点的距离内。语义是**临时移除**，不是排除名单：记录里存下移除那一刻的活动戳（`at` 是这次点击的墙钟时间，`updatedAt` 是当时的会话活动），**只有你重新跟这个会话对话**（`updatedAt` 前进）才会让它失效、行自己回来——不需要定时器，也不需要额外扫描。

| 触发 | 结果 |
|---|---|
| 你重新跟这个会话对话（新提示词，`updatedAt` 前进） | 立刻回到「今天」顶部 |
| 它自己跑起来 / 后台任务或计划重开（没有新提示词） | **保持隐藏**——「重新对话」是唯一的回显信号 |
| 移除时它就在跑、之后一直在跑 | 保持隐藏，直到你下一次对它说话 |
| 移除后一直没有活动 | 保持隐藏（只影响「今天」，项目下依旧能看到它） |
| 今天的会话被全部隐藏 | 分组显示 `今天 0` 且不显示空态提示（不谎称「今天没有会话」） |

配套细节：

- 落盘在 Host Config 的 `hiddenToday`（id → 记录），刷新与重启之后仍然隐藏；记录字段给默认值而不是 `required`，手改过 patch 的残缺记录不会让整份配置校验失败。
- **只在写入时剪枝**：会话已消失、或记录已经不再隐藏任何东西的条目会被丢掉，字段不会随使用增长（与展开状态同一套做法）。
- 点击立刻重绘：乐观值先行（id → 记录 = 隐藏），Host 回写确认后退休，所以回写没落地也不会「点了没反应」。
- **刻意不做恢复按钮**（产品决定，`validate.mjs` 把这条也守住了）：回显只有「重新对话」一条路，误点之后在那个会话里说一句话就回来了，比再加一个一次清空所有隐藏项的按钮更可预期。代价是隐藏项没有逐条撤销。
- 作用域仅限「今天」：项目下的会话列表、分类/项目的状态聚合、状态点都不受影响。

## 5. 实现清单（文件级）

| 文件 | 改动 | 要点 |
|---|---|---|
| `src/client/utils.ts` | 新增纯函数：`startOfLocalDay(now)`、`todaySessions(state, opts)`、`formatClock(ts, dayStart)`、`projectLabelOf(cwd, workspaces)` | 全部可注入 `now`，便于单测不受跨零点影响 |
| `src/client/constants.ts` | `TODAY_FOLDER_ID = '__today__'` | 与 `COLLAPSED_CATEGORIES_FIELD` 并列 |
| `src/client/components/CategorySidebar.tsx` | ① 从 `project()` 里抽出 `sessionRow(summary, opts)` 复用；② 新增 `todayGroup()` 渲染分支；③ 渲染在 `folders.map(folder)` **之前**；④ `idsOfCategories()` 加 `__today__`；⑤ 跨零点 effect | 见下方三个坑 |
| `src/client/components/icons.tsx` | `IconClock16` | 与分类标签图标区分 |
| `src/client/index.ts` | 词条：`today` / `todayEmpty` / `todayRunning` | 中英双语（`NS` 字典） |
| `src/client/styles.css` | `.wcm-todayTime` `.wcm-todayProject` `.wcm-todayEmpty` | 复用 `.wcm-sessions` 缩进与动画，不新造容器 |
| `tests/api.test.js` | 新增断言组 | 桩数据要补 `updatedAt`（现在 `servicesFor` 的行没有这个字段） |
| `scripts/validate.mjs` | 回归门：`__today__` 必须出现在 `idsOfCategories()` 里 | 防止后续重构把它删掉 |
| `README.md` | 新增一节说明 | 与「数据形式」一节一致地解释为什么不需要新 Config 字段 |
| `index.js` | 只新增 `hiddenToday`（§4.6）与 `collapsedTodayGroups`（§4.2）两个字段 | 记录字段给默认值而不是 `required`，手改过的残缺记录不会让整份配置校验失败 |
| `cordis.patch.yml` | **不动** | 新字段有 schema 默认值，profile 配置无需改 |

### 三个实现坑（必须避开）

1. **`idsOfCategories()` 不加 `__today__`，点了没反应。** 现有 override 清理逻辑（`CategorySidebar.tsx:49-62`）会把「不存在的 id」的乐观值立刻回收，于是点击折叠 → 状态瞬间弹回。同时 `retainIds(next, existingIds())`（`utils.ts:31`）会把 `__today__` 当死 id 从持久化列表里删掉。
2. **不要把「今天」塞进 `folders` 数组。** 那个数组的每个元素都带 `projects` 并参与分类排序/拖拽/解散（`CategorySidebar.tsx:102`、`commitFolderDrop`、`confirmDissolve`）。单独渲染一个节点，分类逻辑零改动，回归面最小。
3. **子代理会混进来。** 今天 9 条里 4 条是 `origin === 'subagent'`，不过滤的话列表会瞬间被「<system-reminder> You are teammate…」刷屏——这是本机数据实测出来的，不是假想。

## 6. 测试与验收

**自动化**（`pnpm build && pnpm test && pnpm validate`）：

- 纯选择器：注入固定 `now`，覆盖「今天发过话」「今天新建」「昨天建的但今天发话」「跨天运行中」「昨天且不在跑」「subagent」「归档」「blank（当前除外）」8 种输入 → 期望集合与排序。
- 渲染：今天分组存在且计数正确；点击行触发 `uiWorkspace.openSession`；折叠写 `collapsedCategories` 且**保留 `__today__`**（回归门）。
- 跨零点：把 `dayStart` 前移 24h 再渲染，列表随窗口收缩（同一进程内可测）。
- 首次拉取尚未落地（`phase: 'pending'`）时，`今天 0` 不显示空态提示。
- `validate.mjs`：`__today__` 在 `idsOfCategories()`；侧栏与 `utils.ts` 依旧没有 `localStorage`。

**手工验收**：

1. 刷新页面 → 侧栏最上方出现「今天 N」，默认展开，跨项目、按时间倒序、带 HH:mm 与项目名。
2. 点任一行 → 右侧一步切到该会话（不经过任何分类/项目展开）。
3. 随便发一句话 → 该会话立刻跳到「今天」顶部（验证 `api-session/activity` 通路）。
4. 折叠「今天」→ 刷新页面 → 仍是收起（Config 落盘，非 localStorage）。
5. 跨零点/休眠回来 → 列表自动换天，无需重启。
6. 触发一个待审批的会话 → 琥珀点在「今天」行上同样可见。

## 7. 分期建议

| 期 | 内容 | 是否要动 Host/Config |
|---|---|---|
| **P0（已落地）** | 顶部「今天」分组：跨项目平铺、HH:mm、项目名、状态点、点击一步切换、可折叠、跨零点重算 | 否 |
| **P0.5（已落地，§4.2）** | 「今天」按项目分组：项目名单独成组、分组可折叠、行内只留 状态点 + 时刻 + 标题、分组键按身份 | 是（Config 加 `collapsedTodayGroups`） |
| **P0.6（已落地，§4.6）** | 「从今天隐藏」临时移除：行内按钮、记录落盘、只有重新对话才回显、写入时剪枝（无恢复按钮） | 是（Config 加 `hiddenToday` 一个字段） |
| P1 | 「视图选项」里选窗口：今天 / 近 3 天 / 近 7 天 / 全部（**默认值已放宽到 7 天并落地**，仅缺可配置入口）；「昨天」作为第二个分组 | 是：`Config` 加一个 `.volatile()` 字段（如 `recentWindow`），`index.js` + `validate.mjs` + README 同步 |
| P2 | 分类色小圆点标项目归属；「待处理/运行中置顶」开关；行内悬停显示 turns/token（`projectionValues` 里已有 `sessionStats` / `tokenUsage`） | 否 |
| P3 | 独立「今日」面板（`sidebar.panellist` + 主面板，或右侧 `sidebar.right.pane.tab`）：搜索、按项目分组、耗时统计 | 否（但 UI 面更大） |

## 8. 已知取舍与风险

- **「运行过」的定义**：本方案 = 「今天我发过话 / 今天新建 / 此刻在跑」。如果你心里的定义是「今天 agent 干过活」（包括我一句话没说的长后台任务），那 `updatedAt` 不够用 —— 正确做法是回到 Host 侧读 turn 事件时间（`dsh-session-projection` 里没有时间戳，需要新增投影或走 `session.query`），成本从「小」跳到「中」。建议先按 P0 的定义跑一段时间，不合适再升级。
- **重复出现**：同一会话既在「今天」又在它自己项目的会话列表里。这是视图叠加，不移动任何东西，符合插件「非破坏性」定位。
- **`displayTitle` 可能来自系统提示词**：子代理不过滤时会出现 `<system-reminder>` 这类标题 —— §4.3 的 `origin` 规则就是针对它。
- **会话列表快照的实时性依赖连接**：断连时列表停在最后一次基线（Host 列表本身也是快照）；这与侧栏其它部分的行为一致，不额外处理。
