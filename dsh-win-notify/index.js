/**
 * dsh-win-notify — 会话执行完成时发通知。host/client 双半：
 *
 * 宿主半（本文件，route: host/both）：会话日志是 append-only 事件流，
 * `turn/start` / `turn/end` 是其中的持久化事件类型（不是同名 Cordis 事件），
 * 因此监听 `session/event` 并检查 `event.type === 'turn/end'`（turn 结束 =
 * 模型对当前消息完成了一次完整响应）。通知后端为 Windows PowerShell 5.1
 * （powershell.exe）+ WinRT ToastNotificationManager，零额外依赖。
 *
 * 客户端半（client.js，route: client/both）：在 DSH Web 页面内观察会话
 * 列表快照的 running true→false 跃迁，优先发给 Tauri 桌面壳（event.emit），
 * 回退浏览器 Web Notification；配置经 /dsh-win-notify/config 端点下发。
 *
 * 触发路径只读、fire-and-forget，不阻塞会话；错误只记日志。
 * 所有监听器/子进程均注册为 effect，插件卸载自动清理。
 */
import { spawn } from 'node:child_process';
import z from '@deepseek-ai/schemastery';

/** Stable Cordis plugin name. */
export const name = 'win-notify';

/** Services required before this plugin activates. */
export const inject = ['sessions'];

/** 通知后端实现集合。 */
const BACKENDS = ['powershell-toast', 'none'];

/** 每种 turn 结束原因的展示标签。 */
const REASON_LABELS = {
  completed: '完成',
  blocked: '被阻止',
  aborted: '已取消',
  error: '出错',
  'max-tokens': '达到输出上限',
  interrupted: '中断',
};

/** 允许的 Toast 时长。 */
const DURATIONS = ['short', 'long'];

export const Config = z.object({
  /** 总开关。 */
  enabled: z.boolean().default(true),
  /** 需要通知的 turn 结束原因（TurnEndReasonMap 的 kind）。 */
  notifyKinds: z.array(z.string()).default(['completed', 'error']),
  /** 是否通知 subagent 子会话（默认只通知顶层会话）。 */
  includeSubagents: z.boolean().default(false),
  /** Toast 标题模板，可用占位符：{title} {turn} {reason} {detail}。 */
  titleTemplate: z.string().default('DSH 会话通知'),
  /** Toast 正文模板。 */
  messageTemplate: z.string().default('「{title}」第 {turn} 轮 · {reason}'),
  /** 通知后端：powershell-toast（默认，零依赖）或 none（禁用）。 */
  backend: z.union(BACKENDS).default('powershell-toast'),
  /** 调用哪个 PowerShell 可执行文件（WinRT Toast 只在 Windows PowerShell 下可用）。 */
  shellPath: z.string().default('powershell.exe'),
  /**
   * Toast 归属的 AppUserModelID。默认借用 Windows PowerShell 自带的
   * AUMID（已注册在开始菜单），无需为 dsh 创建快捷方式即可稳定弹出。
   */
  appId: z
    .string()
    .default(
      '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe',
    ),
  /** 是否播放系统默认提示音。 */
  sound: z.boolean().default(true),
  /** Toast 展示时长。 */
  duration: z.union(DURATIONS).default('short'),
  /** 正文最大长度（字符），超出截断，避免超长文本破坏 Toast 布局。 */
  maxMessageLength: z.number().min(20).max(1000).default(240),
  /** 每次触发时打印日志，便于验证插件是否工作。 */
  verbose: z.boolean().default(false),
  /**
   * 通知路由：'client'（默认，浏览器/桌面壳侧，见 client.js——Tauri 原生
   * 通知或浏览器 Web Notification）、'host'（本进程 PowerShell Toast）、
   * 'both'（两侧都发，注意重复）。headless/CLI 等无 Web 界面的部署请用 'host'。
   */
  route: z.union(['client', 'host', 'both']).default('client'),
  /** 壳（Tauri）侧监听的统一事件名。 */
  tauriEventName: z.string().default('dsh-notify'),
  /** 无 Tauri 桥时是否回退到浏览器 Web Notification API。 */
  browserNotify: z.boolean().default(true),
  /** 客户端通知正文模板，可用占位符：{title}。 */
  clientMessageTemplate: z.string().default('「{title}」已执行完成'),
  /** 需要人工干预（权限审批 / 向用户提问）时也发通知。 */
  interventions: z.boolean().default(true),
  /** 人工干预通知的标题。 */
  interventionTitle: z.string().default('DSH 需要人工处理'),
});

/**
 * Windows PowerShell 通知脚本。Title/Message 等通过环境变量
 * DSH_NOTIFY_PAYLOAD（JSON）传入，绕过所有 shell 引用问题；
 * 整段脚本由 Node 经 stdin 写入（`powershell -Command -`），
 * 命令行上不出现 base64 blob。
 */
