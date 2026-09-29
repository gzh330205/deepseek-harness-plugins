/**
 * dsh-sidebar-width — 浏览器半（源码，esbuild 打成 lib/client.js）。
 *
 * 做三件事：
 *   1. 从 DSH 的布局 store 读当前左右栏宽度；
 *   2. 把全局配置里的宽度写回布局 store（走它自己的 actions）；
 *   3. 用户拖动分隔条后，把新宽度记回全局配置。
 *
 * 关键：**完全不碰 DOM**。
 *
 * ui-layout 的布局 store 是它内部 `createLayoutStore()` 的产物，表面上没有对外服务
 * （`ctx.layout` 只暴露 `toggleSidebar`）。但它在注册 `root` 槽时把 store 句柄放进了
 * 注册项，而 renderer 的 `_register()` 会把它并进 entry，于是可以这样拿到**活实例**：
 *
 *     const instance = ctx.slots.entries('root')[0].store.create();
 *     instance.getSnapshot().layoutInfo   // { sidebar, rightbar, rightbarShown, viewportWidth, … }
 *     instance.actions.setSidebar(px)     // 左侧栏
 *     instance.actions.setRightbar(px)    // 右侧栏
 *     instance.subscribe(listener)
 *
 * 为什么必须走 actions 而不是直接改 DOM：右侧面板的宽度是引擎自己算的（绝对定位、
 * 宽度 = 引擎值），三列轨道只是给中间栏留位。早期版本改写 `grid-template-columns`，
 * 轨道一旦比面板窄，面板就向左溢出、盖住中间栏——真机上出现过。走 actions 时面板宽度、
 * 轨道、引擎内部状态天然一致。
 *
 * 另外 ui-layout 比本插件后注册，所以 `entries('root')` 一开始是空的，必须轮询等它。
 *
 * 客户端半区约束：不能 JSX、不能 import npm 包，只能 require('react')。
 */
import React from 'react';
import { h } from './h.js';
import { KIT_TAB_SLOT, registerKitTab } from './kit-tab.js';

const NS = 'settings.sidebarWidth';
/** Loader 行 id = 宿主配置命名空间。 */
const SETTINGS_NAMESPACE = 'sidebar-width';

/** 与宿主 schema / 原生 clamp 一致。 */
const SIDEBAR_MIN = 264;
const SIDEBAR_MAX = 420;
const RIGHTBAR_MIN = 300;
/** 原生在视口小于这个宽度时会自动折叠左栏，此时不强行展开。 */
const SIDEBAR_AUTO_COLLAPSE = 1024;
/** 拖动时每一步都会触发一次 store 变更，写配置要防抖。 */
const RECORD_DEBOUNCE_MS = 300;
/** DSH 内置引导页的 tab kind（见 dsh-client-ui-sidebar-right 的 GUIDE_KIND）。 */
const GUIDE_KIND = 'guide';

/* ── 设置页样式（沿用 DSH 主题变量，浅/深色都跟随） ─────────────────── */

const CSS_ID = 'dsh-sidebar-width/settings.css';
const CSS = `
.sw{display:flex;flex-direction:column;gap:14px;max-width:760px;color:var(--dsw-alias-label-primary)}
.sw-title{font-size:18px;font-weight:600;margin:0}
.sw-muted{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.55;margin:0}
.sw-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:0}
.sw-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.sw-form label{display:flex;flex-direction:column;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}
.sw-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px}
.sw-check{display:flex;align-items:center;gap:7px;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}
.sw-actions{display:flex;gap:6px;justify-content:flex-end}
.sw-actions button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}
.sw-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sw-actions button:disabled{cursor:default;opacity:.5}
.sw-primary{background:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-brand-primary)!important;color:#fff!important}
.sw-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5;margin:0}
.sw-ok{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:1.5;margin:0}
.sw-live{font-family:var(--ds-font-family-code,monospace);font-size:12px;color:var(--dsw-alias-label-secondary);margin:0}
`;

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${CSS_ID}"]`) === null) {
  const style = document.createElement('style');
  style.dataset.plugin = 'dsh-sidebar-width';
  style.dataset.pluginCss = CSS_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/* ── 文案 ───────────────────────────────────────────────────────────── */

