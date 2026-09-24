# dsh-run-env-manager

DSH Web 的「运行环境管理」侧边插件：在右侧栏维护项目的运行配置与开发环境，一键启停，实时看日志，
由 AI 读取项目生成配置、排查启动失败。功能对齐 OneCode 的「运行 / 配置」面板（`docs/quick-launch.md`）。

## 它做什么

- **右侧栏 tab**：右栏「开始」页出现「运行配置」入口卡片，点击打开「运行」tab（可关闭、可与终端/文件并排）。
- **运行分页**：每个运行配置一张卡片（状态点、启停、日志）；顶部有 **AI 配置** 与 **AI 故障排查**。
- **配置分页**：项目开发环境（Java/Maven/Python/Node.js/Go/Tomcat/Ant 七个下拉，未选即跟随全局默认）、
  运行配置增删改、**编辑 JSON**（整份工作区配置全量替换）、全局开发环境管理（从 PATH 检测 / 手工添加 / 验证并保存 / 设默认 / 删除）。
- **设置页**：「全局开发环境」区渲染同一套环境库。
- **两种运行类型**：`command`（普通长驻命令）与 `tomcat`（每配置独立 `CATALINA_BASE` 的托管启动）。
- **AI**：复用 DSH 的会话能力——新建绑定该工作区的会话，把提示词发进去；agent 通过本插件注册的
  `run_env_get` / `run_env_save` 工具读写配置（配置存在 profile 下，不在项目目录里，所以必须经工具）。

## 进程与清理（最关键的一条）

启动的进程随 DSH 关闭而自动结束，这不是本插件自己做的兜底，而是 DSH 宿主的 Win32 Job Object 容器
（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）提供的保证：宿主死亡 → runner 的 IPC 断开 → runner 释放 Job
句柄 → 内核杀掉整棵树。**包括宿主被强杀（任务管理器结束进程）的情况**。实测：`dsh host → cmd.exe →
pnpm → cmd.exe → node` 五层链路在宿主被强杀后全部消失。

插件自身在卸载（有序销毁）时也会 `terminate()` 所有实例并回收 Tomcat 的 `CATALINA_BASE`，两条路径互补。

## 五个已踩实的宿主约束（改代码前先读）

1. `ctx.subprocess` 的 handle **没有 pid**，只能 `handle.terminate()`。因此本插件只能管理**自己启动**的
   进程，**不会去纳管别处已跑着的服务**。
2. Windows 上 `npm`/`pnpm` 是 `.cmd` 垫片，Job runner 只解析 `.com`/`.exe`，直接 spawn 会 `ENOENT`
   —— 一律包一层 `cmd.exe /d /s /c`（POSIX 走 `bash -c`）。
3. 父环境里名字含 `KEY`/`PASSWORD`/`SECRET`/`TOKEN` 的变量与所有 `DSH_*` 会被宿主 scrub 掉；
   要下发必须在 `spec.env` 里显式给。
4. **输出必须用 `stdio: 'pipe'` 自己解码，不能用 collect 模式。** collect 的 `readFrom()` 内部是
   `buffer.toString('utf8')`（硬编码、非 fatal），而中文 Windows 上 Maven / Gradle / javac 写的是
   GB18030 字节流 —— 走 collect 就是满屏 `U+FFFD` 乱码。代价：没有了 collect 的 spill 文件，
   日志只保留内存尾部（`logTailChars`）。解码器在 `src/host/processes.js`，测试见 `tests/decoder.test.js`。
5. 客户端插件里，主按钮与选中态要用 **`--dsw-alias-brand-primary`（填充）+ `--dsw-alias-label-primary-inverted`
   （前景）** 这一对 token：前者在本产品里是高对比油墨色（浅色近黑 / 深色近白），硬编码 `#fff` 会在
   深色主题下变成白底白字。
6. **日志里的 ANSI 转义要渲染、不要丢**：drizzle / vite / pnpm 这类开发服务默认按终端着色输出。
   宿主侧**不能**剥掉（剥了就再也画不出颜色），保留原始序列，由面板解析成片段渲染
   （`src/client/ansi.js`）：只认 SGR（颜色/粗体/下划线），清行 `[2K`、光标归位 `[1G` 这类
   **终端行为**无法在日志视图里复现，丢弃 —— 否则又是一串 `[2K` 噪音。给 AI 的排查输入
   用 `plainText()` 转纯文本。

另有两条 DSH 客户端的坑：工具必须注册在**插件自己的上下文**里（用 `ctx.get('tools')`，不能靠
`ctx.inject` 的子上下文，否则 agent 看不到）；客户端 `apply` 抛错会让整页 boot 失败，所以全程 try/catch 降级。

## 安全与限制

- 宿主路由只在 Web 绑定 `127.0.0.1` 时注册；写操作要求同源浏览器请求（loopback + `Origin` 校验）。
- 启动命令以宿主进程的用户身份执行，等同于在终端里直接运行；**面板不设审批**，请只对可信项目配置。
- Tomcat 的关闭端口绑回环并带随机 token，只有本插件能正常停它；端口被占用时**只报错，不关别人的服务**。
- 不做跨 DSH 重启的进程接管：宿主停止后运行状态不持久化。

## 安装

