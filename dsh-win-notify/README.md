# dsh-win-notify

DSH **会话执行完成 / 需要人工干预时弹通知**的 profile 插件，host/client 双半：

- **客户端（默认路线）**：在 DSH Web 页面内（`client.js`，经 `dsh.client` 客户端模块体系加载）。首选 **Tauri 桌面壳原生通知**（`window.__TAURI__.event.emit` → 壳进程 `listen` 后弹出）；无壳时回退**浏览器 Web Notification API**。
- **宿主（可选）**：进程内监听 `session/event` 的 `turn/end`，调 Windows PowerShell 5.1 + WinRT 弹**系统 Toast**（`route: host` / `both`，零依赖、本机部署、页面全关也有效）。

## 两类触发

**1. 会话执行完成**（客户端）：观察会话列表快照 `running: true → false` 跃迁（= 代理从忙碌到空闲）。

**2. 人工干预**（客户端 + 宿主）：
- **权限审批**（agent 要调工具、需要你允许/拒绝）→ `approval/request`；
- **向用户提问**（`ask_user_question` / 计划审查）→ `user-questions/request`。

客户端观察官方 UI 的 pending-interaction 快照（`ctx.uiSession.pendingInteractions`，审批与提问都会登记，按 interaction key 去重）；宿主侧用 `prepend` 透传监听器（副作用 + 立即 `next()`，绝不短接审批/提问链路）。`interventions: false` 可关闭。

## 客户端是怎么检测"会话跑完了"的

宿主把每个会话的 running 状态绑定到 `agents.get(id)?.status === "running"`，并经 `api-session/status` 广播；客户端 `sessions` 服务的列表快照（`byId[id]`）用 `subscribe` + `getSnapshot` 跟随刷新。客户端插件（`inject: ['sessions']`）观察**每个会话 `running: true → false` 的跃迁** = 代理从忙碌到空闲 = 执行完了，列表行自带 `displayTitle`（会话标题）与 `origin`（过滤 subagent 子会话）。不依赖任何内部 API，且与界面上的"执行中"指示同源。

通知优先级：

1. **Tauri 壳**：`window.__TAURI__.event.emit(tauriEventName, { title, body, sessionId })`（需 `withGlobalTauri: true`）；
2. **浏览器回退**：`Notification` API（首次触发时请求权限）。

## 安装

```sh
# 在插件 checkout 目录里（或任意位置，支持相对路径）
dsh plugin --profile web add ./dsh-win-notify
```

`dsh plugin` 会把包链进 `$DSH_HOME/profiles/web/node_modules`，并把它追加到
`dsh.profile.bundles`。**新增 bundle 需要重启 `dsh web` 才生效**。

验证：

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-win-notify" 层
curl -s http://127.0.0.1:3080/dsh-win-notify/config   # 客户端配置端点
```

## Tauri 壳集成（3 步）

**1) 允许页面使用 Tauri 全局 API**（`src-tauri/tauri.conf.json`）：

```json
{ "app": { "withGlobalTauri": true } }
```

**2) 壳注册通知插件并监听事件**（`src-tauri/Cargo.toml` 加
`tauri-plugin-notification = "2"`，`lib.rs`）：

```rust
use tauri::{Manager, Listener};
use tauri_plugin_notification::NotificationExt;

#[derive(serde::Deserialize)]
struct DshNotify { title: String, body: String, session_id: Option<String> }

tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
        let handle = app.handle().clone();
        app.listen("dsh-notify", move |event| {
            let notify: DshNotify = serde_json::from_str(event.payload()).unwrap_or(
                DshNotify { title: "DSH".into(), body: event.payload().to_string(), session_id: None },
            );
            let _ = handle.notification().builder()
                .title(notify.title).body(notify.body).show();
        });
        Ok(())
    })
    .run(tauri::generate_context!())
```

（事件载荷字段为 `title` / `body` / `sessionId`；`sessionId` 可用来点击后聚焦对应会话。）

**3) 权限**：事件 emit/listen 需要 `core:event:default`（`src-tauri/capabilities/default.json`
里通常已有 `core:default`，包含它）。

## 配置

默认值即开即用；在 profile 的 `cordis.patch.yml` 按 id 覆盖：

```yaml
- id: win-notify
  config:
    route: client            # client | host | both
    browserNotify: true
    tauriEventName: dsh-notify
    titleTemplate: DSH 会话通知
    clientMessageTemplate: '「{title}」已执行完成'
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `route` | `client` | `client`=客户端通知（Tauri/浏览器）；`host`=宿主 PowerShell Toast（headless/CLI 部署）；`both`=两侧都发（会重复） |
| `tauriEventName` | `dsh-notify` | 壳侧监听的事件名 |
| `browserNotify` | `true` | 无 Tauri 桥时是否回退浏览器 Web Notification（需授权） |
| `clientMessageTemplate` | `「{title}」已执行完成` | 客户端正文模板，占位符 `{title}` |
| `titleTemplate` | `DSH 会话通知` | 标题模板，占位符 `{title}`（客户端只认这个） |
| `interventions` | `true` | 需要人工干预（审批/提问/计划审查）时也通知 |
| `interventionTitle` | `DSH 需要人工处理` | 干预通知标题；正文自动区分「需要审批（工具）：原因」/「需要回答：问题」（多问题带计数）/「需要审查计划」 |
| `enabled` | `true` | 总开关 |
| `notifyKinds` | `['completed','error']` | **仅宿主侧**：哪些 turn 结束原因要通知 |
| `includeSubagents` | `false` | 是否通知 subagent 子会话（两侧共用） |
| `backend` | `powershell-toast` | **仅宿主侧**后端；`none` 关闭 |
| `shellPath` / `appId` / `sound` / `duration` / `maxMessageLength` / `verbose` | 见上 | 仅宿主侧 PowerShell 参数 |

## 自检

```sh
node ./scripts/unit-test.mjs           # 宿主逻辑 25 项断言（含干预文案与 waterfall 透传）
node ./scripts/client-unit-test.mjs    # 客户端逻辑 18 项断言（桩 Tauri/Notification/pending interactions）
node ./scripts/validate.mjs --toast    # 宿主侧真实弹一条自检 Toast
```

## headless 端到端验证（宿主路线）

```sh
dsh plugin --profile headless add ./dsh-win-notify
# 临时在 headless profile 的 cordis.patch.yml 写入：
#   - id: win-notify
#     config: { route: host }
dsh --profile headless "只回复：好"
# 终端输出：[dsh-win-notify] → DSH 会话通知 | 「只回复：好」第 1 轮 · 完成
# 屏幕右下角同时弹出 Toast
```

## 常见问题

- **壳里没弹**：确认 `withGlobalTauri: true`、壳里 `listen("dsh-notify")` 已注册、capabilities 含 `core:event:default`；页面 F12 看 `[dsh-win-notify][client]` 日志（`verbose: true`）。
- **浏览器不弹**：检查站点通知权限（地址栏图标）；权限会被浏览器记住。
- **Toast 不显示（宿主路线）**：Windows 通知中心未禁用；自定义 `appId` 需是已注册 AUMID。
- **企业策略拦截 PowerShell（宿主路线）**：WDAC/AppLocker/受约束语言模式下会静默失败，改用客户端路线。

## 卸载

```sh
dsh plugin --profile web remove dsh-win-notify
```
