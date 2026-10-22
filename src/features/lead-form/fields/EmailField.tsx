import { InputField, type FieldProps } from './InputField';
export function EmailField(props: FieldProps) {
  return (
    <InputField
      {...props}
      inputMode="email"
      autoCapitalize="none"
      enterKeyHint="next"
    />
  );
}
