# 把多个插件整合成「一个插件 + 子插件」并在插件页配置（可行性调研 + 落地方案）

调研对象：本机 DSH 0.1.7-rc.2（`G:/nodejs/node_global/node_modules/@deepseek-ai/dsh/`）。
下文用 `R` 代表 `G:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`。
页面渲染细节见 [`notes-plugin-page-ui.md`](./notes-plugin-page-ui.md)（同一目录，含逐条行号证据）。

## 0. 结论

**可以，而且这正是 DSH 官方设计的用法，不是绕路。**

- **卡片单位 = 一个「组合包（bundle）」= 一个带 `dsh.bundle.patch` 的、进入 profile `dependencies` 的 npm 包。**
  截图中「已安装 9」= profile 依赖里的 9 个组合包（`listBundles` 只枚举 `selected ∪ profile.dependencies ∪ 安装自带依赖`，R/dsh-plugin-manager/lib/index.js:1456-1530）。
- **子插件 = 该组合包 patch 里 `insert` 的每一条 Loader 行。** 打开卡片 → 组合包详情页：完整包名、总开关、自定义配置区、**行列表**（每行一个开关，注册后还能有「配置」）。
- 官方就是这么干的，两个现成范例：
  - `@deepseek-ai/dsh-experimental-agent-team-profile`（卡片「智能体团队」）：`dependencies` = `dsh-experimental-agent-team`(host) + `dsh-experimental-tool-agent-team`(工具) + `dsh-experimental-client-ui-agent-team`(浏览器半区)，`cordis.patch.yml` 里 3 条 row + 4 条对内置行的 `disabled` 覆盖。
  - `@deepseek-ai/dsh-experimental-voice-input-bundle`（卡片「语音输入」）：纯配置包，4 条 row 指向 4 个依赖包，`plugins.bundle.config` 由 companion 客户端包注册。
- **配置能放在该页**：三个 slot —— `plugins.item`（官方分组）/ `plugins.bundle.config`（键 = 组合包包名，画在组合包页）/ `plugins.row.config`（键 = `<包名>#<行 id>`，那一行多出一个「配置」，打开该行自己的页面，宿主直接把 `form`（= 0.1.7 的 `configForms.get(行 id)`）注入给你）。

代价与硬约束（详见 §4）：**想只显示一张卡，就只让合集包进 profile 依赖**，其余子插件改为它的 dependencies（pnpm 传递依赖不上页面）；**页面没有多层树**，只有「卡片 → 行」一跳；**客户端半区只挂在「行名恰好等于包名」的那一行**。

## 1. 页面模型（对照截图）

```
侧栏「插件」面板                      R/dsh-client-ui-plugin-manager          ← 截图这一页
├─ 官方 N（optional && !installed）   安装自带、默认关闭、不可卸载的组合包 + 注册了 plugins.item 的官方插件
├─ 已安装 N（installed || !optional） profile 依赖持有的组合包（每个包一张卡）
└─ 卡片 → 组合包详情页
   ├─ 标题 / 图标 / 完整包名 / 启停开关（setBundleEnabled → 写 profile manifest 的 dsh.profile.bundles）
   ├─ plugins.bundle.config（键 = 包名）         ← 合集级自定义配置
   ├─ 行列表（每行 = 组合包 patch 的一条 insert）
   │   ├─ 行开关（setPluginEnabled → 往 profile 的 cordis.patch.yml 写 `- id: <行id>, disabled: true`）
   │   └─ 「配置」（仅当有客户端插件注册了 plugins.row.config）→ 行页：标题/描述/包名/行 id + 表单 + 保存
   ├─ plugins.detail.actions / badge / section（任意插件给该页加东西）
   └─ 卸载（仅 profile 自己装的包）

设置 → 「内置插件」分区               R/dsh-client-ui-settings-plugins        ← 另一个界面，别混淆
└─ 页签来自 settings.plugins.tab；出厂只有一个「插件列表」页签（只读清单，无开关）
```

要点：