const zh = {
  tab: '侧栏宽度',
  title: '侧栏宽度',
  intro: '把左右侧边栏宽度存成全局配置：换会话、刷新页面、重启 DSH 都保持同一宽度。DSH 原生完全不持久化左侧栏，右侧栏只按会话记。',
  sidebarLabel: '左侧栏宽度（px）',
  rightbarLabel: '右侧栏宽度（px）',
  hint: `左侧栏原生限制 ${SIDEBAR_MIN}–${SIDEBAR_MAX}px；右侧栏最小 ${RIGHTBAR_MIN}px（上限是视口的 70%）。填 0 表示「不设置、用原生默认」。`,
  live: '当前生效：左 {left} ／ 右 {right}',
  liveNone: '（未展开）',
  save: '保存并应用',
  reset: '清除记录',
  saving: '保存中…',
  saved: '已保存并应用。',
  loading: '正在连接 DSH 布局…',
  unavailable: '拿不到 DSH 的布局 store，此部署不支持调整侧栏宽度。',
  autoHint: '直接拖动分隔条也会自动记录（无需回到这里点保存）；收起侧栏不会被记录。',
  guideLabel: '关闭右栏最后一个标签后，改为显示引导页',
  guideHint: '右栏只剩一个标签时关掉它，DSH 默认会把整个右栏收起。打开这一项后停在引导页（kind: guide）。手动点收起按钮不受影响。',
};

const en = {
  tab: 'Sidebar width',
  title: 'Sidebar widths',
  intro: 'Keep the left and right sidebar widths in one global setting: they survive session switches, page reloads and DSH restarts. DSH itself persists neither (the right one only per session).',
  sidebarLabel: 'Left sidebar width (px)',
  rightbarLabel: 'Right sidebar width (px)',
  hint: `The left sidebar is natively clamped to ${SIDEBAR_MIN}–${SIDEBAR_MAX}px; the right one needs at least ${RIGHTBAR_MIN}px (up to 70% of the viewport). 0 means "not set — keep the native default".`,
  live: 'In effect: left {left} / right {right}',
  liveNone: '(collapsed)',
  save: 'Save and apply',
  reset: 'Forget',
  saving: 'Saving…',
  saved: 'Saved and applied.',
  loading: 'Connecting to the DSH layout…',
  unavailable: 'The DSH layout store is unavailable, so this deployment cannot adjust sidebar widths.',
  autoHint: 'Dragging the divider is recorded automatically — no need to come back here. Collapsing a sidebar is never recorded.',
  guideLabel: 'Show the guide page after the last right-side tab closes',
  guideHint: 'Closing the only tab of the right column makes DSH collapse the whole column. With this on you land on the guide page instead (kind: guide). The collapse button is unaffected.',
};

/* ── 布局 store ─────────────────────────────────────────────────────── */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * 等 ui-layout 把它的 store 注册进 `root` 槽（它比本插件后注册，所以必须轮询）。
 *
 * @param ctx 浏览器插件上下文
 * @param onReady 拿到活实例时回调
 * @param onUnavailable 超时或取不到时回调
 * @returns 清理函数
 */
function acquireLayoutStore(ctx, onReady, onUnavailable, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const timer = setInterval(() => {
    let instance;
    try {
      const entries = ctx.slots.entries?.('root') ?? [];
      const entry = entries[0] ?? ctx.slots.entriesOfSlot?.('root')?.[0];
      const handle = entry?.store;
      // ui-layout 把 `create` 重写成了 `() => instance`，所以拿到的就是活实例。
      instance = typeof handle?.create === 'function' ? handle.create() : undefined;
    } catch (error) {
      clearInterval(timer);
      onUnavailable(error);
      return;
    }
    const usable =
      instance !== undefined &&
      instance.actions !== undefined &&
      typeof instance.getSnapshot === 'function' &&
      typeof instance.subscribe === 'function';
    if (usable) {
      clearInterval(timer);
      onReady(instance);
      return;
    }
    if (Date.now() > deadline) {
      clearInterval(timer);
      onUnavailable();
    }
  }, 200);
  return () => clearInterval(timer);
}

/** 读当前左右栏宽度；0 表示折叠 / 未设置。 */
function readWidths(instance) {
  const info = instance.getSnapshot().layoutInfo;
  return { left: info.sidebar, right: info.rightbar ?? 0, viewport: info.viewportWidth };
}

/**
 * 把全局配置应用到布局 store。
 *
 * 只在「启动」和「配置变化」时调用——**不**在 store 订阅回调里调用：拖动过程中每一步
 * 都会改 store，那时再应用配置就是跟用户的手对着干。
 *
 * @param instance 布局实例
 * @param config 全局配置
 * @param expected 记下我们写进去的值，避免把自己写的东西当成用户意图记回来
 * @returns 写入后的实际宽度
 */
