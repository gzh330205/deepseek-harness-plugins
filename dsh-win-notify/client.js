/**
 * dsh-win-notify 的浏览器（客户端）半部分。
 *
 * 运行在 DSH Web 页面内（经 dsh.client 客户端模块体系加载，宿主侧为
 * index.js）。检测会话执行完成有两种等价信号，这里选客户端会话列表快照
 * 的 `running: true → false` 跃迁——宿主端把这个状态绑定到
 * `agents.get(id)?.status === "running"`，代理从忙碌到空闲就是「会话跑
 * 完了」，且列表行自带 displayTitle（会话标题）与 origin（过滤 subagent
 * 子会话），无需依赖任何深层内部 API。
 *
 * 通知优先级：
 *   1. Tauri 桌面壳：`window.__TAURI__.event.emit(tauriEventName, ...)`
 *      （壳需 withGlobalTauri: true；Rust 侧 listen 后自弹原生通知）
 *   2. 浏览器回退：Web Notification API（首次触发时请求权限）
 *
 * 人工干预（需要审批 / 需要回答）：官方 UI 把两类请求都登记为
 * pending interaction，暴露在 `ctx.uiSession.pendingInteractions` 快照
 * store（Map<sessionId, { kind, key, toolName?, reason?, questions? }>）。
 * 观察新出现的 interaction key 即可通知，无需触碰 waterfall 链。
 */
window.__ModuleLoader__.load({
  // 注册 id 必须是包名（与客户端模块图的 graph row id 一致），
  // 否则组合 bundle 加载后无法登记，会报 "loaded without registering"。
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
     * 人工干预正文。interaction 是 pending-interactions 快照里的对象：
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

    const inject = ['sessions', 'uiSession'];

    function apply(ctx) {
      const sessions = ctx.sessions;
      const config = { ...DEFAULT_CONFIG };

      // 配置端点可能晚于本模块就绪，先取一次并做一次重试。
      const loadConfig = () => {
        fetch(CONFIG_URL)
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (payload?.ok === true) Object.assign(config, payload);
          })
          .catch(() => { /* 保持默认配置 */ });
      };
      loadConfig();

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

      const fire = (row, sessionId) => {
        const title = truncate(
          renderTemplate(config.titleTemplate, {
            title: row.displayTitle ?? row.title ?? `会话 ${sessionId.slice(0, 8)}`,
          }),
          80,
        );
        const body = truncate(
          renderTemplate(config.clientMessageTemplate, {
            title: row.displayTitle ?? row.title ?? `会话 ${sessionId.slice(0, 8)}`,
          }),
          config.maxMessageLength,
        );
        notify(title, body, sessionId);
      };

      /**
       * pending-interactions 快照：新出现的 interaction.key（审批/提问），
       * 每个 key 只通知一次。
       */
      const lastInteractionKeys = new Map(); // sessionId -> last key
      const checkInterventions = () => {
        if (!config.enabled || !config.interventions) return;
        const pending = ctx.uiSession.pendingInteractions.getSnapshot();
        for (const [sessionId, interaction] of pending) {
          const key = interaction?.key;
          if (key === undefined || key === null) continue;
          if (lastInteractionKeys.get(sessionId) === key) continue;
          lastInteractionKeys.set(sessionId, key);
          const body = truncate(interactionBody(interaction), config.maxMessageLength);
          notify(truncate(config.interventionTitle, 80), body, sessionId);
        }
      };
      const unsubscribeInterventions = ctx.uiSession.pendingInteractions.subscribe(checkInterventions);
      ctx.effect(() => unsubscribeInterventions, 'dsh-win-notify-client: pending interactions');

      /** 会话列表快照：running: true → false 即完成一次执行。 */
      const prev = new Map();
      const check = () => {
        if (!config.enabled) return;
        const snapshot = sessions.list.getSnapshot();
        for (const [id, row] of Object.entries(snapshot.byId ?? {})) {
          const running = row.running === true;
          const was = prev.get(id) ?? false;
          if (was && !running && (config.includeSubagents || row.origin !== 'subagent')) {
            fire(row, id);
          }
          prev.set(id, running);
        }
      };

      // 初始快照只做基线：避免把"页面上本来就跑着"的会话误报。
      const snapshot = sessions.list.getSnapshot();
      for (const [id, row] of Object.entries(snapshot.byId ?? {})) {
        prev.set(id, row.running === true);
      }
      const unsubscribe = sessions.list.subscribe(check);
      ctx.effect(() => unsubscribe, 'dsh-win-notify-client: list watch');
      if (config.verbose) console.log('[dsh-win-notify][client] 会话完成通知已启用（浏览器/壳侧）');
    }

    return { apply, inject };
  },
});
