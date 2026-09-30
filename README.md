# DeepSeek Harness Plugins

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) 的 Web Profile 插件集合，为 DSH Web 提供增强功能。

## 包含的插件

| 插件 | 版本 | 说明 |
|---|---|---|
| [`dsh-plugin-kit`](./dsh-plugin-kit) | 0.1.0 | **插件合集（推荐入口）**：唯一进 profile 依赖的组合包，把下面 6 个插件作为子插件行挂在一次安装里；并在「设置 → 插件合集」分区用页签集中呈现各插件的配置 |
| [`dsh-sidebar-width`](./dsh-sidebar-width) | 0.2.0 | 左右侧栏宽度记忆：收进一份全局配置（Loader volatile Config），跨会话 / 刷新 / 重启都保持（原生左栏完全不持久化、右栏只按会话存）。实现不碰 DOM，而是从 `ctx.slots.entries('root')[0].store` 取到 DSH 的布局 store 实例，调它自己的 `actions.setSidebar/setRightbar` ；**关闭右栏最后一个标签后停在引导页**（而不是收起右栏）|
| [`dsh-mcp-skill-manager`](./dsh-mcp-skill-manager) | 0.3.0 | MCP 与 Skills 统一管理器：新增 / 编辑 / 启停 / 删除，支持从 Claude Code / Codex / OpenCode 一键导入；**MCP 配置字段直接继承官方 `dsh-mcp-client` 的 schema**（不手抄字段表），并提供**真实握手的状态检查**（可用 / 工具数 / 耗时 / 错误文本 / 命令解析诊断） |
| [`dsh-workspace-category-manager`](./dsh-workspace-category-manager) | 0.2.0 | 为 DSH 工作区添加逻辑分类，侧边栏以「分类文件夹 → 项目 → 会话」三级层级展示，支持拖拽归类与排序；支持按 Git 地址克隆并导入项目；兼容 DSH 0.1.7 / 0.1.6（`configForms` 设置、`uiWorkspace.openSession` 会话切换、`uiSession.sessionStatus` 状态点） |
| [`dsh-win-notify`](./dsh-win-notify) | 0.2.1 | 会话执行完成 / 需要人工干预（审批、提问）时弹通知：Tauri 桌面壳原生通知或浏览器 Notification（客户端路线），可选 Windows 系统 Toast（宿主路线，零依赖）；兼容 DSH 0.1.6+（`uiSession.sessionStatus`），客户端降级不抛错 |
| [`dsh-run-env-manager`](./dsh-run-env-manager) | 0.2.0 | 运行环境管理器：按工作区维护运行配置、一键启停、实时日志（SSE）、PATH 环境探测与 Tomcat 托管启动，支持 AI 读项目生成配置 |
| [`dsh-git-panel`](./dsh-git-panel) | 0.1.0 | 右侧栏 Git 面板：待提交变更（**列表 / 目录树两种显示模式**，目录模式下可逐目录或一键展开/折叠，分组 + 增删行数 + 统一 diff）、**点文件的差异可开在中间列（可关闭返回对话、可切换文件，行在侧栏高亮）或侧栏内联**、提交历史（带提交图、分支/标签装饰、分页）、`git worktree` 管理（列表/新建/删除/清理，删除前 dirty 守卫与补丁导出）。只在本机绑定下注册、写操作要求同源，且完全不联网（无 fetch/pull/push） |
| [`dsh-oneway-usage-monitor`](./dsh-oneway-usage-monitor) | 0.1.0 | OneWay 用量监控：右下角三环悬浮卡片 + 扫码登录（本地目录，不在仓库跟踪范围内） |

### 合集与子插件的关系

