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
if (!host.includes("SETTINGS_NAMESPACE = 'workspace-category-manager'")) throw new Error('Host settings namespace is missing.');
/* Sidebar expansion must ride the Host Config: DSH binds Web to a fresh
 * loopback port on every launch, so an origin-scoped browser store is empty at
 * boot and every category would reopen expanded. */
for (const field of ['collapsedCategories', 'expandedWorkspaces']) {
  if (!host.includes(`${field}: z.array(z.string())`)) throw new Error(`Host Config is missing the ${field} field.`);
}
const sidebar = readFileSync(resolve(root, 'src/client/components/CategorySidebar.tsx'), 'utf8');
const utils = readFileSync(resolve(root, 'src/client/utils.ts'), 'utf8');
if (sidebar.includes('localStorage.getItem') || sidebar.includes('localStorage.setItem') || utils.includes('localStorage.getItem') || utils.includes('localStorage.setItem')) throw new Error('Sidebar expansion must not go back to origin-scoped localStorage (it is lost on every launch).');
if (!sidebar.includes('persistExpansion(scope, field, retainIds(next, existingIds()))')) {
  throw new Error('Sidebar expansion must be written to the Host Config on toggle.');
}
/* A toggle must paint from local state first: rendering straight from the Config
 * makes every click wait for the settings round trip. */
if (!sidebar.includes('setCollapseOverrides((previous) =>') || !sidebar.includes('isWorkspaceOpen(id)') || !sidebar.includes('isCollapsed(f.id)')) {
  throw new Error('Expansion must render from an optimistic local override, not only from the Config snapshot.');
}
/* The「今天」group rides the same suppression list as real categories, so its id
 * must belong to the expansion id UNIVERSE: when it does not, the override is
 * retired by the next snapshot (the row silently snaps back) and retainIds
 * prunes the id from the persisted list. Its window must come from the Session
 * list snapshot (`updatedAt`), never from an origin-scoped browser store. */
const todayId = readFileSync(resolve(root, 'src/client/constants.ts'), 'utf8');
if (!/TODAY_FOLDER_ID = '__today__'/.test(todayId)) throw new Error('The Today group id constant is missing.');
const idUniverse = /const idsOfCategories = \(\) => new Set\(\[([^\]]*)\]\)/.exec(sidebar);
if (idUniverse === null || !idUniverse[1].includes('TODAY_FOLDER_ID')) {
  throw new Error('The Today group id must be part of idsOfCategories, or its collapse state is retired immediately.');
}
if (!sidebar.includes('recentSessions(sessionState,') || !sidebar.includes('startOfLocalDay(nowMs)')) {
  throw new Error('The Today window must be derived from the Session list snapshot through the shared selectors.');
}
if (!utils.includes('summary.origin === \'subagent\'')) {
  throw new Error('The Today list must keep excluding subagent Session children.');
}
/* 「从今天隐藏」是临时移除：Host Config 必须持有记录（客户端只是它的投影），记录要
 * 带上移除那一刻的活动戳，并且只在写入时剪枝——丢掉任一项，它就会退化成一份永久
 * 排除名单，或者随使用无限增长。 */
const hiddenField = /hiddenToday: z\.dict\(z\.object\(\{[\s\S]{0,600}?\}\)\)/.exec(host);
if (hiddenField === null) throw new Error('The Host Config is missing the hiddenToday dismissal field.');
for (const fact of ['at:', 'updatedAt:']) {
  if (!hiddenField[0].includes(fact)) throw new Error(`The hiddenToday record is missing ${fact}`);
}
/* 记录字段必须容错（默认值而不是 required）：一条手改过的残缺记录不该让整份 Host
 * 配置校验失败，把插件挡在启动之外。 */