| 事实 | 依据 |
|---|---|
| 分组由两个布尔位过滤，不是 package.json 里的分组 | 页面 `listed/mine/official`（R/dsh-client-ui-plugin-manager/lib/client.js:2720-2722） |
| `installed` = profile 依赖持有；`optional` = 安装自带 | R/dsh-plugin-manager/lib/types/types.d.ts:55-59、lib/index.js:1470 |
| 传递依赖**不会**变成卡片 | `listBundles` 的 names 只取 selected ∪ profile deps ∪ installation deps（lib/index.js:1460-1466） |
| 卡片标题/描述/图标来自 Host 读取的 `PluginLocalizedMeta`：先读 `<specifier>/locale/<lang>.json` 的 `meta`，缺失回退该地址可访问的 `package.json` 的 name/description/icon | R/dsh-app-boot/lib/index.js:1968-2005（`readPluginMeta`）、lib/index.js:1493 |
| 行也有同样的 `meta`（行标题缺失时回退模块名） | lib/index.js:1888（`packages?.metaOf(row.name, base)`） |
| 「实验性」标签由包名前缀 `@deepseek-ai/dsh-experimental-` 推导，不能自己标 | client.js:198-204、:1681-1684 |
| 行开关只在组合包已启用时出现；无活条目 / Host 无法通过 profile patch 寻址的行被锁定 | R/dsh-client-ui-plugin-manager/README.zh.md「切换组合包里的一行」 |
| 行开关写的是 **profile 的 `cordis.patch.yml`**，不是合集的 patch | R/dsh-plugin-manager/lib/types/patch.js:13 |

## 2. 配置挂载（0.1.7 没有「插件自注册设置命名空间」这回事了）

一个 `plugins.row.config` 条目长相（README.zh.md 官方示例改写成含表单）：

```js
ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
  name: 'plugins.row.config',
  key: 'dsh-suite#git-panel',        // <组合包包名>#<patch 里声明的行 id>
  locale: NS,
}, ({ t, view, form }) =>
  view === 'summary'
    ? t('gitPanel.summary')          // 行没有包描述时用它当一句话简介
    : React.createElement(GitPanelForm, { t, form })))
```

- `form` = `{ state, mutate(operations, expectedRevision) }`，由页面宿主注入，**只有当该行条目的 namespace 出现在 `ctx.configForms.describe()` 时才有值**（client.js:2687-2695）。也就是：**行模块必须导出 `Config` schema，可编辑字段标 `.volatile()`**，免重启写回走 `configEditor` + `loader/volatile-update`（R/dsh-settings/lib/index.js:505-507、R/cordis-plugin-loader/lib/index.js:380-420）。这套东西你们 0.1.7 迁移时已经在用，只是把表单从 `settings.plugins.tab` 搬到行页即可。
- `plugins.bundle.config` 的条目**不会被注入 `form`**（页面调用 `renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })`，client.js:1973）。合集级页面想读写配置，自己 `inject: ['configForms']` 然后 `ctx.configForms.get('<锚点行的 id>')`（官方 voice-input 的 Bundle 详情就是这么保存「识别器和语言」），或者调合集自己 host 半区的 remote 方法。
- 页面自带标题、图标、面包屑，只管画表单和保存控件；离开页面丢弃暂存修改。
- `plugins.item` 是给「官方」分组的插件用的（出厂四个宿主机平面配置页占着），合集别用它。

## 3. 推荐落地方案：合集包（umbrella bundle）

新增一个包，只让它进 profile 依赖；其余 7 个包原样保留（可继续单独安装）。

```
dsh-suite/                          # 唯一进 profile 依赖的包 = 截图里唯一一张新卡片
├─ package.json                     # name/version/icon；dsh.bundle.patch；dsh.client → ./client；dependencies = 7 个子包
├─ cordis.patch.yml                 # 1 条锚点行 + 7 条子插件行
├─ index.js                         # host 半区（可空，或放合集级服务/健康检查）
├─ lib/client.js                    # 浏览器半区：plugins.bundle.config + plugins.row.config ×7
├─ locale/en.json / locale/zh.json  # 卡片标题/描述（meta.title/description）
└─ node_modules / pnpm-lock…        # 按你们现有构建约定
```

`cordis.patch.yml`：

```yaml
- insert:
    # 锚点行：name 必须恰好等于合集包名，否则合集的浏览器半区不会被挂载
    - id: dsh-suite
      name: dsh-suite
    # 子插件行：id 与各子插件自己的 SETTINGS_NAMESPACE / configForms 命名空间保持一致
    - id: git-panel
      name: dsh-git-panel
    - id: run-env-manager
      name: dsh-run-env-manager
    - id: workspace-category-manager
      name: dsh-workspace-category-manager
    - id: mcp-skill-manager
      name: dsh-mcp-skill-manager
    - id: web-auth
      name: dsh-web-auth
    - id: win-notify
      name: dsh-win-notify
    - id: oneway-usage-monitor
      name: dsh-oneway-usage-monitor
```

