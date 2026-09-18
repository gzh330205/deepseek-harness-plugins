# DSH Workspace Category Manager

为已注册的 DSH 工作区添加**逻辑分类**。可以创建“客户项目”“内部工具”“实验”等命名分类，并将每个 Workspace 分配到其中一个分类。

## 它做什么

- 在 **设置 → 工作区分类** 中增加分类管理页面；
- 创建、编辑和删除分类；
- 为 DSH 已注册的 Workspace 分配或移除分类；
- 侧边栏以**三级层级**呈现：**分类文件夹 → 项目 → 会话**。每个分类是一个可展开/收起的文件夹，文件夹图标使用分类颜色区分；未分类项目落在“未分类”文件夹；
- 侧边栏头部保留**视图选项**（排序方式：手动 / 最近更新）、**添加分类**与**添加工作区**按钮（添加工作区复用 DSH 目录选择流程，选择目录后自动创建并进入新会话；添加分类直接在侧边栏弹出表单，无需跳转设置页）；
- **右键**分类文件夹弹出**解散分类**菜单：解散后该分类被移除，其下所有项目进入“未分类”；
- **拖拽**：项目可拖入其它分类文件夹改变归属（也可拖到“未分类”移出分类），拖到项目行上可调整顺序（跨文件夹时同时改归属）；分类文件夹之间可拖拽排序（持久化到分类顺序）；
- 项目行不显示文件夹图标（窄轨道模式保留），**运行中的项目在行外侧**（左侧留白处）显示追逐动画，不占行宽、完整显示项目名；
- **右键**项目行 / 会话行弹出管理菜单：项目支持**重命名 / 删除工作区**，会话支持**重命名 / 分叉 / 归档**；
- 分类和分配关系持久化到 `$DSH_HOME/settings.yaml` 中的 `workspace-category-manager` namespace；
- 使用稳定的 Workspace ID，而不是目录路径，因此重命名显示标题不会丢失分类。

## 安全与限制

这是一个**非破坏性分类插件**：

- 不会创建、移动、重命名或删除任何项目目录；
- 不会删除 Workspace 注册或会话；
- 不会移动、重命名或删除项目目录。

DSH 的 `sidebar.workspaces` 是 single slot，因此此插件会替换内置 Workspace Browser，在同一位置以**分类文件夹 → 项目 → 会话**三级层级呈现工作区。分类文件夹可展开/收起、可拖拽排序、图标颜色即分类颜色；项目可拖入其它文件夹改变归属，也可在文件夹内拖拽调整顺序；点击项目展开对话记录、点击会话直接打开、行内悬停 **+** 新建会话、当前会话高亮、执行中会话显示与原版相同的追逐动画。头部保留原版的排序与添加工作区入口（添加复用 DSH 的目录选择流程，仅在部署提供该流程时显示按钮）。原版浏览器的搜索与拖拽会话排序暂不在这个替代视图中提供。

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
```

删除一个分类会自动移除其项目分配；项目目录、Workspace 本身及其会话不会受影响。

## 开发与构建

客户端是 TypeScript 源码，构建为 Dsh 模块表契约的单文件 bundle：

```
src/
  index.ts                  # 客户端入口：样式注入 + 槽位注册
  api.ts                    # DSH API 适配层（唯一接触 ctx）
  constants.ts / utils.ts   # 常量与工具
  components/               # TSX 组件（CategorySidebar/CategorySection/StateDot/dialogs/icons）
  styles.css                # ← 独立的样式文件（源层面分离）
scripts/build-client.mjs    # esbuild：src/client → lib/client.js（CSS 内联注入）
lib/client.js               # 构建产物（不提交，prepare 自动构建）
```

```bash
pnpm install        # 触发 prepare → 构建 lib/client.js
pnpm build          # 手动重新构建（改 src/ 后）
pnpm test           # 针对构建产物的 API 面测试（适配层现代/回退/降级）
pnpm check-api      # 升级核对（见下）
pnpm validate       # 结构校验
```

## 验证

```bash
pnpm build && pnpm test
node --check ./index.js
node ./scripts/validate.mjs
```

## 版本兼容（重要）

DSH 版本间客户端 API 有变动，本插件在 `src/client/api.ts` 内做双路兼容：

| 能力 | DSH 0.1.6+（当前） | DSH ≤ 0.1.2 |
|---|---|---|
| 打开会话（点击后右侧切换） | `uiWorkspace.openSession(id)`：保留为 mainView 并显示会话面板 | `sessions.open(id)` |
| 归档当前会话 | `uiWorkspace.archiveSession(id)`：归档后同时清空会话面板 | `workspaces.archiveSession(id)` |
| “当前会话”高亮 | 列表行 `retainedBy.mainView > 0` | 列表快照 `current` |
| 执行中 / 完成 / 等待人工 | `uiSession.sessionStatus`（`Map<id, {running, pendingInteraction, completionUnread}>`） | `uiSession.pendingInteractions`（`Map<id, {kind}>`），`running/completed` 取自列表行 |
| 会话重命名 | `sessions.using(id, …)` 取得引用后重命名（未持有引用时 `binding` 返回 undefined） | `sessions.binding(id).session.rename()` |

0.1.6 起“选择会话”变成**视图所有者**的动作：单独调用 `sessions.open()` 只改控制器内部选中项，不再切换右侧会话页，必须走 `uiWorkspace.openSession()`。

## 架构与升级稳健性

插件对 DSH 的所有运行时访问都集中在 `src/client/api.ts` 的 **`createDshApi` 适配层**（唯一接触 `ctx` 的代码），组件只消费 `api` 对象：

- **硬依赖**（inject 声明）：`slots` / `locale` / `settingsScope` / `workspaces` / `sessions`；
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
