# dsh-web-auth

DSH Web 的 HTTP 认证网关（**账号密码模式**，面向服务器部署）：安装后，
访问 `http://<服务器>:<端口>` 首先看到登录页，**只有输入正确的用户名和
密码才能进入 DSH Web 界面**、调用 `/api/*` 接口，或建立两个 WebSocket
下行通道。不再依赖环境变量。

## 工作原理

DSH 的 `@deepseek-ai/dsh-host-webserver` 没有认证中间件坐席（其文档明确把
TLS/auth 留给部署层的反向代理），因此本插件在 `webServer.server`（node:http
服务）的最外层安装一道闸：

- 拦下**每一条** HTTP 请求与 WebSocket 升级请求；
- 未登录：普通请求返回 401 + 登录页，`/api/*` 返回 401 JSON，
  WebSocket 升级直接回 401；
- 已登录：原样转发给 DSH 自己的内部处理器（路由匹配、SPA 静态回退、
  WS 协商），框架代码零改动。

**Host 规范化**：DSH 自带 `/api` 浏览器信任面只认回环或
`--trusted-host` 声明的权威；而 DSH 又禁止 `--host 0.0.0.0`，远程访问
几乎必然经反代或主机名。若不做处理，会出现「登录成功但 /api 全 403
forbidden」的断连。网关对**已认证**的 `/api`/WS 请求会把非回环的
Host/Origin 规范到回环再转发——认证层已提供等价防护（会话 Cookie
host-only、未认证请求到不了这里），无需再配置 `--trusted-host`。

登录成功后签发 `HttpOnly; SameSite=Strict; Path=/` 会话 Cookie（默认
12 小时）。**密码只保存 scrypt 哈希 + 盐**（每账户独立盐），设置文档中
永远没有明文密码；登录验证使用常数时间比较，连续失败会按来源 IP
指数退避限速。

### 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/__auth__/login` | GET/POST | 登录页；提交 `username`+`password`（或主令牌 `token`，可选），成功签发会话 Cookie |
| `/__auth__/setup` | GET/POST | **首次部署引导**：无账户且未配置主令牌时才可用，创建第一个账户后永久关闭 |
| `/__auth__/logout` | POST | 撤销会话并清除浏览器 Cookie |
| `/__auth__/status` | GET | `{authed, user, mode, accounts}`，供脚本/健康检查 |
| `/__auth__/users` | GET | 已登录：账户列表 |
| `/__auth__/users/add` `/remove` `/password` | POST | 已登录：新增 / 删除账户 / 重置密码（全部同源校验） |

## 安装

```powershell
# 在本仓库根目录安装插件（不会影响当前运行中的 dsh web）
dsh plugin --profile web add ./dsh-web-auth
```

### 服务器 / 局域网部署

> ⚠️ **DSH 禁止 `--host 0.0.0.0`**（会提示"会向网络暴露远程代码执行"，
> 这是刻意的安全红线）。因此 DSH 进程始终绑定 127.0.0.1，远程访问走
> 反向代理或 SSH 隧道：

```powershell
# 方式 A（推荐，公网/局域网）：反向代理绑定对外的 0.0.0.0，DSH 保持 loopback
dsh web --port 3080 --no-open          # 本机监听 127.0.0.1:3080
# Caddy 示例：your-domain.com { reverse_proxy 127.0.0.1:3080 }  # TLS 由反代负责

# 方式 B：SSH 隧道（临时远程使用）
ssh -L 3080:127.0.0.1:3080 user@server   # 本地浏览器打开 http://127.0.0.1:3080

# 方式 C：同机浏览器
#     http://127.0.0.1:3080 或 http://<计算机名>:3080 均可
```

首次启动后（此时还没有任何账户）：

1. **务必立即**在浏览器打开 `http://127.0.0.1:3080`，会出现
   **DSH Web 初始化** 引导页，创建第一个账户；
2. 再开放反代端口 / 端口映射。

