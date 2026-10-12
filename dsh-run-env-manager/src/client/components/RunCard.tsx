import React from 'react';
import { errText, type RunEnvApi } from '../api.js';
import { LOG_TAIL_CHARS, RunLog } from './RunLog.jsx';
import { LIVE_STATUSES, type RunConfiguration, type RunSnapshot, type Snapshot, type StreamFrame, type Translator } from '../types.js';

/** 状态 → 文案 key。running 与 ready 的圆点都是绿色/蓝色，区别只剩这里。 */
const STATUS_LABELS: Record<string, string> = {
  starting: 'statusStarting',
  running: 'statusRunning',
  ready: 'statusReady',
  stopping: 'statusStopping',
  stopped: 'statusStopped',
  failed: 'statusFailed',
};

/** 未知状态原样显示枚举，方便以后宿主加了新状态时一眼看见。 */
function statusLabel(status: string, t: Translator): string {
  const key = STATUS_LABELS[status];
  return key === undefined ? status : t(key);
}

/** 重连退避：自带重连会沿用建连时的偏移，所以这里自己按当前偏移重连。 */
const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_ATTEMPTS = 5;

export interface RunCardProps {
  configuration: RunConfiguration;
  /** 该配置的运行实例；没启动过就是 undefined。 */
  run: RunSnapshot | undefined;
  root: string;
  api: RunEnvApi;
  t: Translator;
  /** 日志区是否展开。由面板持有：切到「配置」再切回来不会丢。 */
  open: boolean;
  onToggle: (id: string, open: boolean) => void;
  onSnapshot: (snapshot: Snapshot) => void;
  onError: (message: string) => void;
  onEdit: (id: string) => void;
  onOpenUrl: (url: string) => void;
}

/**
 * 一张运行卡片：一个配置 + 它的实例 + **它自己的**可折叠日志。
 *
 * 日志状态（文本、偏移、SSE 连接）都挂在本卡片上，所以多个服务同时跑时互不干扰：
 * 展开 A 不影响 B，A 的输出也不会串进 B。收起即断开连接，后台不再搬运日志。
 */
