import React, { forwardRef } from 'react';
import { FormField, fieldDescriptionIds } from './form-field';
import { FIELD_CONTROL } from './styles';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** 라벨 텍스트(접근성 연결을 위해 id 필수) */
  label: string;
  /** 필드 id (label/htmlFor, aria-describedby 연결에 사용) */
  id: string;
  /** 헬퍼 텍스트(설명) */
  helperText?: string;
  /** 에러 텍스트(존재 시 aria-invalid=true, error id로 설명 연결) */
  errorText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, helperText, errorText, className, 'aria-invalid': ariaInvalid, ...rest },
  ref,
) {
  const invalid = Boolean(ariaInvalid) || Boolean(errorText);
  const { describedBy } = fieldDescriptionIds(id, helperText, errorText);

  const classes = [
    FIELD_CONTROL,
    invalid ? 'border-state-error' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <FormField id={id} label={label} helperText={helperText} errorText={errorText}>
      <input
        ref={ref}
        id={id}
        className={classes}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FormField>
  );
});

export default Input;
