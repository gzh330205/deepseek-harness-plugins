/**
 * dsh-plugin-kit — 插件合集（浏览器半区源码）。
 *
 * 这个半区只做两件事：
 *   1. 在 Settings 里注册一个顶层分区「插件合集」（`settings.section`，
 *      id `plugin-kit`，order 18），并在它下面声明一个 list 子槽
 *      `settings.pluginKit.tab` —— 这是合集与全部子插件之间唯一的契约；
 *   2. 渲染这个分区：页签栏（role=tablist）+ 当前激活面板，面板内容通过
 *      `renderSlot('settings.pluginKit.tab', {}, { only: id })` 交给子插件。
 *
 * 它**不**注册任何 `settings.plugins.tab`：子插件的设置页在这里聚合，
 * 不和「内置插件」分区抢同一块配置面。
 *
 * 客户端半区没有 JSX 转译，也没有 jsx-runtime，只能 require('react')，
 * 所有元素都用 React.createElement 构造。
 */
import React from 'react';

/** 本分区拥有的 locale 命名空间。 */
const NS = 'settings.pluginKit';
/** 子插件贡献设置页的 list 子槽（契约名，不要改）。 */
const TABS_KEY = 'settings.pluginKit.tab';

const h = React.createElement;

const CSS_ID = 'dsh-plugin-kit/settings.css';
const CSS = `
.ps-suite{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
.ps-heading{margin:0;font-size:18px;font-weight:600}
.ps-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.55}
.ps-tabs{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:22px;margin-top:2px;display:flex;flex-wrap:wrap}
.ps-tab{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;padding:7px 1px 9px;font-size:13px;line-height:20px;position:relative}
.ps-tab:hover,.ps-tab[data-active=true]{color:var(--dsw-alias-label-primary)}
.ps-tab[data-active=true]:after,.ps-tab:focus-visible:after{background:var(--dsw-alias-label-primary);content:"";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:-1px;left:0;right:0}
.ps-tab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;color:var(--dsw-alias-label-primary);border-radius:2px}
.ps-panel{min-width:0;padding-top:2px}
.ps-empty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}
`;

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${CSS_ID}"]`) === null) {
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-plugin-kit';
  tag.dataset.pluginCss = CSS_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

/** 简体中文文案。 */
const zh = {
  nav: '插件合集',
  title: '插件合集',
  intro: '本部署安装的插件把自己的设置页贡献到这里，集中在一个分区里管理。',
  tabs: '插件页签',
  empty: '本部署没有可用的插件配置页。',
};

/** 英文文案。 */
const en = {
  nav: 'Plugin Kit',
  title: 'Plugin Kit',
  intro: 'Plugins installed in this deployment contribute their settings pages here, grouped into a single section.',
  tabs: 'Plugin tabs',
  empty: 'This deployment exposes no plugin configuration pages.',
};

/** 需要浏览器端的 slots 与 locale 服务。 */
export const inject = ['slots', 'locale'];

/**
 * list 槽的 label 可能是 thunk（跟随当前语言），读取时再求值。
 * 与 `@deepseek-ai/dsh-client-ui-slots` 的 resolveSlotLabel 语义一致。
 * @param label - 注册时写入的 label。
 * @returns 展示字符串，未声明时为 undefined。
 */
function resolveLabel(label) {
  return typeof label === 'function' ? label() : label;
}

/**
 * 「插件合集」分区组件。
 *
 * @param props.t - 绑定到本分区 locale 命名空间的翻译函数。
 * @param props.renderSlot - 渲染本分区子槽的绑定（框架注入）。
 * @param props.useTabs - 子槽注册表的选择器 hook（由 register options 的 hooks 源绑定）。
 * @param props.tabs - hooks 源缺席时的静态兜底快照（正常路径不会用到）。
 */
