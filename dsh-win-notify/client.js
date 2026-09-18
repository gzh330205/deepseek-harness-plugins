/**
 * dsh-win-notify 的浏览器（客户端）半部分。
 *
 * 运行在 DSH Web 页面内（经 dsh.client 客户端模块体系加载，宿主侧为
 * index.js）。
 *
 * 两类触发：
 *   1. 会话执行完成：`sessions.list` 快照行 `running: true → false`。
 *   2. 人工干预：新版（0.1.6+）由 `uiSession.sessionStatus` 快照的
 *      `pendingInteraction` 给出（审批 / 提问 / 计划审查都登记于此）；
 *      旧版（≤0.1.2）退回 `uiSession.pendingInteractions`。
 *
 * 通知优先级：
 *   1. Tauri 桌面壳：`window.__TAURI__.event.emit(tauriEventName, ...)`
 *      （壳需 withGlobalTauri: true；Rust 侧 listen 后自弹原生通知）
 *   2. 浏览器回退：Web Notification API（首次触发时请求权限）
 *
 * ⚠️ 稳健性约束：新版 Web boot 对客户端插件 fail-loud——任何 entry 未
 * active（apply 抛错/等待服务）都会导致整页 "web boot: N entry did not
 * activate" 而无法进入界面。因此本模块：
 *   - apply 全程 try/catch，绝不向外抛；
 *   - 依赖的服务与快照接口一律特性探测（缺失即降级 + 警告）；
 *   - inject 只声明必然存在的 `sessions`，`uiSession` 用动态 inject 等待，
 *     即使它缺失也不阻塞本插件激活。
 */
