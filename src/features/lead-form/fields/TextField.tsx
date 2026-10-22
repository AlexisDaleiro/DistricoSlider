import { InputField, type FieldProps } from './InputField';
export function TextField(props: FieldProps) {
  return (
    <InputField
      {...props}
      inputMode="text"
      autoCapitalize="words"
      enterKeyHint="next"
    />
  );
}
