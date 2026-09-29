/**
 * 「插件合集 → Git 面板」设置页。
 *
 * 表单读写的是本插件 Loader 条目的 volatile Config（命名空间 = 行 id
 * `git-panel`），所以改完立刻生效、不需要重启 host。git-panel 从来没有自己的
 * 设置入口，这一页就是它唯一的设置面。
 */
import React from 'react';
import { h } from './h';

/** 与 host 半 src/host 一致的字段语义，仅用于表单展示。 */
const FIELDS = [
  { key: 'gitPath', label: 'git 可执行文件', kind: 'text', placeholder: '留空按 PATH 与常见安装位置自动探测' },
  { key: 'worktreeRoot', label: 'worktree 根目录', kind: 'text', placeholder: '留空用 <仓库父目录>/.dsh-worktrees/<仓库名>/' },
  { key: 'worktreeBranchPrefix', label: '新分支前缀', kind: 'text', placeholder: 'dsh' },
  { key: 'diffContext', label: 'diff 上下文行数', kind: 'number', min: 0, max: 50 },
];

const DEFAULTS = { gitPath: '', worktreeRoot: '', worktreeBranchPrefix: 'dsh', diffContext: 3 };

function useScope(scope: any): any {
  return (React as any).useSyncExternalStore(
    (listener: () => void) => scope.subscribe(listener),
    () => scope.getSnapshot(),
    () => scope.getSnapshot(),
  );
}

export function GitPanelSettings({ scope }: { scope: any }) {
  const snapshot = useScope(scope);
  const config = { ...DEFAULTS, ...((snapshot?.value ?? {}) as Record<string, unknown>) };
  const [draft, setDraft] = React.useState<Record<string, unknown> | null>(null);
  const [failure, setFailure] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const value = draft ?? config;

  const patch = (key: string, next: unknown): void => setDraft((old) => ({ ...(old ?? config), [key]: next }));

  const save = async (): Promise<void> => {
    setFailure('');
    setBusy(true);
    try {
      for (const field of FIELDS) {
        if (draft !== null && draft[field.key] === undefined) continue;
        if (value[field.key] === config[field.key]) continue;
        await scope.set(field.key, value[field.key]);
      }
      setDraft(null);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (snapshot?.status === 'loading') return h('p', { className: 'dgp-settingsMuted' }, '正在读取设置…');
  if (snapshot?.status !== 'ready') {
    return h('p', { className: 'dgp-settingsError' }, '此部署未提供可编辑的 Git 面板设置。');
  }

  return h(
    'div',
    { className: 'dgp-settings' },
    h('h2', { className: 'dgp-settingsTitle' }, 'Git 面板'),
    h(
      'p',
      { className: 'dgp-settingsMuted' },
      '变更 / 历史 / 工作树都走本机 git 可执行文件；这里只调插件自己的行为，不改仓库本身。所有字段都是 volatile，保存后立即生效。',
    ),
    h(
      'div',
      { className: 'dgp-settingsForm' },
      ...FIELDS.map((field) =>
        h(
          'label',
          { key: field.key },
          field.label,
          h('input', {
            className: 'dgp-settingsInput',
            type: field.kind === 'number' ? 'number' : 'text',
            min: field.min,
            max: field.max,
            placeholder: field.placeholder,
            value: value[field.key] === undefined || value[field.key] === null ? '' : String(value[field.key]),
            onChange: (event: any) =>
              patch(field.key, field.kind === 'number' ? Number(event.target.value) || 0 : event.target.value),
          }),
        ),
      ),
    ),
    failure ? h('p', { className: 'dgp-settingsError' }, failure) : null,
    h(
      'div',
      { className: 'dgp-settingsActions' },
      h('button', { className: 'dgp-settingsPrimary', onClick: save, disabled: busy }, busy ? '保存中…' : '保存设置'),
      h(
        'button',
        { className: 'dgp-settingsSecondary', onClick: () => setDraft(null), disabled: busy || draft === null },
        '重置',
      ),
    ),
  );
}
