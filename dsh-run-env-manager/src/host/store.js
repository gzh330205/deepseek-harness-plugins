/**
 * 配置存储：环境库、全局默认绑定、各工作区的运行配置。
 *
 * 全部落在插件 Loader 条目的 volatile `Config`（→ `$DSH_HOME/profiles/<profile>/cordis.patch.yml`），
 * 因此不同 profile 天然独立。宿主是**唯一写入方**：浏览器半只读快照、改动一律走 HTTP 动作，
 * 避免两个写入方（configForms 与 configEditor）互相覆盖。
 *
 * volatile 是硬要求：非 volatile 字段的写入会让 Loader 整插件重挂，等于每次改配置都把
 * 跑着的服务全掀一次。
 */
import { emptyBindings, normalizeRoot } from './contract.js';

export function createStore(ctx, config) {
  // 在 apply 时捕获自己的 loader 条目：后面从子上下文取未必还是它。
  const entry = ctx.fiber?.entry;

  const read = () => ({
    environments: config.environments.get() ?? [],
    defaults: { ...emptyBindings(), ...(config.defaults.get() ?? {}) },
    workspaces: config.workspaces.get() ?? [],
  });

  const list = () => read();

  const findWorkspace = (root) => {
    const key = normalizeRoot(root);
    return read().workspaces.find((workspace) => normalizeRoot(workspace.root) === key);
  };

  const patch = async (next) => {
    const editor = ctx.get('configEditor');
    if (entry === undefined || editor === undefined) {
      throw new Error('当前部署不支持写入运行环境配置（缺少 configEditor）。');
    }
    await editor.edit(entry, (current) => ({ ...current, ...next }));
  };

  return {
    list,
    findWorkspace,
    /** 写入一个工作区条目（新增或整体替换），并回读最新快照。 */
    async saveWorkspace(root, workspace) {
      const current = read();
      const key = normalizeRoot(root);
      const rest = current.workspaces.filter((item) => normalizeRoot(item.root) !== key);
      await patch({
        workspaces: [...rest, { ...workspace, root, updatedAt: new Date().toISOString() }],
      });
      return list();
    },
    async patchWorkspace(root, changes) {
      const workspace = findWorkspace(root) ?? { root, bindings: emptyBindings(), configurations: [] };
      return this.saveWorkspace(root, { ...workspace, ...changes });
    },
    /** 环境库与全局默认绑定：各自整体替换（体积小，避免逐条增删的竞态）。 */
    saveEnvironments(environments) {
      return patch({ environments });
    },
    saveDefaults(defaults) {
      return patch({ defaults });
    },
  };
}