> ⚠️ 引导页只在"零账户且未配置主令牌"时存在。请先创建账户再对外暴露，
> 否则他人可能抢注第一个账户。也可跳过引导：把账户直接写进设置文件
> （见下文）。
>
> 说明：经反向代理访问时，Host 头是外部域名——网关会在**已登录**时把
> 它的 Host/Origin 规范为回环再转发，因此**不需要 `--trusted-host`**；
> 未认证请求依旧由登录页/401 拦截。

### 账户管理

- **网页端**：登录后进入 `设置 → 插件 → 认证`，可新增账户、删除账户
  （至少保留一个）、重置任意账户密码。修改/删除账户会**立即撤销**该
  账户的所有会话。
- **配置文件**：`$DSH_HOME/settings.yaml` 的 `web-auth` 命名空间：

  ```yaml
  web-auth:
    users:
      - username: admin
        hash: scrypt$16384$8$1$<salt>#<hash>      # 用 node scripts/hash-password.mjs 生成
    token: ""                                      # 可选主令牌（留空禁用）
    cookieName: dsh_web_auth
    sessionTtlSeconds: 43200
  ```

  哈希生成：`node scripts/hash-password.mjs <密码>`。修改设置文件后，
  外部变更会被热发布（无账户变更时已发会话不受影响；密码/账户变更会
  撤销对应会话）。

### 主令牌（可选）

`web-auth.token` 提供一个**主令牌**备用钥匙：登录页多一个"主令牌"
输入框，脚本/自动化用 `Authorization: Bearer <令牌>`。它不再来自
环境变量，也**不是**必需的认证手段——只配置账户即可。

### 验证

```powershell
# 未登录 → 401 登录页
curl -i http://127.0.0.1:3080/

# 主令牌（若配置了）
curl -i -H "Authorization: Bearer <令牌>" http://127.0.0.1:3080/__auth__/status

# 登录（表单或 JSON 均可）
curl -i -c cookies.txt -X POST -d "username=admin&password=你的密码" http://127.0.0.1:3080/__auth__/login
curl -i -b cookies.txt http://127.0.0.1:3080/__auth__/status
```

## 安全边界与注意事项

- **无 TLS**：`dsh web` 本身只提供 HTTP。面向互联网部署**必须**在前置
  反向代理（Caddy/nginx）上启用 HTTPS（代理后网关仍拦截一切；登录、
  Cookie 定义在应用层，与代理无冲突）。
- **认证过的远程请求拥有完整 /api 能力**：网关的 Host 规范化会让已登录
  请求绕过 DSH 的信任面（其中包括设置/凭据等本应仅回环的管理面）。
  这是有意为之——DSH 在等待"真认证层"出现才放开这些面，本插件即该
  认证层。请只给信任的人发放账户。
- **无角色区分**：所有已登录用户都能管理账户——本插件面向个人/团队
  私有部署；需要细粒度权限请自行扩展。
- **本机同用户不受保护**：设置文件对同账号进程可见；网关保护的是
  网络访问面。
- **登录限速**：同一来源连续失败指数退避（最多 2 秒）；账户不存在时
  也执行一次等价哈希验证，避免用户枚举的时序差异。
- **会话**：不透明随机 ID（服务端登记，可撤销）；进程重启后全部登出；
  `SameSite=Strict` + 同源校验阻断跨站写入（登录/登出/账户管理）。
- **开发期 HMR 也受保护**：`/plugins/*` 客户端模块加载同样在闸内，
  登录一次后不受影响。
- **只认同一主机名**：`127.0.0.1` 与 `localhost` 视为两个站点，各自
  登录一次。

## 开发与验证

```bash
cd dsh-web-auth
pnpm install --ignore-scripts
node ./scripts/validate.mjs            # 结构校验
node --check ./index.js                # 语法检查
node ./scripts/smoke.mjs               # 端到端：真实 webserver + settings 提供商，
                                       # 覆盖首批引导、登录、账户管理、WS、主令牌、卸载归还
node ./scripts/hash-password.mjs <密码> # 生成 scrypt 哈希（用于手写设置文件）
```
