# DeepSeek Harness Plugins

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) 的 Web Profile 插件集合，为 DSH Web 提供增强功能。

## 包含的插件

| 插件 | 版本 | 说明 |
|---|---|---|
| [`dsh-web-auth`](./dsh-web-auth) | 0.2.0 | DSH Web 的 HTTP 认证网关（账号密码模式）：访问 `http://<host>:<port>` 先登录，支持账户管理、首次部署引导（有网页端设置页）；服务器部署走反向代理/SSH 隧道（DSH 禁止 0.0.0.0 绑定） |
| [`dsh-mcp-skill-manager`](./dsh-mcp-skill-manager) | 0.2.0 | 带 Web 设置页面的 MCP 与 Skills 统一管理器：管理 MCP 服务与 Skill 的新增、编辑、启停、删除，并支持从 Claude Code / Codex / OpenCode 一键导入 |
| [`dsh-workspace-category-manager`](./dsh-workspace-category-manager) | 0.2.0 | 为 DSH 工作区添加逻辑分类，侧边栏以「分类文件夹 → 项目 → 会话」三级层级展示，支持拖拽归类与排序；支持按 Git 地址克隆并导入项目；兼容 DSH 0.1.7 / 0.1.6（`configForms` 设置、`uiWorkspace.openSession` 会话切换、`uiSession.sessionStatus` 状态点） |
| [`dsh-win-notify`](./dsh-win-notify) | 0.2.1 | 会话执行完成 / 需要人工干预（审批、提问）时弹通知：Tauri 桌面壳原生通知或浏览器 Notification（客户端路线），可选 Windows 系统 Toast（宿主路线，零依赖）；兼容 DSH 0.1.6+（`uiSession.sessionStatus`），客户端降级不抛错 |
| [`dsh-run-env-manager`](./dsh-run-env-manager) | 0.1.0 | 运行环境管理器：按工作区维护运行配置、一键启停、实时日志（SSE）、PATH 环境探测与 Tomcat 托管启动，支持 AI 读项目生成配置 |
| [`dsh-git-panel`](./dsh-git-panel) | 0.1.0 | 右侧栏 Git 面板：待提交变更（**列表 / 目录树两种显示模式**，目录模式下可逐目录或一键展开/折叠，分组 + 增删行数 + 统一 diff）、**点文件的差异可开在中间列（可关闭返回对话、可切换文件，行在侧栏高亮）或侧栏内联**、提交历史（带提交图、分支/标签装饰、分页）、`git worktree` 管理（列表/新建/删除/清理，删除前 dirty 守卫与补丁导出）。只在本机绑定下注册、写操作要求同源，且完全不联网（无 fetch/pull/push） |

## DSH 版本兼容（0.1.7 破坏性变更）

DSH 0.1.7 移除了「插件自己注册设置命名空间」这套 API，本仓库的插件已按新模型迁移：

| 旧（≤ 0.1.6） | 新（0.1.7+） |
|---|---|
| 客户端 `inject: ['settingsScope']` + `ctx.settingsScope.bind({ namespace })` | `inject: ['configForms']` + `ctx.configForms.get('<条目 id>')`（快照形状与 `subscribe`/`set` 未变） |
| 宿主 `ctx.settings.register(ns, Config, { validate })` | 插件的 Loader 条目 `Config` schema，可编辑字段标 `.volatile()`；宿主写入走 `ctx.configEditor.edit()`，宿主响应变更走 `ctx.on('loader/volatile-update', …)` |
| 数据存 `$DSH_HOME/settings.yaml` | 数据存 profile 补丁 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` |

两条容易踩的坑，改插件前务必知道：

1. **不要写 `export default apply`。** `cordis-plugin-loader` 的 `unwrapExports()` 遇到 default 会把整个模块命名空间丢掉，同级的具名 `Config` / `inject` 一起失效 —— 条目就再也读不到 volatile 字段，客户端 `configForms.get()` 会一直停在 `unavailable`。用官方的 `export { Config, apply, inject }` 形式（模块命名空间对象本身就是合法的 plugin entrypoint）。
2. **`@deepseek-ai/schemastery` 必须是 `~3.18.4`**（`.volatile()` 从 3.18.4 才有，DSH 0.1.7 自带的正是这个版本）。插件的本地 `node_modules` 会优先于 DSH 自带的那份，低版本会让插件在 import 阶段就抛 `TypeError: z.…volatile is not a function`。

## 安装

每个插件均为独立的 DSH Profile Bundle。在**本仓库根目录**执行：

```bash
# 安装 Web Auth（账号密码登录，首次启动网页端引导创建账户；服务器部署见插件 README）
dsh plugin --profile web add ./dsh-web-auth

# 安装 MCP & Skill Manager
dsh plugin --profile web add ./dsh-mcp-skill-manager

# 安装 Workspace Category Manager
dsh plugin --profile web add ./dsh-workspace-category-manager

# 安装 Run Env Manager（运行环境管理）
dsh plugin --profile web add ./dsh-run-env-manager

