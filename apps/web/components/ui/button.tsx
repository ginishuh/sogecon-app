import React, { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 시맨틱 변형(토큰 기반 색상) */
  variant?: ButtonVariant;
  /** 사이즈 변형 */
  size?: ButtonSize;
  /** 로딩 상태(스크린리더 알림을 위해 aria-busy 사용) */
  loading?: boolean;
}

// 변형/사이즈 별 클래스(토큰 우선)
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-700 text-text-inverse hover:bg-brand-800 active:bg-brand-900 focus-visible:ring-brand-400',
  secondary:
    'bg-surface-raised text-text-primary border border-neutral-border hover:bg-surface-sunken',
  ghost: 'bg-transparent text-brand-700 hover:bg-surface-raised',
  danger: 'bg-state-error text-text-inverse hover:bg-red-800',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

/**
 * 버튼 컴포넌트 — 접근성/포커스 링/상태 지원
 * - a11y: aria-busy(loading), disabled시 포커스/커서 처리
 * - 키보드 포커스 링은 globals.css에서 공통 적용
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  const classes = [
    'inline-flex items-center justify-center rounded-md font-medium transition-colors select-none',
    'focus-visible:outline-none ring-offset-2 ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;

