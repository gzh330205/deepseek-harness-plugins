# DSH MCP & Skill Manager

> **安全边界：** 外部 Harness 导入接口仅在 DSH Web 绑定到 `127.0.0.1` 时启用。插件不会在启动时扫描 Claude Code、Codex 或 OpenCode；只有用户在设置页面打开导入弹窗后，才会读取预定义的用户级来源。

一个带 Web 设置页面的 DSH Profile Bundle，用于统一管理：

- MCP 服务：新增、查看、编辑、启用、停用、删除及手动导入；
- Skills：新增、查看/编辑、启用、停用、删除及以目录链接方式导入；
- MCP 环境变量：可为 stdio MCP 配置键值对，也支持现有 Host 环境变量引用。

安装后，在 **设置 → 插件 → MCP** 与 **设置 → 插件 → Skills** 中使用。

## 安装

在此仓库根目录运行：

```bash
dsh plugin --profile web add ./dsh-mcp-skill-manager
```

重启 DSH Web Host 一次以装载这个 profile bundle，然后刷新浏览器页面。

> 本插件的 Host 和 client 文件都直接位于这个目录。DSH 通过 profile 依赖解析它；请保留整个目录，不要仅复制 `cordis.patch.yml`。

## MCP Tab

打开 **设置 → 插件 → MCP**：

- **新增 MCP** 会打开弹窗，支持本地 `stdio` 和 Streamable HTTP；
- **导入** 会打开来源选择弹窗。只有此时 Host 才会扫描相应配置；
- 用户勾选后，外部 MCP 条目被解析、脱敏并转换为 DSH 自己的 MCP Settings record；
- MCP 配置文件本身不会建立链接、不会被复制为一份外部 Harness 配置；
- 启用时，Manager 创建 MCP client；停用或删除时，Manager 解除对应工具注册。

当前支持的用户级 MCP 来源：

| 来源 | 读取位置 |
|---|---|
| Claude Code | `%USERPROFILE%\.claude.json` 的 `mcpServers` |
| Codex | `%USERPROFILE%\.codex\config.toml` 的 `[mcp_servers.<name>]` |
| OpenCode | `%USERPROFILE%\.config\opencode\opencode.json` 的 `mcp` |

导入时，明文环境变量值和 Header 值会被丢弃；仅识别形如 `${TOKEN_NAME}` 或 `$TOKEN_NAME` 的环境变量引用。

手动新增或编辑 **stdio MCP** 时，弹窗中有“环境变量”区域，可以直接添加键值对。例如 Jenkins：

```text
JENKINS_URL                  = http://jenkins.example.internal:8080
JENKINS_USERNAME             = my-user
JENKINS_API_TOKEN            = <token>
JENKINS_ALLOW_SCRIPT_CONSOLE = true
```

这些值会随该 MCP 记录写入 `$DSH_HOME/settings.yaml`，并在启用时传给 MCP 子进程；因此包含 Token 的值会以明文存在于本机 DSH Settings 文件中。若不希望将机密写入 Settings，请通过 `envVars` 配置引用启动 DSH 时已有的 Host 环境变量。

手动新增或编辑 **Streamable HTTP MCP** 时，弹窗中有“HTTP 请求头”区域，可以配置认证头，例如：

```text
Authorization = Bearer <token>
X-API-Key     = <key>
```

HTTP 请求头会随 DSH MCP client 请求发送。若使用环境变量引用，可在设置文件中配置：

```yaml
headerEnvVars:
  Authorization: JENKINS_API_TOKEN
```

这样实际发送的是 `Authorization: <DSH 启动环境中的 JENKINS_API_TOKEN>`，不会把 Token 写入设置文件。

## Skills Tab

打开 **设置 → 插件 → Skills**：

- **新增 Skill** 会打开弹窗，创建 Settings-backed 的托管 Skill；
- **链接导入** 会先显示 Claude Code、Codex、OpenCode 中可发现的 `SKILL.md` 目录；
- 选中项后，插件在 DSH 默认用户 Skill 根中创建**单个 Skill 目录的 Windows junction**，不复制 `SKILL.md`；
- **取消链接** 只删除 DSH 创建的 junction，绝不会删除外部来源目录或文件；
- 停用外部链接时会移除 junction，默认 DSH Skill filesystem provider 不再发现该 Skill。

链接目标为：

```text
%DSH_HOME%\skills\<skill-name>
```

当前环境等价于：

```text
C:\Users\gzh33\.dsh\skills\<skill-name>
```

示例：

```text
C:\Users\gzh33\.dsh\skills\hatch-pet
  → C:\Users\gzh33\.agents\skills\hatch-pet
```

支持的用户级 Skill 根：

| 来源 | 读取位置 |
|---|---|
| Claude Code | `%USERPROFILE%\.claude\skills` |
| Codex | `%USERPROFILE%\.agents\skills` |
| OpenCode | `%USERPROFILE%\.config\opencode\skills` |

每个来源项必须是一个直接包含 `SKILL.md` 的目录。导入前 Host 会重新验证来源目录、规范路径、Skill 文件和目标名称；浏览器不会传递任意本地路径。

## 设置数据

本插件使用 `$DSH_HOME/settings.yaml` 的单个命名空间：

```yaml
mcp-skill-manager:
  mcpServers: []
  skills: []
  skillLinks: []
```

`skillLinks` 仅保存由插件创建的链接元数据。请不要直接编辑 profile 的 `cordis.patch.yml` 来添加动态 MCP；该文件只负责挂载 manager。

## 已知限制

- 此版本仅扫描用户级来源，尚未扫描项目目录；
- 导入接口只支持 loopback (`127.0.0.1`) 的单用户 Web Host；绑定 LAN 时会自动关闭；
- 不导入 MCP 的 OAuth、SSE/未知 transport 或明文秘密；
- 外部链接的损坏、权限变化和外部删除会让该 Skill 不可发现，需要在来源侧修复；
- MCP 连接状态/工具数尚未在 UI 中展示。

## 开发与验证

```bash
cd dsh-mcp-skill-manager
pnpm install --ignore-scripts
node ./scripts/validate.mjs
node --check ./index.js
node --check ./client.js
```