export function RunCard(props: RunCardProps) {
  const { configuration, run, root, api, t, open, onToggle, onSnapshot, onError, onEdit, onOpenUrl } = props;
  const [busy, setBusy] = React.useState('');
  const [logText, setLogText] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  /** 点「刷新」时 +1：重跑一遍「取尾部 + 重连」，用来从卡住的流里恢复。 */
  const [reloadNonce, setReloadNonce] = React.useState(0);
  /** 续读偏移。放 ref 而不是 state：它只被订阅逻辑读写，不该触发重连。 */
  const offsetRef = React.useRef(0);

  const id = configuration.id;
  const runId = run?.id;
  const live = run !== undefined && LIVE_STATUSES.includes(run.status);

  // ── 日志装载 ─────────────────────────────────────────────────────────
  // 展开才装载，收起即断开：看不见的日志不占连接、不搬字节。
  // 顺序是「先取尾部，再从该偏移接增量」——断线重连也走同一条路，
  // 所以既不会重复（不从头重发）也不会漏（服务端从偏移处补发）。
  React.useEffect(() => {
    if (!open || runId === undefined) return undefined;
    let disposed = false;
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const replace = (text: string, end: number) => {
      if (disposed) return;
      offsetRef.current = end;
      setLogText(text.slice(-LOG_TAIL_CHARS));
    };
    const append = (text: string, end: number) => {
      if (disposed) return;
      offsetRef.current = end;
      setLogText((current) => (current + text).slice(-LOG_TAIL_CHARS));
    };

    const connect = () => {
      if (disposed) return;
      const stream = new EventSource(api.streamUrl(root, runId, offsetRef.current));
      source = stream;
      stream.onopen = () => {
        attempts = 0;
        if (!disposed) setStreaming(true);
      };
      stream.onmessage = (event) => {
        let frame: StreamFrame;
        try {
          frame = JSON.parse(event.data) as StreamFrame;
        } catch {
          return;
        }
        if (typeof frame.text === 'string' && frame.text !== '') append(frame.text, frame.offset);
        else if (typeof frame.offset === 'number') offsetRef.current = frame.offset;
      };
      stream.onerror = () => {
        // EventSource 自带的重连会沿用建连时的 from，断线期间收到的增量会被再推一遍；
        // 关掉它，用当前偏移自己重连。
        stream.close();
        if (!disposed) setStreaming(false);
        if (disposed || attempts >= RECONNECT_MAX_ATTEMPTS) return;
        attempts += 1;
        retry = setTimeout(connect, RECONNECT_BASE_MS * attempts);
      };
    };

    const load = async () => {
      let payload;
      try {
        payload = await api.log(root, runId);
      } catch (cause) {
        if (!disposed) onError(errText(cause));
        return;
      }
      replace(payload.log, payload.offset);
      // 实例还活着才需要增量；已经结束的实例读完尾部就够了（连接留给它没意义）。
      if (!disposed && LIVE_STATUSES.includes(payload.status)) connect();
    };
    void load();

    return () => {
      disposed = true;
      if (retry !== undefined) clearTimeout(retry);
      source?.close();
      setStreaming(false);
    };
  }, [api, root, runId, open, live, reloadNonce, onError]);

  // 失败是最需要看到日志的时刻：自动展开一次（用户手动收起过就不再打扰）。
  const previousStatus = React.useRef(run?.status);
  React.useEffect(() => {
    const status = run?.status;
    if (status === 'failed' && previousStatus.current !== 'failed' && !open) onToggle(id, true);
    previousStatus.current = status;
  }, [id, onToggle, open, run?.status]);

  const act = async (label: string, task: () => Promise<Snapshot>) => {
    setBusy(label);
    onError('');
    try {
      onSnapshot(await task());
      return true;
    } catch (cause) {
      onError(errText(cause));
      return false;
    } finally {
      setBusy('');
    }
  };

  const start = async () => {
    if (await act('start', () => api.start(root, id))) onToggle(id, true);
  };

  // 配置里的「浏览器地址」优先（那是用户指定的入口），没配就用就绪检测命中的地址。
  const browserUrl = String(configuration.browserUrl ?? '').trim();
  const address = browserUrl !== '' ? browserUrl : (run?.url ?? '');
  const command = configuration.type === 'tomcat' ? `tomcat · ${configuration.tomcat.contextPath}` : configuration.command;

  return (
    <div className="renv-card">
      <div className="renv-row renv-between">
        <div className="renv-grow">
          <div className="renv-title">
            <span className="renv-dot" data-state={run?.status ?? 'stopped'} />
            {configuration.name || configuration.id}
          </div>
          <div className="renv-meta">{command}</div>
          {run !== undefined && (
            <div className="renv-meta">
              {t('status')}: {statusLabel(run.status, t)}
              {run.exitCode === null || run.exitCode === undefined ? '' : ` · exit ${run.exitCode}`}
              {address === '' ? '' : ' · '}
              {address !== '' && (
                <button type="button" className="renv-linkbtn" title={t('openInBrowser')} onClick={() => onOpenUrl(address)}>
                  {address}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="renv-row renv-actions">
        <button type="button" className="renv-primary" disabled={busy !== '' || live} onClick={() => void start()}>
          {t('start')}
        </button>
        <button type="button" disabled={busy !== '' || !live} onClick={() => void act('stop', () => api.stop(root, id))}>
          {t('stop')}
        </button>
        {run !== undefined && (
          <button type="button" aria-expanded={open} onClick={() => onToggle(id, !open)}>
            {open ? t('collapseLogs') : t('logs')}
          </button>
        )}
        <button type="button" onClick={() => onEdit(id)}>
          {t('edit')}
        </button>
      </div>

      {open && run !== undefined && (
        <div className="renv-logWrap">
          <div className="renv-logHead">
            <span className="renv-logTitle">{t('logs')}</span>
            {live && (
              <span className="renv-live" data-state={streaming ? 'on' : 'off'}>
                {streaming ? t('logLive') : t('logWaiting')}
              </span>
            )}
            <span className="renv-grow" />
            <button type="button" className="renv-linkbtn" onClick={() => setReloadNonce((value) => value + 1)}>
              {t('refresh')}
            </button>
          </div>
          {logText === '' ? (
            <div className="renv-hint">{t('logsEmpty')}</div>
          ) : (
            <RunLog text={logText} onOpenUrl={onOpenUrl} t={t} />
          )}
        </div>
      )}
    </div>
  );
}
