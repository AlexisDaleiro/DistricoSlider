import { InputField, type FieldProps } from './InputField';
export function PhoneField(props: FieldProps) {
  return <InputField {...props} inputMode="tel" enterKeyHint="done" />;
}
