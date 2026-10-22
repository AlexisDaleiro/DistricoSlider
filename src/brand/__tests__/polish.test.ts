import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { brandSchema } from '../schema';
import { reviewContrast } from '../contrast';
import { projectRoot, validateBrand } from '../../../scripts/validate-brand';
import { soundWav } from '../../../scripts/generate-sounds';
import raw from '../../../brands/demo/theme.config.json';
it.each(['demo', '_template', 'districo'])(
  '%s cumple 12 combinaciones de texto y mantiene sonidos apagados',
  async (id) => {
    const config = await validateBrand(id);
    expect(reviewContrast(config)).toHaveLength(12);
    for (const pair of reviewContrast(config))
      expect(pair.ratio, pair.pair).toBeGreaterThanOrEqual(pair.minimum);
    expect(config.game.sounds.enabled).toBe(false);
  },
);
it('sonidos son opcionales, locales y requieren ambos WAV al habilitarlos', () => {
  const copy = structuredClone(raw) as Omit<typeof raw, 'game'> & {
    game: Omit<typeof raw.game, 'sounds'> & { sounds?: unknown };
  };
  delete copy.game.sounds;
  expect(brandSchema.parse(copy).game.sounds).toEqual({ enabled: false });
  copy.game.sounds = { enabled: true };
  expect(brandSchema.safeParse(copy).success).toBe(false);
  copy.game.sounds = {
    enabled: true,
    move: 'https://server/move.wav',
    win: 'assets/sounds/win.wav',
  };
  expect(brandSchema.safeParse(copy).success).toBe(false);
});
it('el generador produce WAV mono PCM completo y reproducible', async () => {
  for (const kind of ['move', 'win'] as const) {
    const wav = soundWav(kind);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(
      await readFile(
        resolve(projectRoot, `brands/demo/assets/sounds/${kind}.wav`),
      ),
    ).toEqual(wav);
  }
});
