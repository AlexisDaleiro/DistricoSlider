import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { reviewContrast } from '../src/brand/contrast.ts';
export { contrastRatio } from '../src/brand/contrast.ts';
import {
  brandIdSchema,
  brandSchema,
  type BrandConfig,
} from '../src/brand/schema.ts';

export const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);

export function parseBrand(raw: unknown): BrandConfig {
  const result = brandSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Configuración de marca inválida:\n${result.error.issues.map((issue) => `  - ${issue.path.join('.') || 'config'}: ${issue.message}`).join('\n')}`,
    );
  }
  return result.data;
}

/** Valida sin red ni mutaciones; se usa tanto desde CLI como antes de dev/build. */
export async function validateBrand(
  id: string,
  root = projectRoot,
  warn: (message: string) => void = console.warn,
): Promise<BrandConfig> {
  brandIdSchema.parse(id);
  const directory = resolve(root, 'brands', id);
  let raw: unknown;
  try {
    raw = JSON.parse(
      await readFile(resolve(directory, 'theme.config.json'), 'utf8'),
    );
  } catch (cause) {
    throw new Error(
      `No se pudo leer brands/${id}/theme.config.json: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
  const config = parseBrand(raw);
  if (config.brand.id !== id)
    throw new Error(`brand.id debe coincidir con la carpeta: ${id}.`);
  const paths = new Set([
    config.brand.logo,
    config.brand.logoOnPrimary,
    ...Object.values(config.theme.fonts).map((font) => font.file),
    ...config.attract.media,
    ...config.game.images.map((image) => image.src),
    ...(config.game.sounds.move ? [config.game.sounds.move] : []),
    ...(config.game.sounds.win ? [config.game.sounds.win] : []),
    ...(config.theme.backgroundImage ? [config.theme.backgroundImage] : []),
  ]);
  const canonicalDirectory = await realpath(directory);
  for (const path of paths) {
    try {
      const file = await realpath(resolve(directory, path));
      const rel = relative(canonicalDirectory, file);
      if (rel.startsWith('..') || isAbsolute(rel))
        throw new Error('El asset sale de la carpeta de marca.');
      const info = await stat(file);
      if (!info.isFile() || info.size === 0)
        throw new Error('El asset debe ser un archivo no vacío.');
      if (path.endsWith('.mp4') && info.size > 50 * 1024 * 1024)
        throw new Error('El video supera 50 MB.');
      if (path.endsWith('.woff2')) {
        const bytes = await readFile(file);
        if (bytes.toString('ascii', 0, 4) !== 'wOF2')
          throw new Error('La fuente no es un archivo WOFF2 válido.');
      }
      if (path.endsWith('.wav')) {
        const bytes = await readFile(file);
        if (
          bytes.length < 44 ||
          bytes.toString('ascii', 0, 4) !== 'RIFF' ||
          bytes.toString('ascii', 8, 12) !== 'WAVE'
        )
          throw new Error('El sonido no es un WAV válido.');
      }
      if (/\.(svg|png|jpe?g|webp)$/.test(path)) {
        const metadata = await sharp(await readFile(file)).metadata();
        if (
          config.game.images.some((image) => image.src === path) &&
          Math.min(metadata.width ?? 0, metadata.height ?? 0) < 1000
        )
          throw new Error(
            'El puzzle necesita al menos 1000 px en el lado menor.',
          );
      }
    } catch (cause) {
      throw new Error(
        `Asset inválido (${path}): ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }
  }
  if (
    config.attract.mode === 'video' &&
    !config.attract.media.some((path) => path.endsWith('.mp4'))
  )
    throw new Error('attract.media necesita un MP4 en modo video.');
  if (
    config.attract.mode === 'slideshow' &&
    config.attract.media.some((path) => !/\.(svg|png|jpe?g|webp)$/.test(path))
  )
    throw new Error('attract.media solo admite imágenes en modo slideshow.');
  for (const { pair, ratio } of reviewContrast(config)) {
    if (ratio < 4.5)
      warn(
        `Advertencia de contraste ${pair}: ${ratio.toFixed(2)}:1 (mínimo recomendado 4.5:1).`,
      );
  }
  return config;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const id = process.argv[2] ?? process.env.VITE_BRAND ?? 'demo';
    await validateBrand(id);
    console.log(
      `Marca "${id}" válida: configuración y assets locales verificados.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
