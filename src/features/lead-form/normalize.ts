import type { BrandConfig } from '../../brand/schema';
import type { NewLeadInput } from '../../data/types';
import type { LeadFormValues } from './buildLeadSchema';
import { normalizeEmail, normalizePhone } from '../../shared/lib/normalize';

export function normalize(
  values: LeadFormValues,
  brand: BrandConfig,
): NewLeadInput {
  const phoneField = brand.form.fields.find((field) => field.id === 'phone');
  const extra = Object.fromEntries(
    Object.entries(values.fields)
      .filter(
        ([key, value]) =>
          !['name', 'email', 'company', 'phone'].includes(key) && value.trim(),
      )
      .map(([key, value]) => [key, value.trim()]),
  );
  return {
    eventId: brand.event.id,
    brandId: brand.brand.id,
    name: values.fields.name.trim(),
    email: normalizeEmail(values.fields.email),
    company: values.fields.company?.trim() || undefined,
    phone: values.fields.phone
      ? (normalizePhone(values.fields.phone, phoneField?.defaultCountry) ??
        values.fields.phone.trim())
      : undefined,
    extra: Object.keys(extra).length ? extra : undefined,
    consent: values.consent,
    consentVersion: brand.form.consent.version,
    marketingOptIn: brand.form.marketingOptIn.enabled && values.marketingOptIn,
  };
}
