# Agent Note: 运行实例交给 agent 管——一份实现、每轮上下文、不设闸门

Status: implemented

## Problem

用户原话：**「我不想自己启动了运行实例，最后 agent 在测试时还自己在背后启动其他实例」**。

改前本插件对模型只开了两个工具（`run_env_get` / `run_env_save`），覆盖的是**配置**。实例这一侧完全没有入口：

- agent 要让某个服务跑起来，唯一的路是自己 `npm run dev &`（或用 bash 工具起后台进程），
  于是同一个服务被起两遍、端口打架、日志分叉，最后没人分得清哪个实例是真的；
- 它也不知道用户已经起了什么：`/status` 快照里有实例，但没有任何东西**催它去看**；
- 就算它去查了，也没有工具能「用那个实例」——只能自己再起一个。

## Decision

**一、启停只有一份实现。** 新增 `src/host/operations.js`：`prepareRun`（三层绑定 → 子进程 env / Tomcat 托管计划）、
`startRun` / `stopRun`、实例投影（`runState` / `runsOf` / `liveRunsOf`）、`waitForRun`、上下文文案
`renderRunningContext`。面板的 `POST /start|/stop` 与 agent 工具都调它；`routes.js` 里那份内联的 prepareRun 与
`registry.start/stop` 调用整段删除。这是 DSH 插件开发约定 `references/user-actions.md` 的「一个操作、两个调用方」，
`scripts/validate.mjs` 把它钉成断言（`routes.js` 里不得再出现 `registry.start(` / `registry.stop(`）。

**二、模型拿到四个工具。** `run_env_get` 扩展为**配置 + 实例实时状态**（状态、就绪地址、退出码、已跑时长），
描述里明确「开始测试之前也先用它」；新增 `run_env_instance`（`action: start|stop`，`start` 幂等——已在跑就把
同一个实例还回来）与 `run_env_log`（尾部 + `waitForReady` / `waitForText`，替掉「sleep 一会儿再猜」）。

**三、每轮把现状注入上下文。** `src/host/agent-context.js` 用
`ctx.systemPrompt.context({ name: 'run-env:running-instances', order: 130, text })` 注册**动态**上下文——
`text` 是函数，每次组装现算，从 `context.agent.session.cwd` 定位工作区（与内置 `dsh-sandbox-policy` 同一套写法）。
只在真有实例在跑时输出一行（`web（ready · http://localhost:5173 · 已跑 3m）… 不要用 bash 再起一个后台服务`），
空闲时返回空串——`renderContextSections` 会过滤空文本，所以空闲时**一个字节都不占**。求值包 try/catch，
失败退回空串，绝不打断一次组装。

**四、对模型不设审批闸门**（用户的选择）：启停直接执行。可见性由面板承担——agent 起的实例与用户自己起的一样，
出现在右侧栏「运行」里，同一个 registry、同一条日志流、同一张卡片。Config 里留 `agentContext`
（默认 true）与 `agentContextMaxInstances`（默认 6）两个 volatile 开关。

**五、ANSI 解析器搬到 `src/shared/ansi.js`。** 宿主侧的工具输出也要剥色（模型不需要 `ESC[32m`），
而这份实现原本只存在于 `src/client/`——与其复制一份，不如挪成两半共用（3 处 import 更新）。

## Alternatives considered

- **维持现状（让 agent 自己用 bash 起服务）**：用户明确不要，且这正是要修的病灶。
- **用 `agent.inject()` 发一条收件箱消息**：它进 session 日志、并且**不唤醒驱动器**，可能一直等到下一次输入
  才被看到；而这里要的是「每一轮都看得到当前事实」。`systemPrompt.context()` 每次组装现算、不写事件，
  也避开了「插件不要 append 新事件类型」那条坑。
- **用 `systemPrompt.section()` 写一句静态提示**（如「测试前先查运行实例」）：拿不到「当前有哪些实例、
  地址是什么」，等于把判断又原样推回给模型——它照样会自己起。
- **工具侧另写一套启动逻辑**（不复用 routes 的那段）：两条路会在环境绑定、就绪检测、Tomcat 托管计划上
  慢慢分叉；`user-actions` 明确要求「不要在 UI 与工具两条路上各维护一份操作逻辑」。
- **给 `start` 加 `tools/pre-execute` 的 `ask` 闸门**：机制存在（审批服务按 permission preset 决定），
  但用户选了不设闸门；而且他当前是 `danger-full-access` + `approval: never`，加了也只是一条永不被触发的分支。
- **把实例状态塞进已有的「AI 配置 / 故障排查」提示词**：那只在用户点按钮的那一次发生，测试中途 agent 看不到变化。

## Consequences

- 收益：agent 能直接复用用户已经起好的实例（状态与地址就在 `run_env_get` 的返回里）；能启停（幂等，不会有第二遍）；
  能等就绪/等日志而不是硬 sleep；每一轮都能看到「本工作区现在在跑什么」。
- 收益：实例的启停语义从此只有一份实现，面板与模型不会漂移。
- 代价：有实例在跑时，每轮多一行 prompt（空闲时为零）；`run_env_instance` 让模型获得了启动进程的能力——
  用户明确要这个能力，风险由「可见（面板/日志）+ 幂等 + 只能启动用户已配置的实例」兜住（模型不能凭空造命令，
  只能启动工作区里已有的配置）。
- 代价：ANSI 解析器搬到 `src/shared/`，客户端 bundle 需要重新构建（已提交 `lib/client.js`）。
- 验证：`tests/agent.test.js`（37 条：工具注册与语义、`waitForText`/`waitForReady`/超时/实例已退出、
  上下文空/满/无 cwd/求值抛错、文案条数与上限）；`scripts/validate.mjs` 新增 18 条契约断言；
  真机用**真实子进程**跑过一次完整闭环：`start`（running）→ `waitForText` 命中且日志无 ESC →
  再 `start` 仍只有 1 个实例（`alreadyRunning: true`）→ 有实例时上下文出现、停止后回到空串。
  **未验证**：真机 DSH 里模型的实际行为（注入上下文后是否真的不再自己起后台服务）——那要在桌面端实测。