const TOAST_SCRIPT = `
$ErrorActionPreference = 'Stop'
$payload = [System.Environment]::GetEnvironmentVariable('DSH_NOTIFY_PAYLOAD') | ConvertFrom-Json
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xmlText = '<toast duration="' + $payload.duration + '"><visual><binding template="ToastGeneric"><text>' + [System.Security.SecurityElement]::Escape([string]$payload.title) + '</text><text>' + [System.Security.SecurityElement]::Escape([string]$payload.message) + '</text></binding></visual>'
if (-not $payload.sound) { $xmlText += '<audio silent="true"/>' }
$xmlText += '</toast>'
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($xmlText)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($payload.appId)
$notifier.Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`;

/** 截断到指定字符数（按 UTF-16 码元，足够保守）。 */
export function truncate(value, max) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** 渲染模板里的 {title} {turn} {reason} {detail} 占位符。 */
export function renderTemplate(template, fields) {
  return String(template)
    .replace(/\{title\}/g, fields.title)
    .replace(/\{turn\}/g, String(fields.turn))
    .replace(/\{reason\}/g, fields.reason)
    .replace(/\{detail\}/g, fields.detail);
}

/** 把 TurnEndReason 折叠成人类可读标签。 */
export function reasonLabel(reason) {
  const kind = reason?.kind;
  const label = REASON_LABELS[kind] ?? String(kind ?? 'unknown');
  if (kind !== 'error') return label;
  const message = String(reason?.error?.message ?? '').trim().split(/\r?\n/)[0] ?? '';
  return message ? `${label}：${truncate(message, 80)}` : label;
}

/**
 * 人工干预通知正文。payload 是两类 waterfall 请求的载荷：
 * approval/request → { toolName?, reason?, ... }；
 * user-questions/request → { questions: [{ question, ... }], ... }。
 */
export function interventionBody(kind, payload) {
  if (kind === 'approval') {
    const tool = payload?.toolName ?? '工具';
    const reason = payload?.reason ? truncate(payload.reason, 80) : '';
    return reason ? `需要审批（${tool}）：${reason}` : `需要审批：${tool}`;
  }
  if (kind === 'question' || kind === 'plan-review') {
    const questions = payload?.questions ?? [];
    const first = questions[0]?.question ?? '';
    const label = kind === 'plan-review' ? '需要审查计划' : '需要回答';
    const head = first ? `${label}：${truncate(first, 120)}` : label;
    return questions.length > 1 ? `${head}（共 ${questions.length} 个问题）` : head;
  }
  return '需要人工干预';
}

/** 读取会话标题；标题服务缺失或尚未生成时回退为会话 id 短形式。 */
function resolveTitle(ctx, session, config) {
  try {
    const snapshot = ctx.get('sessionTitle')?.get(session);
    if (snapshot?.title) return snapshot.title;
  } catch {
    // 标题服务不可用时不做任何事，走回退。
  }
  return truncate(`会话 ${session.id.slice(0, 8)}`, 60);
}

/**
 * 构造 `session/event` 处理器：过滤 turn/end、通知种类与 subagent 子会话，
 * 渲染模板后交给 `notify(title, message)`。独立于 OS/后端，便于单测。
 */
export function createSessionEventHandler(config, notify, resolveTitleFn) {
  return (session, event) => {
    if (event?.type !== 'turn/end') return;
    const reason = event.data?.reason;
    const kind = reason?.kind;
    if (!config.notifyKinds.includes(kind)) return;
    // subagent 子会话在完成时也会发出 turn/end；默认只通知顶层会话。
    if (!config.includeSubagents && session.header?.origin === 'subagent') return;
    const title = resolveTitleFn(session);
    const fields = {
      title,
      turn: event.data.turn,
      reason: reasonLabel(reason),
      detail: kind === 'error' ? truncate(reason?.error?.message ?? '', 120) : '',
    };
    notify(
      renderTemplate(config.titleTemplate, fields),
      renderTemplate(config.messageTemplate, fields),
    );
  };
}

/**
 * 插件日志。用 console 而非 ctx.logger：Cordis 内置 logger 默认只把消息
 * 缓冲起来，不一定有控制台导出器（headless 模式就没有），console 总是
 * 出现在 dsh 启动终端里。
 */
function log(...args) {
  console.log('[dsh-win-notify]', ...args);
}
function warnLog(...args) {
  console.warn('[dsh-win-notify]', ...args);
}

/** 客户端配置端点路径（client.js 从这里读取生效配置）。 */
const CLIENT_CONFIG_ROUTE = '/dsh-win-notify';
const CLIENT_CONFIG_PATH = '/dsh-win-notify/config';