```
dsh-plugin-kit（唯一进 profile 依赖的组合包 = 插件页里的一张卡）
├─ 锚点行 dsh-plugin-kit        ← 合集自己的浏览器半区（「设置 → 插件合集」分区）
├─ 行 git-panel                   → dsh-git-panel
├─ 行 run-env-manager             → dsh-run-env-manager
├─ 行 workspace-category-manager  → dsh-workspace-category-manager
├─ 行 mcp-skill-manager           → dsh-mcp-skill-manager
├─ 行 win-notify                  → dsh-win-notify
├─ 行 oneway-usage-monitor        → dsh-oneway-usage-monitor
└─ 行 sidebar-width              → dsh-sidebar-width
```

- **一张卡**：只有合集进 profile 的 `dependencies`，子插件是它的依赖（pnpm 传递依赖不会各自变卡片）；子插件目录保留，仍可单独 `dsh plugin add` 安装（此时代码里的「双态注册器」会把设置页退回原入口）。
- **行 id = 设置命名空间**：每行的 id 必须与子插件 `SETTINGS_NAMESPACE` / profile patch 里的 id 一致，配置数据仍然按行落在 profile 的 `cordis.patch.yml`。
- **配置集中在「设置 → 插件合集」**：合集的浏览器半区声明 list 子槽 `settings.pluginKit.tab`，各子插件把设置页贡献进去（页签顺序 = 各插件的 `order`：工作区分类 16、运行环境 17、MCP 20、Skills 21、OneWay 30、Git 面板 60、会话通知 70）。
- **锚点行不能关**：关掉 `dsh-plugin-kit` 那一行 = 合集分区和所有页签一起消失（子插件仍各自运行，只是没有统一配置入口）。

## DSH 版本兼容（0.1.7 破坏性变更 + 0.2.0 兼容门）

> **升到 DSH 0.2.0 后插件集体「不起作用」的头号原因：peer 兼容门。**
> DSH 0.2.0 起，`dsh-app-boot` 的 `evaluatePluginCompatibility()` 会在装载前检查插件的
> `peerDependencies` 里所有 `@deepseek-ai/dsh*`（含 `@deepseek-ai/dsh`）条目：
> `semver.satisfies(runtimeVersion, range, { includePrerelease: true })` 不通过，就把
> **整个 bundle 跳过 / 整个 Loader 行 `disabled`**，日志里只有一句
> `skipping profile bundle "…"` / `disabling profile plugin row "…"`。
> `^0.1.0-rc.7` 在语义化版本里**不覆盖 0.2.0**（0.x 的 caret 只允许改最右非零位），
> 所以凡是这么写的插件都会在 0.2.0 上被禁用。三条对策：把范围放宽到覆盖目标版本、
> 用 `workspace:^`/`workspace:~`/`workspace:*`（自动指向当前 runtime），或对具体版本授
> 精确豁免（profile 的 `compatibility.json`，走 `dsh plugin allow-version --accept-risk`
> 或插件管理器，只授权不验证）。
>
> 本仓库现在的写法：所有 `@deepseek-ai/dsh-settings` / `dsh-tools` peer 写
> **`>=0.1.0-rc.7 <0.3.0`**（同时兼容 0.1.7 与 0.2.0，升到 0.3 会被门拦住提醒复核）；
> 内嵌的 `@deepseek-ai/dsh-tools` / `dsh-mcp-client` / `dsh-skill` 依赖对齐到
> **`0.2.0-rc.1`**（原本是 `0.1.7-alpha.2` / `^0.1.0-rc.7`，会在插件里留一份旧副本）。
> 注意 `@deepseek-ai/cordis`、`react` 不在门的检查范围内，写不写范围都会被放过。

### 0.1.7 的 API 破坏性变更

DSH 0.1.7 移除了「插件自己注册设置命名空间」这套 API，本仓库的插件已按新模型迁移：

DSH 0.1.7 移除了「插件自己注册设置命名空间」这套 API，本仓库的插件已按新模型迁移：

