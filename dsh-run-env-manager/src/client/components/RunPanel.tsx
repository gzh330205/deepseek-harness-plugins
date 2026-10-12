import React from 'react';
import { errText, type RunEnvApi } from '../api.js';
import { ConfigurationSection } from './ConfigurationSection.jsx';
import { RunCard } from './RunCard.jsx';
import { IconRefresh } from './icons.jsx';
import type { Snapshot } from '../types.js';

/** 稳定兜底：`useSessions` 缺失时不订阅，而不是条件调用 hook。 */
const NO_SUBSCRIPTION = () => undefined;

/** 取路径末级目录名（Windows/Posix 分隔符都要认）。 */
function basename(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '');
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return at >= 0 ? normalized.slice(at + 1) : normalized;
}
const POLL_INTERVAL_MS = 2000;

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
 * 数据全部来自宿主的全量快照（动作回快照 + 2 秒轮询）；日志按卡片展开时才取
 * （`/log` 首屏 + SSE 增量，见 RunCard），所以轮询快照只要元数据。
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
  const [error, setError] = React.useState('');
  const [aiBusy, setAiBusy] = React.useState('');
  /** 日志展开了哪些卡片：按实例 id 记，多个服务各开各的。 */
  const [openLogs, setOpenLogs] = React.useState<Record<string, boolean>>({});
  /** 最近看过日志的配置：AI 故障排查默认排查它。 */
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  // 工作区根默认跟随当前会话，之后不随会话切换抖动（用户可能正在编辑配置）。
  React.useEffect(() => {
    if (typeof sessionCwd === 'string' && sessionCwd !== '') setRoot((current) => (current === '' ? sessionCwd : current));
  }, [sessionCwd]);

  // 轮询只要元数据：日志按需取，别让「多个服务同时跑」变成每 2 秒回传几份 20 万字符。
  const refresh = React.useCallback(async () => {
    if (root === '') return;
    try {
      setSnapshot(await api.status(root, false));
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

  /** 卡片回调都要求稳定：稳定不了会让日志订阅每次渲染都重连。 */
  const reportError = React.useCallback((message: string) => setError(message), []);
  const applySnapshot = React.useCallback((next: Snapshot) => setSnapshot(next), []);
  const toggleLog = React.useCallback((id: string, open: boolean) => {
    setOpenLogs((current) => (current[id] === open ? current : { ...current, [id]: open }));
    if (open) setFocusedId(id);
  }, []);
  const openUrl = React.useCallback(
    (url: string) => {
      void api.openUrl(url).catch((cause) => {
        // 宿主打不开（例如在非桌面环境里跑 Web 端）就退回浏览器自己的能力，
        // 两种都失败才报错——总比点了没反应好。
        if (window.open(url, '_blank', 'noopener') === null) setError(errText(cause));
      });
    },
    [api],
  );

  const runs = snapshot?.runs ?? [];
  const configurations = snapshot?.workspace?.configurations ?? [];
  const runOf = (id: string) => runs.find((run) => run.id === id);

  const runAi = async (mode: 'configure' | 'troubleshoot') => {
    if (snapshot === null) return;
    setAiBusy(mode);
    setError('');
    try {
      // 换会话前先拉一次最新快照：AI 拿到的是当前真实状态（含各实例日志尾部）。
      const latest = await api.status(root);
      setSnapshot(latest);
      if (mode === 'configure') {
        await props.agent.configure({ root, snapshot: latest });
      } else {
        const selected =
          latest.workspace?.configurations?.find((item) => item.id === (focusedId ?? editing)) ??
          latest.workspace?.configurations?.[0];
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
        <button type="button" className="renv-iconbtn" title={t('refresh')} aria-label={t('refresh')} disabled={root === ''} onClick={() => void refresh()}>
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
              {configurations.map((configuration) => (
                <RunCard
                  key={configuration.id}
                  configuration={configuration}
                  run={runOf(configuration.id)}
                  root={root}
                  api={api}
                  t={t}
                  open={openLogs[configuration.id] === true}
                  onToggle={toggleLog}
                  onSnapshot={applySnapshot}
                  onError={reportError}
                  onEdit={(id) => {
                    setEditing(id);
                    setTab('config');
                  }}
                  onOpenUrl={openUrl}
                />
              ))}
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
