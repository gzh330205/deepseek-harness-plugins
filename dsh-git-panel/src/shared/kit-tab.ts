/**
 * 合集耦合点：合集包 dsh-plugin-kit 的浏览器半区在 `settings.section`
 * （id = `plugin-kit`）上声明了一个 list 子槽 `settings.pluginKit.tab`。
 * 子插件把设置页贡献到该槽，它就会出现在「设置 → 插件合集」分区的页签栏里；
 * 合集缺席时退回本插件自己的入口（fallback）。
 *
 * 不改槽名：它是 dsh-plugin-kit 与全部子插件之间唯一的契约。
 *
 * 机制（DSH 0.1.7 的 slots 服务）：
 *   - `slots.spec(key)`：判断槽是否已声明。**不要用 `specDynamic`**——那是内部
 *     SlotCore 的方法，客户端 slots 服务（SlotRegistry）不暴露它；用它只会得到
 *     undefined，于是永远走 fallback（真实浏览器验证时踩到过）。
 *   - `slots.subscribe(key, fn)`：微任务批处理；订阅发生在声明之前也合法，
 *     声明发生时同样会通知。但订阅本身**不会**立刻回调，所以订阅后必须同步
 *     跑一次判定——否则「合集先加载、子插件后加载」这种最常见的顺序下，
 *     设置页签会一直不出现（等下一次槽变更才补上）。
 *   - `slots.spec(key)`：未声明的槽返回 undefined。
 *   - list 槽同一个 id 只能有一个注册（重复注册会抛错），所以切换必须
 *     先 dispose 再注册。
 *
 * 状态用显式的 mode 记录（'suite' | 'fallback'），**不能**用 `Boolean(dispose)`
 * 当状态：合集缺席时 dispose 也是 undefined，守卫会把「还没注册」误判成
 * 「已经注册」，fallback 永远不执行（fallback 的唯一触发时机就是首次判定）。
 */

export interface SuiteTabOptions {
  /** 合集槽名，默认 `settings.pluginKit.tab`。 */
  slot?: string;
  /** 合集在场时的注册器，返回 disposer。 */
  tab: () => (() => void) | undefined;
  /** 合集缺席时的注册器，返回 disposer。 */
  fallback?: () => (() => void) | undefined;
  /** ctx.effect 的标签。 */
  effectName?: string;
}

export function registerKitTab(ctx: any, options: SuiteTabOptions): void {
  const slot = options.slot ?? 'settings.pluginKit.tab';
  const slots = ctx.slots;
  let dispose: (() => void) | undefined;
  let mode: 'tab' | 'fallback' | undefined;
  const apply = (): void => {
    const declared = slots.spec?.(slot) !== undefined;
    const next: 'tab' | 'fallback' | undefined = declared ? 'tab' : options.fallback ? 'fallback' : undefined;
    if (next === mode) return;
    if (dispose) dispose();
    dispose = undefined;
    mode = next;
    dispose = next === 'tab' ? options.tab() : next === 'fallback' ? options.fallback() : undefined;
  };
  const off = slots.subscribe(slot, apply);
  apply();
  ctx.effect(
    () => () => {
      off();
      if (dispose) dispose();
    },
    options.effectName ?? 'plugin-kit: settings tab',
  );
}
