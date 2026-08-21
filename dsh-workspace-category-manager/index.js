import z from '@deepseek-ai/schemastery';

export const SETTINGS_NAMESPACE = 'workspace-category-manager';
const CATEGORY_ID = /^[a-z][a-z0-9-]{0,31}$/;

const Category = z.object({
  id: z.string().required().pattern(CATEGORY_ID),
  name: z.string().required(),
  color: z.string().default('#4f8cff'),
});

export const Config = z.object({
  categories: z.array(Category).default([]),
  /** Workspace ids are intentionally independent of workspace filesystem paths. */
  assignments: z.dict(z.string()).default({}),
});

export const inject = [];

function validate(config) {
  const ids = new Set();
  for (const category of config.categories) {
    if (ids.has(category.id)) throw new Error(`Workspace category id "${category.id}" is duplicated.`);
    if (category.name.trim() === '') throw new Error(`Workspace category "${category.id}" needs a name.`);
    ids.add(category.id);
  }
  for (const [workspaceId, categoryId] of Object.entries(config.assignments)) {
    if (workspaceId.trim() === '') throw new Error('Workspace assignment contains an empty workspace id.');
    if (!ids.has(categoryId)) throw new Error(`Workspace assignment references missing category "${categoryId}".`);
  }
}

/** Registers settings only: categories never rename, move, or delete project folders. */
export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(SETTINGS_NAMESPACE, Config, {
      base: {},
      applies: 'live',
      validate,
    });
  });
}

export default apply;
