import { describe, expect, it } from 'vitest';
import raw from '../../../brands/demo/theme.config.json';
import template from '../../../brands/_template/theme.config.json';
import { brandSchema } from '../schema';
import { defaultTexts } from '../defaultTexts';
import { asset, brand } from '../brand';
import { t } from '../t';

describe('contrato white-label', () => {
  it('acepta demo y _template, y aplica los textos españoles por defecto', () => {
    for (const config of [raw, template]) {
      expect(brandSchema.parse(config).texts['game.moves']).toBe(
        defaultTexts['game.moves'],
      );
    }
    expect(brand.texts['showcase.eyebrow']).toBeDefined();
  });

  it('permite omitir texts y sobreescribir un texto sin perder los demás', () => {
    expect(brandSchema.parse({ ...raw, texts: undefined }).texts).toEqual(
      defaultTexts,
    );
    const parsed = brandSchema.parse({
      ...raw,
      texts: { 'game.moves': 'Pasos' },
    });
    expect(parsed.texts['game.moves']).toBe('Pasos');
    expect(parsed.texts['common.finish']).toBe('Terminar');
  });

  it('rechaza colores, grillas y mínimos de mezcla inválidos', () => {
    expect(
      brandSchema.safeParse({
        ...raw,
        theme: {
          ...raw.theme,
          colors: { ...raw.theme.colors, primary: 'red' },
        },
      }).success,
    ).toBe(false);
    expect(
      brandSchema.safeParse({ ...raw, game: { ...raw.game, gridSize: 5 } })
        .success,
    ).toBe(false);
    expect(
      brandSchema.safeParse({
        ...raw,
        game: { ...raw.game, shuffleMoves: { '4': 160 } },
      }).success,
    ).toBe(false);
    expect(
      brandSchema.safeParse({
        ...raw,
        game: { ...raw.game, shuffleMoves: { '3': 0 } },
      }).success,
    ).toBe(false);
  });

  it('exige name, email e ids únicos', () => {
    for (const fields of [
      raw.form.fields.filter((field) => field.id !== 'name'),
      raw.form.fields.filter((field) => field.id !== 'email'),
      [...raw.form.fields, raw.form.fields[0]],
      [
        ...raw.form.fields,
        { id: 'otherEmail', type: 'email', label: 'Otro', required: false },
      ],
    ]) {
      expect(
        brandSchema.safeParse({ ...raw, form: { ...raw.form, fields } })
          .success,
      ).toBe(false);
    }
  });

  it('rechaza URLs, escapes de carpeta, PIN y tiempos inválidos', () => {
    for (const logo of [
      'https://example.com/logo.svg',
      '../logo.svg',
      'assets/../logo.svg',
      'assets\\logo.svg',
    ])
      expect(
        brandSchema.safeParse({ ...raw, brand: { ...raw.brand, logo } })
          .success,
      ).toBe(false);
    expect(brandSchema.safeParse({ ...raw, adminPin: '0000' }).success).toBe(
      false,
    );
    expect(
      brandSchema.safeParse({
        ...raw,
        kiosk: { ...raw.kiosk, warningMs: 90000 },
      }).success,
    ).toBe(false);
  });

  it('resuelve assets del bundle y falla explícitamente si faltan', () => {
    expect(asset(brand.brand.logo)).toContain('logo.svg');
    expect(asset(brand.theme.fonts.body.file)).toContain('.woff2');
    expect(() => asset('assets/missing.webp')).toThrow(/Asset no encontrado/);
  });

  it('interpola textos, conserva variables faltantes y rechaza claves ausentes', () => {
    expect(t('result.rank', { rank: 3 })).toBe('Quedaste en el puesto 3');
    expect(t('result.rank')).toBe('Quedaste en el puesto {rank}');
    expect(() => t('missing')).toThrow(/Texto no encontrado/);
  });
});
