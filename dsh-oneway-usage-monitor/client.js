window.__ModuleLoader__.load({
  id: 'dsh-oneway-usage-monitor',
  factory: (require) => {
    const React = require('react');
    const { createElement: h } = React;
    const { createRoot } = require('react-dom/client');

    const NS = 'settings.onewayUsage';
    const SETTINGS_NAMESPACE = 'oneway-usage-monitor';
    const API = '/dsh-oneway-usage/v1';
    const cssId = 'dsh-oneway-usage-monitor/styles.css';
    const css = `
      .owm{color:var(--dsw-alias-label-primary);font-size:13px}.owm *{box-sizing:border-box}
      .owm h2,.owm h3,.owm p{margin:0}.owm-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}
      .owm-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5}
      .owm-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;padding:22px 0}
      /* theme-aware card surface: light = bluish-100, dark = layer-3 */
      .owm-card{background:var(--dsw-static-neutral-bluish-100);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}
      body[data-ds-dark-theme] .owm-card{background:var(--dsw-alias-bg-layer-3)}
      .owm-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .owm-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      /* buttons: ghost by default, primary = DSH info blue, secondary = ghost-active */
      .owm button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;color:var(--dsw-alias-label-primary);background:transparent;transition:background .12s ease,color .12s ease}
      .owm button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
      .owm button:disabled{cursor:default;opacity:.5}
      .owm-primary{background:var(--dsw-alias-button-info-fill)!important;border-color:transparent!important;color:#fff!important}
      .owm-primary:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)!important}
      .owm-secondary{background:var(--dsw-alias-button-ghost-active-fill)}
      .owm-secondary:hover:not(:disabled){background:var(--dsw-alias-button-ghost-active-hover)}
      .owm-danger{color:var(--dsw-alias-state-error-primary)!important;border-color:transparent!important}
      .owm-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)!important}
      .owm-badge{display:inline-block;background:var(--dsw-alias-bg-module-platform);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:11px;padding:2px 9px;white-space:nowrap}
      /* ---------- floating widget card ---------- */
      .owm-fab{position:fixed;right:18px;bottom:22px;z-index:1400;width:120px;padding:10px 12px 9px;border-radius:14px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 90%,transparent);box-shadow:var(--dsw-shadow-lv3);backdrop-filter:blur(12px);display:flex;flex-direction:column;gap:7px;transition:transform .15s ease,box-shadow .15s ease}
      .owm-fab:hover{transform:translateY(-2px);box-shadow:var(--dsw-shadow-lv4,var(--dsw-shadow-lv3))}
      .owm-fabHead{display:flex;align-items:center;justify-content:space-between;width:100%}
      .owm-fabHeadTitle{font-size:10.5px;font-weight:700;color:var(--dsw-alias-label-primary);letter-spacing:.02em}
      .owm-fabHeadDot{width:8px;height:8px;border-radius:999px;flex:none}
      .owm-fabLegend{display:flex;flex-direction:column;gap:3px;width:100%}
      .owm-fabRow{display:flex;align-items:center;gap:5px;font-size:10px;line-height:1.2;color:var(--dsw-alias-label-secondary);min-width:0}
      .owm-fabRow .owm-fabSwatch{width:7px;height:7px;border-radius:999px;flex:none}
      .owm-fabRowLabel{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .owm-fabRowValue{font-weight:700;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;white-space:nowrap}
      .owm-fabTip{position:fixed;z-index:1410;pointer-events:none;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-shadow-lv3);padding:8px 10px;font-size:12px;white-space:nowrap;display:flex;flex-direction:column;gap:3px;color:var(--dsw-alias-label-secondary)}
      .owm-tipRow{display:flex;align-items:center;gap:6px}.owm-tipSwatch{width:9px;height:9px;border-radius:999px;flex:none}
      /* ---------- modal ---------- */
      .owm-mask{position:fixed;inset:0;z-index:1500;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;padding:24px}
      .owm-modal{width:min(1020px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:var(--dsw-shadow-lv3);overflow:hidden}
      .owm-modalHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px 13px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap}
      .owm-modalHead h2{margin:0;font-size:15px;font-weight:700}
      .owm-modalTitle{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
      .owm-modalBody{overflow:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:16px}
      .owm-close{font-size:16px!important;line-height:1;padding:3px 9px!important}
      .owm-banner{display:flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);border-radius:10px;padding:9px 12px;font-size:12px;line-height:1.5}
      /* ---------- summary (single column: token card, then 3 KPI cards) ---------- */
      .owm-summary{display:grid;grid-template-columns:1fr;gap:10px}
      .owm-ringsCard{background:var(--dsw-static-neutral-bluish-100);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 18px;display:flex;flex-direction:column;gap:10px}
      body[data-ds-dark-theme] .owm-ringsCard{background:var(--dsw-alias-bg-layer-3)}
      .owm-ringsHead{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .owm-ringsTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
      .owm-ringsLegend{display:flex;flex-direction:column;gap:8px;width:100%}
      .owm-ringRow{display:flex;align-items:center;gap:10px;font-size:12.5px;min-width:0}
      .owm-ringRow .owm-fabSwatch{width:9px;height:9px;border-radius:999px;flex:none}
      .owm-ringRowLabel{flex:none;color:var(--dsw-alias-label-secondary);white-space:nowrap;width:52px}
      .owm-ringRowValue{flex:none;font-weight:700;font-variant-numeric:tabular-nums;min-width:64px;text-align:right}
      .owm-ringRowBar{flex:1;height:6px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);overflow:hidden;min-width:60px}
      .owm-ringRowBar>span{display:block;height:100%;border-radius:999px}
      .owm-ringRowBar>span[data-color="h5"]{background:#10b981}
      .owm-ringRowBar>span[data-color="today"]{background:#3b82f6}
      .owm-ringRowBar>span[data-color="week"]{background:#8b5cf6}
      .owm-ringRowPct{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11.5px;font-variant-numeric:tabular-nums;width:44px;text-align:right}
      /* ---------- kpi ---------- */
      .owm-kpis{display:grid;grid-template-columns:1fr;gap:10px;min-width:0}
      .owm-kpi{background:var(--dsw-static-neutral-bluish-100);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 16px 11px;display:flex;align-items:center;gap:18px;min-width:0}
      body[data-ds-dark-theme] .owm-kpi{background:var(--dsw-alias-bg-layer-3)}
      .owm-kpiTitle{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);flex:none;width:76px}
      .owm-kpiGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;flex:1;min-width:0}
      .owm-kpiCell{display:flex;flex-direction:column;align-items:center;gap:4px;padding:2px 1px;min-width:0}
      .owm-kpiCell + .owm-kpiCell{border-left:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2))}
      .owm-kpiLabel{font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
      .owm-kpiValue{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
      .owm-apiKeyRow{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap;background:var(--dsw-static-neutral-bluish-100);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 14px;margin-top:2px}
      body[data-ds-dark-theme] .owm-apiKeyRow{background:var(--dsw-alias-bg-layer-3)}
      .owm-apiKeyRow code{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}
      /* ---------- tabs ---------- */
      .owm-tabs{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap}
      .owm-tab{border:0!important;border-radius:8px 8px 0 0;padding:8px 16px;color:var(--dsw-alias-label-secondary)!important;border-bottom:2px solid transparent!important;font-size:13px}
      .owm-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .owm-tab[data-active="true"]{color:var(--dsw-alias-label-primary)!important;font-weight:600;border-bottom-color:var(--dsw-static-deepseek-500)!important}
      /* ---------- tables ---------- */
      .owm-tableWrap{overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:10px}
      /* request-log table: fixed layout, task-priority widths, model column stretches */
      .owm-logsTable{table-layout:fixed}
      .owm-logsTable th:nth-child(1),.owm-logsTable td:nth-child(1){width:152px}
      .owm-logsTable th:nth-child(2),.owm-logsTable td:nth-child(2){width:auto}
      .owm-logsTable th:nth-child(3),.owm-logsTable td:nth-child(3){width:96px}
      .owm-logsTable th:nth-child(4),.owm-logsTable td:nth-child(4){width:112px}
      .owm-logsTable th:nth-child(5),.owm-logsTable td:nth-child(5){width:96px}
      .owm-logsTable th:nth-child(6),.owm-logsTable td:nth-child(6){width:52px}
      .owm-logsTable th:nth-child(7),.owm-logsTable td:nth-child(7){width:80px}
      .owm-logsTable th:nth-child(8),.owm-logsTable td:nth-child(8){width:92px}
      .owm-logsTable td{overflow:hidden;text-overflow:ellipsis}
      .owm-logsTable .owm-cellModel{font-weight:600}
      .owm table{border-collapse:collapse;width:100%;font-size:12px}
      .owm th{position:sticky;top:0;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-weight:600;text-align:left!important;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);white-space:nowrap;z-index:1}
      .owm td{padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2));vertical-align:middle;white-space:nowrap}
      .owm tbody tr:last-child td{border-bottom:0}
      .owm tbody tr:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .owm-num{font-variant-numeric:tabular-nums;text-align:right}
      .owm th.owm-num,.owm td.owm-num{text-align:right!important}
      .owm-status{border-radius:999px;font-size:11px;padding:1px 8px;display:inline-block}
      .owm-status-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 13%,transparent);color:var(--dsw-alias-state-success-primary)}
      .owm-status-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 13%,transparent);color:var(--dsw-alias-state-error-primary)}
      .owm-status-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 15%,transparent);color:var(--dsw-alias-state-warn-primary)}
      .owm-status-other{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
      .owm-limitCell{display:flex;align-items:center;gap:8px;min-width:130px}
      .owm-bar{height:5px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);overflow:hidden;min-width:56px;flex:1}
      .owm-bar>span{display:block;height:100%;border-radius:999px;background:var(--dsw-static-deepseek-500)}
      .owm-bar[data-warn="true"]>span{background:var(--dsw-alias-state-warn-primary)}
      .owm-bar[data-full="true"]>span{background:var(--dsw-alias-state-error-primary)}
      /* ---------- trend ---------- */
      .owm-trend{display:flex;flex-direction:column;gap:16px}
      .owm-trendBlock h3{font-size:13px;font-weight:600;margin:0 0 9px}
      .owm-barList{display:flex;flex-direction:column;gap:2px;max-height:264px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:6px 10px}
      .owm-barRow{display:grid;grid-template-columns:128px 74px 84px 1fr;gap:10px;align-items:center;font-size:11.5px;padding:4px 2px;border-radius:6px}
      .owm-barRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .owm-barTime{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
      .owm-barReqs{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
      .owm-barTokens{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
      .owm-barTrack{height:7px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);overflow:hidden}
      .owm-barTrack>span{display:block;height:100%;border-radius:999px;background:var(--dsw-static-deepseek-500);opacity:.85}
      /* ---------- logs toolbar & pager ---------- */
      .owm-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .owm-input{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
      .owm-pager{display:flex;align-items:center;gap:10px;justify-content:flex-end;flex-wrap:wrap}
      .owm-pagerInfo{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
      /* ---------- models ---------- */
      .owm-modelGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
      .owm-chip{display:inline-block;font-size:11.5px;border-radius:999px;padding:3px 10px;background:color-mix(in srgb,var(--dsw-static-deepseek-500) 10%,transparent);color:var(--dsw-alias-label-secondary);margin:3px 3px 0 0}
      /* ---------- login ---------- */
      .owm-login{display:flex;flex-direction:column;align-items:center;gap:12px;padding:30px 12px;text-align:center;max-width:360px;margin:0 auto}
      .owm-login h3{font-size:15px;font-weight:700}
      .owm-loginDesc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.55}
      .owm-qrBox{border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:12px;background:#fff}
      .owm-qrBox img{width:196px;height:196px;display:block}
      .owm-loginStatus{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}
      .owm-loginHint{font-size:12px;color:var(--dsw-alias-label-tertiary)}
      .owm-loading{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:18px 4px}
      .owm-spin{width:14px;height:14px;border-radius:999px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-static-deepseek-500);animation:owm-spin .8s linear infinite}
      @keyframes owm-spin{to{transform:rotate(360deg)}}
      /* ---------- settings ---------- */
      .owm-form{display:flex;flex-direction:column;gap:10px;max-width:560px}
      .owm-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .owm-form .owm-input{width:100%}
      .owm-rowWrap{display:flex;gap:10px;flex-wrap:wrap}.owm-rowWrap label{flex:1;min-width:140px}
      @media (max-width:860px){
        .owm-summary{grid-template-columns:1fr}
        .owm-kpis{grid-template-columns:1fr}
        .owm-barRow{grid-template-columns:96px 60px 70px 1fr}
      }
    `;
    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${cssId}"]`) === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-oneway-usage-monitor';
      tag.dataset.pluginCss = cssId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /* ---------------- shared helpers ---------------- */

    let apiToken;
    async function api(path, options = {}) {
      if (options.method && apiToken === undefined) {
        const boot = await fetch(`${API}/bootstrap`, { credentials: 'same-origin' });
        const bootstrap = await boot.json();
        if (!boot.ok) throw new Error(bootstrap.error ?? '无法取得操作授权。');
        apiToken = bootstrap.token;
      }
      const headers = { ...(options.headers ?? {}) };
      if (options.method) headers['x-dsh-owm-token'] = apiToken;
      const response = await fetch(`${API}${path}`, { credentials: 'same-origin', ...options, headers });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? `请求失败 (${response.status})`);
      return result;
    }
    function useScope(scope) {
      return React.useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot());
    }
    function configOf(scope) { return scope.getSnapshot().value ?? {}; }
    function errorText(error) { return error instanceof Error ? error.message : String(error); }
    function fmtTokens(value) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return String(Math.round(value));
    }
    function fmtInt(value) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      return Number(value).toLocaleString('zh-CN');
    }
    function fmtDuration(value) {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      if (value >= 60) return `${(value / 60).toFixed(1)}小时`;
      return `${value.toFixed(1)}分钟`;
    }
    function percentOf(value, cap) {
      if (value === null || value === undefined || !cap) return null;
      return Math.round((value / cap) * 1000) / 10;
    }
    const RING_COLORS = { h5: '#10b981', today: '#3b82f6', week: '#8b5cf6' };
    const RING_ORDER = [['h5', '近5小时'], ['today', '今日'], ['week', '本周']];
    const WINDOWS = [
      ['h5', '近5小时'], ['today', '今日'], ['week', '本周'], ['month', '本月'], ['year', '本年'],
    ];

    function StatusBadge({ status }) {
      const cls = status === 'completed' ? 'owm-status-ok' : status === 'failed' ? 'owm-status-err' : status === 'pending' ? 'owm-status-warn' : 'owm-status-other';
      return h('span', { className: `owm-status ${cls}` }, status || '—');
    }

    function LimitCell({ value, limit }) {
      if (limit === null || limit === undefined || limit <= 0) return h('span', { className: 'owm-muted' }, '不限');
      const fraction = (value ?? 0) / limit;
      return h('div', { className: 'owm-limitCell' },
        h('span', { className: 'owm-num' }, fmtTokens(value)),
        h('div', { className: 'owm-bar', 'data-warn': fraction >= 0.8 && fraction < 1, 'data-full': fraction >= 1 },
          h('span', { style: { width: `${Math.min(fraction, 1) * 100}%` } })),
        h('span', { className: 'owm-muted' }, `/${fmtTokens(limit)}`));
    }

    /* ---------------- floating widget ---------------- */

    function WidgetFab({ payload, caps, authenticated, onOpen }) {
      const [tip, setTip] = React.useState(null);
      const ref = React.useRef(null);
      const tokens = payload?.usage?.tokens ?? {};
      const dotColor = authenticated ? 'var(--dsw-alias-state-success-primary)' : payload?.lastError ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-warn-primary)';
      const showTip = (show) => {
        if (!show || !ref.current) { setTip(null); return; }
        const rect = ref.current.getBoundingClientRect();
        setTip({ left: rect.left - 152, top: rect.top - 8 });
      };
      return h('div', { className: 'owm-fab', ref, role: 'button', tabIndex: 0, 'aria-label': 'ONE-WAY 用量监控',
        onClick: onOpen,
        onMouseEnter: () => showTip(true), onMouseLeave: () => showTip(false), onFocus: () => showTip(true), onBlur: () => showTip(false) },
        h('div', { className: 'owm-fabHead' },
          h('span', { className: 'owm-fabHeadTitle' }, authenticated ? (tokens.today !== undefined ? 'ONE-WAY' : 'ONE-WAY') : '点击登录'),
          h('span', { className: 'owm-fabHeadDot', style: { background: dotColor } })),
        h('div', { className: 'owm-fabLegend' },
          RING_ORDER.map(([key, label]) => h('div', { className: 'owm-fabRow', key },
            h('span', { className: 'owm-fabSwatch', style: { background: RING_COLORS[key] } }),
            h('span', { className: 'owm-fabRowLabel' }, label),
            h('span', { className: 'owm-fabRowValue' }, authenticated ? fmtTokens(tokens[key]) : '—')))),
        tip && caps ? h('div', { className: 'owm-fabTip', style: { left: tip.left, top: tip.top } },
          RING_ORDER.map(([key, label]) => h('span', { className: 'owm-tipRow', key },
            h('span', { className: 'owm-tipSwatch', style: { background: RING_COLORS[key] } }),
            `${label}：${fmtTokens(tokens[key])}（${percentOf(tokens[key], caps[key]) ?? '—'}%）`))) : null);
    }

    /* ---------------- login panel ---------------- */

    function LoginPanel({ t, onDone }) {
      const [phase, setPhase] = React.useState('starting');
      const [qrUrl, setQrUrl] = React.useState(null);
      const [message, setMessage] = React.useState('');
      const [cancelled, setCancelled] = React.useState(false);
      // Bumping the generation restarts the whole start + poll loop with a fresh QR.
      const [generation, setGeneration] = React.useState(0);
      React.useEffect(() => {
        let alive = true;
        let timer = null;
        const poll = async () => {
          try {
            const result = await api('/login/poll', { method: 'POST' });
            if (!alive) return;
            setPhase(result.phase);
            if (result.message) setMessage(result.message);
            if (result.phase === 'success') { onDone(); return; }
            if (result.phase === 'failed' || result.phase === 'expired' || result.phase === 'error') {
              setQrUrl(null);
              if (result.phase === 'expired') setMessage('二维码已过期，请刷新二维码。');
              return;
            }
            timer = setTimeout(poll, 2000);
          } catch (error) {
            if (!alive) return;
            setPhase('error');
            setMessage(errorText(error));
          }
        };
        // generation > 0 means the user asked for a fresh QR; force a new flow.
        const options = generation > 0
          ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh: true }) }
          : { method: 'POST' };
        api('/login/start', options).then((result) => {
          if (!alive) return;
          setQrUrl(result.qrUrl);
          setPhase('waiting');
          timer = setTimeout(poll, 1500);
        }).catch((error) => {
          if (!alive) return;
          setPhase('error');
          setMessage(errorText(error));
        });
        return () => { alive = false; if (timer !== null) clearTimeout(timer); };
      }, [generation]);
      const cancel = async () => {
        setCancelled(true);
        try { await api('/login/cancel', { method: 'POST' }); } catch { /* ignore */ }
        onDone();
      };
      const refreshQr = () => {
        setPhase('starting');
        setMessage('');
        setGeneration((value) => value + 1);
      };
      const phaseText = { starting: '正在获取二维码…', waiting: '请使用企业微信扫码登录', scanned: '已扫码，请在手机上确认', success: '登录成功', failed: '扫码失败', expired: '二维码已过期', error: '出错了', none: '未开始' }[phase] ?? phase;
      const phaseError = phase === 'error' || phase === 'failed' || phase === 'expired';
      return h('div', { className: 'owm-login' },
        h('h3', null, '登录 ONE-WAY 中台'),
        h('p', { className: 'owm-loginDesc' }, '使用企业微信扫码，授权后插件即可读取 Token 用量。会话 Cookie 只保存在本机 DSH 设置中。'),
        qrUrl ? h('div', { className: 'owm-qrBox' }, h('img', { src: qrUrl, alt: '企业微信登录二维码' }))
          : phase === 'starting' ? h('div', { className: 'owm-loading' }, h('span', { className: 'owm-spin' }), '正在获取二维码…')
          : h('div', { className: 'owm-qrBox' }, h('div', { style: { width: 196, height: 196, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '二维码已失效')),
        h('div', { className: 'owm-loginStatus', style: phaseError ? { color: 'var(--dsw-alias-state-error-primary)' } : undefined }, phaseText),
        h('p', { className: 'owm-loginHint' },
          phase === 'waiting' ? '打开企业微信「扫一扫」，扫描左侧二维码' :
          phase === 'scanned' ? '已扫码，请在手机上点击确认' :
          phase === 'starting' ? '正在建立安全连接…' : ''),
        message ? h('p', { className: 'owm-error' }, message) : null,
        h('div', { className: 'owm-actions' },
          h('button', { className: 'owm-secondary', onClick: refreshQr, disabled: cancelled }, '刷新二维码'),
          h('button', { className: 'owm-secondary', onClick: cancel, disabled: cancelled }, '取消')));
    }

    /* ---------------- modal: summary + tabs ---------------- */

    function SummarySection({ usage, caps }) {
      const tokens = usage?.tokens ?? {};
      return h('div', { className: 'owm-summary' },
        h('div', { className: 'owm-ringsCard' },
          h('div', { className: 'owm-ringsHead' },
            h('span', { className: 'owm-ringsTitle' }, 'Token 用量'),
            h('span', { className: 'owm-badge' }, '近5小时 · 今日 · 本周')),
          h('div', { className: 'owm-ringsLegend' },
            RING_ORDER.map(([key, label]) => {
              const pct = percentOf(tokens[key], caps?.[key]);
              return h('div', { className: 'owm-ringRow', key },
                h('span', { className: 'owm-fabSwatch', style: { background: RING_COLORS[key] } }),
                h('span', { className: 'owm-ringRowLabel' }, label),
                h('span', { className: 'owm-ringRowValue' }, fmtTokens(tokens[key])),
                h('div', { className: 'owm-ringRowBar' }, h('span', { 'data-color': key, style: { width: `${Math.min(pct ?? 0, 100)}%` } })),
                h('span', { className: 'owm-ringRowPct' }, pct === null ? '—' : `${pct}%`));
            }))),
        h('div', { className: 'owm-kpis' },
          h(KpiCard, { title: 'Token 用量', values: usage?.tokens, format: fmtTokens }),
          h(KpiCard, { title: '请求次数', values: usage?.requests, format: fmtInt }),
          h(KpiCard, { title: '使用时长', values: usage?.duration, format: fmtDuration })));
    }

    function KpiCard({ title, values, format }) {
      return h('div', { className: 'owm-kpi' },
        h('div', { className: 'owm-kpiTitle' }, title),
        h('div', { className: 'owm-kpiGrid' },
          WINDOWS.map(([key, label]) => h('div', { className: 'owm-kpiCell', key },
            h('span', { className: 'owm-kpiLabel' }, label),
            h('span', { className: 'owm-kpiValue' }, format(values?.[key]))))));
    }

    /** Empty-state summary (no data yet): — values. */
    function EmptySummary() {
      return h('div', { className: 'owm-summary' },
        h('div', { className: 'owm-ringsCard' },
          h('div', { className: 'owm-ringsHead' },
            h('span', { className: 'owm-ringsTitle' }, 'Token 用量'),
            h('span', { className: 'owm-badge' }, '近5小时 · 今日 · 本周')),
          h('div', { className: 'owm-ringsLegend' },
            RING_ORDER.map(([key, label]) => h('div', { className: 'owm-ringRow', key },
              h('span', { className: 'owm-fabSwatch', style: { background: RING_COLORS[key] } }),
              h('span', { className: 'owm-ringRowLabel' }, label),
              h('span', { className: 'owm-ringRowValue' }, '—'),
              h('div', { className: 'owm-ringRowBar' }, h('span', { 'data-color': key, style: { width: '0%' } })),
              h('span', { className: 'owm-ringRowPct' }, '—')))),
        h('div', { className: 'owm-kpis' },
          h(KpiCard, { title: 'Token 用量', values: null, format: fmtTokens }),
          h(KpiCard, { title: '请求次数', values: null, format: fmtInt }),
          h(KpiCard, { title: '使用时长', values: null, format: fmtDuration }))));
    }

    function TrendTab({ usage }) {
      return h('div', { className: 'owm-trend' },
        h('div', { className: 'owm-trendBlock' },
          h('h3', null, '最近 24 小时每小时用量'),
          h(BarList, { rows: usage?.hourly, timeKey: 'hour' })),
        h('div', { className: 'owm-trendBlock' },
          h('h3', null, '最近 30 天每日用量'),
          h(BarList, { rows: usage?.daily, timeKey: 'date' })));
    }

    function BarList({ rows, timeKey }) {
      if (!rows || rows.length === 0) return h('p', { className: 'owm-empty' }, '暂无趋势数据');
      const max = Math.max(...rows.map((row) => row.tokens ?? 0), 1);
      return h('div', { className: 'owm-barList' },
        rows.map((row) => h('div', { className: 'owm-barRow', key: row[timeKey] },
          h('span', { className: 'owm-barTime' }, row[timeKey]),
          h('span', { className: 'owm-barReqs' }, `${fmtInt(row.requests)} 次`),
          h('span', { className: 'owm-barTokens' }, fmtTokens(row.tokens)),
          h('div', { className: 'owm-barTrack' }, h('span', { style: { width: `${((row.tokens ?? 0) / max) * 100}%` } })))));
    }

    function LogsTab({ t }) {
      const today = new Date();
      const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const weekAgo = new Date(today.getTime() - 6 * 86400000);
      const [startDate, setStartDate] = React.useState(iso(weekAgo));
      const [endDate, setEndDate] = React.useState(iso(today));
      const [page, setPage] = React.useState(1);
      const [pageSize, setPageSize] = React.useState(10);
      const [logs, setLogs] = React.useState(null);
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const load = async (nextPage = page, nextSize = pageSize) => {
        setBusy(true); setError('');
        try {
          const params = new URLSearchParams({ startDate, endDate, page: String(nextPage), pageSize: String(nextSize) });
          const result = await api(`/logs?${params.toString()}`);
          setLogs(result); setPage(result.page ?? nextPage); setPageSize(result.pageSize ?? nextSize);
        } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
      };
      React.useEffect(() => { load(1, pageSize); }, []);
      const pages = logs?.pages ?? 1;
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h('div', { className: 'owm-toolbar' },
          h('input', { className: 'owm-input', type: 'date', value: startDate, onChange: (event) => setStartDate(event.target.value) }),
          h('span', { className: 'owm-muted' }, '至'),
          h('input', { className: 'owm-input', type: 'date', value: endDate, onChange: (event) => setEndDate(event.target.value) }),
          h('select', { className: 'owm-input', value: pageSize, onChange: (event) => { const next = Number(event.target.value); setPageSize(next); load(1, next); } },
            h('option', { value: 10 }, '10 条/页'), h('option', { value: 20 }, '20 条/页'), h('option', { value: 50 }, '50 条/页')),
          h('button', { className: 'owm-primary', onClick: () => load(1, pageSize), disabled: busy }, '查询'),
          busy ? h('span', { className: 'owm-loading', style: { padding: 0 } }, h('span', { className: 'owm-spin' })) : null,
          h('span', { className: 'owm-muted', style: { marginLeft: 'auto' } }, '默认近 7 天')),
        error ? h('p', { className: 'owm-error' }, error) : null,
        h('div', { className: 'owm-tableWrap' },
          h('table', { className: 'owm-logsTable' },
            h('thead', null, h('tr', null,
              h('th', null, '时间'), h('th', null, '模型'), h('th', null, '所属 Key'), h('th', null, '渠道'),
              h('th', null, '状态'), h('th', null, '流式'), h('th', { className: 'owm-num' }, '延迟'), h('th', { className: 'owm-num' }, 'Token'))),
            h('tbody', null, !logs ? h('tr', null, h('td', { colSpan: 8, className: 'owm-muted' }, '加载中…'))
              : !logs.rows || logs.rows.length === 0 ? h('tr', null, h('td', { colSpan: 8, className: 'owm-muted' }, '该时间段暂无请求。'))
              : logs.rows.map((row) => h('tr', { key: row.id },
                h('td', { className: 'owm-muted' }, row.time),
                h('td', { className: 'owm-cellModel' }, row.model),
                h('td', null, row.key), h('td', null, row.channel),
                h('td', null, h(StatusBadge, { status: row.status })),
                h('td', null, row.stream), h('td', { className: 'owm-num' }, row.latency),
                h('td', { className: 'owm-num' }, fmtTokens(row.tokens))))))),
        logs ? h('div', { className: 'owm-pager' },
          h('button', { className: 'owm-secondary', onClick: () => load(Math.max(1, page - 1)), disabled: page <= 1 }, '« 上一页'),
          h('span', { className: 'owm-pagerInfo' }, `第 ${page} / ${pages} 页 · 共 ${fmtInt(logs.total ?? 0)} 条`),
          h('button', { className: 'owm-secondary', onClick: () => load(Math.min(pages, page + 1)), disabled: page >= pages }, '下一页 »')) : null);
    }

    function ChannelsTab({ usage }) {
      return h('div', { className: 'owm-tableWrap' },
        h('table', null,
          h('thead', null, h('tr', null,
            h('th', null, '渠道'), h('th', { className: 'owm-num' }, '近 5 小时'), h('th', null, '5h 限额'),
            h('th', { className: 'owm-num' }, '今日'), h('th', { className: 'owm-num' }, '本周'), h('th', null, '周限额'),
            h('th', { className: 'owm-num' }, '本月'), h('th', { className: 'owm-num' }, '本年'))),
          h('tbody', null, !usage?.channels || usage.channels.length === 0 ? h('tr', null, h('td', { colSpan: 8, className: 'owm-muted' }, '暂无渠道数据。'))
            : usage.channels.map((channel) => h('tr', { key: channel.channel },
              h('td', { style: { fontWeight: 600 } }, channel.channel),
              h('td', { className: 'owm-num' }, fmtTokens(channel.h5)),
              h('td', null, h(LimitCell, { value: channel.h5, limit: channel.h5Limit })),
              h('td', { className: 'owm-num' }, fmtTokens(channel.today)),
              h('td', { className: 'owm-num' }, fmtTokens(channel.week)),
              h('td', null, h(LimitCell, { value: channel.week, limit: channel.weekLimit })),
              h('td', { className: 'owm-num' }, fmtTokens(channel.month)),
              h('td', { className: 'owm-num' }, fmtTokens(channel.year)))))));
    }

    function ModelsTab({ usage }) {
      return h('div', { className: 'owm-modelGrid' },
        !usage?.models || usage.models.length === 0 ? h('p', { className: 'owm-empty', style: { gridColumn: '1 / -1' } }, '暂无渠道与模型数据。')
          : usage.models.map((group) => h('div', { className: 'owm-card', key: group.channel },
            h('div', { className: 'owm-row' },
              h('span', { style: { fontWeight: 600, fontSize: 13 } }, group.channel),
              h('span', { className: 'owm-badge' }, `${group.count} 个模型`)),
            h('div', { style: { marginTop: 8 } }, group.models.map((model) => h('span', { className: 'owm-chip', key: model }, model))))));
    }

    function UsageModal({ payload, open, close, t }) {
      const [view, setView] = React.useState('logs');
      const [busy, setBusy] = React.useState(false);
      const usage = payload?.usage;
      React.useEffect(() => { if (open && !usage) { api('/refresh', { method: 'POST' }).catch(() => {}); } }, [open]);
      if (!open) return null;
      const tabs = [['logs', '请求日志'], ['trend', '用量趋势'], ['channels', '渠道用量 / 限额'], ['models', '渠道与模型']];
      const refresh = async () => { setBusy(true); try { await api('/refresh', { method: 'POST' }); window.dispatchEvent(new CustomEvent('owm:refresh')); } catch (err) { /* surfaced on next poll */ } finally { setBusy(false); } };
      const logout = async () => { if (!window.confirm('确定退出 ONE-WAY 登录吗？本机保存的会话 Cookie 将被清除。')) return; try { await api('/logout', { method: 'POST' }); window.dispatchEvent(new CustomEvent('owm:refresh')); } catch (err) { window.alert(errorText(err)); } };
      return h('div', { className: 'owm-mask', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) close(); } },
        h('section', { className: 'owm-modal', role: 'dialog', 'aria-modal': true, 'aria-label': 'ONE-WAY 用量监控' },
          h('header', { className: 'owm-modalHead' },
            h('div', { className: 'owm-modalTitle' },
              h('h2', null, 'ONE-WAY 用量监控'),
              payload?.user ? h('span', { className: 'owm-badge' }, payload.user) : null,
              payload?.refreshedAt ? h('span', { className: 'owm-muted' }, `更新于 ${new Date(payload.refreshedAt).toLocaleTimeString('zh-CN')}`) : null),
            h('div', { className: 'owm-actions' },
              h('button', { className: 'owm-secondary', onClick: refresh, disabled: busy }, busy ? '刷新中…' : '刷新'),
              payload?.authenticated ? h('button', { className: 'owm-danger', onClick: logout }, '退出登录') : null,
              h('button', { className: 'owm-close', onClick: close, 'aria-label': '关闭' }, '×'))),
          !payload?.authenticated ? h('div', { className: 'owm-modalBody' },
            h(LoginPanel, { t, onDone: () => { close(); window.dispatchEvent(new CustomEvent('owm:refresh')); } }))
            : h('div', { className: 'owm-modalBody' },
                payload?.lastError ? h('div', { className: 'owm-banner', role: 'alert' }, `数据刷新失败：${payload.lastError}。可点击「刷新」重试。`) : null,
                usage === null ? h(React.Fragment, null,
                  payload?.lastError ? null : h('div', { className: 'owm-loading' }, h('span', { className: 'owm-spin' }), '正在加载用量数据…'),
                  h(EmptySummary))
                : h(React.Fragment, null,
                    h(SummarySection, { usage, caps: payload?.caps }),
                    h('div', { className: 'owm-apiKeyRow' },
                      h('span', null, 'API Key'),
                      h('code', null, usage.apiKey ?? '—'),
                      h('button', { className: 'owm-secondary', onClick: () => { if (usage.apiKey) navigator.clipboard?.writeText(usage.apiKey).catch(() => {}); } }, '复制')),
                    h('nav', { className: 'owm-tabs', role: 'tablist' },
                      tabs.map(([key, label]) => h('button', { className: 'owm-tab', key, role: 'tab', 'aria-selected': view === key, 'data-active': view === key, onClick: () => setView(key) }, label))),
                    view === 'logs' ? h(LogsTab, { t }) : null,
                    view === 'trend' ? h(TrendTab, { usage }) : null,
                    view === 'channels' ? h(ChannelsTab, { usage }) : null,
                    view === 'models' ? h(ModelsTab, { usage }) : null))));
    }

    /* ---------------- settings tab ---------------- */

    function SettingsTab({ scope, t, openMonitor }) {
      const snapshot = useScope(scope);
      const config = configOf(scope);
      const [draft, setDraft] = React.useState(null);
      const [failure, setFailure] = React.useState('');
      const [status, setStatus] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const draftValue = draft ?? config;
      const patch = (key, value) => setDraft((old) => ({ ...(old ?? config), [key]: value }));
      React.useEffect(() => { setStatus(null); api('/usage').then(setStatus).catch((error) => setStatus({ ok: false, lastError: errorText(error) })); }, []);
      const save = async () => {
        setFailure(''); setBusy(true);
        try {
          for (const key of ['baseUrl', 'refreshSeconds', 'showWidget', 'ringCapWeek']) await scope.set(key, draftValue[key]);
          setDraft(null);
        } catch (error) { setFailure(errorText(error)); } finally { setBusy(false); }
      };
      if (snapshot.status === 'loading') return h('p', { className: 'owm-muted' }, '正在读取设置…');
      if (snapshot.status !== 'ready') return h('p', { className: 'owm-error' }, '此部署未提供可编辑的监控设置。');
      return h('div', { className: 'owm', style: { maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 } },
        h('h2', { style: { margin: 0 } }, 'ONE-WAY 用量监控'),
        h('p', { className: 'owm-muted' }, '从 oneway.eportyun.com 获取 Token 用量，在 DSH 右下角以三环卡片展示。会话通过企业微信扫码登录，Cookie 只保存在本机。'),
        status ? h('div', { className: 'owm-card', style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          h('div', { className: 'owm-row' },
            h('span', { style: { fontWeight: 600 } }, '登录状态'),
            h('span', { className: 'owm-badge' }, status.authenticated ? `已登录：${status.user ?? ''}` : '未登录')),
          status.lastError ? h('p', { className: 'owm-error' }, status.lastError) : null,
          h('div', { className: 'owm-actions' },
            h('button', { className: 'owm-primary', onClick: openMonitor }, status.authenticated ? '打开监控弹窗' : '扫码登录'),
            status.authenticated ? h('button', { className: 'owm-danger', onClick: async () => { if (!window.confirm('确定退出登录吗？')) return; try { await api('/logout', { method: 'POST' }); setStatus({ authenticated: false }); } catch (error) { setFailure(errorText(error)); } } }, '退出登录') : null)) : null,
        h('div', { className: 'owm-form' },
          h('label', null, '网关地址', h('input', { className: 'owm-input', value: draftValue.baseUrl ?? '', onChange: (event) => patch('baseUrl', event.target.value), placeholder: 'https://oneway.eportyun.com' })),
          h('div', { className: 'owm-rowWrap' },
            h('label', null, '刷新间隔（秒）', h('input', { className: 'owm-input', type: 'number', min: 30, max: 3600, value: draftValue.refreshSeconds ?? 120, onChange: (event) => patch('refreshSeconds', Number(event.target.value) || 120) })),
            h('label', null, '本周环满值（Token，0=按本周实际用量）', h('input', { className: 'owm-input', type: 'number', min: 0, value: draftValue.ringCapWeek ?? 0, onChange: (event) => patch('ringCapWeek', Number(event.target.value) || 0) }))),
          h('label', { style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
            h('input', { type: 'checkbox', checked: draftValue.showWidget !== false, onChange: (event) => patch('showWidget', event.target.checked) }),
            '显示右下角悬浮窗'),
          failure ? h('p', { className: 'owm-error' }, failure) : null,
          h('div', { className: 'owm-actions' },
            h('button', { className: 'owm-primary', onClick: save, disabled: busy }, '保存设置'),
            h('button', { className: 'owm-secondary', onClick: () => setDraft(null), disabled: busy || draft === null }, '重置'))));
    }

    /* ---------------- app shell ---------------- */

    const zh = {
      settingsTab: 'OneWay 用量',
    };
    const en = {
      settingsTab: 'OneWay Usage',
    };

    const openMonitorRef = { current: null };

    function WidgetApp({ scope, t }) {
      const settings = useScope(scope);
      const [payload, setPayload] = React.useState(null);
      const [open, setOpen] = React.useState(false);
      const load = React.useCallback(async () => {
        try {
          const result = await api('/usage');
          setPayload(result);
        } catch (error) {
          setPayload((previous) => ({ ...(previous ?? {}), ok: false, authenticated: false, lastError: errorText(error) }));
        }
      }, []);
      React.useEffect(() => {
        load();
        const timer = setInterval(load, 30000);
        const onVisible = () => { if (!document.hidden) load(); };
        const onRefresh = () => load();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('owm:refresh', onRefresh);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('owm:refresh', onRefresh); };
      }, [load]);
      React.useEffect(() => {
        openMonitorRef.current = () => setOpen(true);
        return () => { openMonitorRef.current = null; };
      }, []);
      const ready = settings.status === 'ready';
      const showFab = ready && settings.value?.showWidget !== false;
      return h(React.Fragment, null,
        showFab ? h(WidgetFab, { payload, caps: payload?.caps, authenticated: Boolean(payload?.authenticated), onOpen: () => setOpen(true) }) : null,
        h(UsageModal, { payload, caps: payload?.caps, open, close: () => setOpen(false), t }));
    }

    const inject = ['slots', 'locale', 'settingsScope'];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'oneway-usage-monitor: dictionaries');
      const t = ctx.locale.bind(NS);
      const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'oneway-usage',
        order: 30,
        label: () => t('settingsTab'),
        locale: NS,
        inject: () => ({ scope, t, openMonitor: () => openMonitorRef.current?.() }),
      }, SettingsTab));
      if (typeof document === 'undefined') return;
      const container = document.createElement('div');
      container.id = 'dsh-oneway-usage-root';
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(h(WidgetApp, { scope, t }));
      ctx.effect(() => () => { root.unmount(); container.remove(); }, 'oneway-usage-monitor widget');
    }
    return { apply, inject };
  },
});
