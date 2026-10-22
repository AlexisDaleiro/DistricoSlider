import { z } from 'zod';
import type { BrandConfig } from '../../brand/schema';
import { defaultTexts } from '../../brand/defaultTexts';
import { normalizeEmail, normalizePhone } from '../../shared/lib/normalize';

export interface LeadFormValues {
  fields: Record<string, string>;
  consent: boolean;
  marketingOptIn: boolean;
}

export function buildLeadSchema(
  form: BrandConfig['form'],
  overrides: Record<string, string> = {},
) {
  const texts = { ...defaultTexts, ...overrides };
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of form.fields) {
    let value = z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        if (!value) {
          if (field.required)
            ctx.addIssue({
              code: 'custom',
              message: texts['form.errors.required'],
            });
          return;
        }
        if (field.minLength && value.length < field.minLength)
          ctx.addIssue({
            code: 'custom',
            message: texts['form.errors.minLength'].replace(
              '{min}',
              String(field.minLength),
            ),
          });
        if (field.maxLength && value.length > field.maxLength)
          ctx.addIssue({
            code: 'custom',
            message: texts['form.errors.maxLength'].replace(
              '{max}',
              String(field.maxLength),
            ),
          });
      });
    if (field.type === 'email')
      value = value.refine(
        (value) =>
          !value ||
          (z.email().safeParse(normalizeEmail(value)).success &&
            (value.split('@')[1]?.split('.').length ?? 0) >= 2),
        texts['form.errors.email'],
      );
    if (field.type === 'tel')
      value = value.refine(
        (value) =>
          !value || normalizePhone(value, field.defaultCountry) !== null,
        texts['form.errors.phone'],
      );
    shape[field.id] = value.transform((value) =>
      field.type === 'email'
        ? normalizeEmail(value)
        : field.type === 'tel' && value
          ? (normalizePhone(value, field.defaultCountry) ?? value)
          : value,
    );
  }
  return z.object({
    fields: z.object(shape),
    consent: z
      .boolean()
      .refine(
        (value) => !form.consent.required || value,
        texts['form.errors.consent'],
      ),
    marketingOptIn: z
      .boolean()
      .transform((value) => form.marketingOptIn.enabled && value),
  });
}
