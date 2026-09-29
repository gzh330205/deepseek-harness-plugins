# dsh-plugin-kit —— 插件合集

把一组 DSH 插件的设置页收拢到**一个** Settings 分区「插件合集」里的宿主插件。
装它一个包，profile 里一次性进 7 行：合集自己 + 6 个子插件。

- **host 半区**（`index.js`）：空实现。`Config = z.object({})`，没有字段、不提供服务，
  存在的唯一理由是让 Loader 有 `dsh-plugin-kit` 这一行可挂。
- **client 半区**（`lib/client.js`，源码 `src/client/index.js`）：注册 Settings 分区
  「插件合集」（`settings.section`，id `plugin-kit`，order `18`），并在它下面声明一个
  list 子槽 `settings.pluginKit.tab`，然后渲染页签栏 + 当前激活面板。
- **`cordis.patch.yml`**：一个 `insert`，7 行 Loader 行。

合集**不**注册 `settings.plugins.tab`，不和 DSH 自带的「内置插件」分区抢同一块配置面。

## 合集与子插件的关系

```
设置 → 插件合集（本插件提供的唯一入口）
         ├── 页签：Git            ← dsh-git-panel
         ├── 页签：MCP / Skills   ← dsh-mcp-skill-manager（2 个 tab）
         ├── 页签：工作区分类      ← dsh-workspace-category-manager
         ├── 页签：运行环境        ← dsh-run-env-manager
         ├── 页签：OneWay 用量     ← dsh-oneway-usage-monitor
         └── 页签：会话通知        ← dsh-win-notify
```

唯一的契约就是那个槽名 **`settings.pluginKit.tab`**：

- 合集侧：`children: { 'settings.pluginKit.tab': { kind: 'list', scope: 'root' } }`
  声明它，`renderSlot('settings.pluginKit.tab', {}, { only: id })` 渲染它；
  页签行按 `entry.options.order` 升序排列（同一 order 保持注册顺序）。
- 子插件侧：合集在场时把设置页注册进这个槽；合集缺席时退回自己原来的入口
  （`settings.section` 或 `settings.plugins.tab`）。子插件通过
  `ctx.slots.spec('settings.pluginKit.tab')` 判断合集是否声明了这个槽。

  ⚠️ **必须用 `spec`，不能用 `specDynamic`**：客户端 slots 服务是
  `@deepseek-ai/dsh-client-ui-renderer` 的 SlotRegistry，对外只实现
  `spec / subscribe / getVersion / entries / register / inject`；
  `specDynamic`、`declarationEpoch` 挂在内部 `_core`（SlotCore）上，插件拿到的
  是 SlotRegistry，调 `specDynamic` 只会得到 `undefined` —— 结果是「槽永远没声明」，
  所有子插件都走 fallback。本仓库的浏览器端到端验证（`research/verify-suite.mjs`）
  就是被这一条坑住的。

槽名是硬契约，任何一侧改名都会让另一侧的页签凭空消失。子插件不是非装不可：
合集在没有任何页签贡献时会渲染一句「本部署没有可用的插件配置页。」。

## 安装

```bash
# 只装合集 = 7 行一起进 profile（合集通过 link:../<目录名> 依赖 6 个子插件）
dsh plugin --profile web add ./dsh-plugin-kit
```

装完 `~/.dsh/profiles/<profile>/cordis.patch.yml` 里会多出这一段（id / name 一一对应）：

```yaml
- insert:
    - id: dsh-plugin-kit          # 锚点行
      name: dsh-plugin-kit
    - id: git-panel
      name: dsh-git-panel
    - id: run-env-manager
      name: dsh-run-env-manager
    - id: workspace-category-manager
      name: dsh-workspace-category-manager
    - id: mcp-skill-manager
      name: dsh-mcp-skill-manager
    - id: win-notify
      name: dsh-win-notify
    - id: oneway-usage-monitor
      name: dsh-oneway-usage-monitor
```

### 锚点行不能关

第一行 `dsh-plugin-kit` 是**锚点行**：

1. 合集自己的 host 半区和浏览器半区都挂在这一行上——禁用或删掉它，整个「插件合集」
   分区连同全部页签一起消失；
2. 每个 `name` 必须是**裸包名**（`dsh-git-panel`），不能写成 `./dsh-git-panel`。
   客户端半区只挂到 `name` 恰好等于裸包名的行上（判定见
   `@deepseek-ai/dsh-client-modules/lib/index.js` 的 `exactPackageSpecifier`），
   写成相对路径时 host 半区照旧能起来，但浏览器半区不会加载，页面会静默地少功能。

`id` 是各插件的**设置命名空间**：0.1.7 起 Loader 行的 id 就是设置命名空间，也必须与子插件
host 半区的 `SETTINGS_NAMESPACE` 一致（`git-panel` / `run-env-manager` /
`workspace-category-manager` / `mcp-skill-manager` / `win-notify` /
`oneway-usage-monitor`）。改 id 会让子插件读不到自己的配置。

### 只进 profile 依赖

合集自身不进任何全局安装目录；6 个子插件用 `link:../<目录名>` 指向同级目录，因此
**合集目录必须和 6 个子插件目录并排放在同一个仓库里**。单独把 `dsh-plugin-kit/`
拷走会解析不到 link 依赖。

## 本地开发

```bash
pnpm install                 # link: 依赖 + esbuild
node ./scripts/build-client.mjs   # src/client/index.js → lib/client.js
node ./scripts/validate.mjs       # 文件/manifest/patch 行/locale/产物/客户端契约
node --check index.js
node --check lib/client.js
```

`lib/client.js` 是**生成物**：改行为请改 `src/client/index.js` 后重新打包，不要手改产物。
打包走 DSH 的 module-table 契约（`window.__ModuleLoader__.load({ id, factory })`，
`react` external），客户端半区没有 JSX 转译，所有元素都用 `React.createElement` 构造。

`scripts/validate.mjs` 除了静态检查，还会在 `node:vm` 里用 stub React 真正跑一遍客户端契约：
注册的分区 id/order/children、`getSnapshot` 的排序与引用稳定性、empty 文案、
tablist/aria-selected/roving tabindex、键盘导航、`renderSlot(..., { only })` 的调用参数，
以及「未激活但访问过的面板保持挂载且 `hidden`」。它**不**覆盖真实浏览器里的视觉效果。

## 已知边界

- 页签的激活态只存在浏览器内存里，刷新回到第一个页签（与 DSH 自带「内置插件」分区一致）。
- 同一 id 的子插件页签如果被注册两次，list 槽会抛错；子插件在合集槽与回退槽之间必须
  二选一，不能同时注册。
- 合集不接管子插件的 host 半区：路由、Config、SETTINGS_NAMESPACE 都留在各自包里。
