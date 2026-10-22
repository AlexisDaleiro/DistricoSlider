// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prepareImage, squareCrop } from '../image/prepareImage';
import { usePreparedImage } from '../image/usePreparedImage';

const drawImage = vi.fn(),
  close = vi.fn(),
  decode = vi.fn();
const createUrl = vi.fn(),
  revokeUrl = vi.fn(),
  fetchImage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  decode.mockResolvedValue(undefined);
  createUrl.mockImplementation(
    () => `blob:prepared-${createUrl.mock.calls.length}`,
  );
  fetchImage.mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['source']),
    status: 200,
  });
  vi.stubGlobal('fetch', fetchImage);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 1600, height: 1200, close }),
  );
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = decode;
    },
  );
  const BaseURL = URL;
  vi.stubGlobal(
    'URL',
    class extends BaseURL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['webp'], { type: 'image/webp' })),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('recorte cuadrado centrado y limitado por los bordes para ambas orientaciones', () => {
  expect(squareCrop(1600, 1200, { x: 0.5, y: 0.5 })).toEqual({
    x: 200,
    y: 0,
    side: 1200,
  });
  expect(squareCrop(1600, 1200, { x: 0, y: 0 })).toEqual({
    x: 0,
    y: 0,
    side: 1200,
  });
  expect(squareCrop(1200, 1600, { x: 1, y: 1 })).toEqual({
    x: 0,
    y: 400,
    side: 1200,
  });
});

it('prepara 1024×1024, WebP 0.9, cierra bitmap, decodifica y comparte la caché concurrente', async () => {
  const [a, b] = await Promise.all([
    prepareImage('/assets/hero.webp', { x: 0.5, y: 0.5 }),
    prepareImage('/assets/hero.webp', { x: 0.5, y: 0.5 }),
  ]);
  expect(a.url).toBe(b.url);
  expect(fetchImage).toHaveBeenCalledOnce();
  expect(drawImage.mock.calls[0].slice(1)).toEqual([
    200, 0, 1200, 1200, 0, 0, 1024, 1024,
  ]);
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
    expect.any(Function),
    'image/webp',
    0.9,
  );
  expect(close).toHaveBeenCalledOnce();
  expect(decode).toHaveBeenCalledOnce();
  a.release();
  a.release();
  expect(revokeUrl).not.toHaveBeenCalled();
  b.release();
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith(a.url);
});

it('incluye focalPoint en la clave y respeta el límite de tamaño', async () => {
  const a = await prepareImage('/assets/focal.webp', { x: 0, y: 0.5 });
  const b = await prepareImage('/assets/focal.webp', { x: 1, y: 0.5 }, 1536);
  expect(fetchImage).toHaveBeenCalledTimes(2);
  expect(drawImage.mock.calls[1].slice(1)).toEqual([
    400, 0, 1200, 1200, 0, 0, 1536, 1536,
  ]);
  a.release();
  b.release();
  await expect(
    prepareImage('/assets/focal.webp', { x: 0, y: 0 }, 1537),
  ).rejects.toThrow(RangeError);
});

it('falla sin red externa, y permite reintentar un fallo de fetch local', async () => {
  await expect(
    prepareImage('https://external.invalid/image.webp', { x: 0.5, y: 0.5 }),
  ).rejects.toThrow(/origen local/);
  expect(fetchImage).not.toHaveBeenCalled();
  fetchImage.mockResolvedValueOnce({ ok: false, status: 404 });
  await expect(
    prepareImage('/missing.webp', { x: 0.5, y: 0.5 }),
  ).rejects.toThrow(/404/);
  const resource = await prepareImage('/missing.webp', { x: 0.5, y: 0.5 });
  resource.release();
});

it('revoca el objectURL si decode falla', async () => {
  decode.mockRejectedValueOnce(new Error('decode failed'));
  await expect(
    prepareImage('/decode.webp', { x: 0.5, y: 0.5 }),
  ).rejects.toThrow(/decode failed/);
  expect(revokeUrl).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});

it('cierra el bitmap incluso si Canvas no puede codificar', async () => {
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce(
    (callback) => callback(null),
  );
  await expect(
    prepareImage('/encode.webp', { x: 0.5, y: 0.5 }),
  ).rejects.toThrow(/codificar/);
  expect(close).toHaveBeenCalledOnce();
  expect(createUrl).not.toHaveBeenCalled();
});

it('cambiar de imagen retira la anterior sin mostrar una URL obsoleta', async () => {
  function ImageState({ src }: { src: string }) {
    const image = usePreparedImage(src, 0.5, 0.5);
    return <span>{image.url ?? 'loading'}</span>;
  }
  const mounted = render(<ImageState src="/first.webp" />);
  await act(async () => {});
  expect(screen.getByText('blob:prepared-1')).toBeDefined();
  mounted.rerender(<ImageState src="/second.webp" />);
  expect(screen.queryByText('blob:prepared-1')).toBeNull();
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:prepared-1');
  await act(async () => {});
  expect(screen.getByText('blob:prepared-2')).toBeDefined();
  mounted.unmount();
  expect(revokeUrl).toHaveBeenCalledTimes(2);
});

it('StrictMode comparte la carga y desmontar libera también los resultados tardíos', async () => {
  function ImageState() {
    const image = usePreparedImage('/strict.webp', 0.5, 0.5);
    return <span>{image.url ?? 'loading'}</span>;
  }
  let unmount = () => {};
  await act(async () => {
    ({ unmount } = render(
      <StrictMode>
        <ImageState />
      </StrictMode>,
    ));
  });
  expect(screen.getByText('blob:prepared-1')).toBeDefined();
  expect(createUrl).toHaveBeenCalledOnce();
  expect(revokeUrl).not.toHaveBeenCalled();
  unmount();
  expect(revokeUrl).toHaveBeenCalledOnce();
  let finishDecode: (() => void) | undefined;
  decode.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishDecode = resolve;
      }),
  );
  const mounted = render(<ImageState />);
  await act(async () => {});
  expect(finishDecode).toBeDefined();
  mounted.unmount();
  await act(async () => {
    finishDecode?.();
  });
  expect(revokeUrl).toHaveBeenCalledTimes(2);
});
