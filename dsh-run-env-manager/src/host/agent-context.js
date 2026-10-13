/**
 * 每轮的「运行实例」动态上下文。
 *
 * 要解决的问题（用户原话）：他自己在右侧栏把服务起好了，agent 测试时**又用 bash 起了一个**，
 * 同一个服务跑两遍。工具能让 agent 查到实例，但它不会每次主动查；把「本工作区现在有什么在跑」
 * 放进每一轮的运行时上下文，它就没有理由再自己起。
 *
 * 机制（与内置 `dsh-sandbox-policy` 同一套写法）：
 *  - `ctx.systemPrompt.context({ name, order, text })` 注册的是**每次组装都重新求值**的动态上下文，
 *    `text` 可以是一个函数，拿到的是当次组装上下文（含 `context.agent`）；
 *  - 因此只需注册一次，`text` 里按 agent 的会话 cwd 现算工作区，不需要为每个 agent 单独挂；
 *  - **空字符串会被 `renderContextSections` 过滤掉**，所以没有实例时这段上下文一个字节都不占；
 *  - 不写 session 事件、不调 `agent.inject()`：注入消息会进收件箱并可能等到下一次输入才被看到，
 *    而这里要的是「每一轮都看得到当前事实」。
 *
 * order 用 130：内置的 CONTEXT_ORDERS 是 SANDBOX_POLICY=110、APPROVAL_POLICY=115、
 * SUBAGENT_DELEGATION=120，本条目排在这些策略文本之后（外部贡献者可以用任意有限值）。
 */
const CONTEXT_NAME = 'run-env:running-instances';
const CONTEXT_ORDER = 130;

/** 一次组装上下文里拿 agent 的会话 cwd（与工具侧的 resolveRoot 同一套回退顺序）。 */
function sessionRoot(agent) {
  const session = agent?.session;
  for (const candidate of [session?.cwd, session?.meta?.cwd, session?.header?.cwd, agent?.meta?.cwd]) {
    if (typeof candidate === 'string' && candidate !== '') return candidate;
  }
  return undefined;
}

/**
 * 注册这条动态上下文。`systemPrompt` 缺失（headless/精简 profile）时静默跳过。
 *
 * @param options.render - 由 operations.js 提供的文案函数（registry + root → 一行文本）。
 * @returns 该注册的 disposer；插件卸载时随之撤销。
 */
export function registerAgentContext(ctx, options) {
  const render = options.render;
  return ctx.inject(['systemPrompt'], (scope) => {
    scope.systemPrompt.context({
      name: CONTEXT_NAME,
      order: CONTEXT_ORDER,
      text: (context) => {
        const root = sessionRoot(context?.agent);
        if (root === undefined) return '';
        try {
          return render(root);
        } catch {
          // 上下文求值失败绝不能打断一次组装：退回「这一轮没有这段上下文」。
          return '';
        }
      },
    });
  });
}

export { CONTEXT_NAME, CONTEXT_ORDER };