```bash
# 在本仓库根目录执行
dsh plugin --profile web add ./dsh-run-env-manager
```

安装后**重启该 profile 的 DSH Host 一次**，再刷新页面。

## 数据存储

- 环境库、全局默认绑定、各工作区运行配置都存插件 Loader 条目的 volatile `Config`，
  落盘在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` —— **不同 profile 相互独立**，
  没装本插件的 profile 完全不受影响（这是刻意的选择：不往项目目录里写文件）。
- 宿主是唯一写入方（浏览器半只读快照、改动走 HTTP 动作），避免两个写入方互相覆盖。
- Tomcat 的 `CATALINA_BASE` 放在 `$DSH_HOME/run-env-manager/tomcat/<hash>/`，停止即回收。
- 运行中的进程状态只在宿主内存里，不落盘。

## 开发与构建

```bash
pnpm install              # 安装依赖（会自动构建一次）
pnpm build                # src/client/* → lib/client.js（esbuild，产物需提交）
pnpm test                 # 宿主纯逻辑测试（环境解析 + Tomcat）
pnpm validate             # 脚手架约定校验
node ./scripts/read-session.mjs <会话id片段> [关键字]   # 读 DSH 会话日志（多帧 zstd，调试 AI 通路用）
```

改 `src/` 后必须 `pnpm build` 并提交 `lib/client.js`，否则用户拿到的是旧产物。

## 验证记录

阶段 0（spike）与阶段 1～3 都在真机（Windows 11 + DSH `0.1.7-alpha.2`，独立 `test` profile + 独立端口）验证：

| 项 | 结果 |
|---|---|
| 「运行配置」卡片出现在右栏开始页，点击打开「运行」tab | ✅ |
| 启动 `pnpm dev`（cmd → pnpm → node 三层），日志实时流式显示 | ✅ |
| 停止 → 进程树消失（`exitCode 1` 正确判为 `stopped`） | ✅ |
| **强杀宿主 → 五层进程树全部消失** | ✅ |
| 从 PATH 检测环境（java 21.0.4 / maven 3.9.9 / python 3.12.3 / node 26.7.0 / go 1.23.4） | ✅ |
| 环境库/运行配置写入 `profiles/<profile>/cordis.patch.yml` | ✅ |
| 三层绑定注入（`JAVA_HOME` 注入、`JRE_HOME` 清掉、PATH 前置、字面量 env 原样下发） | ✅ |
| 面板内启动 + 日志 + 设置页「全局开发环境」 | ✅ |
| **AI 配置**：点按钮 → 新会话 → agent 读项目 → 调 `run_env_save` → 配置出现在面板 | ✅ |
| **AI 故障排查**：日志预算（总 48000 / 单条 12000 / 取尾部）+「只排查不修改」 | ✅ |
| Tomcat 路径：独立 `CATALINA_BASE` + 生成的 `server.xml` + java 启动到主类加载阶段 | ✅（用最小 Tomcat 布局验证） |
| 「构建失败不启动服务」（构建退出码 3 → 不启动，端口保持空闲） | ✅ |
| **GB18030 输出**（自写 GBK 字节，模拟 Maven/Gradle）与 **UTF-8 输出**都正确显示，零替换字符 | ✅ |
| **ANSI 着色日志**按终端颜色渲染（普通色/亮色/粗体/下划线/256 色/背景色） | ✅ |
| 终端行为序列（`[2K` 清行、`[1G` 光标归位）、截断序列不显示 | ✅ |
| 浅色/深色两套调色板各用一套配色，与日志底色同源（都跟 `body[data-ds-dark-theme]`） | ✅ |
| 删除开发环境时级联清理引用它的默认绑定与项目绑定 | ✅ |

**未验证**：真实 Tomcat 上的完整启动与优雅关闭（本机没装 Tomcat）。托管启动的 `server.xml` 生成、
argv 组装、`CATALINA_BASE` 隔离、token 握手都有单测覆盖（`tests/tomcat.test.js`，含用本地 TCP 服务器
接住 token 的优雅关闭断言），但没有跑过真的 Tomcat 进程。

## 架构

```
index.js                 插件入口：Config schema（volatile）+ 装配
src/host/contract.js     数据形状 / 三层绑定解析 / 校验
src/host/environment.js  开发环境发现·版本探测·环境注入
src/host/tomcat.js       Tomcat 托管启动（独立 CATALINA_BASE、server.xml、优雅关闭）
src/host/store.js        volatile Config 读写
src/host/processes.js    运行实例注册表（按工作区串行锁 / 就绪探测 / 日志 / 构建阶段）
src/host/routes.js       单一前缀 + action 判别，每个动作回全量快照
src/host/tools.js        给 AI 的 run_env_get / run_env_save
src/client/             浏览器半（TS + esbuild）
```

## 版本兼容

| 版本 | 说明 |
|---|---|
| DSH `0.1.7-alpha.2` | 当前开发基线：`configForms` 设置面、`sidebarRightTabs` tab 类型、`ctx.subprocess` 内置 Job 容器 |
| `@deepseek-ai/schemastery` | 必须 `~3.18.4`（`.volatile()` 从该版本才有） |
| `@deepseek-ai/dsh-tools` | 锁 `0.1.7-alpha.2`（工具注册与 `defineTool` 的 DSL） |
