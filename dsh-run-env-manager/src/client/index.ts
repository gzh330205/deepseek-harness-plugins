import React from 'react';
import { createElement as h } from 'react';
import cssText from './styles.css';
import { NS, TAB_ID, TAB_KIND } from './constants.js';
import { createApi } from './api.js';
import { createAgent } from './agent.js';
import { RunPanel } from './components/RunPanel.jsx';
import { EnvironmentSection } from './components/EnvironmentSection.jsx';
import { IconRunOutline } from './components/icons.jsx';

// 与 dsh 自己编译产物的约定一致：一个 <style data-plugin-css> 标签，重复挂载不重复注入。
if (typeof document !== 'undefined') {
  const tagId = 'dsh-run-env-manager/styles.css';
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
    const tag = document.createElement('style');
    tag.dataset.plugin = 'dsh-run-env-manager';
    tag.dataset.pluginCss = tagId;
    tag.textContent = cssText;
    document.head.appendChild(tag);
  }
}

const zh = {
  title: '运行',
  guideTitle: '运行配置',
  guideDescription: '配置并一键启动项目的运行环境',
  tabRun: '运行',
  tabConfig: '配置',
  status: '状态',
  start: '启动',
  stop: '停止',
  logs: '日志',
  refresh: '刷新',
  close: '关闭',
  edit: '编辑',
  remove: '删除',
  save: '保存',
  saving: '保存中…',
  cancel: '取消',
  browse: '浏览…',
  optional: '可选',
  expand: '展开',
  collapse: '收起',
  loading: '正在读取运行环境配置…',
  workspace: '工作区',
  cwd: '工作目录',
  command: '启动命令',
  commandPlaceholder: '例如 pnpm dev',
  emptyConfigurations: '该工作区还没有运行配置。可以在「配置」里添加，或用 AI 识别项目自动生成。',
  goToConfig: '前往配置',
  configurations: '运行配置',
  addConfiguration: '+ 添加运行配置',
  editJson: '编辑 JSON',
  editJsonHint: '这里是该工作区运行配置的完整内容，保存时整体替换（格式错误会直接报错，不会写入）。',
  jsonInvalid: 'JSON 解析失败：',
  jsonSaved: 'JSON 已保存。',
  configSaved: '运行配置已保存。',
  configId: '标识符',
  configName: '名称',
  configNamePlaceholder: '例如 前端',
  configType: '运行类型',
  typeCommand: '命令',
  typeTomcat: 'Tomcat',
  tomcatWebapp: 'Web 应用目录',
  tomcatWebappPlaceholder: '相对项目根，例如 WebRoot',
  tomcatContextPath: '上下文路径',
  tomcatPort: 'HTTP 端口',
  tomcatShutdownPort: '关闭端口',
  tomcatJvmArgs: 'JVM 参数',
  tomcatBuildCommand: '构建命令（可选）',
  tomcatHint: 'Tomcat 会为每个配置生成独立的 CATALINA_BASE（不污染安装目录），并把端口绑在 127.0.0.1；关闭端口带随机 token，只有本插件能正常停它。配置了构建命令时，构建失败不会启动服务。',
  readyWhen: '就绪检测地址',
  browserUrl: '浏览器地址',
  envVars: '环境变量（每行 KEY=VALUE）',
  removeConfigurationConfirm: '确定删除运行配置「{name}」吗？',
  projectBindings: '项目开发环境',
  projectBindingsHint: '未选择时跟随全局默认；单个服务可在运行配置里再覆盖。',
  followDefault: '跟随全局默认',
  noEnvironmentHint: '还没有可用的开发环境，请在下方「全局开发环境」里从 PATH 检测或手动添加。',
  globalEnvironments: '全局开发环境',
  settingsIntro: '开发环境只保存路径与版本；运行配置按工作区存放，两者都保存在当前 profile 下，不同 profile 相互独立。',
  libraryDetect: '从 PATH 检测环境',
  detecting: '正在检测…',
  libraryAdd: '+ 添加开发环境',
  librarySaved: '环境已保存。',
  libraryDetected: '已检测并合并 {count} 个环境。',
  libraryEmptyKind: '尚未配置',
  libraryRemoveConfirm: '确定删除开发环境「{name}」吗？引用它的项目需要重新选择。',
  isDefault: '全局默认',
  setDefault: '设为默认',
  validateAndSave: '验证并保存',
  validating: '正在验证…',
  envKind: '种类',
  envName: '名称',
  envNamePlaceholder: '例如 JDK 8',
  envPath: '环境路径',
  envPathPlaceholder: '安装目录或可执行文件；Windows 下 .cmd 也可',
  needCwd: '还没有确定工作区目录，请先打开一个会话或等待工作区就绪。',
  aiConfigure: 'AI 配置',
  aiTroubleshoot: 'AI 故障排查',
  aiPreparing: '正在创建会话…',
  aiSessionHint: '已新建一个绑定本项目的工作区会话，提示词已发送；生成结果会写回本面板。',
};

