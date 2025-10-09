import React from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT: Record<BadgeVariant, string> = {
  primary: 'bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-200',
  secondary: 'bg-surface-sunken text-text-primary ring-1 ring-inset ring-neutral-border',
  success: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  info: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
  warning: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200',
  error: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200',
  neutral: 'bg-neutral-100 text-neutral-800 ring-1 ring-inset ring-neutral-200',
};

/** 상태/분류 표시용 배지 — 대비 우선 */
export function Badge({ variant = 'secondary', className, children, ...rest }: BadgeProps) {
  const classes = ['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', VARIANT[variant], className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

export default Badge;

