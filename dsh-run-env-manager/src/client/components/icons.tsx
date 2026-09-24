import React from 'react';

/** 与 dsh primitives 的 IconProps 同形：尺寸由调用方给，颜色继承 currentColor。 */
interface IconProps {
  size?: number;
  className?: string;
}

/** Guide 卡片与 tab 胶囊用的图标（阶段 0 自画，阶段 1 换成 primitives 里的现成图标）。 */
export function IconRefresh({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M13 8a5 5 0 1 1-1.6-3.67" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 2.6v3.1h-3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRunOutline({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.6 6.4 6.6 8l-2 1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.6 9.9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