const en = {
  title: 'Run',
  guideTitle: 'Run configuration',
  guideDescription: 'Configure and start the project runtime in one click',
  tabRun: 'Run',
  tabConfig: 'Configure',
  status: 'Status',
  start: 'Start',
  stop: 'Stop',
  logs: 'Logs',
  refresh: 'Refresh',
  close: 'Close',
  edit: 'Edit',
  remove: 'Remove',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  browse: 'Browse…',
  optional: 'optional',
  expand: 'Expand',
  collapse: 'Collapse',
  loading: 'Loading run environment settings…',
  workspace: 'Workspace',
  cwd: 'Working directory',
  command: 'Command',
  commandPlaceholder: 'e.g. pnpm dev',
  emptyConfigurations: 'No run configuration in this workspace yet. Add one under “Configure”, or let the AI read the project.',
  goToConfig: 'Go to Configure',
  configurations: 'Run configurations',
  addConfiguration: '+ Add run configuration',
  editJson: 'Edit JSON',
  editJsonHint: 'The complete run configuration of this workspace; saving replaces it as a whole (invalid JSON is rejected).',
  jsonInvalid: 'JSON parse failed: ',
  jsonSaved: 'JSON saved.',
  configSaved: 'Run configuration saved.',
  configId: 'Identifier',
  configName: 'Name',
  configNamePlaceholder: 'e.g. Frontend',
  configType: 'Run type',
  typeCommand: 'Command',
  typeTomcat: 'Tomcat',
  tomcatWebapp: 'Web application directory',
  tomcatWebappPlaceholder: 'Relative to the project root, e.g. WebRoot',
  tomcatContextPath: 'Context path',
  tomcatPort: 'HTTP port',
  tomcatShutdownPort: 'Shutdown port',
  tomcatJvmArgs: 'JVM arguments',
  tomcatBuildCommand: 'Build command (optional)',
  tomcatHint: 'Tomcat gets its own CATALINA_BASE per configuration (the installation directory is untouched) and binds to 127.0.0.1; the shutdown port carries a random token so only this plugin can stop it. With a build command configured, a failed build never starts the service.',
  readyWhen: 'Readiness URL',
  browserUrl: 'Browser URL',
  envVars: 'Environment variables (KEY=VALUE per line)',
  removeConfigurationConfirm: 'Remove run configuration “{name}”?',
  projectBindings: 'Project development environment',
  projectBindingsHint: 'Unset follows the global default; a single service can override it again.',
  followDefault: 'Follow global default',
  noEnvironmentHint: 'No development environment yet — detect from PATH or add one under “Global development environments”.',
  globalEnvironments: 'Global development environments',
  settingsIntro: 'Environments store only a path and version; run configurations are per workspace. Both live under the current profile, so profiles stay independent.',
  libraryDetect: 'Detect from PATH',
  detecting: 'Detecting…',
  libraryAdd: '+ Add environment',
  librarySaved: 'Environment saved.',
  libraryDetected: 'Detected and merged {count} environments.',
  libraryEmptyKind: 'Not configured',
  libraryRemoveConfirm: 'Remove environment “{name}”? Projects referencing it must pick another.',
  isDefault: 'global default',
  setDefault: 'Set default',
  validateAndSave: 'Validate and save',
  validating: 'Validating…',
  envKind: 'Kind',
  envName: 'Name',
  envNamePlaceholder: 'e.g. JDK 8',
  envPath: 'Environment path',
  envPathPlaceholder: 'Installation directory or executable; .cmd works too on Windows',
  needCwd: 'No workspace directory yet — open a session or wait for the workspace.',
  aiConfigure: 'AI configure',
  aiTroubleshoot: 'AI troubleshoot',
  aiPreparing: 'Creating session…',
  aiSessionHint: 'A workspace session was created and the prompt was sent; results are written back into this panel.',
};

const inject = ['slots', 'locale', 'sidebarRightTabs'];

function apply(ctx: any) {
  // 客户端插件外抛会让整页 boot 失败（web boot: N entry did not activate），
  // 所以这里一律降级为警告。
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'run-env-manager: dictionaries');
    const t = ctx.locale.bind(NS);
    const api = createApi();
    const agent = createAgent(ctx);
    // uiWorkspace 必须惰性取：模块启动顺序无保证，插件热重载还会移除重加。
    const pickDirectory = async (): Promise<string | null> => {
      const uiWorkspace = ctx.get?.('uiWorkspace');
      if (uiWorkspace?.pickDirectory === undefined) return null;
      try {
        return await uiWorkspace.pickDirectory();
      } catch {
        return null;
      }
    };

    ctx.effect(
      () =>
        ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          // 单实例页面：每个会话一块运行面板，不需要多个副本。
          keepMounted: true,
          title: () => t('title'),
          // 「开始」页上的入口卡片；内置 guide 会渲染它并在点击时 openTab(kind)。
          guide: [
            {
              id: 'open',
              order: 30,
              title: () => t('guideTitle'),
              description: () => t('guideDescription'),
              icon: IconRunOutline,
            },
          ],
        }),
      'run-env-manager: tab type',
    );

    // slots.register 必须包在 slots.inject 里：apply 顺序无保证。
    ctx.effect(
      () =>
        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register(
            { name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS, inject: () => ({ api, agent, t, pickDirectory }) },
            RunPanel,
          ),
        ),
      'run-env-manager: panel body',
    );

    // 同一套环境库管理也挂在设置里（设置页没有会话上下文，组件自己拉不带工作区的快照）。
    ctx.slots.inject('settings.section', () =>
      ctx.slots.register(
        { name: 'settings.section', id: 'run-environments', order: 17, label: () => t('globalEnvironments'), locale: NS, inject: () => ({ api, t, pickDirectory }) },
        EnvironmentSection,
      ),
    );
  } catch (error) {
    console.warn('[run-env-manager] client apply failed', error);
  }
}

export { apply, inject };
