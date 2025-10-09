import React, { forwardRef } from 'react';

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  id: string;
  helperText?: string;
  errorText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, id, helperText, errorText, className, 'aria-invalid': ariaInvalid, ...rest },
  ref,
) {
  const invalid = Boolean(ariaInvalid) || Boolean(errorText);
  const helpId = helperText ? `${id}-help` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  const classes = [
    'block w-full rounded-md border bg-white px-3 py-2',
    'text-text-primary placeholder:text-text-muted',
    'border-neutral-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    invalid ? 'border-state-error' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        className={classes}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {errorText ? (
        <p id={errorId} className="text-sm text-state-error">
          {errorText}
        </p>
      ) : helperText ? (
        <p id={helpId} className="text-sm text-text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default TextArea;

