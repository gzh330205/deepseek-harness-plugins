/**
 * dsh-git-panel — 浏览器半。
 *
 * 在右侧栏注册一个 `git` 页：变更（含差异）、历史（含提交图）、工作树。
 * 注册路径与内置 tab 类型完全一致：`ctx.sidebarRightTabs.register` 声明类型，
 * `sidebar.right.pane.tab` 提供正文，引导页给一张入口卡片。
 *
 * 两个客户端约束（与 dsh-run-env-manager 同源）：
 *  - **客户端插件外抛会让整页 boot 失败**（`web boot: N entry did not activate`），
 *    所以 apply 一律 try/catch 降级为 console.warn；
 *  - **`sidebarRightTabs` / `slots` 都必须在 effect 里注册**，模块启动顺序无保证。
 */
import React from 'react';
import cssText from './styles.css';
import { NS, TAB_ID, TAB_KIND } from './constants.js';
import { zh, en } from './locales.js';
import { createActions, createApi } from './api.js';
import { GitPanel } from './components/GitPanel.jsx';
import { DiffPage } from './components/DiffPage.jsx';
import { IconGit } from './components/icons.jsx';
import { fileAddressFor } from './format.js';
import { getDiffTarget, setDiffTarget, type DiffItem, type DiffTargetState } from './diff-target.js';

/** 中心窗口差异页在 root `main` 席位里的 key（同时也是 selectPanel 的 id）。 */
const DIFF_PANEL_ID = 'git-diff';

// 与 dsh 自己编译产物的约定一致：一个 <style data-plugin-css> 标签，重复挂载不重复注入。
if (typeof document !== 'undefined') {
  const tagId = 'dsh-git-panel/styles.css';
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
    const tag = document.createElement('style');
    tag.dataset.plugin = 'dsh-git-panel';
    tag.dataset.pluginCss = tagId;
    tag.textContent = cssText;
    document.head.appendChild(tag);
  }
}

const inject = ['slots', 'locale', 'sidebarRightTabs'];

function apply(ctx: any) {
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'git-panel: dictionaries');
    const t = ctx.locale.bind(NS);
    const api = createApi();
    const actions = createActions();

    ctx.effect(
      () =>
        ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          // 单实例页面：每个会话一块 Git 面板。
          keepMounted: true,
          title: () => t('title'),
          guide: [
            {
              id: 'open',
              order: 20,
              title: () => t('guideTitle'),
              description: () => t('guideDescription'),
              icon: IconGit,
            },
          ],
        }),
      'git-panel: tab type',
    );

    // slots.register 必须包在 slots.inject 里：apply 顺序无保证。
    // ── 中心窗口：把差异开在中间列，关闭即回到当前会话 ──────────────────
    // `main` 是 ui-layout 声明的 root 作用域 keyed 席位；`ctx.layout.selectPanel(id)` 选中它，
    // `selectPanel(null)` 把中心列交还给 Conversation。服务一律惰性取：ui-layout 的装载
    // 顺序无保证，缺了它就退回侧栏内联（ChangesView 会看 `centerAvailable`）。
    const layout = (): { selectPanel?: (id: string | null) => void } | undefined => ctx.get?.('layout');
    const centerAvailable = (): boolean => typeof layout()?.selectPanel === 'function';
    const selectPanel = (id: string | null): void => {
      const service = layout();
      if (typeof service?.selectPanel !== 'function') return;
      service.selectPanel(id);
    };
    /** 打开中心差异页；失败（席位未注册等）时回滚目标并让调用方回落内联。 */
    const openDiffInCenter = (state: DiffTargetState): void => {
      if (!centerAvailable()) return;
      try {
        setDiffTarget(state);
        selectPanel(DIFF_PANEL_ID);
      } catch (error) {
        setDiffTarget(null);
        console.warn('[git-panel] 打开中间差异页失败', error);
      }
    };
    const closeDiffInCenter = (): void => {
      try {
        selectPanel(null);
      } catch (error) {
        console.warn('[git-panel] 关闭中间差异页失败', error);
      }
    };
    /** 在内置预览里打开同一个文件（资源地址落在右侧栏，复用 DSH 自己的文件预览）。 */
    const openPreview = (item: DiffItem, absolute: string): void => {
      const sessionId = getDiffTarget()?.sessionId;
      const sidebarRight = ctx.get?.('sidebarRight') as { openResource?: (address: string) => void } | undefined;
      if (sessionId === undefined || typeof sidebarRight?.openResource !== 'function') return;
      try {
        sidebarRight.openResource(fileAddressFor(sessionId, absolute));
      } catch (error) {
        console.warn('[git-panel] 打开文件预览失败', error);
      }
    };

    ctx.effect(
      () =>
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: DIFF_PANEL_ID, locale: NS, inject: () => ({ api, t, close: closeDiffInCenter, openPreview }) },
            DiffPage,
          ),
        ),
      'git-panel: center diff page',
    );

    ctx.effect(
      () =>
        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register(
            {
              name: 'sidebar.right.pane.tab',
              key: TAB_ID,
              locale: NS,
              inject: () => ({ api, actions, t, openDiffInCenter, diffCenterAvailable: centerAvailable() }),
            },
            GitPanel,
          ),
        ),
      'git-panel: panel body',
    );
  } catch (error) {
    console.warn('[git-panel] client apply failed', error);
  }
}

export { apply, inject };
