export type ControlSize = 'sm' | 'md' | 'lg';
export type ControlVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const CONTROL_BASE = [
  'inline-flex min-w-11 items-center justify-center rounded-md font-medium transition-colors select-none',
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export const CONTROL_VARIANT: Record<ControlVariant, string> = {
  primary: 'bg-brand-700 text-text-inverse hover:bg-brand-800 active:bg-brand-900',
  secondary: 'border border-neutral-border bg-surface-raised text-text-primary hover:bg-surface-sunken',
  ghost: 'bg-transparent text-brand-700 hover:bg-surface-raised',
  danger: 'bg-state-error text-text-inverse hover:bg-state-error-hover',
};

/** 모든 크기는 WCAG 2.2 target size 기준인 최소 44px 높이를 유지한다. */
export const CONTROL_SIZE: Record<ControlSize, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export const FIELD_CONTROL = [
  'block min-h-11 w-full rounded-md border bg-white px-3 py-2 text-text-primary',
  'border-neutral-border placeholder:text-text-muted',
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
].join(' ');
