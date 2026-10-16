# DSH Workspace Category Manager

为已注册的 DSH 工作区添加**逻辑分类**。可以创建“客户项目”“内部工具”“实验”等命名分类，并将每个 Workspace 分配到其中一个分类。

## 它做什么

- 在 **设置 → 工作区分类** 中增加分类管理页面；
- 创建、编辑和删除分类；
- 为 DSH 已注册的 Workspace 分配或移除分类；
- **从 Git 导入项目**：添加工作区时切换到「从 Git 导入」，选择下载目录、填写 Git 地址（可选分支与目录名）、选择分组后提交，Host 端自动 `git clone` 并把克隆出的目录注册为工作区、归入所选分类、打开新会话；
- 侧边栏以**三级层级**呈现：**分类文件夹 → 项目 → 会话**。每个分类是一个可展开/收起的文件夹，文件夹图标使用分类颜色区分；未分类项目落在“未分类”文件夹；
- **顶部固定「当前」分组**：跨项目列出**正在运行 / 刚跑完还没看**的会话（一份显式注册表，不是时间窗口），**按项目分组且分组可折叠**（项目名只出现一次），每组内按时间倒序，行内是 状态点 + 时刻 + 标题；点击一步切换，不必先展开分类和项目；折叠状态随 Config 落盘，跨零点自动换天；每行悬停可「从「当前」隐藏」，被隐藏的会话在你**重新跟它对话**时回到列表；
- **展开状态跨启动保持**：分类文件夹与项目行的展开/收起会随 `Config` 落盘，关闭程序时是什么样子，下次打开就还是什么样子（原因见「数据形式」——不能放 `localStorage`）；
- **点击即时响应 + 平滑动画**：点击先按本地状态重绘（不再等设置写回），面板常驻 DOM 并用 180ms 的高度/内边距/透明度过渡做展开收起；收起时面板高度与内边距归零，**不占位**（行必须包在单层内层里——若把行直接当网格轨道，它们会各自保留 34px 高度）；宿主拒绝写入时以宿主状态为准，不会留下假的展开态；
- 侧边栏头部保留**全部收起 / 全部展开**（一个按钮把分类和项目自身一次性收拢或摊开，复用 `collapsedCategories` 与 `expandedWorkspaces`，不新增字段；「当前」分组不是分类，不会被它动到）、**视图选项**（排序方式：手动 / 最近更新）、**添加分类**与**添加工作区**按钮（添加工作区复用 DSH 目录选择流程，选择目录后自动创建并进入新会话；添加分类直接在侧边栏弹出表单，无需跳转设置页）；
- **右键**分类文件夹弹出**解散分类**菜单：解散后该分类被移除，其下所有项目进入“未分类”；
- **拖拽**：项目可拖入其它分类文件夹改变归属（也可拖到“未分类”移出分类），拖到项目行上可调整顺序（跨文件夹时同时改归属）；分类文件夹之间可拖拽排序（持久化到分类顺序）；
- 项目行不显示文件夹图标（窄轨道模式保留），**运行中的项目在行外侧**（左侧留白处）显示追逐动画，不占行宽、完整显示项目名；
- **右键**项目行 / 会话行弹出管理菜单：项目支持**重命名 / 删除工作区**，会话支持**重命名 / 分叉 / 归档**；
- 分类、分配关系与侧边栏展开状态持久化到本插件 Loader 条目的 `Config`（DSH 0.1.7+ 落进 profile 补丁 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`，旧的 `$DSH_HOME/settings.yaml` 命名空间已随 0.1.7 移除，见「版本兼容」）；
- 使用稳定的 Workspace ID，而不是目录路径，因此重命名显示标题不会丢失分类。

## 安全与限制

这是一个**非破坏性分类插件**：

- 不会创建、移动、重命名或删除任何项目目录；
- 不会删除 Workspace 注册或会话；
- 不会移动、重命名或删除项目目录。

DSH 的 `sidebar.workspaces` 是 single slot，因此此插件会替换内置 Workspace Browser，在同一位置以**分类文件夹 → 项目 → 会话**三级层级呈现工作区。分类文件夹可展开/收起、可拖拽排序、图标颜色即分类颜色；项目可拖入其它文件夹改变归属，也可在文件夹内拖拽调整顺序；点击项目展开对话记录、点击会话直接打开、行内悬停 **+** 新建会话、当前会话高亮、执行中会话显示与原版相同的追逐动画。头部保留原版的排序与添加工作区入口（添加复用 DSH 的目录选择流程，仅在部署提供该流程时显示按钮）。原版浏览器的搜索与拖拽会话排序暂不在这个替代视图中提供。

## 「当前」视图

侧边栏最上方固定一个跨项目的「当前」分组。它是一份**显式注册表**（Config `currentSessions`），不是时间窗口：

- **登记**（只看运行）：会话**开始运行**（含自动续跑这类没有新提示词的运行）或它的**活动戳前进**（你发了新提示词）。**打开一个会话不会登记它** —— 翻看一下不该让这一栏多出东西；打开只会给已经登记过的条目刷新 `viewedAt`，把「跑完了还没看」的加粗摘掉。
- **隐藏 = 从注册表里删掉这一条**。所以：从没登记过的**历史会话不会自己出现**；删掉的**也不会自己回来**，除非它再次运行（那时会重新登记）。
- **排除**：子代理会话（`origin === 'subagent'`）、已归档会话、从未发过话的空白会话（当前正在用的那个除外）——与项目下的会话列表同一套语言。
- **按项目分组，项目名单独成组**：分组标题**复用分类栏里那个项目行的样式**（同一套类名与结构：文件夹图标 + 角标状态点 + 项目名 + 条数），会话也装在同一个 `.wcm-sessions` 折叠容器里、走同一个会话行渲染函数 —— 两栏看起来就是一套东西；唯一刻意的差别是这里**不给项目操作按钮**（重命名 / 删除工作区仍然只在分类树里右键）。状态点把组内会话的状态聚合上来（待处理 > 运行中 > 完成未读），是**静态点**，组内没有状态就不渲染；「当前」这一行本身不带点。组内按时间倒序，分组之间按组里最新那条排。
- **行内容**：状态点（待处理 / 运行中 / 完成未读）+ 时刻（`HH:mm`；更早的显示 `M/D`）+ 标题；跑完了还没看过的行标题**加粗**。
- **定位到会话**：行悬停时右侧出现「定位」（紧挨着「隐藏」），点一下就在左边的分类树里把它露出来——自动展开它所属的分类与项目、滚动到那一行并闪一下高亮；只有被工作区记账的会话（能在树里找到）才有这个按钮。
- **隐藏**：行悬停时右侧的小眼睛按钮，效果就是把该会话从注册表里删掉（写盘前会剪掉快照里已经不存在的 id）。
- **归档**：不占行内按钮 —— 会话右键菜单里本来就有「归档」，归档后的会话不会再出现在这一栏。
- **点击**一步切换会话（`uiWorkspace.openSession`），右键仍是原有的会话菜单（重命名 / 分叉 / 归档）。

为什么不是「最近 N 天」这类时间窗口：窗口是猜的，而注册表是你**看得见、删得掉**的。历史会话不会因为「刚好落在一周内」而混进来；一条会话要不要留在这一栏，只由「它跑没跑」和你「删没删」决定。

**登记必须是观测型的**：客户端把「上一次看到的会话状态」存在一个 ref 里（不是配置），只在观察到跃迁（`running` 由假变真 / 活动戳前进）时登记。重启之后这个 ref 是空的 —— 首次观测**什么都不登记**（没有可比较的跃迁），所以隐藏过的会话不会因为「它还在跑」而自己回来，历史也不会被导入。

**已知取舍**：

- 只看不发的会话不会出现 —— 没提示词、没运行，就没有登记事件（想让它出现就先运行一次，或者用「定位」在分类树里找它）；
- 隐藏一个**正在运行**的会话，它会一直隐藏到该会话出现新活动为止（这是刻意的：运行本身不是新活动）；
- 注册表会随使用增长，但只在会话确实跑过时才增长，而且写入时剪枝；不想留的随手隐藏即可。
**这个视图是纯投影，唯一新增的字段是「当前注册表」**：DSH 的会话快照本来就下发 `running` 与 `updatedAt`（`max(createdAt, lastPromptAt)`，只在你发消息时推进，`@deepseek-ai/dsh-api-session-controller`）——登记只看这两个事实，再加客户端一个**不落盘**的 ref（记住上一次看到的会话状态；重启后它是空的，所以首次观测什么都不登记，隐藏过的会话不会因为「它还在跑」而自己回来）。折叠状态复用已有的 `collapsedCategories`（合成 id `__today__`）与 `collapsedTodayGroups`，Host 端只多了 `currentSessions` 一个字段（见「数据形式」），没有数据迁移。

「隐藏」为什么不需要额外记录：它就是**从注册表里删掉那一条**，所以不需要跨重启保留任何「排除名单」、也没有需要失效的判定——想让它回来，就再让它运行一次（或者用「定位」在分类树里找到它）。注册表**只在写入时剪枝**（快照里已消失的 id 会被丢掉），所以它和展开状态一样不会随使用无限增长。

已知取舍：**只看不发的会话不会出现**（只读日志、只让 agent 自己跑而不插话），这是 `updatedAt` 语义的必然结果；跨天仍在跑的会话由 `running` 兜住，而既不新鲜又不在跑的会话按定义就不是「今天运行过」。

## 从 Git 导入项目

浏览器不能执行 git，因此克隆由 **Host 半部分**（`index.js`）完成，「添加工作区」对话框提供两条路径：

- **本地目录**：和以前一样，用目录选择器挑一个已有目录；
- **从 Git 导入**：填写 Git 地址（`https://`、`http://`、`ssh://`、`git://`、`file://`、`git@host:path` 或本机绝对路径），可选填分组、分支与目录名，选择「下载目录」后提交。Host 会执行 `git clone`（参数数组，不经 shell），成功后把克隆出的目录注册为 Workspace、写入所选分类并打开新会话。

