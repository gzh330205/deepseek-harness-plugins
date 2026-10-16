import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = ['package.json', 'cordis.patch.yml', 'index.js', 'README.md', 'tsconfig.json', 'src/client/index.ts', 'src/client/api.ts', 'src/client/styles.css', 'lib/client.js', 'scripts/build-client.mjs', 'scripts/check-api.mjs'];
const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) throw new Error(`Missing required files: ${missing.join(', ')}`);

const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('Bundle patch metadata is missing.');
if (manifest.dsh?.client?.platform !== 'web') throw new Error('Web client metadata is missing.');
if (manifest.exports?.['./client'] !== './lib/client.js') throw new Error('Client export must point at the built bundle.');

const host = readFileSync(resolve(root, 'index.js'), 'utf8');
const sidebar = readFileSync(resolve(root, 'src/client/components/CategorySidebar.tsx'), 'utf8');
const utils = readFileSync(resolve(root, 'src/client/utils.ts'), 'utf8');
const constants = readFileSync(resolve(root, 'src/client/constants.ts'), 'utf8');
const entry = readFileSync(resolve(root, 'src/client/index.ts'), 'utf8');
const api = readFileSync(resolve(root, 'src/client/api.ts'), 'utf8');
const css = readFileSync(resolve(root, 'src/client/styles.css'), 'utf8');

if (!host.includes("SETTINGS_NAMESPACE = 'workspace-category-manager'")) throw new Error('Host settings namespace is missing.');
/* Sidebar expansion must ride the Host Config: DSH binds Web to a fresh loopback
 * port on every launch, so an origin-scoped browser store is empty at boot and
 * every category would reopen expanded. */
for (const field of ['collapsedCategories', 'expandedWorkspaces']) {
  if (!host.includes(`${field}: z.array(z.string())`)) throw new Error(`Host Config is missing the ${field} field.`);
}
if (sidebar.includes('localStorage.getItem') || sidebar.includes('localStorage.setItem') || utils.includes('localStorage.getItem') || utils.includes('localStorage.setItem')) {
  throw new Error('Sidebar expansion must not go back to origin-scoped localStorage (it is lost on every launch).');
}
if (!sidebar.includes('persistExpansion(scope, field, retainIds(next, existingIds()))')) {
  throw new Error('Sidebar expansion must be written to the Host Config on toggle.');
}
/* A toggle must paint from local state first: rendering straight from the Config
 * makes every click wait for the settings round trip. */
if (!sidebar.includes('setCollapseOverrides((previous) =>') || !sidebar.includes('isWorkspaceOpen(id)') || !sidebar.includes('isCollapsed(f.id)')) {
  throw new Error('Expansion must render from an optimistic local override, not only from the Config snapshot.');
}
/* The「当前」group rides the same suppression list as real categories, so its id
 * must belong to the expansion id UNIVERSE: when it does not, the override is
 * retired by the next snapshot (the row silently snaps back) and retainIds
 * prunes the id from the persisted list. */
if (!/TODAY_FOLDER_ID = '__today__'/.test(constants)) throw new Error('The Current group id constant is missing.');
const idUniverse = /const idsOfCategories = \(\) => new Set\(\[([^\]]*)\]\)/.exec(sidebar);
if (idUniverse === null || !idUniverse[1].includes('TODAY_FOLDER_ID')) {
  throw new Error('The Current group id must be part of idsOfCategories, or its collapse state is retired immediately.');
}

/* 「当前」= 显式注册表（Config currentSessions），不是时间窗口也不是抑制名单：会话跑起来、
 * 有新提示词、或被打开时才登记，点「隐藏」= 从表里删掉。测试守住行为，这里守住结构：
 * 任何一环退回窗口 / 排除名单，都会让「历史会话自己冒出来」或者「删掉的又回来」。 */
