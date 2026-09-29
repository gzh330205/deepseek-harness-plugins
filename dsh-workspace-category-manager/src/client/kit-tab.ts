/**
 * 合集耦合点：合集（dsh-plugin-kit）的浏览器半区在 settings.section(plugin-kit)
 * 上声明了 list 子槽 settings.pluginKit.tab。子插件贡献到该槽 → 出现在
 * 「设置 → 插件合集」分区；合集缺席 → 退回本插件自己的入口。别改槽名。
 *
 * 两个必须遵守的点（都踩过）：
 *  1. ctx.slots.subscribe 订阅时不会立刻回调，只在后续槽变更时通知；订阅后必须
 *     同步跑一次 apply()，否则「合集先加载、子插件后加载」时搬家不生效。
 *  2. 状态必须用显式 mode 记录，不能用 Boolean(dispose)：合集缺席时 dispose 也是
 *     undefined，守卫会把「还没注册」误判成「已注册」，fallback 永远不执行。
 */
export function registerKitTab(ctx: any, options: any) {
  const slot = options.slot ?? 'settings.pluginKit.tab';
  const slots = ctx.slots;
  let dispose: (() => void) | undefined;
  let mode: 'tab' | 'fallback' | undefined;
  const apply = () => {
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
  ctx.effect(() => () => { off(); if (dispose) dispose(); }, options.effectName ?? 'plugin-kit: settings tab');
}