function applyWidths(instance, config, expected) {
  if (config.enabled === false) return readWidths(instance);
  const { left, right, viewport } = readWidths(instance);
  const narrow = (viewport || window.innerWidth || 0) < SIDEBAR_AUTO_COLLAPSE;
  const wantLeft = Number(config.sidebarWidth) || 0;
  // 折叠态（0）不强行展开；窄视口交给原生自动折叠逻辑。
  if (wantLeft > 0 && !narrow && left > 0) {
    const target = clamp(wantLeft, SIDEBAR_MIN, SIDEBAR_MAX);
    if (left !== target) {
      instance.actions.setSidebar(target);
      expected.sidebar = readWidths(instance).left;
    }
  }
  const wantRight = Number(config.rightbarWidth) || 0;
  // 右侧栏没打开时 `rightbar` 是一个「偏好值」：现在就写进去，用户下次展开即用。
  if (wantRight > 0) {
    const target = Math.max(RIGHTBAR_MIN, Math.round(wantRight));
    if (right !== target) {
      instance.actions.setRightbar(target);
      expected.rightbar = readWidths(instance).right;
    }
  }
  return readWidths(instance);
}

/* ── 「关掉最后一个标签 → 回引导页」 ─────────────────────────────────── */

/**
 * DSH 原生：右栏只剩一个标签时关闭它，`closeTab`（sidebar-right 的 store）会一并
 * `planSetExpanded(false)`，把整个右栏收起。想让它停在引导页，就得在这里补一手。
 *
 * 判据为什么是「`rightbarShown` 由 true 变 false **且** 活动 dock pane 已空」：
 *
 *   - 手动点收起按钮：`expanded` 变 false，但 pane 里的标签还在，
 *     `commandTarget().tabId` 有值 → 不动（否则用户永远收不起右栏）；
 *   - 引导页自己作为唯一 docked 标签时**没有关闭按钮**（`canCloseTab` 明令禁止），
 *     所以不存在「关了又被本插件打开」的死循环；
 *   - 只有「关闭最后一个标签」会同时满足「收起」+「pane 为空」。
 *
 * 打开引导页走的是公开服务 `ctx.sidebarRight.openTabFromTarget('guide', target)`；
 * 它内部的 `openContent` 一定会 `planSetExpanded(true)`，所以列会重新展开。
 * 窄视口（<768px）下右栏是全屏浮层，那里让原生照常收起，不打扰用户。
 *
 * @param ctx 浏览器插件上下文
 * @param readConfig 读当前全局配置
 * @returns 接收 `layoutInfo` 的观察函数（挂在布局 store 的订阅里）
 */
function createGuideFallback(ctx, readConfig) {
  const service = ctx.sidebarRight;
  if (
    service === undefined ||
    typeof service.commandTarget !== 'function' ||
    typeof service.openTabFromTarget !== 'function'
  ) {
    return () => {};
  }
  let previousShown;
  let previousFullscreen = false;
  let reopening = false;
  return (info) => {
    const shown = info?.rightbarShown === true;
    const fullscreen = info?.rightbarFullscreen === true;
    const wasShown = previousShown;
    const wasFullscreen = previousFullscreen;
    previousShown = shown;
    previousFullscreen = fullscreen;
    // 只在「刚收起」这一帧动作；首次观测（wasShown undefined）不算。
    if (reopening || shown || wasShown !== true || wasFullscreen) return;
    const config = readConfig();
    if (config.enabled === false || config.guideOnLastTab === false) return;
    let target;
    try {
      target = service.commandTarget();
    } catch (error) {
      console.warn('[dsh-sidebar-width] 读取右栏目标失败，跳过引导页回退', error);
      return;
    }
    // tabId 仍在 = 用户手动收起，或收起的不是「空掉的」那一列。
    if (target === undefined || target.tabId !== undefined || target.host !== 'dock') return;
    reopening = true;
    try {
      service.openTabFromTarget(GUIDE_KIND, target);
    } catch (error) {
      console.warn('[dsh-sidebar-width] 关闭最后一个标签后无法打开引导页', error);
    } finally {
      reopening = false;
    }
  };
}

/* ── 设置页 ─────────────────────────────────────────────────────────── */

function useScope(scope) {
  return React.useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
    () => scope.getSnapshot(),
  );
}