if (!utils.includes('function currentListOf') || !utils.includes('function pruneCurrentList') || !utils.includes('function currentRows') || !utils.includes('function registryUpdates')) {
  throw new Error('The Current registry helpers (read / prune / rows / updates) must live in the shared selectors.');
}
if (!sidebar.includes('currentRows(sessionState, { list: currentList,')) throw new Error('The Current rows must be projected from the registry, not from a time window.');
if (!sidebar.includes('registryUpdates(sessionState, { list: currentList,')) throw new Error('Registration must be derived from observed Session events.');
if (!sidebar.includes('const currentList = registryOverride === null ? persistedList : registryOverride;')) {
  throw new Error('The registry must keep an optimistic local copy so the click repaints before the settings write lands.');
}
if (!sidebar.includes('delete without[row.id];')) throw new Error('Hiding a Session must delete its registry entry (that is the whole model).');
if (!sidebar.includes('observation.current = next;')) throw new Error('Registration needs the previous observation, or every render looks like a fresh run.');
if (/CURRENT_WINDOW_DAYS|currentWindowStart/.test(sidebar + constants)) throw new Error('The time-window model was replaced by the registry; no window constant may come back.');
if (/hiddenToday/.test(host + utils + sidebar)) throw new Error('The dismissal list is gone: hiding now deletes from the registry.');
if (!utils.includes("summary.origin === 'subagent'")) throw new Error('The Current list must keep excluding subagent Session children.');
if (/wcm-todayOvernight|todayOvernight/.test(sidebar + utils)) throw new Error('A registry row needs no window-explanation text any more.');

/* 注册表字段本身：id → { at, viewedAt }，两个字段都给默认值（手改过的残缺记录不该让整份
 * 配置校验失败），整体有默认值（全新 profile 不做任何写入也能校验通过）。 */
