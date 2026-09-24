/** 内联 SVG 图标：不引第三方图标库，尺寸/描边与 DSH 自己的 16px 线性图标一致。 */
import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
});

export function IconGit({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="8" cy="4" r="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M8 6v4" />
      <path d="M8 12 4.5 8.5" />
      <circle cx="4" cy="4.5" r="1.6" />
      <path d="M4 6.1v3.2" />
    </svg>
  );
}

export function IconBranch({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="4.5" cy="4" r="1.8" />
      <circle cx="4.5" cy="12" r="1.8" />
      <circle cx="11.5" cy="6" r="1.8" />
      <path d="M4.5 5.8v4.4" />
      <path d="M11.5 7.8c0 2-1.6 3.4-4 3.4H6.3" />
    </svg>
  );
}

export function IconCommit({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M1.5 8h3.9M10.6 8h3.9" />
    </svg>
  );
}

export function IconFileDiff({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.5 2.5h6l3 3v8h-9z" />
      <path d="M9.5 2.5v3h3" />
      <path d="M6 8.5h4M8 6.5v4" />
    </svg>
  );
}

export function IconWorktree({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="1.8" y="2.5" width="5" height="4" rx="1" />
      <rect x="9.2" y="9.5" width="5" height="4" rx="1" />
      <path d="M4.3 6.5v3.2c0 .8.6 1.4 1.4 1.4h3.5" />
    </svg>
  );
}

export function IconRefresh({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.5V5h-2.6" />
    </svg>
  );
}

export function IconPlus({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function IconMinus({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function IconUndo({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 8a5 5 0 1 0 1.6-3.7" />
      <path d="M3 2.5V5h2.6" />
    </svg>
  );
}

export function IconChevron({ size = 16, className, open = false }: IconProps & { open?: boolean }) {
  return (
    <svg {...base(size, className)} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .12s ease' }}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M10 3.5 5.5 8 10 12.5" />
    </svg>
  );
}

export function IconBack({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9.5 3.5 5 8l4.5 4.5" />
    </svg>
  );
}

export function IconExternal({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6.5 3.5H3.5v9h9v-3" />
      <path d="M9.5 3.5h3v3" />
      <path d="M12.5 3.5 7.5 8.5" />
    </svg>
  );
}

export function IconTrash({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 4.5h10" />
      <path d="M4.5 4.5V13h7V4.5" />
      <path d="M6.5 4.5V3h3v1.5" />
      <path d="M6.8 7v3.5M9.2 7v3.5" />
    </svg>
  );
}

export function IconWarning({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M8 2.5 14 13H2z" />
      <path d="M8 6.5v3" />
      <path d="M8 11.3v.2" />
    </svg>
  );
}

export function IconExpand({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5 8 8" />
      <path d="M6.5 13.5h-4v-4" />
      <path d="M2.5 13.5 8 8" />
    </svg>
  );
}

export function IconCopy({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="5.5" y="2.5" width="7" height="8" rx="1" />
      <path d="M3.5 5.5v8h7" />
    </svg>
  );
}
