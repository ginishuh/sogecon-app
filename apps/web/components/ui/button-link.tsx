import Link from 'next/link';
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type LinkBaseProps = React.ComponentProps<typeof Link>;

export type ButtonLinkProps = Omit<LinkBaseProps, 'className'> & {
  /** 시맨틱 변형(토큰 기반 색상) */
  variant?: ButtonVariant;
  /** 사이즈 변형 */
  size?: ButtonSize;
  className?: string;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-700 text-text-inverse hover:bg-brand-800 active:bg-brand-900 focus-visible:ring-brand-400',
  secondary:
    'bg-surface-raised text-text-primary border border-neutral-border hover:bg-surface-sunken',
  ghost: 'bg-transparent text-brand-700 hover:bg-surface-raised',
  danger: 'bg-state-error text-text-inverse hover:bg-state-error-hover',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function ButtonLink({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = [
    'inline-flex items-center justify-center rounded-md font-medium transition-colors select-none',
    'focus-visible:outline-none ring-offset-2 ring-offset-surface',
    'no-underline hover:no-underline focus-visible:no-underline',
    VARIANT[variant],
    SIZE[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link className={classes} {...rest}>
      {children}
    </Link>
  );
}

export default ButtonLink;