const registryField = /currentSessions: z\.dict\(z\.object\(\{[\s\S]{0,400}?\}\)\)/.exec(host);
if (registryField === null) throw new Error('The Host Config is missing the currentSessions registry.');
for (const fact of ['at: z.number().default(0)', 'viewedAt: z.number().default(0)']) {
  if (!registryField[0].includes(fact)) throw new Error(`The registry entry is missing ${fact}`);
}
if (!/currentSessions: z\.dict\(z\.object\(\{[\s\S]{0,400}?\.default\(\{\}\)/.test(host)) {
  throw new Error('The registry needs a default so a fresh profile validates without any write.');
}
if (!sidebar.includes('pruneCurrentList(merged, sessionState)') && !sidebar.includes('pruneCurrentList(without, sessionState)')) {
  throw new Error('Every registry write must prune ids the Session list no longer has.');
}
/* 回显只有两条路：重新跟它对话（活动戳前进）或它再次开始运行 —— 都是被观测到的事件。
 * 没有恢复按钮（刻意的产品决定），也没有第二条自动回显信号。 */
if (sidebar.includes('todayRestore') || sidebar.includes('restoreToday')) throw new Error('The Current list must not grow a restore button: running it again is the only way back.');
/* 登记只看运行：打开一个会话不许把它写进注册表（「翻一下就多出一堆」正是要避免的），
 * 打开只用于给已登记条目刷新 viewedAt（清掉「还没看」标记）。 */
if (!utils.includes('const fresh = startedRunning || advanced;')) {
  throw new Error('Registration must be driven by run events only: opening a session must not register it.');
}
if (/known === undefined && justOpened/.test(utils)) throw new Error('Opening must never be a registration path.');
if (!utils.includes('else if (known !== undefined && justOpened)')) {
  throw new Error('Opening a registered session must still refresh viewedAt (that is how the unseen mark clears).');
}

/* 「当前」按项目分组：项目名只能出现在分组标题上（行内重复正是要消掉的东西），分组折叠状态
 * 是落盘的抑制列表，键必须来自身份（工作区 id / 目录路径）而不是显示名 —— 否则重命名项目
 * 就会丢折叠状态，分组键还会被 retainIds 当成死 id 剪掉。 */
if (!host.includes('collapsedTodayGroups: z.array(z.string())')) throw new Error('The Host Config is missing the collapsedTodayGroups suppression list.');
if (sidebar.includes('wcm-todayProject')) throw new Error('The project name must live on the group header, never repeated on every row.');
/* 分组标题也要能看出运行情况：把组内会话的状态聚合上来（同一套 warning > running > done），
 * 少了这一句，用户就只能逐个展开分组去找谁在跑 —— 这正是被反馈过的问题。 */
if (!sidebar.includes('const groupStatus = aggregateStatus(group.rows.map((row) => sessionStatusOf(row.summary, sessionStatuses)))') || !sidebar.includes('statusIconSlot(groupStatus,')) {
  throw new Error('Every project group header must carry the aggregated STATIC status dot.');
}
/* 分组标题就是分类栏里那个项目行（同款类名与结构），会话也用同一个折叠容器 ——
 * 这样两栏的样式、折叠动画、悬停、状态点语言天然一致，不再各写一套。 */
for (const token of ['wcm-projectRow', 'wcm-projectLine', 'wcm-projectLabel', 'wcm-projectCount']) {
  if (!sidebar.includes(token)) throw new Error(`The Current groups must reuse the category-tree project row styling: missing ${token}`);
}
if (/wcm-todayGroup/.test(sidebar) || /wcm-todayGroup/.test(css)) throw new Error('The bespoke group-header styling was removed: reuse the project row instead.');
const groupBlock = /const groupStatus = aggregateStatus\(group\.rows[\s\S]{0,2000}?group\.rows\.map\(todayRow\)/.exec(sidebar);
if (groupBlock === null || groupBlock[0].includes('wcm-projectAdd') || groupBlock[0].includes('onContextMenu')) {
  throw new Error('The group header must stay action-free (no + button, no project menu), only folding.');
}
if (sidebar.includes('sessionStatusDot(groupStatus)')) throw new Error('The group marker must be a static dot, not the running animation.');
/* 「当前」这一行本身不带状态点（用户决定）：运行情况看下面的项目分组标题。 */
if (!sidebar.includes('statusIconSlot(undefined, h(IconClock16))')) {
  throw new Error('The Current row itself must not carry a status dot.');
}
if (!sidebar.includes('COLLAPSED_TODAY_GROUPS_FIELD') || !sidebar.includes('idsOfTodayGroups') || !sidebar.includes('universeOf(entry.field)')) {
  throw new Error('Folding a project group must ride the shared override machinery with its own id universe.');
}
if (!utils.includes('key: `w:${workspaceId(found)}`')) throw new Error('A project group key must derive from workspace identity, not from its display label.');
/* 「当前」里不放项目操作按钮（刻意的产品决定）：分组标题只负责折叠，项目菜单唯一的入口是
 * 分类树里右键项目行。菜单项定义只留一份，别在两个入口各写一遍。 */
if (sidebar.includes('wcm-todayLocate') || sidebar.includes('wcm-todayGroupHead')) {
  throw new Error('The「当前」group headers must stay action-free: folding is their only affordance.');
}
/* 行内「定位到会话」：把这个会话在分类树里展开并高亮 —— 展开复用同一套乐观/落盘写盘，
 * 树里的行要有定位锚点与高亮类，而且只有被工作区记账的会话才给按钮（不许有点了没反应的按钮）。 */
for (const token of ['wcm-sessionLocate', 'locateSession(', 'wcm-locateHit', "'data-wcm-tree-session'", 'workspaceBySession.has(row.id)']) {
  if (!sidebar.includes(token)) throw new Error(`The locate-session affordance is incomplete: missing ${token}`);
}
/* 行内只留「定位」和「隐藏」两个动作；归档走右键菜单（不进这一行）。 */
if (!sidebar.includes("className: 'wcm-todayHide'")) throw new Error('The row-level hide button must stay.');
if (sidebar.includes('wcm-sessionArchive')) throw new Error('Archiving belongs to the right-click menu, not to a row button.');
if (!sidebar.includes('const workspaceMenuItems = (id, label) =>') || (sidebar.match(/menuItem\(t\('deleteWorkspace'\)/g) ?? []).length !== 1) {
  throw new Error('The project menu must be defined once instead of duplicated per surface.');
}

/* The animated panel keeps its rows inside ONE inner layer: as direct grid tracks
 * every row stayed 34px tall while the panel claimed to be collapsed. */
for (const inner of ['wcm-sessionsInner', 'wcm-folderProjectsInner']) {
  if (!sidebar.includes(inner)) throw new Error(`Animated panel ${inner} wrapper is missing.`);
}
if (/grid-template-rows\s*:\s*0fr/.test(css)) throw new Error('Collapsed panels must not use grid tracks; their children would keep their own row height.');
if (!/\.wcm-sessions\.wcm-closed[^{]*\{[^}]*height:0/.test(css)) throw new Error('A collapsed panel must collapse its height (height:0).');
if (!/wcm-closed \.wcm-folderProjectsInner|wcm-closed .wcm-sessionsInner/.test(css)) throw new Error('A collapsed panel must hide its inner layer (visibility:hidden).');

/* 一键「全部收起 / 全部展开」：作用在分类与项目自身的折叠状态上，复用既有的两个列表
 * （不许新增只有它用的字段），而且「当前」分组不是分类 —— 它不在 folders 里，折叠位必须
 * 原样保留。整棵目录被藏起来那种做法是错的需求，这里也顺手守住。 */
if (!sidebar.includes('const foldAll = () =>')) throw new Error('The header needs the Collapse all / Expand all action.');
if (!sidebar.includes('folders.forEach((folder) => changes.push({ id: folder.id, field: COLLAPSED_CATEGORIES_FIELD, value: anyExpanded }))')) {
  throw new Error('Collapse all must fold the categories themselves (not hide the tree).');
}
if (!sidebar.includes('list.forEach((workspace) => changes.push({ id: workspaceId(workspace), field: EXPANDED_WORKSPACES_FIELD, value: !anyExpanded }))')) {
  throw new Error('Collapse all must also fold the projects themselves.');
}
if (!sidebar.includes('const anyExpanded = folders.some((folder) => !isCollapsed(folder.id)) || list.some((workspace) => isWorkspaceOpen(workspaceId(workspace)))')) {
  throw new Error('The bulk toggle must derive its direction from the real expansion state.');
}
/* 图标必须随状态换成另一个字形，而不是同一个图标转 180°（旋转看不出状态，也看不出这是开关）。 */
if (sidebar.includes('wcm-iconFlip')) throw new Error('The bulk toggle must swap glyphs instead of rotating one in place.');
if (!sidebar.includes('h(anyExpanded ? IconFoldAll16 : IconUnfoldAll16)')) {
  throw new Error('The bulk toggle must show the glyph matching its direction (fold / unfold pair).');
}
if (sidebar.includes('className: `wcm-categories')) throw new Error('Hiding the whole directory was the wrong requirement; fold categories and projects instead.');
if (host.includes('treeCollapsed')) throw new Error('The treeCollapsed flag belonged to the rejected design and must not come back.');

if (!entry.includes("id: 'workspace-categories'")) throw new Error('Client settings section id is missing.');
if (!entry.includes("name: 'sidebar.workspaces'") || !entry.includes('priority: -1')) throw new Error('Client sidebar registration is missing.');
if (!entry.includes('createDshApi') || !entry.includes('CategorySidebar') || !entry.includes('CategorySection')) throw new Error('Client entry wiring is incomplete.');
if (!api.includes('export function createDshApi')) throw new Error('DSH API adapter export is missing.');
if (!api.includes("ctx.get('uiWorkspace')")) throw new Error('uiWorkspace must be soft-detected, not injected.');

console.log('DSH Workspace Category Manager scaffold is valid.');