`package.json` 关键字段：

```jsonc
{
  "name": "dsh-research-suite",
  "version": "0.1.0",
  "icon": "./icon.svg",
  "dependencies": {
    "dsh-git-panel": "link:../dsh-git-panel",
    "dsh-run-env-manager": "link:../dsh-run-env-manager"
    // … 其余同理；发布到 registry 时换成版本号
  },
  "exports": { ".": "./index.js", "./client": "./lib/client.js", "./package.json": "./package.json", "./locale/*.json": "./locale/*.json" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-slots"] } }
}
```

安装：`dsh plugin --profile web add ./dsh-suite`（`dsh plugin` 的 path spec 要求绝对路径时请用绝对路径），重启一次，刷新页面 → 「已安装」里多出**一张**卡片，点开就是 7 条子插件行。

### 为什么这样能成

1. **只有合集进 profile 依赖**：`listBundles` 不枚举传递依赖，7 个子包不会各出一张卡。
2. **子包仍能被解析**：启动时会为 profile 组合包构建依赖闭包链接（`collectProfileScopePackages`/`dependencyClosure`，R/dsh-app-boot/lib/index.js:780-820），所以 patch 里的 `name: dsh-git-panel` 这类裸包名能 import，且各子包的 `dsh.client` 浏览器半区照常挂载（`dsh-client-modules` 扫描活条目）。
3. **子包保留自己的 `dsh.bundle.patch` 也无害**：合集是传递依赖时它们的 patch 不参与组合（只有 profile 的 `dsh.profile.bundles` 会被应用），所以「既能整装、也能单装」。
4. **子插件的开关/配置粒度不丢**：每行独立开关（写 profile patch 的 disabled 覆盖），每行独立配置页。

### 不建议的两条路

- **`group: true` 嵌套组**：`declaredRows` 会把组的子行 `flatten` 成同级行（R/dsh-plugin-manager/lib/index.js:1101、:1865-1899），组行本身也会多显示成一行 —— 页面拿不到折叠树，反而多一行；而且行页取表单用的是**声明的 rowId**（`formFor(openRow.rowId)`），嵌套子的活条目 id 是 `group:child`，容易对不上。
- **单包 + 子路径行**（`name: 'dsh-suite/features/git'`）：能少几个包，但 `dsh-client-modules` 只对「裸包名 specifier」挂载浏览器半区（`exactPackageSpecifier`，R/dsh-client-modules/lib/index.js:77-88、:746），子路径行不挂 UI；且行 meta 要额外为每个子路径铺 `locale/<lang>.json`（`readPluginMeta` 读的是 `<specifier>/locale/...`）。除非你确实想消灭多包，否则不划算。

## 4. 坑与限制（务必先看）

1. **一包一卡**：只要某包进了 profile 依赖且声明了 `dsh.bundle`，它就一定有自己的卡片 —— 想「一张卡」就只能有一个这样的包。
2. **锚点行不能关**：合集的浏览器半区挂在 `name` 等于合集包名的那一行，关掉它 = 合集页和所有行配置页一起消失（R/dsh-client-ui-plugin-manager/README.zh.md 明确警告）。锚点行的 host 半区可以什么都不做（像 `dsh-client-ui-settings-plugins` 的空 `apply`）。
3. **行 id 必须唯一且稳定**：`configForms` 命名空间 = 行条目 id（`entry.options.id`），行页 key = `<包名>#<行id>`。保持现状（`git-panel` 等）迁移最省事；但如果同一子包可能被合集与独立安装同时挂载（同 id 两次 insert），要么换合集内的前缀 id 并同步子包的 `SETTINGS_NAMESPACE`，要么明确不支持「合集 + 单包子包」混装。
4. **只有 `.volatile()` 字段能免重启编辑**；非 volatile 字段改动会走重启/重载路径。
5. **`plugins.bundle.config` 没有注入 `form`**，合集级配置得自己接 `configForms` 或自己的 host remote。
6. **页面无多层折叠**：只有「卡片 → 行」。7 条行会平铺在组合包页（>10 行会出现筛选框）。
7. **「实验性」标签改不了**，只能靠 `@deepseek-ai/dsh-experimental-` 前缀。
8. **不要再注册 `settings.plugins.tab` 之外的入口做重复配置**：行页与设置里的表单会各写一份；要么搬过来，要么明确谁是主入口。
9. 卸载粒度：卡片级卸载只对 profile 自己装的包可用（合集可卸；子包是它的依赖，随合集卸载）。

