import React from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT: Record<BadgeVariant, string> = {
  primary: 'bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-200',
  secondary: 'bg-surface-sunken text-text-primary ring-1 ring-inset ring-neutral-border',
  success: 'bg-state-success-subtle text-state-success ring-1 ring-inset ring-state-success-ring',
  info: 'bg-state-info-subtle text-state-info ring-1 ring-inset ring-state-info-ring',
  warning: 'bg-state-warning-subtle text-state-warning ring-1 ring-inset ring-state-warning-ring',
  error: 'bg-state-error-subtle text-state-error ring-1 ring-inset ring-state-error-ring',
  neutral: 'bg-surface-sunken text-text-secondary ring-1 ring-inset ring-neutral-border',
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