细节：

- 目录名留空时从 Git 地址推导（`https://host/org/repo.git` → `repo`），推导结果实时显示在「将克隆到」提示里；Host 端会用同一规则复核；
- 目标目录已存在、下载目录不存在、目录名含路径分隔符或系统保留名等情况会在克隆前直接拒绝；
- 克隆超时（5 分钟）或失败时会删除它创建的那层目录，不留半成品；
- 克隆期间会禁用对话框输入并提示「正在克隆仓库…」；
- `git` 必须已安装且在 Host 进程的 `PATH` 中，否则「从 Git 导入」页签不会出现。

**安全边界（重要）**：Git 导入是一个能写磁盘、能访问网络的 Host 能力，因此接口只在这些条件下存在/可用：

- Host 的 Web 服务绑定在 `127.0.0.1`（绑定 `0.0.0.0` 时根本不注册该路由，并打印一条警告）；
- 请求来自 loopback 地址、Host 头是 `127.0.0.1` / `localhost` / `[::1]`、且是同源浏览器请求（写操作必须带 `Origin`，跨站 `Sec-Fetch-Site: cross-site` 直接拒绝）；
- 写操作需要先通过状态探测拿到的一次性令牌（`X-DSH-WCM-Token`，10 分钟有效），防跨站请求伪造；
- Git 地址不得以 `-` 开头（防选项注入），下载目录必须是已存在的绝对路径，目录名必须是不含分隔符的单个路径段；
- 通过 HTTPS/TLS 反向代理以域名访问的部署不会启用此功能（这是有意的：该能力只服务于本机使用）。