| 旧（≤ 0.1.6） | 新（0.1.7+） |
|---|---|
| 客户端 `inject: ['settingsScope']` + `ctx.settingsScope.bind({ namespace })` | `inject: ['configForms']` + `ctx.configForms.get('<条目 id>')`（快照形状与 `subscribe`/`set` 未变） |
| 宿主 `ctx.settings.register(ns, Config, { validate })` | 插件的 Loader 条目 `Config` schema，可编辑字段标 `.volatile()`；宿主写入走 `ctx.configEditor.edit()`，宿主响应变更走 `ctx.on('loader/volatile-update', …)` |
| 数据存 `$DSH_HOME/settings.yaml` | 数据存 profile 补丁 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` |

三条容易踩的坑，改插件前务必知道：

1. **不要写 `export default apply`。** `cordis-plugin-loader` 的 `unwrapExports()` 遇到 default 会把整个模块命名空间丢掉，同级的具名 `Config` / `inject` 一起失效 —— 条目就再也读不到 volatile 字段，客户端 `configForms.get()` 会一直停在 `unavailable`。用官方的 `export { Config, apply, inject }` 形式（模块命名空间对象本身就是合法的 plugin entrypoint）。
2. **schema 必须叫 `Config`，不能改别名。** Loader 读的是模块命名空间上的 `Config` 键（`cordis-plugin-loader` 的 `this.runtime?.Config`、`dsh-app-boot` 的 `Reflect.get(plugin, "Config")`）。写成 `SettingsConfig` 之类的别名，Loader 就当这个条目没声明 schema：`apply(ctx, config)` 收到裸 config（`config.users.get()` 直接 TypeError），设置面板永远 unavailable。
3. **`@deepseek-ai/schemastery` 必须是 `~3.18.4`**（`.volatile()` 从 3.18.4 才有，DSH 0.1.7 自带的正是这个版本）。插件的本地 `node_modules` 会优先于 DSH 自带的那份，低版本会让插件在 import 阶段就抛 `TypeError: z.…volatile is not a function`。

另外，宿主半区分不清「加 volatile」的代价时，记住运行时形状会变：**`.volatile()` 字段在 `apply` 里不是裸值，而是引用对象**（`{ get() }`），读法要写 `config.notifyKinds.get()`，不能写 `config.notifyKinds.includes(...)`；同时 `Config({})` 对 volatile 字段返回的是引用而不是默认值，所以单测里要传「原始配置」给 `ctx.plugin()`，让 cordis 自己用 schema 物化。

## 安装

### 推荐：整装合集（一张卡 + 一个设置分区）

在**本仓库根目录**执行：

```bash
# 只装合集：7 个插件作为它的依赖一起装上，插件页只多出一张卡
dsh plugin --profile web add ./dsh-plugin-kit
```

安装后**重启 DSH Web Host 一次**（让 profile 依赖闭包与新 patch 生效），然后刷新浏览器页面。若合集目录还没装过依赖，先在 `dsh-plugin-kit/` 里跑一次 `pnpm install --ignore-scripts`。

### 单独安装某个插件

每个插件都是独立的 DSH Profile Bundle，仍可单独安装（此时代码里的双态注册器会把它的设置页退回原来的入口）：

```bash
dsh plugin --profile web add ./dsh-mcp-skill-manager     # MCP & Skills
dsh plugin --profile web add ./dsh-workspace-category-manager
dsh plugin --profile web add ./dsh-run-env-manager       # 运行环境管理
dsh plugin --profile web add ./dsh-git-panel             # 侧边栏 Git：变更 / 历史 / 工作树
dsh plugin --profile web add ./dsh-sidebar-width         # 侧栏宽度记忆（页签进合集）
```

> ⚠️ 不要「合集 + 单独子插件」混装：同一子插件会被插入两行、两个槽同时有注册（list 槽同 id 二次注册会抛错）。

### 使用入口

装合集时（推荐）：

- **设置 → 插件合集**：页签依次为 工作区分类 / 运行环境 / MCP / Skills / OneWay 用量 / Git 面板 / 侧栏宽度（`dsh-win-notify` 已按需求去掉设置页——它没有需要调的东西）
- **侧边栏**：工作区分组层级（workspace-category-manager）
- **右侧栏**：「+」→「运行配置」（run-env-manager）、「Git 变更」（git-panel）

单独安装时：

- **MCP & Skill Manager**：`设置 → 插件 → MCP` 与 `设置 → 插件 → Skills`
- **Workspace Category Manager**：`设置 → 工作区分类`
- **Run Env Manager**：`设置 → 运行环境`；右侧栏「+」→「运行配置」
- **Git Panel**：右侧栏「+」→「Git 变更」（变更 / 历史 / 工作树三个子页）
- **OneWay 用量**：`设置 → 插件 → OneWay 用量`

> ⚠️ 插件的 Host / client 文件都直接位于各自目录，DSH 通过 profile 依赖解析它们。请保留整个目录，不要仅复制 `cordis.patch.yml`。

## 项目结构

```
.
├── dsh-plugin-kit/               # 插件合集（唯一进 profile 依赖的组合包）
│   ├── index.js                    # Host 半区：空 Config + 空 apply（浏览器半区挂着锚点行）
│   ├── cordis.patch.yml            # 1 锚点行 + 7 子插件行（git-panel/run-env/wcm/mcp/win-notify/oneway/sidebar-width）
│   ├── src/client/index.js         # 浏览器半区：「设置 → 插件合集」分区 + settings.pluginKit.tab 槽
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── locale/{zh,en}.json         # 卡片标题/描述
│   └── scripts/{build-client,validate}.mjs
├── dsh-sidebar-width/             # 侧栏宽度记忆（独立包，也可作为合集的一行）
│   ├── index.js                    # Host 端 Config：enabled / sidebarWidth / rightbarWidth（volatile）
│   ├── src/client/index.js         # 浏览器半：应用/记录列宽 + 「侧栏宽度」设置页
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── cordis.patch.yml            # 一行 insert：id = sidebar-width
│   └── scripts/{build-client,validate}.mjs
├── dsh-mcp-skill-manager/          # MCP & Skill 统一管理器
│   ├── index.js                    # Host 端逻辑
│   ├── client.js                   # Web 设置页 client（MCP / Skills 两个页签）
│   ├── src/client/kit-tab.mjs    # 合集槽双态注册器（契约副本）
│   ├── locale/{zh,en}.json         # 卡片标题/描述
│   ├── cordis.patch.yml            # Profile bundle 补丁
│   ├── examples/                   # 配置示例
│   ├── skills/                     # 插件自带的 Skill
│   └── scripts/validate.mjs        # 结构校验脚本
├── dsh-workspace-category-manager/ # 工作区分类管理器（src/client + esbuild 打包）
│   ├── index.js
│   ├── src/client/                 # 分类设置页 + 侧边栏分类层级；kit-tab.ts 为合集槽注册器
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── locale/{zh,en}.json         # 卡片标题/描述
│   ├── tests/                      # api / git-clone / 合集槽迁移自查
│   ├── cordis.patch.yml
│   └── scripts/{build-client,validate}.mjs
├── dsh-run-env-manager/            # 运行环境管理器（宿主 src/host + 浏览器 src/client，esbuild 打包）
│   ├── index.js                    # Host 端插件入口（Config / apply / inject）
│   ├── src/host/                   # 环境探测、运行实例、HTTP 路由、AI 工具
│   ├── src/client/                 # 右侧栏「运行」页与设置页；kit-tab.ts 为合集槽注册器
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── locale/{zh,en}.json         # 卡片标题/描述
│   ├── tests/                      # 契约 / 环境 / Tomcat / ANSI 解码 / 合集槽
│   ├── cordis.patch.yml
│   └── scripts/{build-client,validate}.mjs
├── dsh-git-panel/                  # 侧边栏 Git 面板（同一个 src/host + src/client + esbuild 结构）
│   ├── index.js                    # Host 端插件入口（Config / apply / inject）
│   ├── src/host/                   # git 进程、状态/差异/历史/worktree 解析、HTTP 路由
│   ├── src/shared/                 # 宿主与浏览器共用的纯逻辑 + kit-tab.ts（合集槽注册器）
│   ├── src/client/                 # 右侧栏「Git」页（变更 / 历史 / 工作树）+ 中间列差异页 + 设置页
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── locale/{zh,en}.json         # 卡片标题/描述
│   ├── tests/                      # 解析 / 泳道 / 契约 / 目录树 / 产物契约 / 渲染 / 真实 git / 路由 / 合集槽
│   ├── cordis.patch.yml
│   └── scripts/{build-client,validate}.mjs
└── .gitignore
```

## 开发与验证

```bash
# 安装依赖（任一插件目录）
cd dsh-mcp-skill-manager            # 或 dsh-workspace-category-manager / dsh-win-notify
pnpm install --ignore-scripts

