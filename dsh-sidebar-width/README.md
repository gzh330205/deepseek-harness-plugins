# dsh-sidebar-width —— 侧栏宽度记忆

DSH 原生**不持久化左侧栏宽度**（`ui-layout` 的 layout store 里 `sidebar` 初值 280，
文件里 `localStorage` 出现 0 次），刷新页面就回到默认；右侧栏宽度只按**会话**存
（`localStorage["dsh.sidebar-right.v1.<sessionId>"]`，而且只有 dock 内部分栏的尺寸，
外层面板宽度 `layoutInfo.rightbar` 是纯内存值），换会话 / 重开就变。

本插件把**左右两条侧栏的宽度**都收进一份全局配置（Loader 条目的 volatile Config，落在
profile 的 `cordis.patch.yml`），因此跨会话、跨标签、重启都保持同一宽度；拖动分隔条也会
自动记录下来。

实现上**不碰 DOM**，而是直接驱动 DSH 布局 store 自己的 actions（见下一节的发现过程）。
早期版本改写 `grid-template-columns`，导致右侧面板溢出盖住中间栏——那条路已经废弃，
`validate.mjs` 里有断言禁止它回来。

## 组成

| 半区 | 文件 | 作用 |
|---|---|---|
| host | `index.js` | 声明 `Config`：`enabled` / `sidebarWidth` / `rightbarWidth` / `guideOnLastTab`（都 `.volatile()`） |
| client | `src/client/index.js` → `lib/client.js` | 连接布局 store、应用宽度、记录用户拖动、关闭最后一个标签后回引导页、贡献「侧栏宽度」设置页签 |
| bundle | `cordis.patch.yml` | 一行 `insert`：`id: sidebar-width` = `SETTINGS_NAMESPACE` |

## 怎么拿到 DSH 的布局 store（关键）

ui-layout 的布局 store 是它内部 `createLayoutStore()` 的产物，**表面上没有对外服务**：
`ctx.layout` 只暴露 `selectPanel / toggleSidebar / openRightbar / closeRightbar`，没有宽度方法；
承载 store 的 `root` 槽是 `single` 类型，插件也抢不到。

但 ui-layout 在注册 `root` 槽时把 store 句柄写进了注册项：

```js
ctx.slots.register({ name: "root", kind: "single", scope: "root", children: {…}, store }, AppFrame);
```

而 renderer 的 `_register()` 会把它并进 entry：

```js
const erased = { ...options, ...(store !== undefined ? { store } : {}), registrant };
```

于是插件可以这样拿到**活实例**（`create` 被 ui-layout 重写成了 `() => instance`）：

```js
const instance = ctx.slots.entries('root')[0].store.create();
instance.getSnapshot().layoutInfo   // { sidebar, rightbar, rightbarShown, viewportWidth, … }
instance.actions.setSidebar(px)     // 左侧栏（原生 clamp 264–420）
instance.actions.setRightbar(px)    // 右侧栏（原生 clamp 300–视口70%）
instance.subscribe(listener)        // 用户拖动 / 快捷键都会从这里出来
```

**ui-layout 比本插件后注册**，所以刚 apply 时 `entries('root')` 还是空的，必须轮询等它
（`acquireLayoutStore()`，200ms × 30s）。拿不到就什么都不做并打一行 warning，不做任何 DOM 兜底。

### 为什么绝对不碰 DOM

早期版本直接改写 `grid-template-columns`，结果是**右侧面板溢出、盖住中间栏**：右侧面板是
绝对定位、宽度由引擎自己算（`layoutInfo.rightbar ?? 视口×0.45`），三列轨道只是给中间栏留位；
轨道一旦比面板窄，面板就向左压过去。走 store 的 actions 时，面板宽度、三列轨道、引擎内部
状态由同一次写入一起更新，天然一致。

### 谁算「用户意图」

只有 store 订阅回调里**不是我们写进去的**变化才算用户改动（`expected` 记着我们刚写的值），
并且：

- `sidebar === 0`（收起）不记录；
- 未打开过的右侧栏（`rightbar` 为 null）不记录；
- 拖动每一步都会触发一次变更，所以写配置有 300ms 防抖；
- 引擎会按视口 clamp（例如右栏请求 3000 → 实际 700），配置里存的是**引擎实际值**。