## 安装

从此仓库根目录执行：

```bash
dsh plugin --profile web add ./dsh-workspace-category-manager
```

重启 DSH Web Host 并刷新页面。随后前往：

```text
设置 → 工作区分类
```

## 数据形式

```yaml
workspace-category-manager:
  categories:
    - id: client-projects
      name: 客户项目
      color: '#4f8cff'
  assignments:
    workspace-stable-id: client-projects
  # 侧边栏展开状态：只记录「非默认」的那一侧
  collapsedCategories: []   # 列在这里的分类是收起的，其它保持展开
  expandedWorkspaces: []    # 列在这里的项目是展开的，其它保持收起
  # 「当前」注册表：id → { at: 登记时的活动戳, viewedAt: 最后一次把它当作当前会话看到的时间 }
  currentSessions:
    session-3dbba6d7: { at: 1791775395012, viewedAt: 1791777600000 }
  # 「当前」里被收起的项目分组（键 = 工作区身份 / 目录路径）
  collapsedTodayGroups: []
```

删除一个分类会自动移除其项目分配；项目目录、Workspace 本身及其会话不会受影响。

> 字段名里的 `today`（`collapsedTodayGroups` / `TODAY_FOLDER_ID`）是历史命名：这一栏早期的语义是「今天」，现在由 `currentSessions` 注册表决定成员，界面上的显示名一直是**「当前」**。

### 侧边栏展开状态为什么放在这里

