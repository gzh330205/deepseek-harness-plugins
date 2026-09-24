/** 插件身份与接口常量：三处 id 必须一致（见 host/index.js 与 cordis.patch.yml）。 */
export const NS = 'gitPanel';
/** Loader 条目 id = 宿主设置命名空间 = `cordis.patch.yml` 的行 id。 */
export const SETTINGS_NAMESPACE = 'git-panel';
/** tab 实现 id：正文/标题席位都以它注册。 */
export const TAB_ID = 'dsh-git-panel';
/** tab kind：引导卡片与 `openTab` 用它打开本面板。 */
export const TAB_KIND = 'git';
/** 宿主 HTTP 前缀。 */
export const ROUTE = '/dsh-git';
/** 有焦点时的轮询间隔：git status 很快，但没必要更频繁。 */
export const POLL_INTERVAL_MS = 5000;
/** 一次历史分页条数。 */
export const HISTORY_PAGE_SIZE = 40;
