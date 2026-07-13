import type { ReactNode } from 'react';

export function AuthPage({ children, width = 'wide' }: { children: ReactNode; width?: 'narrow' | 'wide' }) {
  return (
    <section
      className={`mx-auto w-full space-y-7 py-2 md:space-y-9 md:py-4 ${
        width === 'narrow' ? 'max-w-xl' : 'max-w-4xl'
      }`}
    >
      {children}
    </section>
  );
}

export function AuthHeading({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <header className="space-y-3">
      {eyebrow ? (
        <p className="hidden font-menu text-xs font-semibold tracking-[0.16em] text-brand-700 md:block">{eyebrow}</p>
      ) : null}
      <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.025em] text-text-primary md:text-[2.5rem]">
        {title}
      </h1>
      <p className="max-w-2xl text-sm leading-6 text-text-secondary md:text-base md:leading-7">{description}</p>
    </header>
  );
}

export function AuthSectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="shrink-0 text-lg font-semibold text-text-primary md:text-xl">{children}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-brand-700" />
    </div>
  );
}