/** 发送一个回调式 JSON 响应（node:http 风格，与 oneway 插件相同的约定）。 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

export function apply(ctx, config) {
  if (!config.enabled) {
    log('已禁用（enabled: false）');
    return;
  }

  const hostEnabled = (config.route === 'host' || config.route === 'both') && config.backend !== 'none';
  const clientEnabled = config.route === 'client' || config.route === 'both';

  // ── 宿主侧（PowerShell Toast）─────────────────────────────────────────
  if (hostEnabled) {
    if (process.platform !== 'win32') {
      log(`当前平台 ${process.platform} 不支持 PowerShell Toast，仅保留客户端通知`);
    } else {
      /** 子进程失败警告节流：同一错误每 60 秒最多记一次。 */
      let lastWarnAt = 0;
      const warnThrottled = (message) => {
        const now = Date.now();
        if (now - lastWarnAt < 60_000) return;
        lastWarnAt = now;
        warnLog(message);
      };

      /**
       * 弹出一条 Windows Toast（fire-and-forget，绝不阻塞会话）。
       *
       * 脚本经 stdin（`-Command -`）传入而不是 `-EncodedCommand`：
       * 命令行上不出现 base64 脚本 blob——`powershell -EncodedCommand <base64>`
       * 是 AV/EDR 的经典告警特征（LOLBin heuristics），stdin 方式功能完全等价
       * （同样不依赖执行策略、无引用问题），检测面小得多。脚本内容仍是插件
       * 固定字符串，变量只经环境变量 JSON（数据），不进入代码路径。
       */
      const showToast = (toastTitle, message) => {
        const payload = {
          title: truncate(toastTitle, 80),
          message: truncate(message, config.maxMessageLength),
          sound: config.sound,
          duration: config.duration,
          appId: config.appId,
        };
        const child = spawn(
          config.shellPath,
          ['-NoProfile', '-NonInteractive', '-Command', '-'],
          {
            windowsHide: true,
            stdio: ['pipe', 'ignore', 'ignore'],
            env: { ...process.env, DSH_NOTIFY_PAYLOAD: JSON.stringify(payload) },
          },
        );
        try {
          child.stdin.end(TOAST_SCRIPT);
        } catch {
          // stdin 已关闭（进程刚启动即失败）时忽略，由 exit/error 事件报告。
        }
        child.on('error', (error) => warnThrottled(`通知子进程启动失败：${error.message}`));
        child.on('exit', (code) => {
          if (code !== 0) warnThrottled(`通知子进程退出码 ${code}`);
        });
        child.unref();
        if (config.verbose) {
          log(`→ ${payload.title} | ${payload.message}`);
        }
      };

      /** `turn/end` 事件 → 通知。 */
      const onSessionEvent = createSessionEventHandler(config, showToast, (session) =>
        resolveTitle(ctx, session, config),
      );
      ctx.on('session/event', (session, event) => {
        try {
          onSessionEvent(session, event);
        } catch (error) {
          warnLog(`处理 turn/end 失败：${error instanceof Error ? error.message : String(error)}`);
        }
      });

      /**
       * 人工干预（审批 / 提问）→ 通知。两者都是 waterfall 事件：本监听器
       * 只做副作用并立即透传 `next()`，绝不短读审批/提问链路；prepend 保证
       * 即使后面有消费者抢先处理，我们的通知也已发出。
       */
      if (config.interventions) {
        const forwardIntervention = (kind) => (payload, next) => {
          try {
            const title = truncate(config.interventionTitle, 80);
            const body = truncate(interventionBody(kind, payload), config.maxMessageLength);
            showToast(title, body);
          } catch (error) {
            warnLog(`处理 ${kind} 通知失败：${error instanceof Error ? error.message : String(error)}`);
          }
          return next();
        };
        ctx.on('approval/request', forwardIntervention('approval'), { prepend: true });
        ctx.on('user-questions/request', forwardIntervention('question'), { prepend: true });
      }

      log('宿主侧已启用（PowerShell Toast）');
    }
  }

  // ── 客户端侧（浏览器 / Tauri 壳）────────────────────────────────────
  // 只给 browser 端提供一份配置端点；client.js 在同一进程的 Web 页面里，
  // 经 dsh.client 客户端模块体系加载。webServer 仅存在于 Web 类 profile，
  // 用惰性 inject，缺失（headless 等）时静默跳过。
  if (clientEnabled) {
    ctx.inject(['webServer'], (webCtx) => {
      webCtx.webServer.register({
        kind: 'prefix',
        path: CLIENT_CONFIG_ROUTE,
        handler: async (req, res) => {
          const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
          if (req.method !== 'GET' || url.pathname !== CLIENT_CONFIG_PATH) {
            return sendJson(res, 404, { ok: false, error: 'not-found' });
          }
          return sendJson(res, 200, {
            ok: true,
            enabled: true,
            tauriEventName: config.tauriEventName,
            browserNotify: config.browserNotify,
            includeSubagents: config.includeSubagents,
            titleTemplate: config.titleTemplate,
            clientMessageTemplate: config.clientMessageTemplate,
            maxMessageLength: config.maxMessageLength,
            interventions: config.interventions,
            interventionTitle: config.interventionTitle,
          });
        },
      });
    });
    log('客户端侧已启用（浏览器 / Tauri 壳）');
  }
}
