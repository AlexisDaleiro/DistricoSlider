export interface FocalPoint {
  x: number;
  y: number;
}
export interface PreparedImage {
  readonly url: string;
  /** Libera esta referencia; el último consumidor revoca el objectURL. */
  release: () => void;
}

interface CacheEntry {
  references: number;
  promise: Promise<string>;
}
const cache = new Map<string, CacheEntry>();

export function squareCrop(
  width: number,
  height: number,
  focalPoint: FocalPoint,
) {
  const side = Math.min(width, height);
  return {
    x: Math.max(0, Math.min(width - side, focalPoint.x * width - side / 2)),
    y: Math.max(0, Math.min(height - side, focalPoint.y * height - side / 2)),
    side,
  };
}

async function createPreparedUrl(
  src: string,
  focalPoint: FocalPoint,
  size: number,
): Promise<string> {
  const source = new URL(src, window.location.href);
  if (source.origin !== window.location.origin)
    throw new Error('La imagen debe estar empaquetada en el origen local.');
  const response = await fetch(source.href);
  if (!response.ok)
    throw new Error(`No se pudo cargar la imagen local: ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  let blob: Blob;
  try {
    if (bitmap.width <= 0 || bitmap.height <= 0)
      throw new Error('La imagen no tiene dimensiones válidas.');
    const crop = squareCrop(bitmap.width, bitmap.height, focalPoint);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D no disponible.');
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.side,
      crop.side,
      0,
      0,
      size,
      size,
    );
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('No se pudo codificar la imagen.')),
        'image/webp',
        0.9,
      );
    });
  } finally {
    bitmap.close();
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return url;
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw cause;
  }
}

/** Una sola imagen cuadrada compartida por todas las fichas, nunca n² bitmaps. */
export async function prepareImage(
  src: string,
  focalPoint: FocalPoint,
  size = 1024,
): Promise<PreparedImage> {
  if (!Number.isInteger(size) || size <= 0 || size > 1536)
    throw new RangeError('El lado de la imagen debe estar entre 1 y 1536 px.');
  const key = JSON.stringify([src, focalPoint.x, focalPoint.y, size]);
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      references: 0,
      promise: createPreparedUrl(src, focalPoint, size),
    };
    cache.set(key, entry);
  }
  const ownedEntry = entry;
  ownedEntry.references++;
  let url: string;
  try {
    url = await ownedEntry.promise;
  } catch (cause) {
    ownedEntry.references--;
    if (cache.get(key) === ownedEntry) cache.delete(key);
    throw cause;
  }
  let released = false;
  return {
    url,
    release: () => {
      if (released) return;
      released = true;
      ownedEntry.references--;
      if (ownedEntry.references === 0) {
        if (cache.get(key) === ownedEntry) cache.delete(key);
        URL.revokeObjectURL(url);
      }
    },
  };
}
