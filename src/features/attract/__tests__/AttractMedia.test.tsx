// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { brand, asset } from '../../../brand/brand';
import { AttractMedia } from '../AttractMedia';
import { AttractScreen } from '../AttractScreen';

vi.mock('../../../brand/brand', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../brand/brand')>();
  return {
    ...original,
    asset: (path: string) =>
      path.endsWith('.mp4') ? '/local-test.mp4' : original.asset(path),
  };
});

const original = structuredClone(brand.attract);
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  Object.assign(brand.attract, structuredClone(original));
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('slideshow usa el intervalo del config y libera su timer al desmontar', () => {
  brand.attract.mode = 'slideshow';
  brand.attract.media = ['assets/attract/cover.webp', brand.game.images[0].src];
  const { unmount } = render(<AttractMedia />);
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.attract.media[0]),
  );
  act(() => vi.advanceTimersByTime(brand.attract.slideIntervalMs));
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.attract.media[1]),
  );
  act(() => vi.advanceTimersByTime(brand.attract.slideIntervalMs));
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.attract.media[0]),
  );
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('el slideshow se detiene mientras el fondo no está activo', () => {
  brand.attract.media = ['assets/attract/cover.webp', brand.game.images[0].src];
  const mounted = render(<AttractMedia active={false} />);
  act(() => vi.advanceTimersByTime(brand.attract.slideIntervalMs * 2));
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.attract.media[0]),
  );
  mounted.rerender(<AttractMedia active />);
  act(() => vi.advanceTimersByTime(brand.attract.slideIntervalMs));
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.attract.media[1]),
  );
});

it('video local tiene atributos kiosco y cae a slideshow si autoplay se rechaza', async () => {
  brand.attract.mode = 'video';
  // asset() se simula solo para el video, sin incorporar medios ficticios al producto.
  brand.attract.media = [
    brand.attract.media[0].replace('.webp', '.mp4'),
    brand.game.images[0].src,
  ];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
    new Error('autoplay denied'),
  );
  const mounted = render(<AttractMedia />);
  const video = mounted.container.querySelector('video')!;
  expect(video.muted).toBe(true);
  for (const attr of ['playsinline', 'loop', 'autoplay', 'preload'])
    expect(video.hasAttribute(attr)).toBe(true);
  await act(async () => {});
  expect(mounted.container.querySelector('video')).toBeNull();
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.game.images[0].src),
  );
});

it('sin imágenes reproducibles cae al logo y finalmente al nombre si también falla', () => {
  brand.attract.media = [];
  render(<AttractMedia />);
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    asset(brand.brand.logo),
  );
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText(brand.brand.name)).toBeTruthy();
});

it('solo el botón de empezar inicia; encabezado y ranking no disparan el inicio', () => {
  const onStart = vi.fn();
  const onLeaderboard = vi.fn();
  render(
    <AttractScreen
      startError={false}
      onStart={onStart}
      onLeaderboard={onLeaderboard}
    />,
  );
  fireEvent.click(screen.getByText(brand.brand.appName));
  expect(onStart).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: brand.attract.startButton }),
  );
  expect(onStart).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole('button', { name: brand.attract.rankingButton }),
  );
  expect(onLeaderboard).toHaveBeenCalledTimes(1);
  expect(onStart).toHaveBeenCalledTimes(1);
});