if (/hiddenToday: z\.dict\(z\.object\(\{[\s\S]{0,600}?\.required\(\)/.test(host)) {
  throw new Error('The hiddenToday record must tolerate a partial entry instead of requiring every fact.');
}
if (!utils.includes('function todayDismissed') || !utils.includes('function pruneHiddenToday')) throw new Error('The dismissal predicate and prune helper are missing.');
if (!sidebar.includes('pruneHiddenToday(merged, sessionState)')) throw new Error('A dismissal write must prune records that no longer hide anything.');
/* 回显只有一条路：「重新跟这个会话对话」。没有恢复按钮（这是刻意的产品决定），
 * 也没有定时器或第二条自动回显信号——再加回来要同时改这条门禁和它的测试。 */
if (sidebar.includes('todayRestore') || sidebar.includes('restoreToday')) throw new Error('The Today dismissal must not grow a restore button: talking to the Session is the only way back.');
if (/record\.running/.test(utils) || /running: row\.running/.test(sidebar)) throw new Error('Reappearance must be driven by the activity stamp alone, not by a running transition.');
/* 「今天」按项目分组：项目名只能出现在分组标题上（行内重复正是这次要消掉的东西），
 * 分组折叠状态是落盘的抑制列表，键必须来自身份（工作区 id / 目录路径）而不是显示名
 * ——否则重命名项目就会丢折叠状态，分组键还会被 retainIds 当成死 id 剪掉。 */
if (!host.includes('collapsedTodayGroups: z.array(z.string())')) throw new Error('The Host Config is missing the collapsedTodayGroups suppression list.');
if (sidebar.includes('wcm-todayProject')) throw new Error('The project name must live on the group header, never repeated on every row.');
if (!sidebar.includes('COLLAPSED_TODAY_GROUPS_FIELD') || !sidebar.includes('idsOfTodayGroups') || !sidebar.includes('universeOf(entry.field)')) {
  throw new Error('Folding a project group must ride the shared override machinery with its own id universe.');
}
if (!utils.includes('key: `w:${workspaceId(found)}`')) throw new Error('A project group key must derive from workspace identity, not from its display label.');
/* 「当前」里不放项目操作按钮（这是刻意的产品决定）：分组标题只负责折叠，项目菜单唯一
 * 的入口是分类树里右键项目行。菜单项定义只留一份，别在两个入口各写一遍。 */
if (sidebar.includes('wcm-todayLocate') || sidebar.includes('wcm-todayGroupHead')) {
  throw new Error('The「当前」group headers must stay action-free: folding is their only affordance.');
}
/* 「定位到会话」：行内按钮挨着隐藏按钮，作用是把该会话在分类树里展开并高亮 —— 所以
 * 展开要复用同一套乐观/落盘写盘、树里的行要有定位锚点与高亮类。只有被工作区记账的
 * 会话才有地方可去，别的会话不许出现一个点了没反应的按钮。 */
for (const token of ['wcm-sessionLocate', 'locateSession(', 'wcm-locateHit', "'data-wcm-tree-session'", 'workspaceBySession.has(row.id)']) {
  if (!sidebar.includes(token)) throw new Error(`The locate-session affordance is incomplete: missing ${token}`);
}
/* 「当前」的行里必须同时有定位和隐藏两个动作（前者定位到树里的会话，后者临时移除）。 */
if (!sidebar.includes("className: 'wcm-todayHide'")) throw new Error('The row-level hide button must stay.');
if (!sidebar.includes('const workspaceMenuItems = (id, label) =>') || (sidebar.match(/menuItem\(t\('deleteWorkspace'\)/g) ?? []).length !== 1) {
  throw new Error('The project menu must be defined once instead of duplicated per surface.');
}
/* The animated panel keeps its rows inside ONE inner layer: as direct grid
 * tracks every row stayed 34px tall while the panel claimed to be collapsed. */
for (const inner of ['wcm-sessionsInner', 'wcm-folderProjectsInner']) {
  if (!sidebar.includes(inner)) throw new Error(`Animated panel ${inner} wrapper is missing.`);
}
const css = readFileSync(resolve(root, 'src/client/styles.css'), 'utf8');
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

const entry = readFileSync(resolve(root, 'src/client/index.ts'), 'utf8');
if (!entry.includes("id: 'workspace-categories'")) throw new Error('Client settings section id is missing.');
if (!entry.includes("name: 'sidebar.workspaces'") || !entry.includes('priority: -1')) throw new Error('Client sidebar registration is missing.');
if (!entry.includes('createDshApi') || !entry.includes('CategorySidebar') || !entry.includes('CategorySection')) throw new Error('Client entry wiring is incomplete.');

const api = readFileSync(resolve(root, 'src/client/api.ts'), 'utf8');
if (!api.includes('export function createDshApi')) throw new Error('DSH API adapter export is missing.');
if (!api.includes("ctx.get('uiWorkspace')")) throw new Error('uiWorkspace must be soft-detected, not injected.');

console.log('DSH Workspace Category Manager scaffold is valid.');