# 安装 Git Panel（侧边栏 Git：变更 / 历史 / 工作树）
dsh plugin --profile web add ./dsh-git-panel
```

安装后**重启 DSH Web Host 一次**以装载 profile bundle，然后刷新浏览器页面。

### 使用入口

- **MCP & Skill Manager**：`设置 → 插件 → MCP` 与 `设置 → 插件 → Skills`
- **Workspace Category Manager**：`设置 → 工作区分类`（侧边栏工作区区域直接呈现分类层级）
- **Run Env Manager**：右侧栏「+」→ 引导页的「运行配置」；全局开发环境在 `设置 → 插件 → 运行环境`
- **Git Panel**：右侧栏「+」→ 引导页的「Git 变更」（变更 / 历史 / 工作树三个子页）

> ⚠️ 插件的 Host / client 文件都直接位于各自目录，DSH 通过 profile 依赖解析它们。请保留整个目录，不要仅复制 `cordis.patch.yml`。

## 项目结构

```
.
├── dsh-web-auth/                  # HTTP 认证网关（用户名+密码登录 + 账户管理 + 可选主令牌）
│   ├── index.js                    # Host 端网关（webServer 最外层拦截）
│   ├── client.js                   # Web 设置页「认证」标签（账户管理）
│   ├── cordis.patch.yml            # Profile bundle 补丁
│   ├── scripts/validate.mjs        # 结构校验脚本
│   ├── scripts/hash-password.mjs   # 生成 scrypt 密码哈希（手写设置文件用）
│   └── scripts/smoke.mjs           # 端到端冒烟测试（HTTP + WebSocket + 设置）
├── dsh-mcp-skill-manager/          # MCP & Skill 统一管理器
│   ├── index.js                    # Host 端逻辑
│   ├── client.js                   # Web 设置页 client
│   ├── cordis.patch.yml            # Profile bundle 补丁
│   ├── examples/                   # 配置示例
│   ├── skills/                     # 插件自带的 Skill
│   └── scripts/validate.mjs        # 结构校验脚本
├── dsh-workspace-category-manager/ # 工作区分类管理器
│   ├── index.js
│   ├── client.js
│   ├── cordis.patch.yml
│   └── scripts/validate.mjs
├── dsh-run-env-manager/            # 运行环境管理器（宿主 src/host + 浏览器 src/client，esbuild 打包）
│   ├── index.js                    # Host 端插件入口（Config / apply / inject）
│   ├── src/host/                   # 环境探测、运行实例、HTTP 路由、AI 工具
│   ├── src/client/                 # 右侧栏「运行」页与设置页
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── tests/                      # 契约 / 环境 / Tomcat / ANSI 解码
│   ├── cordis.patch.yml
│   └── scripts/{build-client,validate}.mjs
├── dsh-git-panel/                  # 侧边栏 Git 面板（同一个 src/host + src/client + esbuild 结构）
│   ├── index.js                    # Host 端插件入口（Config / apply / inject）
│   ├── src/host/                   # git 进程、状态/差异/历史/worktree 解析、HTTP 路由
│   ├── src/shared/                 # 宿主与浏览器共用的纯逻辑（变更语义、目录树、提交图泳道）
│   ├── src/client/                 # 右侧栏「Git」页（变更 / 历史 / 工作树）+ 中间列差异页
│   ├── lib/client.js               # 构建产物（pnpm run build）
│   ├── tests/                      # 解析 / 泳道 / 契约 / 目录树 / 产物契约 / 渲染交互 / 真实 git / 路由
│   ├── cordis.patch.yml
│   └── scripts/{build-client,validate}.mjs
└── .gitignore
```

## 开发与验证

```bash
# 安装依赖（任一插件目录）
cd dsh-web-auth                     # 或 dsh-mcp-skill-manager / dsh-workspace-category-manager
pnpm install --ignore-scripts

# 校验插件结构
node ./scripts/validate.mjs

# 语法检查
node --check ./index.js
node --check ./client.js   # web-auth 为纯 Host 插件，无 client.js
```

`dsh-run-env-manager` 与 `dsh-git-panel` 是「宿主 + 浏览器」两半的插件，流程多了打包
与更完整的测试：

```bash
cd dsh-git-panel            # 或 dsh-run-env-manager
pnpm install --ignore-scripts
pnpm run build              # esbuild 打包 src/client → lib/client.js
pnpm test                   # 8 个测试文件 / 377 条断言
pnpm run typecheck          # tsc --noEmit
pnpm run validate           # 脚手架约定 + i18n key 完整性 + 样式同名类冲突回归断言
pnpm run preview            # 生成 README 截图用的独立渲染 HTML（仅 dsh-git-panel）
```

各插件的详细功能、安全边界与数据形式，请参见对应目录下的 `README.md`。

浏览器侧的界面约定：右侧栏面板的骨架照宿主内建「文件」页的尺寸来（头部 38px、
左内边距 16px、`.5px solid var(--dsw-alias-border-l3)` 分隔线；列表 8px + 行内 10px；
面板内页签 13px/500、选中 `state-business-primary` 2px 下划线）。`dsh-git-panel` 与
`dsh-run-env-manager` 都遵循这份尺寸，三个页签并排看是齐的；样式里同名类被定义两套会被
`validate.mjs` 拦下。

## 安全说明

- `dsh-web-auth` 为认证网关：未授权请求不会触达 DSH 内部路由；自身不做 TLS（DSH Web 仅 HTTP），面向不可信网络的部署请叠加 HTTPS 反向代理；密码只存 scrypt 哈希，账户写入设置文档。无账户时网关不启用（显示初始化引导页）。
- `dsh-mcp-skill-manager` 的外部 Harness 导入接口仅在 DSH Web 绑定 `127.0.0.1` 时启用；导入时会丢弃明文秘密，仅识别环境变量引用。
- `dsh-workspace-category-manager` 为非破坏性插件，不会创建、移动、重命名或删除任何项目目录与会话。
- `dsh-git-panel` 只在本机绑定时注册接口：写操作要求同源 `Origin`，ref/hash/路径都过语义护栏，
  破坏性操作（放弃改动、删除未跟踪文件、强制删除 worktree、`amend`）都要二次确认；
  插件不提供 fetch/pull/push，因此不接触任何凭据、不产生网络流量。

## License

MIT
