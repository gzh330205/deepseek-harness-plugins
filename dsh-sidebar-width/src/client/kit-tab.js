/**
 * 合集耦合点：合集包 dsh-plugin-kit 的浏览器半区在 `settings.section`
 * （id = `plugin-kit`）上声明了一个 list 子槽 `settings.pluginKit.tab`。
 * 子插件把设置页贡献到该槽，它就会出现在「设置 → 插件合集」分区的页签栏里。
 *
 * 不改槽名：它是 dsh-plugin-kit 与全部子插件之间唯一的契约。
 *
 * 三个踩过的坑（都有回归测试）：
 *   1. 判定「槽是否已声明」必须用 `ctx.slots.spec(key)`。**不要用 `specDynamic`**：
 *      那是内部 SlotCore 的方法，客户端 slots 服务（ui-renderer 的 SlotRegistry）
 *      不暴露它，调用只会得到 undefined，于是永远走 fallback。
 *   2. `slots.subscribe(key, fn)` 订阅时**不会**立刻回调（只在后续槽变更时通知），
 *      所以订阅之后必须同步跑一次 apply()，否则「合集先加载、子插件后加载」这种
 *      最常见的顺序下页签永远不出现。
 *   3. 状态要用显式 mode，**不能**用 `Boolean(dispose)`：合集缺席时 dispose 也是
 *      undefined，守卫会把「还没注册」误判成「已注册」，fallback 永不执行。
 */

/** 契约槽名（与 dsh-plugin-kit 的 TABS_KEY 必须一致）。 */
export const KIT_TAB_SLOT = 'settings.pluginKit.tab';

/**
 * 判断合集槽是否已声明。
 * @param ctx 浏览器插件上下文
 * @returns spec（未声明时 undefined）
 */
export function resolveKitSlot(ctx) {
  return ctx?.slots?.spec?.(KIT_TAB_SLOT);
}

/**
 * 双态注册器：合集在场 → options.tab()；缺席 → options.fallback()。
 * @param ctx 浏览器插件上下文
 * @param options {{ slot?, tab, fallback?, effectName? }}
 */
export function registerKitTab(ctx, options) {
  const slot = options.slot ?? KIT_TAB_SLOT;
  const slots = ctx.slots;
  let dispose;
  let mode;
  const apply = () => {
    const declared = slots.spec?.(slot) !== undefined;
    const next = declared ? 'tab' : options.fallback ? 'fallback' : undefined;
    if (next === mode) return;
    if (dispose) dispose();
    dispose = undefined;
    mode = next;
    dispose = next === 'tab' ? options.tab() : next === 'fallback' ? options.fallback() : undefined;
  };
  const off = slots.subscribe(slot, apply);
  apply();
  ctx.effect(() => () => { off(); if (dispose) dispose(); }, options.effectName ?? 'plugin-kit: settings tab');
}
