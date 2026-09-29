# Web GUI「设置 → 插件」页面渲染与配置机制（源码调研）

只读调研。所有路径以 `R = G:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/` 为前缀；行号取自构建产物（`lib/client.js`、`lib/*.d.ts`），无 TS 源码。

**先厘清两个不同的界面**（这是理解该页面的关键）：
- **侧栏「插件」面板** = `R/dsh-client-ui-plugin-manager`。这就是截图里带 **官方 N / 已安装 N** 分组、每行 icon+标题+描述+开关、右上「添加插件」按钮的页面。
- **设置里的「内置插件」分区** = `R/dsh-client-ui-settings-plugins`（`settings.section` id `plugins`，nav 文案 `内置插件`）。它只提供**导航入口 + 标签栏外壳**，页签内容来自 `settings.plugins.tab` list slot；出厂只注册一个页签「插件列表」（`R/dsh-client-ui-settings-plugin-inventory`，**只读**，无开关）。
- 截图里的「插件 / 内置插件」不是同一个 tab bar 的两个 tab：`插件` 是侧栏面板名（`R/dsh-client-ui-plugin-manager/lib/client.js:2978` `panel: "插件"`，注册进 `sidebar.panellist`，`:3485-3491`），`内置插件` 是设置分区名（`R/dsh-client-ui-settings-plugins/lib/client.js:143` `nav: "内置插件"`）。真正的 tab bar 是 `settings.plugins.tab`，见 Q8。

---

## 1. 渲染列表行的组件与数据模型

列表行 = 每包一张卡片，组件 `PackageCard`（`R/dsh-client-ui-plugin-manager/lib/client.js:1668-1703`）：

```js
function PackageCard({ pkg, t, resolveText, busy, highlighted, onOpen, onSetEnabled }) {
  const { title, description, beta } = packageText(pkg, resolveText);
```
卡片头由 `CardHead`（`:1608-1642`）画 icon / 标题按钮 / 标签 / 描述 / 尾部件，尾部件是 `EnableSwitch`（`:1593-1601`）；`PackageArtwork`（`:1420-1432`）渲染 `pkg.meta?.icon` 的 data URL，解码失败回退默认插画。官方内置插件卡片是同构的 `ItemCard`（`:1708-1720`）。**包内每一行**由 `RowsSection` 渲染（`:1469-1588`），开关是 `RowSwitch`（`:1434-1443`）。

数据模型（`R/dsh-client-ui-plugin-manager/lib/types/client/manager-store.d.ts`）：

```ts
export interface PackageView {          // :64-81
    readonly name: string; readonly version?: string; readonly description?: string;
    readonly meta?: PluginLocalizedMeta;
    readonly installed: boolean;
    /** Whether the installation ships the bundle for the person to switch on: official, off until selected, never removable. */
    readonly optional: boolean;
    readonly enabled: boolean;
    readonly readOnlyReason?: ReadOnlyReason; readonly error?: ManagementError;
    readonly rows: readonly PackageRow[]; }
export interface PackageRow {           // :47-62
    readonly entryId?: PluginEntryId; readonly rowId: string; readonly moduleName: string;
    readonly meta?: PluginLocalizedMeta; readonly enabled: boolean;
    readonly phase: PluginInfo['fiberPhase']; readonly readOnlyReason?: ReadOnlyReason; }
```
`插件.item` 卡片另有 `{ id, label }`（`:57-61` 的 ledger 投影）。**没有 `children`/`experimental`/`configurable` 字段**：实验性由名字前缀推导（见 3），可配置性来自 slot 账本（见 6）。

## 2.「官方」与「已安装」从哪来

不是 package.json 分组，而是 Host 清单响应里的两个布尔位在页面里过滤出来的（`lib/client.js:2720-2722`）：