function SidebarWidthSettings({ scope, holder, t }) {
  const snapshot = useScope(scope);
  const [draft, setDraft] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState('');
  const [note, setNote] = React.useState('');
  const [live, setLive] = React.useState({ left: 0, right: 0 });
  const [, forceTick] = React.useState(0);
  const instance = holder?.instance;

  // 面板打开期间显示引擎里真正生效的宽度；store 晚于页签注册，所以靠这个轮询
  // 既刷新数值、也把「store 就绪」这件事推给 React。
  React.useEffect(() => {
    const timer = setInterval(() => {
      const current = holder?.instance;
      if (current !== undefined) {
        const { left, right } = readWidths(current);
        setLive({ left, right });
      }
      forceTick((n) => n + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [holder]);

  const saved = snapshot?.value ?? {};
  const value = {
    sidebarWidth: draft?.sidebarWidth ?? saved.sidebarWidth ?? 0,
    rightbarWidth: draft?.rightbarWidth ?? saved.rightbarWidth ?? 0,
    guideOnLastTab: draft?.guideOnLastTab ?? saved.guideOnLastTab ?? true,
  };
  const patch = (key, next) => setDraft((old) => ({ ...(old ?? value), [key]: next }));

  const save = async () => {
    setFailure('');
    setNote('');
    setBusy(true);
    try {
      const sidebar = clamp(Math.max(0, Number(value.sidebarWidth) || 0), 0, 2000);
      const rightbar = clamp(Math.max(0, Number(value.rightbarWidth) || 0), 0, 4000);
      await scope.set('sidebarWidth', sidebar);
      await scope.set('rightbarWidth', rightbar);
      await scope.set('guideOnLastTab', value.guideOnLastTab !== false);
      // 立刻应用一次，不必等下次刷新。
      if (holder?.instance !== undefined) {
        applyWidths(holder.instance, { ...saved, sidebarWidth: sidebar, rightbarWidth: rightbar }, {});
      }
      setDraft(null);
      setNote(t('saved'));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setFailure('');
    setNote('');
    setBusy(true);
    try {
      await scope.set('sidebarWidth', 0);
      await scope.set('rightbarWidth', 0);
      setDraft(null);
      setNote(t('saved'));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (px) => (px > 0 ? `${px}px` : t('liveNone'));
  if (snapshot?.status === 'loading') return h('p', { className: 'sw-muted' }, t('loading'));
  if (snapshot?.status !== 'ready' || instance === undefined) {
    return h('p', { className: 'sw-error' }, t('unavailable'));
  }

  return h(
    'div',
    { className: 'sw' },
    h('h2', { className: 'sw-title' }, t('title')),
    h('p', { className: 'sw-muted' }, t('intro')),
    h('p', { className: 'sw-live' }, t('live', { left: fmt(live.left), right: fmt(live.right) })),
    h(
      'div',
      { className: 'sw-form' },
      h(
        'label',
        null,
        t('sidebarLabel'),
        h('input', {
          className: 'sw-input',
          type: 'number',
          min: 0,
          max: 2000,
          value: String(value.sidebarWidth),
          onChange: (event) => patch('sidebarWidth', Number(event.target.value) || 0),
        }),
      ),
      h(
        'label',
        null,
        t('rightbarLabel'),
        h('input', {
          className: 'sw-input',
          type: 'number',
          min: 0,
          max: 4000,
          value: String(value.rightbarWidth),
          onChange: (event) => patch('rightbarWidth', Number(event.target.value) || 0),
        }),
      ),
    ),
    h('p', { className: 'sw-hint' }, t('hint')),
    h('p', { className: 'sw-hint' }, t('autoHint')),
    h(
      'label',
      { className: 'sw-check' },
      h('input', {
        type: 'checkbox',
        checked: value.guideOnLastTab !== false,
        onChange: (event) => patch('guideOnLastTab', event.target.checked),
      }),
      t('guideLabel'),
    ),
    h('p', { className: 'sw-hint' }, t('guideHint')),
    failure ? h('p', { className: 'sw-error' }, failure) : null,
    note ? h('p', { className: 'sw-ok' }, note) : null,
    h(
      'div',
      { className: 'sw-actions' },
      h('button', { className: 'sw-primary', onClick: save, disabled: busy }, busy ? t('saving') : t('save')),
      h('button', { className: 'sw-secondary', onClick: reset, disabled: busy }, t('reset')),
    ),
  );
}

/* ── 插件入口 ───────────────────────────────────────────────────────── */

export const inject = ['slots', 'locale', 'configForms', 'sidebarRight'];

export function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'sidebar-width: dictionaries');
    const t = ctx.locale.bind(NS);
    const scope = ctx.configForms.get(SETTINGS_NAMESPACE);
    const readConfig = () => scope.getSnapshot()?.value ?? {};

    /** 我们写进去的值记在这里，用来把「自己写的」和「用户改的」分开。 */
    const expected = { sidebar: undefined, rightbar: undefined };
    const lastSeen = { sidebar: undefined, rightbar: undefined };
    let recordTimer = null;
    let recordPending = {};
    /** store 比本插件晚注册，所以用持有对象承载，面板按引用读。 */
    const holder = { instance: undefined };

    const flushRecord = () => {
      recordTimer = null;
      const pending = recordPending;
      recordPending = {};
      const saved = readConfig();
      if (pending.sidebar !== undefined && pending.sidebar !== saved.sidebarWidth) {
        void scope.set('sidebarWidth', pending.sidebar);
      }
      if (pending.rightbar !== undefined && pending.rightbar !== saved.rightbarWidth) {
        void scope.set('rightbarWidth', pending.rightbar);
      }
    };

    /** 「最后一个标签关闭 → 引导页」的观察者（见 createGuideFallback）。 */
    const observeRightbar = createGuideFallback(ctx, readConfig);

    const onStoreChange = () => {
      if (holder.instance === undefined) return;
      const info = holder.instance.getSnapshot().layoutInfo;
      observeRightbar(info);
      const saved = readConfig();
      // 只记「用户真的改过」的值：展开态（>0）、不是我们刚写进去的、和配置不同。
      if (
        info.sidebar > 0 &&
        info.sidebar !== lastSeen.sidebar &&
        info.sidebar !== expected.sidebar &&
        info.sidebar !== saved.sidebarWidth
      ) {
        recordPending.sidebar = info.sidebar;
        expected.sidebar = info.sidebar;
      }
      if (
        (info.rightbar ?? 0) > 0 &&
        info.rightbar !== lastSeen.rightbar &&
        info.rightbar !== expected.rightbar &&
        info.rightbar !== saved.rightbarWidth
      ) {
        recordPending.rightbar = info.rightbar;
        expected.rightbar = info.rightbar;
      }
      lastSeen.sidebar = info.sidebar;
      if ((info.rightbar ?? 0) > 0) lastSeen.rightbar = info.rightbar;
      if (Object.keys(recordPending).length > 0) {
        if (recordTimer !== null) clearTimeout(recordTimer);
        recordTimer = setTimeout(flushRecord, RECORD_DEBOUNCE_MS);
      }
    };

    const stopDiscovery = acquireLayoutStore(
      ctx,
      (ready) => {
        holder.instance = ready;
        // 1) 启动应用
        applyWidths(holder.instance, readConfig(), expected);
        const info = holder.instance.getSnapshot().layoutInfo;
        lastSeen.sidebar = info.sidebar;
        if ((info.rightbar ?? 0) > 0) lastSeen.rightbar = info.rightbar;
        // 2) 用户拖动 / 快捷键改宽度 → 记回全局配置
        const unsubscribe = holder.instance.subscribe(onStoreChange);
        // 3) 配置变化（本面板保存、其它标签页、别的客户端）→ 应用
        const offConfig = scope.subscribe(() => {
          const config = readConfig();
          if (config.enabled === false) return;
          applyWidths(holder.instance, config, expected);
        });
        ctx.effect(
          () => () => {
            unsubscribe();
            offConfig();
            if (recordTimer !== null) clearTimeout(recordTimer);
          },
          'sidebar-width: layout subscription',
        );
      },
      (error) => {
        console.warn('[dsh-sidebar-width] 未接入 DSH 布局 store，侧栏宽度不做任何改动', error ?? '');
      },
    );
    ctx.effect(() => stopDiscovery, 'sidebar-width: layout discovery');

    // 设置页签：合集在场 → 进「设置 → 插件合集」；缺席 → 不提供入口。
    registerKitTab(ctx, {
      effectName: 'sidebar-width: settings tab',
      tab: () =>
        ctx.slots.inject(KIT_TAB_SLOT, () =>
          ctx.slots.register(
            {
              name: KIT_TAB_SLOT,
              id: 'sidebar-width',
              order: 80,
              label: () => t('tab'),
              locale: NS,
              inject: () => ({ scope, t, holder }),
            },
            SidebarWidthSettings,
          ),
        ),
    });
  } catch (error) {
    console.warn('[dsh-sidebar-width] client apply failed', error);
  }
}
