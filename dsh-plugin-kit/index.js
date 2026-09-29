/**
 * dsh-plugin-kit — 插件合集（host 半区）。
 *
 * 这个包本身不提供任何服务：它是一条「安装入口 + 设置分区宿主」。
 *
 * - host 半区（本文件）：空实现，只为了让 Loader 能挂上 `dsh-plugin-kit`
 *   这一行（行 id 即设置命名空间）。没有自己的 Config 字段。
 * - client 半区（lib/client.js）：注册 Settings 里的「插件合集」分区，
 *   并提供一处 list 子槽 `settings.pluginKit.tab`，7 个子插件把各自的
 *   设置页注册进去，于是设置侧栏只多出一个入口。
 * - cordis.patch.yml：一个 insert，把合集自己和 7 个子插件的 Loader 行
 *   一次性写进 profile。子插件的行 id 必须与它们的 SETTINGS_NAMESPACE 一致。
 *
 * 约定（与仓库其它插件保持一致）：不要写 `export default`。
 */
import z from '@deepseek-ai/schemastery';

/** Host 半区没有配置字段：合集只是一个分区宿主。 */
export const Config = z.object({});

/** 不需要任何 host 服务。 */
export const inject = [];

/** 合集的 host 半区不做任何事；真正的逻辑都在浏览器半区。 */
export function apply() {}