```js
const listed = state.packages.filter((pkg) => !BUILTIN_PROFILE_BUNDLES.has(pkg.name) && (pkg.installed || pkg.optional || pkg.error !== void 0));
const mine = listed.filter((pkg) => pkg.installed || !pkg.optional);
const official = listed.filter((pkg) => pkg.optional && !pkg.installed);
```
分组渲染（`:2906-2907`）：`renderGroup("official", t("officialTitle"), officialCards)` / `renderGroup("bundles", t("bundlesTitle"), mine.map(packageCard))`，DOM 标记 `data-plugin-group="official"|"bundles"`、`data-plugin-count`（`:2772-2790`）。文案（zh，`:2990-2991`）：`bundlesTitle: "已安装"`、`officialTitle: "官方"`（en `:3179-3180`: `"Installed"` / `"Official"`）。

语义（Host 侧 `R/dsh-plugin-manager/lib/types/types.d.ts:55-59`）：`optional` =“安装随附、供人开启、不可卸载”；`R/dsh-plugin-manager/lib/index.js:1470` `const optional = OPTIONAL_BUNDLES.includes(name);`，`installed` = profile 自己的依赖持有。即：**「已安装」= profile 依赖里的组合包，「官方」= 安装随附但默认关闭的组合包（外加注册了配置页的官方插件卡片）**。

## 3. 标题 / 描述 / 图标 / 实验性 的来源

`meta` 是 Host 端读出的 `PluginLocalizedMeta`（`R/dsh-package-manifest/lib/types/types.d.ts:43-53`：`title`/`description` 为 `LocalizedText`、`icon` 为 base64 data URL、`error` 为元信息诊断），页面对它做本地化与回退（`lib/client.js:198-204`）：

```js
function packageText(pkg, resolveText) {
  return { title: pkg.meta?.title === void 0 ? pkg.name : resolveText(pkg.meta.title),
    description: pkg.meta?.description === void 0 ? void 0 : resolveText(pkg.meta.description) || void 0,
    beta: pkg.name.startsWith("@deepseek-ai/dsh-experimental-") }; }
```
行用 `rowText`（`:211-216`，标题回退到 `row.moduleName`）。实验性标签：`PackageCard` 中 `beta ? <Tag tone="info">{t("statusBeta")}</Tag>`（`:1681-1684`，`statusBeta: "实验性"`）。
Host 读取器：`R/dsh-app-boot/lib/types/package-meta.d.ts:24` `readPluginMeta(specifier, parentURL): PluginLocalizedMeta | undefined`（“Read localized display text and the icon declared in a plugin's exported package.json … Missing fields use the same address's package.json name/description”）；组合包用它（`R/dsh-plugin-manager/lib/index.js:1493`），行与清单条目用 `packages?.metaOf(...)`（`R/dsh-plugin-manager/lib/index.js:1888`、`R/dsh-host-plugin-inventory/lib/index.js:127`）。README 补充：先读导出的 locale `meta`，缺失回退 `package.json`——**未见 README front-matter `kind:` 参与渲染**。

## 4. 开关实际控制什么

**两套粒度都有**，是两个不同 Remote 调用：

- 组合包开关 `EnableSwitch` → `props.setEnabled` → `setEnabled: (packageName, enabled) => … await this.ctx.remote.pluginManager.setBundleEnabled(packageName, enabled)`（`lib/client.js:641-647`）。Host：`setBundleEnabled` → `selectBundle`（`R/dsh-plugin-manager/lib/index.js:1670-1677`），写 profile manifest 的层列表：`manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles } }`（`:1994-2001`）。
- 行开关 `RowSwitch`（只在打开的组合包页出现，`PackageDetail` `:1975-1984` 仅在 `pkg.enabled` 时传 `toggle`）→ `setRowEnabled(entryId)` → `remote.pluginManager.setPluginEnabled(entryId, enabled)`（`lib/client.js:668-674`）。Host：`writePluginEnabled(this.profile.patchPath, row.patchId, row.moduleName, enabled)`（`R/dsh-plugin-manager/lib/index.js:1651-1662`），即写 `cordis.patch.yml` 里该 Loader 条目的 `disabled` override（`R/dsh-plugin-manager/lib/types/patch.js:13`）。