# 校验插件结构
node ./scripts/validate.mjs

# 语法检查
node --check ./index.js
node --check ./client.js   # 有浏览器半区的插件；纯 host 插件可跳过
```

`dsh-run-env-manager` 与 `dsh-git-panel` 是「宿主 + 浏览器」两半的插件，流程多了打包
与更完整的测试：

```bash
cd dsh-git-panel            # 或 dsh-run-env-manager
pnpm install --ignore-scripts
pnpm run build              # esbuild 打包 src/client → lib/client.js
pnpm test                   # 8 个测试文件 / 380 条断言
pnpm run typecheck          # tsc --noEmit
pnpm run validate           # 脚手架约定 + i18n key 完整性 + 样式同名类冲突回归断言
pnpm run preview            # 生成 README 截图用的独立渲染 HTML（仅 dsh-git-panel）
```

`dsh-sidebar-width` 也是「宿主 + 浏览器」两半，并且有一份**真跑产物逻辑**的测试：

```bash
cd dsh-sidebar-width
pnpm install --ignore-scripts
pnpm run build              # esbuild 打包 src/client → lib/client.js
node ./tests/client.test.mjs   # 23 条断言：启动应用 / 拖动防抖记录 / 收起不记录 / 只记被改的那一侧 / store 晚到
node ./scripts/validate.mjs
```

> 它用极小的假 DOM 把 `lib/client.js` 真执行起来。这个插件踩过的三个坑
> （误用 `slots.specDynamic`、漏掉声明、空格切分、拖右栏覆盖左栏、改 DOM 轨道导致面板
> 溢出盖住中间栏）**全都过得了文本校验**，只有真跑代码才抓得到——所以
> 别再给这个包只留 grep 式的校验。

各插件的详细功能、安全边界与数据形式，请参见对应目录下的 `README.md`。

浏览器侧的界面约定：右侧栏面板的骨架照宿主内建「文件」页的尺寸来（头部 38px、
左内边距 16px、`.5px solid var(--dsw-alias-border-l3)` 分隔线；列表 8px + 行内 10px；
面板内页签 13px/500、选中 `state-business-primary` 2px 下划线）。`dsh-git-panel` 与
`dsh-run-env-manager` 都遵循这份尺寸，三个页签并排看是齐的；样式里同名类被定义两套会被
`validate.mjs` 拦下。

## 安全说明

- `dsh-mcp-skill-manager` 的外部 Harness 导入接口仅在 DSH Web 绑定 `127.0.0.1` 时启用；导入时会丢弃明文秘密，仅识别环境变量引用。
- `dsh-workspace-category-manager` 为非破坏性插件，不会创建、移动、重命名或删除任何项目目录与会话。
- `dsh-git-panel` 只在本机绑定时注册接口：写操作要求同源 `Origin`，ref/hash/路径都过语义护栏，
  破坏性操作（放弃改动、删除未跟踪文件、强制删除 worktree、`amend`）都要二次确认；
  插件不提供 fetch/pull/push，因此不接触任何凭据、不产生网络流量。

## License

MIT
