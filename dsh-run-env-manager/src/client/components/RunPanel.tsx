import React from 'react';
import { errText, type RunEnvApi } from '../api.js';
import { parseAnsi } from '../ansi.js';
import { ConfigurationSection } from './ConfigurationSection.jsx';
import { IconRefresh } from './icons.jsx';
import type { RunSnapshot, Snapshot, StreamFrame } from '../types.js';

/** 稳定兜底：`useSessions` 缺失时不订阅，而不是条件调用 hook。 */
const NO_SUBSCRIPTION = () => undefined;

/** 取路径末级目录名（Windows/Posix 分隔符都要认）。 */
function basename(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at >= 0 ? normalized.slice(at + 1) : normalized;
}
const POLL_INTERVAL_MS = 2000;
const LIVE_STATUSES: RunSnapshot['status'][] = ['starting', 'running', 'ready', 'stopping'];

export interface RunPanelProps {
  api: RunEnvApi;
  /** AI 通路：复用 DSH 会话（见 src/client/agent.ts）。 */
  agent: {
    configure: (input: { root: string; snapshot: Snapshot }) => Promise<void>;
    troubleshoot: (input: { root: string; snapshot: Snapshot; configuration?: { id: string }; panelError?: string }) => Promise<void>;
  };
  sessionId?: string;
  /** 会话作用域插槽注入的全局标准件；缺失时降级（不阻塞挂载）。 */
  useSessions?: (selector: (state: unknown) => unknown) => unknown;
  /** 可选的原生目录选择器。 */
  pickDirectory?: () => Promise<string | null>;
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * 运行面板：上半是「运行」，下半是「配置」。
 * 数据全部来自宿主的全量快照（动作回快照 + 2 秒轮询 + 活动实例的 SSE 日志）。
 */
export function RunPanel(props: RunPanelProps) {
  const { api, sessionId, t } = props;
  const useSessions = props.useSessions ?? (NO_SUBSCRIPTION as RunPanelProps['useSessions']);
  const sessionCwd = useSessions((state) => {
    const byId = (state as { byId?: Record<string, { cwd?: string }> } | undefined)?.byId;
    return sessionId === undefined ? undefined : byId?.[sessionId]?.cwd;
  });

  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [root, setRoot] = React.useState('');
  const [tab, setTab] = React.useState<'run' | 'config'>('run');
  const [editing, setEditing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [logText, setLogText] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [aiBusy, setAiBusy] = React.useState('');

  // 工作区根默认跟随当前会话，之后不随会话切换抖动（用户可能正在编辑配置）。
  React.useEffect(() => {
    if (typeof sessionCwd === 'string' && sessionCwd !== '') setRoot((current) => (current === '' ? sessionCwd : current));
  }, [sessionCwd]);

  const refresh = React.useCallback(async () => {
    if (root === '') return;
    try {
      setSnapshot(await api.status(root));
      setError('');
    } catch (cause) {
      setError(errText(cause));
    }
  }, [api, root]);

  React.useEffect(() => {
    if (root === '') return undefined;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh, root]);

  // 日志可能到 20 万字符，解析只在文本变化时做一次（useMemo），不在每帧渲染里重跑。
  const segments = React.useMemo(() => parseAnsi(logText), [logText]);

  const runs = snapshot?.runs ?? [];
  const configurations = snapshot?.workspace?.configurations ?? [];
  const runOf = (id: string) => runs.find((run) => run.id === id);
  const activeRun = activeId === null ? undefined : runOf(activeId);

  // 只在「活动实例还活着」时订阅日志；结束后服务端不再推送，连接自然收掉。
  React.useEffect(() => {
    if (activeRun === undefined || !LIVE_STATUSES.includes(activeRun.status)) return undefined;
    const source = new EventSource(api.streamUrl(activeRun.root, activeRun.id, offset));
    source.onmessage = (event) => {
      let frame: StreamFrame;
      try {
        frame = JSON.parse(event.data) as StreamFrame;
      } catch {
        return;
      }
      if (frame.text !== undefined && frame.text !== '') setLogText((current) => (current + frame.text).slice(-200000));
      setOffset(frame.offset);
    };
    // EventSource 自带重连；连不上时不刷错误，由显式操作报错。
    source.onerror = () => {};
    return () => source.close();
    // 只依赖订阅目标与它的活动态，避免每帧日志都重连。
  }, [api, activeRun?.root, activeRun?.id, activeRun?.status === undefined ? '' : String(LIVE_STATUSES.includes(activeRun.status))]);

  const openLog = (id: string) => {
    const run = runOf(id);
    setActiveId(id);
    setLogText(run?.log ?? '');
    setOffset(run?.offset ?? 0);
  };

  const act = async (label: string, task: () => Promise<Snapshot>) => {
    setBusy(label);
    setError('');
    try {
      setSnapshot(await task());
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy('');
    }
  };

  const runAi = async (mode: 'configure' | 'troubleshoot') => {
    if (snapshot === null) return;
    setAiBusy(mode);
    setError('');
    try {
      // 换会话前先拉一次最新快照：AI 拿到的是当前真实状态。
      const latest = await api.status(root);
      setSnapshot(latest);
      if (mode === 'configure') {
        await props.agent.configure({ root, snapshot: latest });
      } else {
        const selected = latest.workspace?.configurations?.find((item) => item.id === activeId) ?? latest.workspace?.configurations?.[0];
        await props.agent.troubleshoot({ root, snapshot: latest, configuration: selected, panelError: error });
      }
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setAiBusy('');
    }
  };

  return (
    <div className="renv">
      {/* 头部对齐宿主内建「文件」页：38px、左内边距 16px、border-l3 分隔线。
          左边放面板正在管的工作区，右边是刷新。 */}
      <div className="renv-head">
        <span className="renv-headname renv-ellipsis" title={root}>
          {root === '' ? t('tabRun') : basename(root)}
        </span>
        <button type="button" className="renv-iconbtn" title={t('refresh')} aria-label={t('refresh')} disabled={busy !== '' || root === ''} onClick={() => void refresh()}>
          <IconRefresh size={15} />
        </button>
      </div>

      <div className="renv-tabs" role="tablist">
        <button type="button" role="tab" className={`renv-tab${tab === 'run' ? ' renv-tabOn' : ''}`} onClick={() => setTab('run')} aria-selected={tab === 'run'}>{t('tabRun')}</button>
        <button type="button" role="tab" className={`renv-tab${tab === 'config' ? ' renv-tabOn' : ''}`} onClick={() => setTab('config')} aria-selected={tab === 'config'}>{t('tabConfig')}</button>
      </div>

      <div className="renv-body">
      <div className="renv-row renv-actions">
        <button type="button" disabled={aiBusy !== '' || root === ''} onClick={() => void runAi('configure')}>
          {aiBusy === 'configure' ? t('aiPreparing') : t('aiConfigure')}
        </button>
        <button type="button" disabled={aiBusy !== '' || root === ''} onClick={() => void runAi('troubleshoot')}>
          {aiBusy === 'troubleshoot' ? t('aiPreparing') : t('aiTroubleshoot')}
        </button>
      </div>
      {aiBusy !== '' && <div className="renv-hint">{t('aiSessionHint')}</div>}
      {error !== '' && <div className="renv-error">{error}</div>}

      {tab === 'run' && (
        <>
          {configurations.length === 0 ? (
            <div className="renv-empty">
              <div>{t('emptyConfigurations')}</div>
              <button type="button" onClick={() => setTab('config')}>{t('goToConfig')}</button>
            </div>
          ) : (
            <div className="renv-list">
              {configurations.map((configuration) => {
                const run = runOf(configuration.id);
                const live = run !== undefined && LIVE_STATUSES.includes(run.status);
                return (
                  <div key={configuration.id} className="renv-card">
                    <div className="renv-row renv-between">
                      <div className="renv-grow">
                        <div className="renv-title">
                          <span className="renv-dot" data-state={run?.status ?? 'stopped'} />
                          {configuration.name || configuration.id}
                        </div>
                        <div className="renv-meta">
                          {configuration.type === 'tomcat'
                            ? `tomcat · ${configuration.tomcat.contextPath}`
                            : configuration.command}
                        </div>
                        {run !== undefined && (
                          <div className="renv-meta">
                            {t('status')}: {run.status}
                            {run.exitCode === null || run.exitCode === undefined ? '' : ` · exit ${run.exitCode}`}
                            {run.url !== undefined && run.url !== '' ? ` · ${run.url}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="renv-row renv-actions">
                      <button
                        type="button"
                        className="renv-primary"
                        disabled={busy !== '' || live}
                        onClick={() => void act('start', () => api.start(root, configuration.id)).then(() => openLog(configuration.id))}
                      >
                        {t('start')}
                      </button>
                      <button type="button" disabled={busy !== '' || !live} onClick={() => void act('stop', () => api.stop(root, configuration.id))}>
                        {t('stop')}
                      </button>
                      <button type="button" onClick={() => openLog(configuration.id)}>{t('logs')}</button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(configuration.id);
                          setTab('config');
                        }}
                      >
                        {t('edit')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeId !== null && (
            <div className="renv-logWrap">
              <div className="renv-row renv-between">
                <span className="renv-title">{t('logs')}: {activeId}</span>
                <div className="renv-row">
                  <button type="button" onClick={() => void refresh()}>{t('refresh')}</button>
                  <button type="button" onClick={() => setActiveId(null)}>{t('close')}</button>
                </div>
              </div>
              {/* 日志保留原始 ANSI，这里重建成带类名/内联色的片段来还原终端着色。
                  整段解析（而不是追加式）才能正确处理被 chunk 切断的转义序列。 */}
              <pre className="renv-log">
                {segments.map((segment, index) =>
                  segment.className === undefined && segment.style === undefined ? (
                    segment.text
                  ) : (
                    <span key={index} className={segment.className} style={segment.style as React.CSSProperties | undefined}>
                      {segment.text}
                    </span>
                  ),
                )}
              </pre>
            </div>
          )}
        </>
      )}

      {tab === 'config' && snapshot !== null && (
        <ConfigurationSection
          snapshot={snapshot}
          api={api}
          onSnapshot={setSnapshot}
          root={root}
          pickDirectory={props.pickDirectory}
          editing={editing}
          setEditing={setEditing}
          t={t}
        />
      )}
      </div>
    </div>
  );
}
