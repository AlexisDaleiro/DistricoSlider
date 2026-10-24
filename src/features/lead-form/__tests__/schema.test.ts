import { expect, it } from 'vitest';
import raw from '../../../../brands/demo/theme.config.json';
import { brandSchema } from '../../../brand/schema';
import { buildLeadSchema } from '../buildLeadSchema';
import { normalize } from '../normalize';
import { dayKey } from '../../../shared/lib/time';
import { formatPlayerName } from '../../leaderboard/formatPlayerName';
import { selectGameImage } from '../../game/image/selectGameImage';
import biofreshRaw from '../../../../brands/biofresh/theme.config.json';
import granplusRaw from '../../../../brands/granplus/theme.config.json';
import { mulberry32 } from '../../game/engine/rng';

const brand = brandSchema.parse(raw);
const valid = {
  fields: {
    name: ' Ana Pérez ',
    email: ' ANA@EXAMPLE.COM ',
    company: ' Empresa ',
    phone: '099123456',
  },
  consent: true,
  marketingOptIn: false,
};
it('el config exige nombre/email obligatorios y países de teléfono reconocidos', () => {
  const optional = structuredClone(raw);
  optional.form.fields.find((field) => field.id === 'email')!.required = false;
  expect(brandSchema.safeParse(optional).success).toBe(false);
  const country = structuredClone(raw);
  country.form.fields.find((field) => field.id === 'phone')!.defaultCountry =
    'ZZ';
  expect(brandSchema.safeParse(country).success).toBe(false);
});
it('normaliza trim, lowercase y E.164; conserva versión de consentimiento y opt-in separado', () => {
  const result = buildLeadSchema(brand.form).parse(valid);
  expect(result.fields).toMatchObject({
    name: 'Ana Pérez',
    email: 'ana@example.com',
    phone: '+59899123456',
  });
  expect(normalize(result, brand)).toMatchObject({
    name: 'Ana Pérez',
    email: 'ana@example.com',
    phone: '+59899123456',
    company: 'Empresa',
    consentVersion: brand.form.consent.version,
    marketingOptIn: false,
  });
});
it('rechaza campos vacíos, nombre corto, email de un solo label, teléfono inválido y falta de consentimiento', () => {
  const schema = buildLeadSchema(brand.form);
  for (const fields of [
    { ...valid.fields, name: ' ' },
    { ...valid.fields, name: 'Al' },
    { ...valid.fields, email: 'a@b' },
    { ...valid.fields, email: 'bad' },
    { ...valid.fields, phone: '123' },
    { ...valid.fields, company: 'x'.repeat(81) },
  ])
    expect(schema.safeParse({ ...valid, fields }).success).toBe(false);
  expect(schema.safeParse({ ...valid, consent: false }).success).toBe(false);
});
it('opcionales vacíos se permiten; marketing deshabilitado se guarda false y campos adicionales van a extra', () => {
  const config = structuredClone(brand);
  config.form.marketingOptIn.enabled = false;
  config.form.consent.required = false;
  config.form.fields.push({
    id: 'role',
    type: 'text',
    label: 'Cargo',
    required: false,
    minLength: 3,
  });
  const parsed = buildLeadSchema(config.form).parse({
    fields: { ...valid.fields, phone: '', company: '', role: ' Gerente ' },
    consent: false,
    marketingOptIn: true,
  });
  expect(normalize(parsed, config)).toMatchObject({
    phone: undefined,
    company: undefined,
    consent: false,
    marketingOptIn: false,
    extra: { role: 'Gerente' },
  });
  expect(
    buildLeadSchema(config.form).safeParse({
      ...parsed,
      fields: { ...parsed.fields, role: '' },
    }).success,
  ).toBe(true);
});
it('el nombre público enmascara apellido, soporta espacios, nombres compuestos y Unicode', () => {
  expect(formatPlayerName(' María José Pérez ')).toBe('María P.');
  expect(formatPlayerName('Ana')).toBe('Ana');
  expect(formatPlayerName('李 小龍')).toBe('李 小.');
  expect(formatPlayerName('  ')).toBe('');
});
it('dayKey usa el día local, incluyendo el borde de medianoche', () => {
  expect(dayKey(new Date(2026, 9, 21, 0, 0, 0).getTime())).toBe('2026-10-21');
  expect(dayKey(new Date(2026, 9, 20, 23, 59, 59).getTime())).toBe(
    '2026-10-20',
  );
});
it('cada marca sortea solo sus bolsas y separa evento y export', () => {
  const bio = brandSchema.parse(biofreshRaw);
  const gran = brandSchema.parse(granplusRaw);
  expect(bio.game.images.map((image) => image.src)).toEqual([
    'assets/puzzle/biofresh.jpg',
  ]);
  const images = gran.game.images;
  expect(images.map((image) => image.src)).toEqual([
    'assets/puzzle/granplus-carne.jpg',
    'assets/puzzle/granplus-salmon.jpg',
  ]);
  expect(selectGameImage(images, () => 0)).toBe(images[0]);
  expect(selectGameImage(images, () => 0.9999)).toBe(images[1]);
  const rng = mulberry32(42);
  const chosen = new Set(
    Array.from({ length: 100 }, () => selectGameImage(images, rng).src),
  );
  expect(chosen.size).toBe(2);
  expect(bio.event.id).not.toBe(gran.event.id);
  expect(bio.export.filePrefix).not.toBe(gran.export.filePrefix);
  expect(bio.brand.androidAppId).toBe(gran.brand.androidAppId);
});
