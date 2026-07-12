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
}: {
  id: string;
  label: string;
  helperText?: string;
  errorText?: string;
  children: ReactNode;
}) {
  const { helpId, errorId } = fieldDescriptionIds(id, helperText, errorText);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text-primary">
        {label}
      </label>
      {children}
      {helperText ? (
        <p id={helpId} className="text-sm text-text-muted">
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p id={errorId} role="alert" className="text-sm text-state-error">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
