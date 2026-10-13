export const NS = 'settings.workspaceCategories';
export const SETTINGS_NAMESPACE = 'workspace-category-manager';
/** Config field holding the「当前」registry: session id → { at, viewedAt }. */
export const CURRENT_SESSIONS_FIELD = 'currentSessions';
/**
 * 折叠状态用 SUPPRESSION 列表：只存「收起」的那一侧（见 scripts/validate.mjs）。
 * Config 里的字段名保持 today/category 这套历史命名，改的是语义不是键。
 */
export const COLLAPSED_CATEGORIES_FIELD = 'collapsedCategories';
export const EXPANDED_WORKSPACES_FIELD = 'expandedWorkspaces';
export const TODAY_FOLDER_ID = '__today__';
/**
 * Project groups folded away inside the「今天」list (a SUPPRESSION list: only the
 * collapsed side is stored, so every project present today is expanded by
 * default). Group keys derive from workspace identity / directory path, never
 * from the display label, so renaming a project keeps its fold state.
 */
export const COLLAPSED_TODAY_GROUPS_FIELD = 'collapsedTodayGroups';
