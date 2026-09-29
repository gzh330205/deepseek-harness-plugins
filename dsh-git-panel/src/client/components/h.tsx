/**
 * 统一用 createElement 的短别名：本仓库的浏览器半习惯 `h(...)`（见
 * dsh-run-env-manager / dsh-workspace-category-manager 的文档写法）。
 */
import { createElement, type ReactNode } from 'react';

export const h = createElement as unknown as (
  type: unknown,
  props?: Record<string, unknown> | null,
  ...children: ReactNode[]
) => React.ReactElement;
