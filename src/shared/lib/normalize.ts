import {
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export function normalizePhone(
  value: string,
  defaultCountry?: string,
): string | null {
  const country =
    defaultCountry && isSupportedCountry(defaultCountry)
      ? defaultCountry
      : undefined;
  const phone = parsePhoneNumberFromString(value.trim(), country);
  return phone?.isValid() ? phone.number : null;
}
