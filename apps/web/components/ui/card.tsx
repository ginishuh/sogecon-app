import React from 'react';

type Elevation = 'xs' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** 카드 헤더 텍스트/노드 (접근성: aria-labelledby 연결) */
  heading?: React.ReactNode;
  /** h 계열 시맨틱 헤딩 레벨(기본 h3) */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  meta?: React.ReactNode;
  elevation?: Elevation;
}

const ELEVATION: Record<Elevation, string> = {
  xs: 'shadow-xs',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

/** 카드 컴포넌트 — 헤더/본문/메타, 섀도 단계 지원 */
export function Card({
  heading,
  headingLevel = 3,
  meta,
  elevation = 'sm',
  className,
  children,
  ...rest
}: CardProps) {
  const classes = ['rounded-lg border border-neutral-border bg-surface p-4 md:p-6', ELEVATION[elevation], className ?? '']
    .filter(Boolean)
    .join(' ');

  const Heading = (`h${headingLevel}` as unknown) as keyof React.JSX.IntrinsicElements;
  const headingId = heading ? (rest.id ? `${rest.id}-title` : undefined) : undefined;

  return (
    <section className={classes} aria-labelledby={headingId} {...rest}>
      {heading ? (
        <header className="mb-2 flex items-start justify-between gap-2">
          <Heading id={headingId} className="font-heading text-lg text-text-primary md:text-xl">
            {heading}
          </Heading>
          {meta ? <div className="text-sm text-text-muted">{meta}</div> : null}
        </header>
      ) : null}
      <div className="text-text-primary">{children}</div>
    </section>
  );
}

export default Card;