window.__ModuleLoader__.load({
  // 注册 id 必须是包名（与客户端模块图的 graph row id 一致）。
  id: 'dsh-win-notify',
  factory: () => {
    const CONFIG_URL = '/dsh-win-notify/config';

    const DEFAULT_CONFIG = {
      enabled: true,
      tauriEventName: 'dsh-notify',
      browserNotify: true,
      includeSubagents: false,
      titleTemplate: 'DSH 会话通知',
      clientMessageTemplate: '「{title}」已执行完成',
      maxMessageLength: 240,
      verbose: false,
      interventions: true,
      interventionTitle: 'DSH 需要人工处理',
    };

    function truncate(value, max) {
      const text = String(value ?? '').trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    function renderTemplate(template, fields) {
      return String(template)
        .replace(/\{title\}/g, fields.title)
        .replace(/\{turn\}/g, String(fields.turn ?? ''))
        .replace(/\{reason\}/g, fields.reason ?? '')
        .replace(/\{detail\}/g, fields.detail ?? '');
    }

    /**
     * 人工干预正文。interaction 是 pending-interaction 对象：
     * kind = 'approval' | 'question' | 'plan-review'，带 toolName/reason
     * 或 questions[]。
     */
    function interactionBody(interaction) {
      const kind = interaction?.kind;
      if (kind === 'approval') {
        const tool = interaction.toolName ?? '工具';
        const reason = interaction.reason ? truncate(interaction.reason, 80) : '';
        return reason ? `需要审批（${tool}）：${reason}` : `需要审批：${tool}`;
      }
      if (kind === 'question' || kind === 'plan-review') {
        const questions = interaction?.questions ?? [];
        const first = questions[0]?.question ?? '';
        const label = kind === 'plan-review' ? '需要审查计划' : '需要回答';
        const head = first ? `${label}：${truncate(first, 120)}` : label;
        return questions.length > 1 ? `${head}（共 ${questions.length} 个问题）` : head;
      }
      return '需要人工干预';
    }

    /** 快照 store 特性探测：需要 getSnapshot() + subscribe()。 */
    function snapshotStore(candidate) {
      if (!candidate) return undefined;
      if (typeof candidate.getSnapshot !== 'function' || typeof candidate.subscribe !== 'function') return undefined;
      return candidate;
    }

    /** 把 Map / 可迭代快照统一成 [key, value] 数组；不可迭代时返回空。 */
    function entriesOf(snapshot) {
      if (snapshot === undefined || snapshot === null) return [];
      if (typeof snapshot[Symbol.iterator] !== 'function') return [];
      try {
        return [...snapshot];
      } catch {
        return [];
      }
    }

    const inject = ['sessions'];

    function apply(ctx) {
      try {
        applyInner(ctx);
      } catch (error) {
        // 绝不外抛：客户端插件抛错会让整个 Web 界面启动失败。
        console.warn('[dsh-win-notify][client] 初始化失败，已降级（不影响 DSH 启动）：', error);
      }
    }

    function applyInner(ctx) {
      const config = { ...DEFAULT_CONFIG };

      const loadConfig = () => {
        fetch(CONFIG_URL)
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (payload?.ok === true) {
              Object.assign(config, payload);
              // 日志放在这里：配置是异步取回的，此时 verbose 才是生效值。
              if (config.verbose) console.log('[dsh-win-notify][client] 通知已启用（浏览器/壳侧）');
            }
          })
          .catch(() => { /* 保持默认配置 */ });
      };
      loadConfig();

      const listStore = snapshotStore(ctx.sessions?.list);
      if (!listStore) {
        console.warn('[dsh-win-notify][client] sessions.list 不可用，已跳过会话完成通知');
        return;
      }

      /** 会话标题：列表行优先，回退 id 短形式。 */
      const titleOf = (sessionId) => {
        const row = listStore.getSnapshot()?.byId?.[sessionId];
        return row?.displayTitle ?? row?.title ?? `会话 ${String(sessionId).slice(0, 8)}`;
      };

      let permissionRequested = false;
      /** 浏览器 Web Notification 兜底。 */
      const browserNotify = (title, body, sessionId) => {
        if (!config.browserNotify || typeof Notification === 'undefined') return;
        const show = () => {
          try {
            new Notification(title, { body, tag: `dsh-win-notify-${sessionId}` });
          } catch {
            /* 部分平台对 new Notification 有同步限制，忽略。 */
          }
        };
        if (Notification.permission === 'granted') {
          show();
        } else if (Notification.permission === 'default' && !permissionRequested) {
          permissionRequested = true;
          Notification.requestPermission().then((value) => {
            if (value === 'granted') show();
          }).catch(() => {});
        }
      };

      /** 壳（Tauri）原生通知：emit 事件，由壳进程 listen 后弹出。 */
      const shellNotify = (title, body, sessionId) => {
        const tauri = window.__TAURI__;
        if (tauri?.event?.emit) {
          try {
            tauri.event.emit(config.tauriEventName, { title, body, sessionId });
            return true;
          } catch {
            return false;
          }
        }
        return false;
      };

      /** 通知分发：优先壳，回退浏览器。 */
      const notify = (title, body, tag) => {
        if (config.verbose) console.log(`[dsh-win-notify][client] → ${title} | ${body}`);
        if (!shellNotify(title, body, tag)) browserNotify(title, body, tag);
      };

      // ── 完成通知 / 干预通知 的共享状态 ──────────────────────────────
      const prevRunning = new Map(); // sessionId -> was running
      const lastInteractionKeys = new Map(); // sessionId -> last interaction key
      /** 干预快照来源：新版 sessionStatus 优先，旧版 pendingInteractions 兜底。 */
      let statusStore;
      let pendingStore;

      const notifyInteractionOnce = (sessionId, interaction) => {
        const key = interaction?.key;
        if (key === undefined || key === null) return;
        if (lastInteractionKeys.get(sessionId) === key) return;
        lastInteractionKeys.set(sessionId, key);
        const body = truncate(`「${titleOf(sessionId)}」${interactionBody(interaction)}`, config.maxMessageLength);
        notify(truncate(config.interventionTitle, 80), body, sessionId);
      };

      const checkRunning = () => {
        const rows = listStore.getSnapshot()?.byId ?? {};
        for (const [id, row] of Object.entries(rows)) {
          const running = row?.running === true;
          const was = prevRunning.get(id) ?? false;
          if (was && !running && (config.includeSubagents || row?.origin !== 'subagent')) {
            const title = truncate(
              renderTemplate(config.titleTemplate, { title: titleOf(id) }),
              80,
            );
            const body = truncate(
              renderTemplate(config.clientMessageTemplate, { title: titleOf(id) }),
              config.maxMessageLength,
            );
            notify(title, body, id);
          }
          prevRunning.set(id, running);
        }
      };

      const checkInterventions = () => {
        if (!config.interventions) return;
        const statusMap = statusStore?.getSnapshot();
        for (const [sessionId, status] of entriesOf(statusMap)) {
          const interaction = status?.pendingInteraction;
          if (interaction) notifyInteractionOnce(sessionId, interaction);
        }
        for (const [sessionId, interaction] of entriesOf(pendingStore?.getSnapshot())) {
          if (interaction) notifyInteractionOnce(sessionId, interaction);
        }
      };

      const checkAll = () => {
        if (!config.enabled) return;
        try {
          checkInterventions();
          checkRunning();
        } catch (error) {
          console.warn('[dsh-win-notify][client] 通知检查失败：', error);
        }
      };

      // 初始快照只做基线：避免把"页面上本来就跑着/本来就在等"的状态误报。
      for (const [id, row] of Object.entries(listStore.getSnapshot()?.byId ?? {})) {
        prevRunning.set(id, row?.running === true);
      }

      const disposers = [];
      const unsubscribeList = listStore.subscribe(checkAll);
      disposers.push(unsubscribeList);

      // uiSession 用动态 inject：即使该服务缺失/改名，也不阻塞本插件激活。
      ctx.inject(['uiSession'], (uiCtx) => {
        statusStore = snapshotStore(uiCtx.uiSession?.sessionStatus); // 0.1.6+
        pendingStore = snapshotStore(uiCtx.uiSession?.pendingInteractions); // ≤0.1.2
        if (!statusStore && !pendingStore) {
          console.warn('[dsh-win-notify][client] uiSession 无 pending-interaction 快照，已跳过人工干预通知');
          return;
        }
        const unsubscribeStatus = statusStore?.subscribe(checkAll);
        const unsubscribePending = pendingStore?.subscribe(checkAll);
        if (unsubscribeStatus) disposers.push(unsubscribeStatus);
        if (unsubscribePending) disposers.push(unsubscribePending);
        checkAll();
      });

      ctx.effect(() => () => {
        for (const dispose of disposers) {
          try {
            dispose();
          } catch { /* 忽略卸载期异常 */ }
        }
      }, 'dsh-win-notify-client: watchers');

      checkAll();
    }

    return { apply, inject };
  },
});
