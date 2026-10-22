import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cp, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import {
  contrastRatio,
  parseBrand,
  projectRoot,
  validateBrand,
} from './validate-brand';
import raw from '../brands/demo/theme.config.json';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kiosk-brand-test-'));
  await cp(resolve(projectRoot, 'brands/demo'), join(root, 'brands/demo'), {
    recursive: true,
  });
});
afterEach(async () => {
  if (!root.startsWith(join(tmpdir(), 'kiosk-brand-test-')))
    throw new Error('Directorio temporal inesperado.');
  await rm(root, { recursive: true, force: true });
});

it('valida todos los assets de demo y template sin advertencias', async () => {
  const warn = vi.fn();
  expect((await validateBrand('demo', root, warn)).brand.id).toBe('demo');
  expect((await validateBrand('_template', projectRoot, warn)).brand.id).toBe(
    '_template',
  );
  expect((await validateBrand('districo', projectRoot, warn)).brand.id).toBe(
    'districo',
  );
  expect(warn).not.toHaveBeenCalled();
});

it('un config inválido falla con la ruta exacta y un error legible', () => {
  expect(() =>
    parseBrand({ ...raw, game: { ...raw.game, gridSize: 5 } }),
  ).toThrow(/Configuración de marca inválida:[\s\S]*game.gridSize/);
});

it('reporta archivo de config ausente y JSON roto', async () => {
  await expect(validateBrand('missing', root)).rejects.toThrow(
    /No se pudo leer brands\/missing\/theme.config.json/,
  );
  await writeFile(join(root, 'brands/demo/theme.config.json'), '{');
  await expect(validateBrand('demo', root)).rejects.toThrow(/No se pudo leer/);
});

it('rechaza ids que salen de brands y discrepancias de carpeta', async () => {
  await expect(validateBrand('../demo', root)).rejects.toThrow();
  await writeFile(
    join(root, 'brands/demo/theme.config.json'),
    JSON.stringify({ ...raw, brand: { ...raw.brand, id: 'other' } }),
  );
  await expect(validateBrand('demo', root)).rejects.toThrow(
    /brand.id debe coincidir/,
  );
});

it('reporta assets ausentes con la ruta del config', async () => {
  await rm(join(root, 'brands/demo/assets/logo.svg'));
  await expect(validateBrand('demo', root)).rejects.toThrow(
    /Asset inválido \(assets\/logo.svg\)/,
  );
});

it('rechaza puzzles de menos de 1000 px del lado menor', async () => {
  await sharp({
    create: { width: 1200, height: 999, channels: 3, background: '#112233' },
  })
    .webp()
    .toFile(join(root, 'brands/demo/assets/puzzle/hero.webp'));
  await expect(validateBrand('demo', root)).rejects.toThrow(/al menos 1000 px/);
});

it('rechaza fuentes corruptas', async () => {
  await writeFile(
    join(root, 'brands/demo', raw.theme.fonts.body.file),
    'not a font',
  );
  await expect(validateBrand('demo', root)).rejects.toThrow(/WOFF2 válido/);
});

it('rechaza videos mayores a 50 MB', async () => {
  const file = await open(
    join(root, 'brands/demo/assets/attract/loop.mp4'),
    'w',
  );
  await file.truncate(50 * 1024 * 1024 + 1);
  await file.close();
  await writeFile(
    join(root, 'brands/demo/theme.config.json'),
    JSON.stringify({
      ...raw,
      attract: {
        ...raw.attract,
        mode: 'video',
        media: ['assets/attract/loop.mp4'],
      },
    }),
  );
  await expect(validateBrand('demo', root)).rejects.toThrow(/supera 50 MB/);
});

it('el bajo contraste avisa y permite continuar', async () => {
  const config = JSON.parse(
    await readFile(join(root, 'brands/demo/theme.config.json'), 'utf8'),
  ) as typeof raw;
  config.theme.colors.primary = config.theme.colors.onPrimary;
  const warn = vi.fn();
  await writeFile(
    join(root, 'brands/demo/theme.config.json'),
    JSON.stringify(config),
  );
  await expect(validateBrand('demo', root, warn)).resolves.toBeDefined();
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining(
      'Advertencia de contraste primary/onPrimary: 1.00:1',
    ),
  );
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21);
});

it('rechaza un sonido local corrupto aunque esté deshabilitado', async () => {
  await writeFile(
    join(root, 'brands/demo/assets/sounds/win.wav'),
    'RIFFincorrecto',
  );
  await expect(validateBrand('demo', root)).rejects.toThrow(
    'El sonido no es un WAV válido',
  );
});
