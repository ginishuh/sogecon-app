import Link from 'next/link';
import React from 'react';
import { CONTROL_BASE, CONTROL_SIZE, CONTROL_VARIANT, type ControlSize, type ControlVariant } from './styles';

type LinkBaseProps = React.ComponentProps<typeof Link>;

export type ButtonLinkProps = Omit<LinkBaseProps, 'className'> & {
  /** 시맨틱 변형(토큰 기반 색상) */
  variant?: ControlVariant;
  /** 사이즈 변형 */
  size?: ControlSize;
  className?: string;
};

export function ButtonLink({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = [
    CONTROL_BASE,
    'no-underline hover:no-underline focus-visible:no-underline',
    CONTROL_VARIANT[variant],
    CONTROL_SIZE[size],
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
