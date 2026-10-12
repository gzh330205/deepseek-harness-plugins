export const NS = 'settings.workspaceCategories';
export const SETTINGS_NAMESPACE = 'workspace-category-manager';
/** Sidebar expansion rides the plugin Config (persisted on disk) — see utils.js. */
export const COLLAPSED_CATEGORIES_FIELD = 'collapsedCategories';
export const EXPANDED_WORKSPACES_FIELD = 'expandedWorkspaces';
/**
 * Synthetic folder id of the cross-project「今天」group. It rides the same
 * suppression list as real categories (`collapsedCategories`), so it needs no
 * Config field of its own — but it MUST be part of the expansion id universe in
 * CategorySidebar (`idsOfCategories`), or the optimistic collapse override is
 * retired on the next snapshot and the row snaps back.
 */
export const TODAY_FOLDER_ID = '__today__';
/**
 * Sessions the operator temporarily removed from the「今天」list (id → the facts
 * observed at removal). A record stops hiding its Session the moment that
 * Session shows activity it did not have then, so the field stays a temporary
 * dismissal list rather than an exclusion list.
 */
export const HIDDEN_TODAY_FIELD = 'hiddenToday';
/**
 * Project groups folded away inside the「今天」list (a SUPPRESSION list: only the
 * collapsed side is stored, so every project present today is expanded by
 * default). Group keys derive from workspace identity / directory path, never
 * from the display label, so renaming a project keeps its fold state.
 */
export const COLLAPSED_TODAY_GROUPS_FIELD = 'collapsedTodayGroups';