function PluginKitSection({ t, renderSlot, useTabs, tabs: fallbackTabs }) {
  const tabsId = React.useId();
  const tabRefs = React.useRef([]);
  /* 框架把 register options 的 hooks.tabs 绑成 useTabs 传进来；万一某个宿主
   * 版本没有绑定 hooks 源，就退回注入时算好的静态快照，而不是让设置页崩掉。 */
  const rows = typeof useTabs === 'function' ? useTabs((value) => value) : (fallbackTabs ?? []);
  const [requestedId, setActiveId] = React.useState();
  const [visitedIds, setVisitedIds] = React.useState(() => new Set());
  /* 激活项按 id 匹配：贡献方重排/消失时退回第一个，而不是停在空面板。 */
  const active = rows.find((row) => row.id === requestedId)?.id ?? rows[0]?.id;

  React.useEffect(() => {
    if (active === undefined) return;
    setVisitedIds((previous) => {
      if (previous.has(active)) return previous;
      return new Set([...previous, active]);
    });
  }, [active]);

  const heading = h('h2', { className: 'ps-heading' }, t('title'));
  const intro = h('p', { className: 'ps-intro' }, t('intro'));

  if (rows.length === 0) {
    return h('div', { className: 'ps-suite' }, heading, intro, h('p', { className: 'ps-empty' }, t('empty')));
  }

  const tabBar = h('div', { className: 'ps-tabs', role: 'tablist', 'aria-label': t('tabs') },
    rows.map((row, index) => {
      const selected = row.id === active;
      return h('button', {
        key: row.id,
        ref: (element) => {
          tabRefs.current[index] = element;
        },
        id: `${tabsId}-tab-${row.id}`,
        type: 'button',
        role: 'tab',
        className: 'ps-tab',
        'aria-selected': selected,
        'aria-controls': `${tabsId}-panel-${row.id}`,
        'data-active': selected ? 'true' : undefined,
        tabIndex: selected ? 0 : -1,
        onClick: () => {
          setActiveId(row.id);
        },
        onKeyDown: (event) => {
          let nextIndex;
          switch (event.key) {
            case 'ArrowRight':
              nextIndex = (index + 1) % rows.length;
              break;
            case 'ArrowLeft':
              nextIndex = (index - 1 + rows.length) % rows.length;
              break;
            case 'Home':
              nextIndex = 0;
              break;
            case 'End':
              nextIndex = rows.length - 1;
              break;
            default:
              return;
          }
          event.preventDefault();
          const nextRow = rows[nextIndex];
          const nextTab = tabRefs.current[nextIndex];
          setActiveId(nextRow.id);
          if (nextTab) nextTab.focus();
        },
      }, row.label);
    }));

  /* 未激活面板 hidden，但访问过的保持挂载（切回来不丢本地状态）。 */
  const panels = rows
    .filter((row) => row.id === active || visitedIds.has(row.id))
    .map((row) => {
      const selected = row.id === active;
      return h('div', {
        key: row.id,
        id: `${tabsId}-panel-${row.id}`,
        className: 'ps-panel',
        role: 'tabpanel',
        'aria-labelledby': `${tabsId}-tab-${row.id}`,
        hidden: !selected,
      }, renderSlot(TABS_KEY, {}, { only: row.id }));
    });

  return h('div', { className: 'ps-suite' }, heading, intro, tabBar, panels);
}

/**
 * 挂载「插件合集」分区。
 * @param ctx - 浏览器端插件上下文。
 */
export function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-kit: section dictionaries');

  let tabsVersion = -1;
  let tabsRevision = -1;
  let tabs = [];

  /* 子槽注册表 + locale 快照 → 稳定的页签行投影：
   * 按 order 升序（同一 order 保持注册顺序，Array#sort 是稳定排序）。 */
  const tabsSource = {
    getSnapshot: () => {
      const version = ctx.slots.getVersion(TABS_KEY);
      const revision = ctx.locale.getSnapshot().revision;
      if (version !== tabsVersion || revision !== tabsRevision) {
        tabsVersion = version;
        tabsRevision = revision;
        tabs = ctx.slots.entries(TABS_KEY)
          .map((entry) => ({
            id: entry.options.id ?? '',
            order: entry.options.order ?? 0,
            label: resolveLabel(entry.options.label) ?? '',
          }))
          .sort((a, b) => a.order - b.order);
      }
      return tabs;
    },
    subscribe: (listener) => {
      const offLedger = ctx.slots.subscribe(TABS_KEY, listener);
      const offLocale = ctx.locale.subscribe(listener);
      return () => {
        offLedger();
        offLocale();
      };
    },
  };

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'plugin-kit',
    order: 18,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ tabs: tabsSource.getSnapshot(), hooks: { tabs: tabsSource } }),
    children: {
      [TABS_KEY]: { kind: 'list', scope: 'root' },
    },
  }, PluginKitSection));
}
