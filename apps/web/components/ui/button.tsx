import React, { forwardRef } from 'react';
import { CONTROL_BASE, CONTROL_SIZE, CONTROL_VARIANT, type ControlSize, type ControlVariant } from './styles';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 시맨틱 변형(토큰 기반 색상) */
  variant?: ControlVariant;
  /** 사이즈 변형 */
  size?: ControlSize;
  /** 로딩 상태(스크린리더 알림을 위해 aria-busy 사용) */
  loading?: boolean;
}

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
    CONTROL_BASE,
    CONTROL_VARIANT[variant],
    CONTROL_SIZE[size],
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
