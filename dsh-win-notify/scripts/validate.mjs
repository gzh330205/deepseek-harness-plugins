/**
 * dsh-win-notify 自检脚本：不启动 dsh，直接验证
 *   1. Config schema 能通过并填充默认值；
 *   2. 生成的 PowerShell（-Command -，脚本经 stdin）能弹出 Toast。
 * 用法: node ./scripts/validate.mjs [--toast]
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Config } = require('../index.js');

const config = Config({});
console.log('[validate] schema 默认值:', JSON.stringify(config, null, 2));

if (!process.argv.includes('--toast')) {
  console.log('[validate] 跳过 Toast 弹窗（加 --toast 实测）');
  process.exit(0);
}
if (process.platform !== 'win32') {
  console.log('[validate] 非 Windows 平台，跳过 Toast');
  process.exit(0);
}

// 与 index.js 中的 TOAST_SCRIPT 保持同构，实测 stdin 传输路径。
const TOAST_SCRIPT = `$ErrorActionPreference = 'Stop'
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

const payload = {
  title: 'DSH 自检通知',
  message: '<b>&amp; 自检成功</b> — session <会话> 完成',
  sound: true,
  duration: 'short',
  appId: '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe',
};

const child = spawn(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-Command', '-'],
  {
    windowsHide: true,
    stdio: ['pipe', 'ignore', 'pipe'],
    env: { ...process.env, DSH_NOTIFY_PAYLOAD: JSON.stringify(payload) },
  },
);
let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});
child.stdin.end(TOAST_SCRIPT);
const code = await new Promise((resolve) => {
  child.on('error', (error) => {
    console.error('[validate] 启动失败:', error.message);
    resolve(1);
  });
  child.on('exit', resolve);
});
console.log('[validate] powershell 退出码:', code);
if (code !== 0) {
  console.error('[validate] stderr:', stderr);
  process.exit(1);
}
console.log('[validate] Toast 已弹出（请查看屏幕右下角）');

