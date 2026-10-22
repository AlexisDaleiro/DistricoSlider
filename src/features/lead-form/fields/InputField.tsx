import type { BrandConfig } from '../../../brand/schema';
import type { InputHTMLAttributes } from 'react';

export interface FieldProps {
  field: BrandConfig['form']['fields'][number];
  inputName: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onEnter: (element: HTMLInputElement) => void;
}

export function InputField({
  field,
  inputName,
  value,
  error,
  disabled,
  onChange,
  onBlur,
  onEnter,
  ...attributes
}: FieldProps &
  Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'inputMode' | 'autoCapitalize' | 'enterKeyHint'
  >) {
  return (
    <div>
      <label htmlFor={inputName} className="mb-2 block text-sm font-bold">
        {field.label}
      </label>
      <input
        {...attributes}
        data-lead-field={field.id}
        id={inputName}
        name={inputName}
        type={field.type}
        value={value}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={field.maxLength}
        aria-required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputName}-error` : undefined}
        className="lead-input"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onFocus={(event) =>
          event.currentTarget.scrollIntoView?.({ block: 'center' })
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter(event.currentTarget);
          }
        }}
      />
      {error && (
        <p
          id={`${inputName}-error`}
          className="mt-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
