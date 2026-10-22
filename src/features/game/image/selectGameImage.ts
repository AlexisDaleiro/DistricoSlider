import type { BrandConfig } from '../../../brand/schema';
import { defaultRng, type Rng } from '../engine/rng';

export function selectGameImage(
  images: BrandConfig['game']['images'],
  rng: Rng = defaultRng,
) {
  if (!images.length)
    throw new Error('No hay imágenes de puzzle configuradas.');
  return images[Math.floor(rng() * images.length)];
}
