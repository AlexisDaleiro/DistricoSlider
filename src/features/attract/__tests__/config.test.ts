import { expect, it } from 'vitest';
import raw from '../../../../brands/demo/theme.config.json';
import { brandSchema } from '../../../brand/schema';

it('marcas existentes reciben portada configurable por defecto y permiten omitir medios', () => {
  const config = brandSchema.parse({
    ...raw,
    attract: { ...raw.attract, media: undefined },
  });
  expect(config.attract).toMatchObject({
    media: [],
    startButton: 'Empezar juego',
    rankingButton: 'Ver ranking',
    backButton: 'Volver',
    animation: 'puzzle-assemble',
    animationCycleMs: 9000,
  });
  for (const animation of ['unknown', 'video'])
    expect(
      brandSchema.safeParse({ ...raw, attract: { ...raw.attract, animation } })
        .success,
    ).toBe(false);
  expect(
    brandSchema.safeParse({
      ...raw,
      attract: { ...raw.attract, animationCycleMs: 0 },
    }).success,
  ).toBe(false);
});
