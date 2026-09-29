/**
 * 合集耦合点：合集的浏览器半区在 settings.section(plugin-kit) 上声明了一个
 * list 子槽 settings.pluginKit.tab。子插件把设置页贡献到该槽时，它会出现在
 * 「设置 → 插件合集」分区的页签栏里；合集缺席时退回本插件自己的入口。
 * 别改槽名：它是 dsh-plugin-kit 与全部子插件之间的唯一契约。
 *
 * 本文件是契约副本（不参与发布，见 package.json files）；client.js 的 factory 里
 * 内联了同一份函数体 —— 客户端半区不能 import npm 包，只能 require('react')。
 */
export function registerKitTab(ctx, options) {
  const slot = options.slot ?? 'settings.pluginKit.tab';
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