## 5. 嵌套 / 子行 / 折叠：**不支持**

- `RowsSection` 是扁平列表：一个 `<ul>` 下每行一个 `<li data-plugin-row=…>`，无展开态、无 `children`（`lib/client.js:1514-1584`）；`PackageRow` 定义里没有子行字段（`manager-store.d.ts:47-62`）。
- 卡片列表也是扁平 `<ul>{cards}</ul>`（`:2786-2789`），唯一“层级”是 **组合包 → 它的行**（一跳，靠打开组合包详情页实现），以及 `plugin-manager` 页面里 `plugins.row.config` 让某一行多出一个「配置」按钮跳转到该行自己的页面（`:1534-1547`）。行的父级关系止于“属于哪个组合包”。
- 只读清单页 `R/dsh-client-ui-settings-plugin-inventory/lib/client.js` 的 `PluginCard`（`:154-216`）有 `expanded`/`children` 展开，但展开的是**事实明细**（`CardFacts`），不是子插件；分组是 `会话插件 / 全局插件`（`:652-659`）且可用 group toggle 折叠（`:493-508`）。

## 6. 配置表单如何挂到该页

`PluginManagerPage` 的 `main` 注册声明了三个配置 slot（`lib/client.js:3440-3468`）：`plugins.item`(list)、`plugins.bundle.config`(keyed)、`plugins.row.config`(keyed)，另有 `plugins.detail.actions/badge/section`。契约（`lib/types/client/slot-contract.d.ts`）：

```ts
'plugins.item': { kind: 'list'; scope: 'root'; owner: PluginConfigViewProps; };            // :90-94
'plugins.bundle.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewProps; };   // :100-104
'plugins.row.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewProps; };      // :112-116
```
表单**内联在对象自己的页面上**（不是设置页签）：组合包页 `renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })`（`:1970-1974`，位于描述与行列表之间）；官方插件页用 `plugins.item` 的 `view: "page"`（`:1778-1784`）；行则打开独立行页 `RowDetail`，`renderSlot("plugins.row.config", { view: "page", form }, { entryKey: key })`（`:1852-1855`），key = `` `${bundle}#${rowId}` ``（`:27-29`）。
表单本体由页面宿主注入（`:2687-2695`）：只有 namespace 出现在 `ctx.configForms.describe()` 的 `view.namespaces` 里才给 `form = props.configForm(id)`，形状是 `ConfigPageForm = { state: ConfigFormSnapshot, mutate }`（slot-contract.d.ts:149-155）。`configForms` 服务面见 `R/dsh-client-ui-settings/lib/types/client/config-form.d.ts`：`describe()`(:137)、`get(entryId)`(:142)、`whileServed(namespaces, register)`(:156)，一个表单对应**一个 Host 设置 namespace**，写入走 `remote.settings` 并带 revision fence。
**运行时（免重启）可编辑的前提是 `volatile`**：Host 只放行 volatile 子树——`R/dsh-settings/lib/index.js:505-507` `const form = volatileForm(schema); if (form === void 0) throw … "has no volatile fields"; … throw new Error('Config field "…" is not volatile')`，判定函数 `volatileForm`(:120-135)、`isVolatilePath`(:151-157)，最终经 `this.ownerContext.configEditor.edit(entry, …)`(:508) 写回；`configEditor` 是 Host 服务（`R/dsh-config-editor/lib/types/index.d.ts`“…Persist complete raw configs and apply them through the normal Loader path”）。Loader 侧对“仅 volatile 变化”直接把值提交进运行中 fiber 引用并发事件：`R/cordis-plugin-loader/lib/index.js:380-382`、`:420` `fiber.ctx.emit(self, "loader/volatile-update", paths);`（事件类型 `lib/types/index.d.ts:29`）。客户端 Schemastery 扩展 `.volatile()` 见 `R/dsh-client-ui-settings/lib/client.js:496-499`，并拒绝无固定路径的 volatile 字段（`:507`）。

## 7.「添加插件」接受什么、装的是什么

