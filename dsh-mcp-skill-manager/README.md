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

这些值会随该 MCP 记录写入 DSH 配置文件（DSH 0.1.7+ 为 profile 补丁 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`，见「设置数据」），并在启用时传给 MCP 子进程；因此包含 Token 的值会以明文存在于该文件中。若不希望将机密写入配置，请通过 `envVars` 配置引用启动 DSH 时已有的 Host 环境变量。

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

## 与官方 `dsh-mcp-client` 配置对齐

每条受管记录的字段**不是手抄的，而是直接继承官方 schema**：

```js
import { Config as McpClientConfig } from '@deepseek-ai/dsh-mcp-client';
const [stdioSchema, httpSchema] = McpClientConfig.list;      // 官方是 z.union([stdio, streamable-http])
z.union([ stdioSchema.dict, httpSchema.dict ].map((dict) => z.object({ ...dict, ...managerExtras })));
```

这样官方以后新增字段（`reconnect`、`maxInstructionBytes`、`failOnStartupError` …）会自动出现在
本插件里，不会再出现「官方加了字段、管理器不认识」。挂载时除管理器元数据外**原样透传**给
`applyMcpClient`，只把 `envVars` / `headerEnvVars`（引用宿主环境变量的结构化字段）解引用并进
`env` / `headers`。

> 曾经这里是逐字段手写映射，结果漏了 `reconnect` / `maxInstructionBytes`，还把
> `failOnStartupError` 硬编码成 `false`——官方字段一律以官方为准，别在管理器里再写一遍。

管理器自己的元数据：`id`（状态检查的键）、`label`、`enabled`、`envVars` / `headerEnvVars`、
`importedFrom` / `diagnostics`。

## MCP 状态检查

打开 MCP 页会自动对**所有已启用**的服务做一次真实握手探测，每张卡片直接给出结论；也可以随时
点「重新检查」。一个服务一个请求，慢的（`npx` 首次下载）不会拖住快的。

探测由 Host 半完成，走的是**与 `dsh-mcp-client` 完全相同的 SDK 与传输**（同样的
`cross-spawn` + `shell:false`、同样的 `scrubbedParentEnv()` 环境脱敏），因此
「探测通过」等价于「模型调用时能连上」：

| 显示 | 含义 |
|---|---|
| ● 可用　工具 N　耗时　服务器名/版本 | `initialize` 成功且 `tools/list` 可用 |
| ● 不可用　耗时 + 错误文本 | 连接/握手/列表失败；子进程 stderr 会附在错误后面 |
| 诊断行（单独一行） | 命令解析层面能确定的原因，见下 |
| 已停用 / 未检查 | 未启用，或不探测 |

另外 Host 侧还记录**挂载结果**（`applyMcpClient` 是否抛错）：它与实时探测互补——
官方客户端 `failOnStartupError=false` 时初始连接失败**不会**拒绝激活，表现为「工具静默消失」，
所以只靠挂载结果看不出来，必须实测。

### Windows：`node` / `npx` 这类裸命令的陷阱

这是「服务配了却永远连不上、日志只有一句 Connection closed」的头号原因，值得单独说：

- SDK 用 `cross-spawn` + `shell: false` 启动 stdio 服务。cross-spawn 按「先目录、后扩展名
  （`.com/.exe/.bat/.cmd`）」解析裸命令，所以 **PATH 里靠前的目录决定用哪个文件**；
- DSH Desktop 会把自带的 `resources/runtime/dsh/bin` 放在 PATH 很前面，那里有 `node.cmd`、
  `pnpm.cmd`；而 `npm` 附带的 `npx` 是**无扩展名的 shell 脚本**；
- Node 在 CVE-2024-27980 之后**拒绝在 `shell:false` 下 spawn `.cmd`/`.bat`**，无扩展名文件在
  Windows 上也不是可执行文件——两种情况 spawn 都直接失败；
- 用 `npx` / `pnpm` / `yarn` 裸命令的服务几乎都会踩到。

**修法（已实测）**：改用真实程序的 `.exe` 绝对路径。Node 类服务写成：

```yaml
command: '<node 安装目录>\node.exe'
args: ['<包目录>/node_modules/@scope/pkg/dist/index.js']
```

实测：一个 `npx -y @raviraj87/jenkins-mcp` 的 Jenkins MCP 服务在裸 `npx` 下 100% 起不来；改成
「绝对 `node.exe` + 全局安装后的 `dist/index.js`」后探测通过（`jenkins-mcp-server 1.0.1`，37 个工具，约 0.5 s）。`cmd /c ...` 包一层**不可行**（实测同样失败）。

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

DSH 0.1.7 起设置不再由插件自己注册命名空间（`settingsScope` / `ctx.settings.register` 均已移除），
而是由本插件 Loader 条目的 `Config` 承担：条目 id（`cordis.patch.yml` 里的 `id: mcp-skill-manager`）
即命名空间，`mcpServers` / `skills` / `skillLinks` 三个字段都标了 `.volatile()` 因此可由设置页编辑。
写入落进 **profile 补丁**：

```yaml
# $DSH_HOME/profiles/<profile>/cordis.patch.yml
- id: mcp-skill-manager
  name: dsh-mcp-skill-manager
  config:
    mcpServers: []
    skills: []
    skillLinks: []
```

从 0.1.6 及更早升级时，这三个数组原本在 `$DSH_HOME/settings.yaml` 的 `mcp-skill-manager` 段里；
该文件在首次升级后已被 DSH 重命名为 `settings.yaml.imported`，把其中的 `mcp-skill-manager` 段
搬成上面这样的补丁行（**只搬这一段**，`settings.yaml.imported` 里其余段落属于别的插件）即可。

`skillLinks` 仅保存由插件创建的链接元数据。请不要直接编辑 profile 的 `cordis.patch.yml` 来添加动态 MCP；该文件只负责挂载 manager。

## 已知限制

- 此版本仅扫描用户级来源，尚未扫描项目目录；
- 导入接口只支持 loopback (`127.0.0.1`) 的单用户 Web Host；绑定 LAN 时会自动关闭；
- 不导入 MCP 的 OAuth、SSE/未知 transport 或明文秘密；
- 外部链接的损坏、权限变化和外部删除会让该 Skill 不可发现，需要在来源侧修复；
- 状态检查会按配置真实起一次连接（stdio 会拉子进程、HTTP 会握手），量大时首次检查可能需要十几秒。

## 开发与验证

```bash
cd dsh-mcp-skill-manager
pnpm install --ignore-scripts
node ./scripts/validate.mjs
node --check ./index.js
node --check ./client.js
node ./tests/probe.test.mjs      # 真起子进程 / 真连 HTTP 的探测测试（23 条断言）
```

`tests/probe.test.mjs` **不 mock SDK**：它用 `tests/fixtures/echo-mcp-server.mjs`
（一个最小 stdio MCP 服务）验证「可用 / 进程秒退 / 命令不存在 / HTTP 连不上 / 环境变量注入」，
外加 Windows 命令解析诊断（`.cmd`、无扩展名 shim、`.exe` 不误报）。
