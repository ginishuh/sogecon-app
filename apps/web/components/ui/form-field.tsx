import type { ReactNode } from 'react';

export function fieldDescriptionIds(id: string, helperText?: string, errorText?: string) {
  const helpId = helperText ? `${id}-help` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;
  return {
    helpId,
    errorId,
    describedBy: [errorId, helpId].filter(Boolean).join(' ') || undefined,
  };
}

export function FormField({
  id,
  label,
  helperText,
  errorText,
  children,
  layout = 'stacked',
}: {
  id: string;
  label: string;
  helperText?: string;
  errorText?: string;
  children: ReactNode;
  layout?: 'stacked' | 'inline';
}) {
  const { helpId, errorId } = fieldDescriptionIds(id, helperText, errorText);
  const inline = layout === 'inline';
  return (
    <div className={inline ? 'grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5' : 'flex flex-col gap-1.5'}>
      <label htmlFor={id} className={`text-sm font-semibold text-text-primary ${inline ? 'break-keep' : ''}`}>
        {label}
      </label>
      {children}
      {helperText ? (
        <p id={helpId} className={`text-sm text-text-muted ${inline ? 'col-start-2' : ''}`}>
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p id={errorId} role="alert" className={`text-sm text-state-error ${inline ? 'col-start-2' : ''}`}>
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