接受 pnpm 的四种 spec（`R/dsh-plugin-manager/lib/types/install-spec.d.ts:11-29`：`registry | path | tarball | git`；`parseInstallSpec` :49 “A path must be absolute”）。对话框文案与示例（`lib/client.js:3027-3036`）：`包名`（`@deepseek-ai/dsh-subagent-codex`）、`GitHub 仓库地址`、`本地插件目录`（绝对路径）。流程：`remote.pluginManager.inspect(spec, { registry })` 先让 Host 判定（`:884`），被拒的类型见 `PluginInspectProblem`（types.d.ts:138，含 `not-bundle`「包没有声明组合包」），通过后 `installBundle(spec, { enabled: false, requestId, registry, … })`（`:939-944`）——**装的是 profile 的一个 npm 包/bundle，不是单条 Loader entry**，且要求该包带 bundle patch（`dsh.bundle.patch`）。安装完成界面提供「立即启用」，即 `setBundleEnabled(name, true)`（`:1119-1123`）。

## 8. 一个条目能否拥有多个配置子区 / 页签机制

- **页签栏 = `settings.plugins.tab` list slot**，由 `PluginsSettingsSection` 渲染（`R/dsh-client-ui-settings-plugins/lib/client.js`）：`settings.plugins.tab` 被声明为子 slot（`:208-211`，`kind: "list"`），页签由账本投影按 `order` 排序（`:183-188`），多标签时渲染 `role="tablist"` 并挂载每个面板（`:69-126`）；**只有一个贡献时不画 tab bar，直接渲染该页**（`:43-44` `const single = rows.length === 1 ? rows[0] : void 0;`，`:66-68`）。类型定义：`R/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:79-91` “One page inside the Plugins settings section … renders localized entry labels as tabs … Options: `id` (tab key), `order` (tab order), and `label`”。
- **一个插件包可以注册多个 tab**：`settings.plugins.tab` 是 list slot，每个注册带自己的 `id`；本工作区 `dsh-mcp-skill-manager/client.js:77` 就一次注册了 `id: 'mcp'` 与 `id: 'skills'` 两个 tab。出厂 `R/dsh-client-ui-settings-plugin-inventory/lib/client.js:763-770` 只注册 `id: "all"`、`label: t("tab")`（zh `:641` `tab: "插件列表"`）。
- **一个条目拥有多个配置子区**：框架层面靠“一个 tab / 一张卡片里由注册方自己排版”实现，而不是框架提供的子页签。官方四个配置页各自注册一个 `plugins.item`（`shell` order 10、`agent-loop` 20、`subagent` 30、`web-search` 40；见各包 client.js 的 `ctx.configForms.whileServed([...], () => ctx.slots.inject("plugins.item", …))`，如 `R/dsh-client-ui-settings-subagent/lib/client.js:839-844`）。其中 subagent 单个卡片**合并两个 namespace 的表单**并自绘多个区块：`const limits = new SubagentLimitsCardController(ctx.configForms.get(SUBAGENT_NS)); const models = new SubagentModelSelectionCardController(ctx.configForms.get(SUBAGENT_MODEL_SELECTION_NS), ctx);`（`:820-824`），卡片内有“模型选择”小节（`:454`）。
- 注意 `dsh-client-ui-settings-models` **不在**插件页：它注册的是自己的 `settings.section`（`R/dsh-client-ui-settings-models/lib/client.js:4061-4065`）。

---
### 核实程度
已验证（代码引用）：1–8 全部结论性代码路径、行号与 slot 契约。推断（未在代码中直接出现）：截图中的「插件 / 内置插件」若是同一 tab bar 的两项，则部署里必有 ≥2 个 `settings.plugins.tab` 注册；出厂包只有 1 个（`all`），因此该 tab bar 更可能是「侧栏 `插件` 面板」与「设置 `内置插件` 分区」两个不同入口的视觉并置。工作区已存在的第三方插件（mcp/skills/认证/OneWay 等）会向该 slot 追加页签。