## 5. 迁移清单（对照本仓库现有 7 个包）

| 步骤 | 动作 |
|---|---|
| 1 | 新增 `dsh-suite/`：`package.json`（`dsh.bundle.patch` + `dsh.client` + `dependencies: link:../…`）、`cordis.patch.yml`（1 锚点 + 7 行）、`index.js`（空 `apply` 即可）、`lib/client.js`、`locale/{en,zh}.json` |
| 2 | 各子包加 `locale/{en,zh}.json`（`{"meta":{"title":"…","description":"…"}}`）并在 `exports` 里加 `"./locale/*.json"` —— 卡片与行就有中文标题/描述，不再显示包名 |
| 3 | 各子包把现有 `settings.plugins.tab` 表单（`dsh-mcp-skill-manager/client.js:77`、`dsh-oneway-usage-monitor/client.js:711`、`dsh-web-auth/client.js:248` 等）改为 `plugins.row.config`（键 `dsh-suite#<行id>`），表单直接用宿主注入的 `form`；侧栏/右侧栏面板（git-panel、run-env-manager、workspace-category-manager）**不用动** |
| 4 | 合集 `lib/client.js` 注册一处 `plugins.bundle.config`（键 `dsh-suite`，画总览：每个子插件的状态 + 快捷跳转，或合集级全局选项） |
| 5 | `dsh plugin --profile web add <合集绝对路径>` → 重启 host → 刷新页面 → 检查：一张卡、7 行、行开关、行「配置」入口、保存后 profile 的 `cordis.patch.yml` 出现对应 `disabled`/`config` |
| 6 | 保留各子包自己的 `dsh.bundle.patch`（可单装），但在 README 注明「不要与合集混装」或给合集内 id 加前缀 |

## 6. 验证要点（改完后逐条核对）

- 页面「已安装」只多出合集一张卡；`dsh-suite` 打开后行的标题/描述是中文（locale meta 生效）。
- 关掉某一行 → 该子插件宿主半区卸下、其余行照常；profile 的 `cordis.patch.yml` 出现 `- id: <行id>, disabled: true`。
- 某一行的「配置」出现且能保存；保存后重启仍生效（`configEditor` 写回 profile patch）。
- 关掉整张卡 → 所有行与配置页消失；再打开恢复。
- 单独 `dsh plugin add ./dsh-git-panel` 的旧路径仍然可用（若明确不支持混装，则此条改为「文档化不支持」）。

---

## 7. 实际落地方案（2025-09-28 实施记录）

本节记录**真实实现**与本设计稿的差异——设计稿当时推荐的是官方 `plugins.bundle.config` / `plugins.row.config`
（侧栏「插件」面板里的卡片与行页），实际按需求方选择改成了另一条路线：

| 维度 | 设计稿（§3） | 实际实现 |
|---|---|---|
| 包名 | `dsh-suite` | `dsh-plugin-kit` |
| 配置界面 | 侧栏「插件」卡片 → 行页（`plugins.row.config`） | **设置 → 新增独立分区「插件合集」**（`settings.section` id `plugin-kit`，order 18） |
| 页签来源 | 框架的行页机制 | 合集在分区上声明 list 子槽 `settings.pluginKit.tab`，子插件把设置页注册进去 |
| 子插件改动 | 各子包把 `settings.plugins.tab` 搬到 `plugins.row.config` | 各子包用**双态注册器**：合集槽在场 → 注册到合集槽；缺席 → 退回原入口 |

实际交付：

- `dsh-plugin-kit/`：`cordis.patch.yml`（锚点行 + 7 子插件行）、空 `Config` 的 host 半区、
  浏览器半区（分区 + 页签栏 + `renderSlot('settings.pluginKit.tab', {}, { only: id })`）、
  `locale/{zh,en}.json`、`scripts/{build-client,validate}.mjs`。
- profile 接线：`dependencies` 只留 `dsh-plugin-kit`（7 个子包成为它的 `link:../…` 依赖），
  `dsh.profile.bundles` 里 7 个子插件换成合集。`dsh --profile web --dump-config` 验证组合结果：
  1 个合集块 + 8 行、7 个子插件行的 config 仍按行 id 生效。
