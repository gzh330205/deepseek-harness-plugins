/**
 * dsh-sidebar-width — 宿主半。
 *
 * 只做一件事：声明这份「侧栏宽度」配置 schema（两个 volatile 字段）。
 *
 * 为什么放宿主配置而不是 localStorage：
 *   - DSH 原生**完全没持久化左栏宽度**（ui-layout 的 layout store 里 sidebar 初值 280，
 *     文件里 localStorage 出现 0 次），刷新即重置；
 *   - 右栏宽度原生按**会话**存（`dsh.sidebar-right.v1.<sessionId>`），换会话/换页就变；
 *   - 存进 Loader 条目的 volatile Config，数据落在 profile 的 cordis.patch.yml 里，
 *     因此是**全局唯一一份**，跨会话、跨标签、重启都保持。
 *
 * 字段必须 volatile：非 volatile 的写入会让 Loader 把整个插件卸载重挂。
 *
 * 两个宽度都通过**布局 store 的 actions** 写入：浏览器半区从
 * `ctx.slots.entries('root')[0].store.create()` 拿到活实例，调
 * `actions.setSidebar()/setRightbar()`。这是唯一能让「面板宽度 / 三列轨道 / 引擎内部
 * 布局」三者始终一致的写法——早期版本直接改 DOM 的 `grid-template-columns`，因为右侧
 * 面板宽度由引擎自己算（不由轨道决定），轨道比面板窄时面板会溢出盖住中间栏。
 *
 * 不要写 `export default apply`（DSH 的 unwrapExports 会丢掉具名 Config / inject）。
 */
import z from '@deepseek-ai/schemastery';

/** 必须等于 cordis.patch.yml 的行 id，也是浏览器半的 configForms 命名空间。 */
export const SETTINGS_NAMESPACE = 'sidebar-width';

/** 与 DSH 原生的 clamp 保持一致（见 ui-layout 的 computeColumns / setSidebar）。 */
export const SIDEBAR_WIDTH_RANGE = { min: 264, max: 420 };
/** 右侧栏原生最小值；上限是视口的 70%，由原生按视口算。 */
export const RIGHTBAR_WIDTH_RANGE = { min: 300 };

export const Config = z.object({
  /** 总开关；关掉后不再应用也不再记录。 */
  enabled: z.boolean().default(true).volatile(),
  /** 左侧栏宽度（px）。0 = 没设置过（用原生默认），由浏览器半写入。 */
  sidebarWidth: z.number().min(0).max(2000).default(0).volatile(),
  /** 右侧栏宽度（px）。0 = 没设置过。面板未打开时也会记住，下次展开即用该宽度。 */
  rightbarWidth: z.number().min(0).max(4000).default(0).volatile(),
});

export const inject = [];

export function apply() {
  // 宿主侧不需要做任何事：配置由 Loader 解析、由浏览器半通过 configForms 读写。
  // 这里保留空实现，让 Loader 有一行可挂（浏览器半区挂在 name == 包名的那一行）。
}
