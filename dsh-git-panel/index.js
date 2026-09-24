/**
 * dsh-git-panel — 宿主半。
 *
 * 在 DSH 的右侧栏提供 Git 面板：待提交的变更（含差异）、提交历史（含提交图）、
 * 工作树（worktree）管理。宿主侧只做三件事：
 *   1. 定位并驱动本机 `git`（argv 数组、不走 shell、不做任何联网操作）；
 *   2. 把 git 输出解析成结构化的 JSON；
 *   3. 通过 `ctx.webServer` 暴露 `/dsh-git/*`，写操作带同源门禁。
 *
 * 结构：
 *   src/host/git.js       进程运行器（上限/超时/PATH 兜底）
 *   src/host/repo.js      仓库探测（根、分支、进行中的操作）
 *   src/host/status.js    工作区状态快照
 *   src/host/diff.js      差异生成与结构化
 *   src/host/history.js   提交列表 / 提交详情 / 分支
 *   src/host/worktree.js  worktree 列表 / 创建 / 删除 / 清理
 *   src/host/actions.js   暂存 / 取消暂存 / 放弃 / 提交 / 切换分支
 *   src/host/parse.js     纯解析器（可单测）
 *   src/host/routes.js    HTTP 接口
 *
 * 两条必守约束：
 *   - 所有 config 字段标 `.volatile()`：非 volatile 的写入会让 Loader 整插件重挂；
 *   - 不要写 `export default apply`：`unwrapExports()` 遇到 default 会丢掉整个模块
 *     命名空间，同级的具名 `Config` / `inject` 一起失效。
 */
import z from '@deepseek-ai/schemastery';
import { installRoutes } from './src/host/routes.js';

/** 必须等于 cordis.patch.yml 的行 id，也是浏览器半的插件身份。 */
export const SETTINGS_NAMESPACE = 'git-panel';

/** 默认 diff 上下文行数。 */
const DEFAULT_CONTEXT_LINES = 3;

export const Config = z.object({
  /** 留空按 PATH 与常见安装位置自动探测。 */
  gitPath: z.string().default('').volatile(),
  /** 留空用 `<仓库父目录>/.dsh-worktrees/<仓库名>/`。 */
  worktreeRoot: z.string().default('').volatile(),
  /** 新建 worktree 选择「新建分支」形态时的分支前缀（自动补 `/`）。 */
  worktreeBranchPrefix: z.string().default('dsh').volatile(),
  /** diff 上下文行数（0~50）。 */
  diffContext: z.number().default(DEFAULT_CONTEXT_LINES).volatile(),
});

/** 依赖 webServer 才能暴露接口；headless profile 没有它时插件安静地不做事。 */
export const inject = [];

export function apply(ctx, config) {
  ctx.inject(['webServer'], (webCtx) => {
    try {
      installRoutes(webCtx, { config });
      webCtx.logger?.info?.('git-panel: Git 面板接口已挂载在 /dsh-git');
    } catch (error) {
      webCtx.logger?.warn?.(`git-panel: 挂载接口失败：${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ctx.logger?.info?.(`git-panel: 宿主已就绪（${process.platform}）`);
}
