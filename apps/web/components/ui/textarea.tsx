import React, { forwardRef } from 'react';
import { FormField, fieldDescriptionIds } from './form-field';
import { FIELD_CONTROL } from './styles';

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  id: string;
  helperText?: string;
  errorText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, id, helperText, errorText, className, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, ...rest },
  ref,
) {
  const invalid = Boolean(ariaInvalid) || Boolean(errorText);
  const { describedBy } = fieldDescriptionIds(id, helperText, errorText);
  const allDescriptions = [describedBy, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

  const classes = [
    FIELD_CONTROL,
    invalid ? 'border-state-error' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <FormField id={id} label={label} helperText={helperText} errorText={errorText}>
      <textarea
        ref={ref}
        id={id}
        className={classes}
        {...rest}
        aria-invalid={invalid || undefined}
        aria-describedby={allDescriptions}
      />
    </FormField>
  );
});

export default TextArea;
