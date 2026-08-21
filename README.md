# DeepSeek Harness Plugins

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) 的 Web Profile 插件集合，为 DSH Web 提供增强功能。

## 包含的插件

| 插件 | 版本 | 说明 |
|---|---|---|
| [`dsh-mcp-skill-manager`](./dsh-mcp-skill-manager) | 0.2.0 | 带 Web 设置页面的 MCP 与 Skills 统一管理器：管理 MCP 服务与 Skill 的新增、编辑、启停、删除，并支持从 Claude Code / Codex / OpenCode 一键导入 |
| [`dsh-workspace-category-manager`](./dsh-workspace-category-manager) | 0.1.0 | 为 DSH 工作区添加逻辑分类，侧边栏以「分类文件夹 → 项目 → 会话」三级层级展示，支持拖拽归类与排序 |

## 安装

每个插件均为独立的 DSH Profile Bundle。在**本仓库根目录**执行：

```bash
# 安装 MCP & Skill Manager
dsh plugin --profile web add ./dsh-mcp-skill-manager

# 安装 Workspace Category Manager
dsh plugin --profile web add ./dsh-workspace-category-manager
```

安装后**重启 DSH Web Host 一次**以装载 profile bundle，然后刷新浏览器页面。

### 使用入口

- **MCP & Skill Manager**：`设置 → 插件 → MCP` 与 `设置 → 插件 → Skills`
- **Workspace Category Manager**：`设置 → 工作区分类`（侧边栏工作区区域直接呈现分类层级）

> ⚠️ 插件的 Host / client 文件都直接位于各自目录，DSH 通过 profile 依赖解析它们。请保留整个目录，不要仅复制 `cordis.patch.yml`。

## 项目结构

```
.
├── dsh-mcp-skill-manager/          # MCP & Skill 统一管理器
│   ├── index.js                    # Host 端逻辑
│   ├── client.js                   # Web 设置页 client
│   ├── cordis.patch.yml            # Profile bundle 补丁
│   ├── examples/                   # 配置示例
│   ├── skills/                     # 插件自带的 Skill
│   └── scripts/validate.mjs        # 结构校验脚本
├── dsh-workspace-category-manager/ # 工作区分类管理器
│   ├── index.js
│   ├── client.js
│   ├── cordis.patch.yml
│   └── scripts/validate.mjs
└── .gitignore
```

## 开发与验证

```bash
# 安装依赖（任一插件目录）
cd dsh-mcp-skill-manager   # 或 dsh-workspace-category-manager
pnpm install --ignore-scripts

# 校验插件结构
node ./scripts/validate.mjs

# 语法检查
node --check ./index.js
node --check ./client.js
```

各插件的详细功能、安全边界与数据形式，请参见对应目录下的 `README.md`。

## 安全说明

- `dsh-mcp-skill-manager` 的外部 Harness 导入接口仅在 DSH Web 绑定 `127.0.0.1` 时启用；导入时会丢弃明文秘密，仅识别环境变量引用。
- `dsh-workspace-category-manager` 为非破坏性插件，不会创建、移动、重命名或删除任何项目目录与会话。

## License

MIT