- 子插件新增 `src/client/kit-tab.{mjs,ts}`（git-panel 在 `src/shared/`）：约 25 行的双态注册器。
  **两个必须记住的坑**（都踩过并写了回归测试）：
  1. `ctx.slots.subscribe(key, fn)` 订阅时**不会**立刻回调 → 订阅后必须同步跑一次判定，
     否则「合集先加载、子插件后加载」时页签永远不出现；
  2. 状态要用**显式 mode**，不能用 `Boolean(dispose)` 当守卫：合集缺席时 dispose 也是 `undefined`，
     守卫会把「还没注册」误判成「已注册」，`fallback()` 永不执行（而它的唯一触发时机就是首次判定）。
     回归测试：`dsh-git-panel/tests/kit-tab.test.js`（真实 SlotCore 驱动，6 个场景 15 条断言）。
- 顺带修掉一个真实缺陷：`dsh-web-auth` 的 schema 之前导出名是 `SettingsConfig`，
  Loader 只认 `Config`，导致该条目没有 schema、宿主 `config.users.get()` 直接 TypeError
  （`scripts/smoke.mjs` 的既存失败就是它的症状）。

`research/notes-plugin-page-ui.md` 里关于「设置 → 内置插件」分区与 `settings.plugins.tab` 的结论仍然成立，
只是本实现没有再往那个分区里塞页签（避免与出厂「插件列表」页签混在一起）。

### 实施后的调整：web-auth 已移出合集

落地后按需求方要求把 `dsh-web-auth`（HTTP 认证网关）从合集里摘掉：合集的 `cordis.patch.yml`
从 8 行减到 7 行，`package.json` 去掉该 link 依赖，profile 依赖树与补丁行同步清理，插件目录移到
仓库外的 `../removed-plugins/`（保留可恢复副本）。原因：合集把 `web-auth` 带上线后，profile 补丁里
原本静默的 `web-auth` 行（含 admin 账户）立刻生效，浏览器访问先撞认证网关；该插件当前不需要。

顺带记录一条本次学到的 patch 语义：**给 profile 补丁里已有的行加 `disabled: true` 是有效的**，
但它作用于 Loader 行、不会卸载已经挂上的服务——`web-auth` 的网关在 disable 之后仍然拦截请求，
必须重启 host（或卸载该行）才消失。所以「临时关掉一个会拦截请求的行」要么重启，要么直接删行。

### 另一个真机才暴露的坑：`ctx.slots.spec` vs `specDynamic`

浏览器端到端验证（`research/verify-suite.mjs` + CLI 专用实例）抓到一条只有真机才暴露的问题：
**插件拿到的 `ctx.slots` 是 `@deepseek-ai/dsh-client-ui-renderer` 的 SlotRegistry，不是纯 SlotCore。**
SlotRegistry 对外只实现 `spec / subscribe / getVersion / entries / register / inject`；
`specDynamic`、`declarationEpoch`、`entriesOfSlot` 只在内部 `_core`（SlotCore）上。
子插件用 `ctx.slots.specDynamic?.(slot) !== undefined` 判定「合集槽是否已声明」时，
因为 SlotRegistry 没有这个方法，可选链直接得到 `undefined` —— 于是**永远走 fallback**，
表现就是：合集分区渲染出来了，但一个页签都没有，而各插件的设置页仍留在原入口。

修正：统一改用 `ctx.slots.spec(key)`（SlotRegistry 有实现，真实 SlotCore 也有）。
配套注意：单元测试的槽替身必须跟着改成 `spec`，否则替身会「支持」一个生产环境不存在的 API，
测试照样全绿却掩盖真实缺陷（这正是 review-suite 点名过的桩风险）。

验证结果（CLI 实例 + 无头 Chrome）：
- boot 清单：合集锚点 + 6 个子插件行各一次，`web-auth` 已移除；
- 设置侧栏导航：`工作区分类`、`全局开发环境` 两个已迁移分区不再占顶层入口；
- 「插件合集」分区：7 个页签 = 工作区分类 / 全局开发环境 / MCP / Skills / OneWay 用量 / Git 面板 / 会话通知，无空白页签，面板内容正常；
- 插件页「已安装」只有 dshmarket / 智能体团队 / 插件合集三张卡，6 个子插件不再各自出卡；
- 控制台无槽声明/守卫类报错。
