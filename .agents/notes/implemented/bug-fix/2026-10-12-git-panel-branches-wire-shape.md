# Agent Note: 分支选择器永远是空的——只读接口的包壳被客户端读成了扁平

Status: implemented

## Problem

`GET /dsh-git/branches` 一直回的是 `{ ok, root, branches: { local, remote, tags, truncated, total } }`，
而 `HistoryView.loadBranches` 与 `WorktreeView` 的表单加载都按**扁平**读：
`setBranches({ local: response.local, remote: response.remote, tags: response.tags, … })`。
宿主从没发过这种形状，于是四个字段全是 `undefined`。

渲染侧 `(props.branches?.local ?? []).filter(...)` 把 `undefined` 变成空数组，所以：

- 分支选择器只剩「筛选分支…」「新分支名 + 创建并切换」「关闭」，**一个分支都列不出来**；
  同一次真机排查里 `curl` 同一个接口，`dev / main / one-bot-client` 加一堆 `origin/*` 都在。
- 工作树页「新建 worktree」的基线选择器（本地分支 / tag）同样空掉。
- 全程不报错、不抛异常、不进错误横幅——`?? []` 把读错的字段静静地吃掉了。

这是「无法切换分支」的**主因**：脏工作区拒绝与入口不可见都是真的，但只要这一条在，
即使工作区干净、即使找到了选择器，也依然无从下手。

**测试为什么没拦住**：`render.test.js` 传给视图的分支夹具是手写的扁平对象
（形状与 `api.ts` 的声明一致，与宿主实现对不上），而 `entry.tsx` 的 stub 又原样
`{ ok: true, ...夹具 }` 回传。于是「历史：分支选择器有本地分支」这条断言，在一个
现实中不存在的响应上稳稳通过——夹具越具体，骗得越真。

## Decision

**包壳属于契约，以宿主为准。** 客户端读 `response.branches`：

- `HistoryView.loadBranches`：`setBranches(response.branches)`；
- `WorktreeView` 的基线加载：同样一处；
- `api.ts`：`branches(root): Promise<{ ok: boolean; root: string; branches: BranchListResult }>`，
  并在类型上写死注释——「不要再按扁平读，`?? []` 会把读错吞掉」。扁平读法从此在类型层面不合法。

**夹具改由宿主实现生成，手写的那份删掉。** `render.test.js` 里 `readBranches(gitRunner, repo)`
直接算出内层结构（该测试本来就有真实仓库与真实 runner），`entry.tsx` 的 stub 只按
`routes.js` 的包壳包一层 `{ ok, root, branches }`。内层结构从此没有第二个副本。

新增两条「宿主给了几个 ref 就画几个」的断言（选择器与头部入口各一条），
把「列表为空」这种静默失败钉成红灯。

## Alternatives considered

- **把宿主改成回扁平**：功能上等价，但 `/branches` 的包壳已被 `routes.test.js`
  钉住（`branches.json.branches.local[0].name`），且 `history` / `commit` / `diff` 三个只读接口
  都是「同名包壳」；改宿主等于让 `branches` 成为整组接口里唯一的例外。
- **客户端写成 `response.branches ?? response`，两种形状都容忍**：能同时容忍新旧两半，
  但扁平形状**从来没有被任何一版宿主发出过**，这份兼容没有真实发送方；留着它只会让
  下一个人以为两种形状都合法，把契约重新搅浑。
- **只加断言、不改夹具**：夹具本身是错的，断言越真越有欺骗性（这次就是活例子）。
  钉子必须打在夹具的**来源**上，否则修好这一处、下一个人照抄手写夹具还会再犯。
- **UI 在列表为空时提示「没有可切换的分支」**：症状会变得可见，但仍不能用；
  而且 unborn 仓库本来就真的没有分支，这条提示会变成误报。

## Consequences

- 收益：分支选择器与 worktree 基线选择器恢复内容——数据一直在宿主侧，只是被读丢了。
- 收益：夹具改由宿主实现生成后，「客户端读错包壳」这类问题会在 `render.test.js` 直接炸出来；
  「ref 数量对得上」的断言覆盖所有分组，而不只是「能看见 main」。
- 收益：调试路径也变清楚——`curl /dsh-git/branches` 有数据、UI 空列表，问题必在包壳或渲染，
  不会再被误判成「仓库没有分支」。
- 代价：`api.ts` 的类型收紧会波及未来任何调用方——这是有意的。
- 验证：把 `render.test.js` 的夹具换成 `readBranches()` 的真实输出后，先在**未修复**的客户端上
  复现失败（`历史：分支选择器有本地分支`、`头部：点一下…打开选择器`），修复后 92 条全过；
  `routes.test.js` 继续钉住宿主侧的包壳形状。
- 关联：本次「无法切换分支」的其余三处（脏工作区一刀切拒绝、入口不可见、远程分支落进
  detached HEAD）记在 [另一篇](2026-10-12-git-panel-branch-switch.md)。
