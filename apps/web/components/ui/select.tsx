import React, { forwardRef } from 'react';
import { FormField, fieldDescriptionIds } from './form-field';
import { FIELD_CONTROL } from './styles';

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  id: string;
  helperText?: string;
  errorText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, id, helperText, errorText, className, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, children, ...rest },
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
      <select
        ref={ref}
        id={id}
        className={classes}
        {...rest}
        aria-invalid={invalid || undefined}
        aria-describedby={allDescriptions}
      >
        {children}
      </select>
    </FormField>
  );
});

export default Select;