`enabled: false` 时既不应用也不记录；窄视口（< 1024，原生会自动折叠）不强行展开左栏。

## 关闭右栏最后一个标签 → 停在引导页

DSH 原生：右栏**只剩一个标签**时关掉它，`closeTab`（`dsh-client-ui-sidebar-right` 的 store）
会一并 `planSetExpanded(false)`，把整个右栏收起：

```js
// sidebar-right 的 closeTab action（原生）
if (!soleDockedTab(state, tabId)) return [{ type: 'closeTab', tabId }];
return [{ type: 'closeTab', tabId }, ...planSetMode(state, 'push'), ...planSetExpanded(state, false)];
```

本插件把这一步改成**停在引导页**（`kind: "guide"`，界面上叫「开始」），右栏保持展开。
走的是公开服务 `ctx.sidebarRight.openTabFromTarget('guide', target)`——它内部的
`openContent` 一定会 `planSetExpanded(true)`，所以列会重新展开。

**判据**（`createGuideFallback`）用两个条件同时成立：`layoutInfo.rightbarShown` 由
`true` 变 `false`，**且**活动 dock pane 已空（`commandTarget().tabId === undefined`）。
只看「收起」是不够的：

| 场景 | pane 里有标签？ | 动作 |
|---|---|---|
| 关闭最后一个标签（本功能的目标） | 否 | 打开引导页 |
| 手动点「收起右侧边栏」 | 是 | **不动**（否则用户再也收不起右栏） |
| 引导页作为唯一标签 | — | 它**没有关闭按钮**（原生 `canCloseTab` 明令禁止），不存在「关了又被打开」的循环 |
| 窄视口（<768px）全屏浮层 | — | 让原生照常收起，不打扰 |
| `guideOnLastTab: false` 或 `enabled: false` | — | 完全保持 DSH 原生行为 |

设置页里对应一个勾选框（默认开启）。真机验证：

```
打开右栏（引导页）→ 点「工作区文件」→ 标签只剩「文件」
关闭它            → open=true  标签回到「开始」      ← ★功能生效
手动点收起右侧边栏 → open=false 且保持不动            ← 不误触发
关掉开关后再试     → open=false（原生收起右栏）        ← 开关有效
```

## 安装

```bash
# 单独装
dsh plugin --profile <profile> add ./dsh-sidebar-width

# 或者作为合集的一行（推荐）：dsh-plugin-kit 已经 link 了本包，
# 装合集即带上，页签出现在「设置 → 插件合集 → 侧栏宽度」
```

改完记得**重启 DSH Host**（bundle 列表变更不走 hot reload）。

## 开发与验证

```bash
pnpm install --ignore-scripts
node ./scripts/build-client.mjs   # src/client/index.js → lib/client.js
node ./scripts/validate.mjs       # 结构 + 产物契约
```

## 测试

`tests/client.test.mjs` 用**假的 DSH 布局 store** 真跑 `lib/client.js`，覆盖 23 条断言：
启动应用左右栏、值已在目标不重复调用、拖动防抖记录、收起不记录、只记被改的那一侧、
store 晚到、store 缺失不抛错、折叠不强撑、窄视口不强撑左栏但右栏仍应用、
右栏超上限以引擎实际值为准。

```bash
node ./tests/client.test.mjs
```

> 这轮之前的两个 bug（误用 `slots.specDynamic`、重写时漏掉 `OVERRIDE_ID` 声明、
> 右栏解析被空格切断）**都过得了文本校验**，只有真跑代码才抓得到。

## 边界

- 只改「前端显示宽度」，不碰任何仓库/会话数据。
- 折叠状态不记：侧栏折叠时不会把宽度写成 0，也不会因为配置里有值就自动展开。
- 「关闭最后一个标签 → 引导页」只在**右栏本来是展开的**前提下生效（`rightbarShown` 由 true 变 false），
  并且不会阻止手动收起；`guideOnLastTab` 可关掉。
- 左右栏都接管，全部通过布局 store 的 actions 写入。
- 原生 clamp：左栏 264–420px，右栏 300px–视口 70%；配置里填超范围的值会以引擎实际值为准。
- 依赖「store 挂在 `root` 注册项上」这一实现细节：DSH 若改了这里，插件会打一行 warning
  并完全不做改动（不会出错、也不会退化成改 DOM）。