展开/收起状态**不能**放在浏览器 `localStorage`：DSH 每次启动都会给 Web 服务分配一个**新的回环端口**，而 `localStorage` 按 origin（含端口）隔离，所以新端口下的存储永远是空的——分类会全部重新展开。

因此这两项作为 `Config` 字段随分类、分配关系一起落盘（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`），下次启动时按磁盘上的值恢复：**关闭时怎么样，打开时就是怎么样**。两个字段都只保存「非默认」的一侧（`collapsedCategories` / `expandedWorkspaces`），删掉的分类和已删除项目会在下次写入时自动清理，不会无限增长。

## 开发与构建

客户端是 TypeScript 源码，构建为 Dsh 模块表契约的单文件 bundle：

```
index.js                    # Host 端：settings 注册 + Git 导入路由（git clone）
src/
  index.ts                  # 客户端入口：样式注入 + 槽位注册
  api.ts                    # DSH API 适配层（唯一接触 ctx）+ Host Git 接口调用
  constants.ts / utils.ts   # 常量与工具
  components/               # TSX 组件（CategorySidebar/CategorySection/StateDot/dialogs/icons）
  styles.css                # ← 独立的样式文件（源层面分离）
scripts/build-client.mjs    # esbuild：src/client → lib/client.js（CSS 内联注入）
lib/client.js               # 构建产物（不提交，prepare 自动构建）
tests/api.test.js           # 客户端：针对构建产物的 API 面测试
tests/git-clone.test.js     # Host：校验规则 + 真实本地克隆 + 路由安全门禁
```

```bash
pnpm install        # 触发 prepare → 构建 lib/client.js
pnpm build          # 手动重新构建（改 src/ 后）
pnpm test           # 客户端 + Host 全部测试
pnpm test:client    # 仅客户端 API 面测试（现代/回退/降级/Git 导入 UI 流程）
pnpm test:host      # 仅 Host Git 导入测试（会创建临时 git 仓库）
pnpm check-api      # 升级核对（见下）
pnpm validate       # 结构校验
```

## 验证

```bash
pnpm build && pnpm test
node --check ./index.js
node ./scripts/validate.mjs
```

`validate` 会顺手守住本次的回归点：Host `Config` 必须声明 `collapsedCategories` / `expandedWorkspaces` / `currentSessions` / `collapsedTodayGroups`；侧边栏与 `utils.ts` 不得再出现 `localStorage` 读写（否则展开状态又会在换端口后丢失）；「全部收起/全部展开」必须收放分类与项目自身（不是把目录藏起来）、两个字段各写一次且「当前」折叠位不被改动；「当前」分组的合成 id 必须留在 `idsOfCategories()` 的 id 全集里（否则乐观折叠值会被立刻回收、`retainIds` 还会把它从落盘列表里剪掉），并继续排除子代理会话；**登记必须由观测事件驱动**（`running` 由假变真或活动戳前进），**打开会话不得登记**（只刷新已登记条目的 `viewedAt`）；**隐藏必须是删掉那一条**（不得长出恢复按钮或第二条回显信号）；每次写入都要剪掉快照里已不存在的 id；`currentSessions` 的两个字段与整张表都要有默认值（全新 profile 不做任何写入也能校验通过）；窗口常量与 `hiddenToday` 一旦回来就报错。

`pnpm test:client` 里对应的是「P: 「当前」= 显式注册表」一组断言：成员只来自注册表（历史会话不许出现）、分组与排序、子代理/归档/空白/已删会话的排除、隐藏=从注册表删除且立刻生效、重启后不自动回显、再次运行才回来、登记的三种观测事件（开始运行 / 活动戳前进 / 打开它）、以及「跑完了还没看」的加粗标记、项目名回退、点击走 `uiWorkspace.openSession`、折叠落盘保留 `__today__`、重挂载后仍是收起、跨过零点后只剩还在跑的会话；以及隐藏的即时重绘（设置回写未落地时也立刻消失）、记录只带活动戳、跨挂载保留、**只有重新对话才回显**（自己跑起来不回来）、失效记录在下次写入被剪枝、以及「没有恢复按钮」这条产品决定、「当前」的项目分组折叠落盘（键是身份不是显示名）、「项目名只在分组标题上出现一次」、「「当前」的分组标题不长出项目操作按钮」，以及「定位到会话」要把所属分类/项目展开、给树里的行打上定位锚点与高亮（且不可定位的会话不出现按钮）。


## 版本兼容（重要）

DSH 版本间客户端 API 有变动，本插件在 `src/client/api.ts` 内做双路兼容：

| 能力 | DSH 0.1.7+（当前） | DSH 0.1.6+ | DSH ≤ 0.1.2 |
|---|---|---|---|
| 读取/写入插件设置 | `ctx.configForms.get('workspace-category-manager')`（条目 id 即命名空间，快照仍是 `{status, value, writable}` + `subscribe`/`set`） | `ctx.settingsScope.bind({ namespace })` | 同左 |
| 打开会话（点击后右侧切换） | `uiWorkspace.openSession(id)`：保留为 mainView 并显示会话面板 | 同左 | `sessions.open(id)` |
| 归档当前会话 | `uiWorkspace.archiveSession(id)`：归档后同时清空会话面板 | 同左 | `workspaces.archiveSession(id)` |
| “当前会话”高亮 | 列表行 `retainedBy.mainView > 0` | 同左 | 列表快照 `current` |
| 执行中 / 完成 / 等待人工 | `uiSession.sessionStatus`（`Map<id, {running, pendingInteraction, completionUnread}>`） | 同左 | `uiSession.pendingInteractions`（`Map<id, {kind}>`），`running/completed` 取自列表行 |
| 会话重命名 | `sessions.using(id, …)` 取得引用后重命名（未持有引用时 `binding` 返回 undefined） | 同左 | `sessions.binding(id).session.rename()` |

0.1.6 起“选择会话”变成**视图所有者**的动作：单独调用 `sessions.open()` 只改控制器内部选中项，不再切换右侧会话页，必须走 `uiWorkspace.openSession()`。

0.1.7 起**插件不能再自己注册设置命名空间**（客户端 `settingsScope` 服务与宿主 `ctx.settings.register()` 均已移除）：设置面 = 本插件 Loader 条目的 `Config`，只有标了 `.volatile()` 的字段可被设置面板编辑，条目 id 兼作命名空间。因此 `cordis.patch.yml` 里的 `id: workspace-category-manager` 必须与 `index.js` 的 `SETTINGS_NAMESPACE`、客户端 `ctx.configForms.get(...)` 的入参三处一致。数据落点也随之从 `$DSH_HOME/settings.yaml` 变为 **profile 补丁** `$DSH_HOME/profiles/<profile>/cordis.patch.yml`。

## 架构与升级稳健性

插件对 DSH 的所有运行时访问都集中在 `src/client/api.ts` 的 **`createDshApi` 适配层**（唯一接触 `ctx` 的代码），组件只消费 `api` 对象：

- **硬依赖**（inject 声明）：`slots` / `locale` / `configForms` / `workspaces` / `sessions`；
- **软依赖**（`ctx.get` 探测，缺失即降级）：
  - `uiWorkspace`：`openSession` / `startSession` / `pickDirectory`——缺失时回退旧路径 `sessions.open`、`workspaces.startSession`、`sessions.create`、`workspaces.pickDirectory`，目录选择都不存在时“添加工作区”按钮自动隐藏；
  - `uiSession`：状态源按 `sessionStatus` → `pendingInteractions` 两代探测，都缺失时仅保留列表行的执行中标记；
- 组合层面：不禁用、不修改任何原生包；`cordis.patch.yml` 只插入自身；侧边栏以 `priority: -1` 遮蔽原生浏览器（原生条目保持注册，插件加载失败时原生浏览器自然兜底）；
- 样式在 `src/client/styles.css` 独立维护，构建时内联为 `<style data-plugin-css>` 注入（与 Dsh 自家编译产物格式一致）。

**DSH 升级后**运行：

```bash
node ./scripts/check-api.mjs <dshRoot可选>
```

它从 `src/client/` 源码提取适配层用到的服务/方法 token，逐项对照已安装 dsh 的**客户端契约接口**（`ISessions` / `IWorkspaces` / `UiWorkspace` / `uiSession` 状态源），输出缺失清单。只作为兼容回退的分支标记为 `[soft — legacy fallback]`，其余缺失会以非零退出码拦住发布。缺失项只在 `api.ts`（`createDshApi`）加一条回退分支即可，UI 逻辑无需变更。

> 校准接口（而不是“包内任意同名方法”）是刻意为之：0.1.6 移除了 `ISessions.open`，但包内仍有一个无关的私有 `Session.open()`，早期按文本出现的检查因此把“会话点击不切换”的破坏漏了过去。
