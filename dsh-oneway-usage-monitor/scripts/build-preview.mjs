/**
 * Builds examples/preview.html — a standalone interactive design preview of the
 * OneWay usage monitor UI. The CSS is extracted from client.js (single source
 * of truth); the markup is a static mock mirroring the React components, with
 * example data clearly labelled.
 *
 * Usage: node ./scripts/build-preview.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const clientSource = readFileSync(resolve(root, 'client.js'), 'utf8');

const match = /const css = `([\s\S]*?)`;/.exec(clientSource);
if (!match) throw new Error('Could not extract the CSS template from client.js');
const css = match[1];

// DSH design-token fallbacks so the preview renders outside the DSH shell.
// Light is the default; [data-theme="dark"] switches to the dark palette.
const tokens = `
  :root {
    color-scheme: light;
    --dsw-alias-label-primary: #1c2230;
    --dsw-alias-label-secondary: #4c5768;
    --dsw-alias-label-tertiary: #8a94a6;
    --dsw-alias-bg-layer-1: #f2f4f9;
    --dsw-alias-bg-layer-2: #ffffff;
    --dsw-alias-bg-layer-3: #f5f7fb;
    --dsw-alias-border-l1: #e7ebf2;
    --dsw-alias-border-l2: #dde3ec;
    --dsw-alias-interactive-bg-hover: rgba(15, 23, 42, 0.05);
    --dsw-alias-interactive-bg-hover-danger: rgba(214, 69, 61, 0.06);
    --dsw-alias-bg-module-platform: rgba(15, 23, 42, 0.07);
    --dsw-alias-bg-mask-1: rgba(15, 23, 42, 0.35);
    --dsw-shadow-lv3: 0 14px 40px rgba(15, 23, 42, 0.14);
    --dsw-alias-state-error-primary: #d6453d;
    --dsw-alias-state-success-primary: #1f9d63;
    --dsw-alias-state-warn-primary: #b97f10;
    --dsw-static-neutral-bluish-100: #ebeef2;
    --dsw-static-neutral-bluish-150: #e9ecf2;
    --dsw-static-deepseek-400: #679efe;
    --dsw-static-deepseek-500: #4176e6;
    --dsw-alias-button-info-fill: #4176e6;
    --dsw-alias-button-info-hover: #5686fe;
    --dsw-alias-button-ghost-active-fill: #ebeef2;
    --dsw-alias-button-ghost-active-hover: #e2e6ee;
  }
  [data-theme="dark"] {
    color-scheme: dark;
    --dsw-alias-label-primary: #e7ebf4;
    --dsw-alias-label-secondary: #a7b1c5;
    --dsw-alias-label-tertiary: #6d788d;
    --dsw-alias-bg-layer-1: #10131a;
    --dsw-alias-bg-layer-2: #171c26;
    --dsw-alias-bg-layer-3: #1e2531;
    --dsw-alias-border-l1: #232b3a;
    --dsw-alias-border-l2: #2c3547;
    --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.06);
    --dsw-alias-interactive-bg-hover-danger: rgba(242, 90, 90, 0.14);
    --dsw-alias-bg-module-platform: rgba(255, 255, 255, 0.08);
    --dsw-alias-bg-mask-1: rgba(4, 8, 16, 0.62);
    --dsw-shadow-lv3: 0 14px 40px rgba(0, 0, 0, 0.42);
    --dsw-alias-state-error-primary: #f26b64;
    --dsw-alias-state-success-primary: #34c77b;
    --dsw-alias-state-warn-primary: #e5b34b;
    --dsw-static-neutral-bluish-100: #ebeef2;
    --dsw-static-neutral-bluish-150: #e9ecf2;
    --dsw-static-deepseek-400: #679efe;
    --dsw-static-deepseek-500: #4176e6;
    --dsw-alias-button-info-fill: #679efe;
    --dsw-alias-button-info-hover: #4176e6;
    --dsw-alias-button-ghost-active-fill: #2a3140;
    --dsw-alias-button-ghost-active-hover: #343d50;
  }
  body { background: var(--dsw-alias-bg-layer-1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; margin: 0; }
  .demo-note { position: fixed; left: 18px; top: 16px; z-index: 3000; font-size: 12px; color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 6px 10px; }
  .demo-actions { position: fixed; left: 18px; top: 52px; z-index: 3000; display: flex; flex-direction: column; gap: 6px; }
  .demo-actions button { font: inherit; font-size: 12px; cursor: pointer; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 6px 12px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-3); text-align: left; }
  .demo-actions button[data-on="true"] { outline: 1px solid var(--dsw-static-deepseek-500); }
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ONE-WAY 用量监控 · 界面预览（示例数据）</title>
<style>${tokens}
${css}</style>
</head>
<body>
<div class="demo-note">界面预览 · 示例数据（非真实用量）</div>
<div class="demo-actions">
  <button id="demoModal" data-on="true">查看用量弹窗</button>
  <button id="demoLogin">查看登录面板（未登录态）</button>
  <button id="demoEmpty">查看空数据态（渠道/模型）</button>
  <button id="demoLight" data-on="true">亮色模式</button>
  <button id="demoDark">暗色模式</button>
</div>

<!-- ============ 悬浮窗卡片（右下角，真实位置） ============ -->
<div class="owm-fab" role="button" tabindex="0" aria-label="ONE-WAY 用量监控">
  <div class="owm-fabHead">
    <span class="owm-fabHeadTitle">ONE-WAY</span>
    <span class="owm-fabHeadDot" style="background: var(--dsw-alias-state-success-primary)"></span>
  </div>
  <div class="owm-fabLegend">
    <div class="owm-fabRow"><span class="owm-fabSwatch" style="background:#10b981"></span><span class="owm-fabRowLabel">近5小时</span><span class="owm-fabRowValue">76.70M</span></div>
    <div class="owm-fabRow"><span class="owm-fabSwatch" style="background:#3b82f6"></span><span class="owm-fabRowLabel">今日</span><span class="owm-fabRowValue">76.70M</span></div>
    <div class="owm-fabRow"><span class="owm-fabSwatch" style="background:#8b5cf6"></span><span class="owm-fabRowLabel">本周</span><span class="owm-fabRowValue">5.44亿</span></div>
  </div>
</div>

<!-- ============ 用量弹窗 ============ -->
<div class="owm-mask" id="demoMask">
  <section class="owm-modal" role="dialog" aria-modal="true" aria-label="ONE-WAY 用量监控">
    <header class="owm-modalHead">
      <div class="owm-modalTitle">
        <h2>ONE-WAY 用量监控</h2>
        <span class="owm-badge">郭增辉</span>
        <span class="owm-muted">更新于 14:32</span>
      </div>
      <div class="owm-actions">
        <button class="owm-secondary">刷新</button>
        <button class="owm-danger">退出登录</button>
        <button class="owm-close" aria-label="关闭">×</button>
      </div>
    </header>
    <div class="owm-modalBody" id="demoBody">

      <!-- 已登录态 -->
      <div id="demoAuthed">
        <div class="owm-summary">
          <div class="owm-ringsCard">
            <div class="owm-ringsHead"><span class="owm-ringsTitle">Token 用量</span><span class="owm-badge">近5小时 · 今日 · 本周</span></div>
            <div class="owm-ringsLegend">
              <div class="owm-ringRow"><span class="owm-fabSwatch" style="background:#10b981"></span><span class="owm-ringRowLabel">近5小时</span><span class="owm-ringRowValue">76.70M</span><div class="owm-ringRowBar"><span data-color="h5" style="width:14.1%"></span></div><span class="owm-ringRowPct">14.1%</span></div>
              <div class="owm-ringRow"><span class="owm-fabSwatch" style="background:#3b82f6"></span><span class="owm-ringRowLabel">今日</span><span class="owm-ringRowValue">76.70M</span><div class="owm-ringRowBar"><span data-color="today" style="width:14.1%"></span></div><span class="owm-ringRowPct">14.1%</span></div>
              <div class="owm-ringRow"><span class="owm-fabSwatch" style="background:#8b5cf6"></span><span class="owm-ringRowLabel">本周</span><span class="owm-ringRowValue">5.44亿</span><div class="owm-ringRowBar"><span data-color="week" style="width:100%"></span></div><span class="owm-ringRowPct">100%</span></div>
            </div>
          </div>
          <div class="owm-kpis">
            <div class="owm-kpi"><div class="owm-kpiTitle">Token 用量</div><div class="owm-kpiGrid">
              <div class="owm-kpiCell"><span class="owm-kpiLabel">近5小时</span><span class="owm-kpiValue">76.70M</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">今日</span><span class="owm-kpiValue">76.70M</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本周</span><span class="owm-kpiValue">5.44亿</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本月</span><span class="owm-kpiValue">20.51亿</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本年</span><span class="owm-kpiValue">49.68亿</span></div>
            </div></div>
            <div class="owm-kpi"><div class="owm-kpiTitle">请求次数</div><div class="owm-kpiGrid">
              <div class="owm-kpiCell"><span class="owm-kpiLabel">近5小时</span><span class="owm-kpiValue">379</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">今日</span><span class="owm-kpiValue">379</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本周</span><span class="owm-kpiValue">3,411</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本月</span><span class="owm-kpiValue">16,255</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本年</span><span class="owm-kpiValue">43,278</span></div>
            </div></div>
            <div class="owm-kpi"><div class="owm-kpiTitle">使用时长</div><div class="owm-kpiGrid">
              <div class="owm-kpiCell"><span class="owm-kpiLabel">近5小时</span><span class="owm-kpiValue">53.8分钟</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">今日</span><span class="owm-kpiValue">53.8分钟</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本周</span><span class="owm-kpiValue">10.8小时</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本月</span><span class="owm-kpiValue">72.9小时</span></div>
              <div class="owm-kpiCell"><span class="owm-kpiLabel">本年</span><span class="owm-kpiValue">195.3小时</span></div>
            </div></div>
          </div>
        </div>
        <div class="owm-apiKeyRow"><span>API Key</span><code>ah-c0c12294d19e0da0bab39295eef232b669e939de4eb2e9959c5792a0af5d1bd2</code><button class="owm-secondary">复制</button></div>
        <nav class="owm-tabs" role="tablist">
          <button class="owm-tab" data-tab="logs" data-active="true" role="tab" aria-selected="true">请求日志</button>
          <button class="owm-tab" data-tab="trend" role="tab" aria-selected="false">用量趋势</button>
          <button class="owm-tab" data-tab="channels" role="tab" aria-selected="false">渠道用量 / 限额</button>
          <button class="owm-tab" data-tab="models" role="tab" aria-selected="false">渠道与模型</button>
        </nav>

        <!-- 请求日志 -->
        <div data-panel="logs">
          <div class="owm-toolbar">
            <input class="owm-input" type="date" value="2026-08-15"><span class="owm-muted">至</span><input class="owm-input" type="date" value="2026-08-21">
            <select class="owm-input"><option>10 条/页</option><option>20 条/页</option><option>50 条/页</option></select>
            <button class="owm-primary">查询</button>
            <span class="owm-muted" style="margin-left:auto">默认近 7 天</span>
          </div>
          <div class="owm-tableWrap"><table class="owm-logsTable">
            <thead><tr><th>时间</th><th>模型</th><th>所属 Key</th><th>渠道</th><th>状态</th><th>流式</th><th class="owm-num">延迟</th><th class="owm-num">Token</th></tr></thead>
            <tbody>
              <tr><td class="owm-muted">2026/08/21 11:47:37</td><td style="font-weight:600">deepseek-v4-flash</td><td>郭增辉</td><td>deepseek</td><td><span class="owm-status owm-status-ok">completed</span></td><td>是</td><td class="owm-num">9.42s</td><td class="owm-num">103.1K</td></tr>
              <tr><td class="owm-muted">2026/08/21 11:47:34</td><td style="font-weight:600">gpt-5.4</td><td>郭增辉</td><td>gpt-onecore</td><td><span class="owm-status owm-status-err">failed</span></td><td>否</td><td class="owm-num">1.69s</td><td class="owm-num">92.0K</td></tr>
              <tr><td class="owm-muted">2026/08/21 11:47:30</td><td style="font-weight:600">glm-4.7</td><td>郭增辉</td><td>智谱</td><td><span class="owm-status owm-status-warn">pending</span></td><td>是</td><td class="owm-num">2.75s</td><td class="owm-num">45.6K</td></tr>
            </tbody>
          </table></div>
          <div class="owm-pager"><button class="owm-secondary">« 上一页</button><span class="owm-pagerInfo">第 1 / 39 页 · 共 385 条</span><button class="owm-secondary">下一页 »</button></div>
        </div>

        <!-- 用量趋势 -->
        <div data-panel="trend" hidden>
          <div class="owm-trend">
            <div class="owm-trendBlock"><h3>最近 24 小时每小时用量</h3><div class="owm-barList">
              <div class="owm-barRow"><span class="owm-barTime">2026-08-21 11:00</span><span class="owm-barReqs">254 次</span><span class="owm-barTokens">35.72M</span><div class="owm-barTrack"><span style="width:100%"></span></div></div>
              <div class="owm-barRow"><span class="owm-barTime">2026-08-21 10:00</span><span class="owm-barReqs">46 次</span><span class="owm-barTokens">16.55M</span><div class="owm-barTrack"><span style="width:46%"></span></div></div>
              <div class="owm-barRow"><span class="owm-barTime">2026-08-20 14:00</span><span class="owm-barReqs">230 次</span><span class="owm-barTokens">74.26M</span><div class="owm-barTrack"><span style="width:100%"></span></div></div>
            </div></div>
            <div class="owm-trendBlock"><h3>最近 30 天每日用量</h3><div class="owm-barList">
              <div class="owm-barRow"><span class="owm-barTime">2026-08-21</span><span class="owm-barReqs">379 次</span><span class="owm-barTokens">76.70M</span><div class="owm-barTrack"><span style="width:28%"></span></div></div>
              <div class="owm-barRow"><span class="owm-barTime">2026-08-20</span><span class="owm-barReqs">1,075 次</span><span class="owm-barTokens">255.27M</span><div class="owm-barTrack"><span style="width:95%"></span></div></div>
              <div class="owm-barRow"><span class="owm-barTime">2026-08-19</span><span class="owm-barReqs">1,179 次</span><span class="owm-barTokens">118.83M</span><div class="owm-barTrack"><span style="width:44%"></span></div></div>
            </div></div>
          </div>
        </div>

        <!-- 渠道用量 / 限额 -->
        <div data-panel="channels" hidden>
          <div class="owm-tableWrap"><table class="owm-logsTable">
            <thead><tr><th>渠道</th><th class="owm-num">近 5 小时</th><th>5h 限额</th><th class="owm-num">今日</th><th class="owm-num">本周</th><th>周限额</th><th class="owm-num">本月</th><th class="owm-num">本年</th></tr></thead>
            <tbody>
              <tr><td style="font-weight:600">gpt-onecore</td><td class="owm-num">12.52M</td><td><div class="owm-limitCell"><span class="owm-num">12.52M</span><div class="owm-bar"><span style="width:25%"></span></div><span class="owm-muted">/50.00M</span></div></td><td class="owm-num">12.52M</td><td class="owm-num">201.55M</td><td><span class="owm-muted">不限</span></td><td class="owm-num">1462.95M</td><td class="owm-num">2965.15M</td></tr>
              <tr><td style="font-weight:600">deepseek</td><td class="owm-num">64.18M</td><td><span class="owm-muted">不限</span></td><td class="owm-num">64.18M</td><td class="owm-num">304.71M</td><td><div class="owm-limitCell"><span class="owm-num">304.71M</span><div class="owm-bar" data-warn="true"><span style="width:87%"></span></div><span class="owm-muted">/350.00M</span></div></td><td class="owm-num">485.11M</td><td class="owm-num">626.91M</td></tr>
              <tr><td style="font-weight:600">智谱</td><td class="owm-num">0.00M</td><td><span class="owm-muted">不限</span></td><td class="owm-num">0.00M</td><td class="owm-num">37.53M</td><td><span class="owm-muted">不限</span></td><td class="owm-num">59.64M</td><td class="owm-num">59.64M</td></tr>
            </tbody>
          </table></div>
        </div>

        <!-- 渠道与模型 -->
        <div data-panel="models" hidden>
          <div class="owm-modelGrid">
            <div class="owm-card"><div class="owm-row"><span style="font-weight:600;font-size:13px">deepseek</span><span class="owm-badge">1 个模型</span></div><div style="margin-top:8px"><span class="owm-chip">deepseek-v4-flash</span></div></div>
            <div class="owm-card"><div class="owm-row"><span style="font-weight:600;font-size:13px">gpt-onecore</span><span class="owm-badge">3 个模型</span></div><div style="margin-top:8px"><span class="owm-chip">gpt-5.4</span><span class="owm-chip">gpt-5.5</span><span class="owm-chip">gpt-image-1.5</span></div></div>
            <div class="owm-card"><div class="owm-row"><span style="font-weight:600;font-size:13px">智谱</span><span class="owm-badge">2 个模型</span></div><div style="margin-top:8px"><span class="owm-chip">glm-4.7</span><span class="owm-chip">glm-5.2</span></div></div>
          </div>
        </div>
      </div>

      <!-- 登录面板（未登录态） -->
      <div id="demoLoginPanel" hidden>
        <div class="owm-login">
          <h3>登录 ONE-WAY 中台</h3>
          <p class="owm-loginDesc">使用企业微信扫码，授权后插件即可读取 Token 用量。会话 Cookie 只保存在本机 DSH 设置中。</p>
          <div class="owm-qrBox"><img src="https://login.work.weixin.qq.com/wwlogin/sso/qrcode?key=preview" alt="企业微信登录二维码（示例）"></div>
          <div class="owm-loginStatus">请使用企业微信扫码登录</div>
          <p class="owm-loginHint">打开企业微信「扫一扫」，扫描左侧二维码</p>
          <div class="owm-actions"><button class="owm-secondary">刷新二维码</button><button class="owm-secondary">取消</button></div>
        </div>
      </div>

      <!-- 空数据态 -->
      <div id="demoEmptyPanel" hidden>
        <div class="owm-summary">
          <div class="owm-ringsCard">
            <div class="owm-ringsHead"><span class="owm-ringsTitle">Token 用量</span><span class="owm-badge">近5小时 · 今日 · 本周</span></div>
            <div class="owm-ringsLegend">
              <div class="owm-ringRow"><span class="owm-fabSwatch" style="background:#10b981"></span><span class="owm-ringRowLabel">近5小时</span><span class="owm-ringRowValue">—</span><div class="owm-ringRowBar"><span data-color="h5" style="width:0%"></span></div><span class="owm-ringRowPct">—</span></div>
              <div class="owm-ringRow"><span class="owm-fabSwatch" style="background:#3b82f6"></span><span class="owm-ringRowLabel">今日</span><span class="owm-ringRowValue">—</span><div class="owm-ringRowBar"><span data-color="today" style="width:0%"></span></div><span class="owm-ringRowPct">—</span></div>
              <div class="owm-ringRow"><span class="owm-fabSwatch" style="background:#8b5cf6"></span><span class="owm-ringRowLabel">本周</span><span class="owm-ringRowValue">—</span><div class="owm-ringRowBar"><span data-color="week" style="width:0%"></span></div><span class="owm-ringRowPct">—</span></div>
            </div>
          </div>
          <div class="owm-kpis">
            <div class="owm-kpi"><div class="owm-kpiTitle">Token 用量</div><div class="owm-kpiGrid"><div class="owm-kpiCell"><span class="owm-kpiLabel">近5小时</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">今日</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本周</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本月</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本年</span><span class="owm-kpiValue">—</span></div></div></div>
            <div class="owm-kpi"><div class="owm-kpiTitle">请求次数</div><div class="owm-kpiGrid"><div class="owm-kpiCell"><span class="owm-kpiLabel">近5小时</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">今日</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本周</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本月</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本年</span><span class="owm-kpiValue">—</span></div></div></div>
            <div class="owm-kpi"><div class="owm-kpiTitle">使用时长</div><div class="owm-kpiGrid"><div class="owm-kpiCell"><span class="owm-kpiLabel">近5小时</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">今日</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本周</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本月</span><span class="owm-kpiValue">—</span></div><div class="owm-kpiCell"><span class="owm-kpiLabel">本年</span><span class="owm-kpiValue">—</span></div></div></div>
          </div>
        </div>
        <p class="owm-empty" style="grid-column:1/-1">暂无渠道与模型数据。</p>
      </div>

    </div>
  </section>
</div>

<script>
  const tabs = [...document.querySelectorAll('.owm-tab')];
  const panels = (name) => [...document.querySelectorAll('[data-panel]')].find((p) => p.dataset.panel === name);
  const setTab = (key) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === key;
      tab.dataset.active = on;
      tab.setAttribute('aria-selected', on);
    });
    Object.keys({ logs: 1, trend: 1, channels: 1, models: 1 }).forEach((name) => {
      panels(name).hidden = name !== key;
    });
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));

  const authed = document.getElementById('demoAuthed');
  const loginPanel = document.getElementById('demoLoginPanel');
  const emptyPanel = document.getElementById('demoEmptyPanel');
  const mask = document.getElementById('demoMask');
  const show = (which) => {
    authed.hidden = which !== 'authed';
    loginPanel.hidden = which !== 'login';
    emptyPanel.hidden = which !== 'empty';
  };
  document.getElementById('demoModal').addEventListener('click', () => { show('authed'); mask.style.display = 'flex'; });
  document.getElementById('demoLogin').addEventListener('click', () => { show('login'); mask.style.display = 'flex'; });
  document.getElementById('demoEmpty').addEventListener('click', () => { show('empty'); mask.style.display = 'flex'; });
  mask.addEventListener('mousedown', (event) => { if (event.target === mask) mask.style.display = 'none'; });
  document.querySelector('.owm-fab').addEventListener('click', () => { show('authed'); mask.style.display = 'flex'; });
  document.querySelector('.owm-close').addEventListener('click', () => { mask.style.display = 'none'; });

  // theme toggle
  const setTheme = (theme) => {
    document.body.dataset.theme = theme;
    document.body.dataset.dsDarkTheme = theme === 'dark';
    document.getElementById('demoLight').dataset.on = theme === 'light';
    document.getElementById('demoDark').dataset.on = theme === 'dark';
  };
  document.getElementById('demoLight').addEventListener('click', () => setTheme('light'));
  document.getElementById('demoDark').addEventListener('click', () => setTheme('dark'));
  setTheme('light');
</script>
</body>
</html>
`;

mkdirSync(dirname(resolve(root, 'examples', 'preview.html')), { recursive: true });
writeFileSync(resolve(root, 'examples', 'preview.html'), html);
console.log('Wrote examples/preview.html (' + html.length + ' bytes).');
