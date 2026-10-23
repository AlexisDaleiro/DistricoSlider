// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { brand, asset } from '../../../brand/brand';
import { AttractPuzzle } from '../AttractPuzzle';
import { prepareImage } from '../../game/image/prepareImage';

vi.mock('../../game/image/prepareImage', () => ({ prepareImage: vi.fn() }));
const original = structuredClone(brand.attract);
const release = vi.fn();
const motions: {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
}[] = [];
let animate: ReturnType<typeof vi.fn>;
beforeEach(() => {
  motions.length = 0;
  release.mockClear();
  vi.mocked(prepareImage).mockResolvedValue({
    url: 'blob:square-puzzle',
    release,
  });
  animate = vi.fn(() => {
    const motion = { play: vi.fn(), pause: vi.fn(), cancel: vi.fn() };
    motions.push(motion);
    return motion;
  });
  vi.stubGlobal('IntersectionObserver', undefined);
  Object.defineProperty(Element.prototype, 'animate', {
    value: animate,
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  Object.assign(brand.attract, original);
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).animate;
});
const props = () => ({
  image: brand.game.images[0],
  size: 3 as const,
  visible: true,
  reducedMotion: false,
});

it('reutiliza el recorte del juego, reparte un único bitmap y solo anima transform/opacity en el ciclo configurable', async () => {
  brand.attract.animationCycleMs = 10000;
  const mounted = render(<AttractPuzzle {...props()} />);
  await waitFor(() => expect(animate).toHaveBeenCalledTimes(11));
  expect(prepareImage).toHaveBeenCalledWith(
    asset(brand.game.images[0].src),
    brand.game.images[0].focalPoint,
  );
  const tiles = mounted.container.querySelectorAll<HTMLElement>(
    '[data-attract-tile]',
  );
  expect(tiles).toHaveLength(9);
  expect(tiles[0].style.backgroundPosition).toBe('0% 0%');
  expect(tiles[8].style.backgroundPosition).toBe('100% 100%');
  for (const [frames, options] of animate.mock.calls) {
    expect(options).toMatchObject({ duration: 10000, iterations: Infinity });
    for (const frame of frames)
      expect(
        Object.keys(frame)
          .filter((key) => key !== 'offset')
          .every((key) => ['transform', 'opacity'].includes(key)),
      ).toBe(true);
  }
  mounted.unmount();
  expect(release).toHaveBeenCalledOnce();
  expect(motions.every((motion) => motion.cancel.mock.calls.length === 1)).toBe(
    true,
  );
});
it('pausa al ocultarse y reanuda sin reconstruir las animaciones', async () => {
  const mounted = render(<AttractPuzzle {...props()} />);
  await waitFor(() => expect(animate).toHaveBeenCalledTimes(11));
  mounted.rerender(<AttractPuzzle {...props()} visible={false} />);
  expect(motions.every((motion) => motion.pause.mock.calls.length === 1)).toBe(
    true,
  );
  mounted.rerender(<AttractPuzzle {...props()} />);
  expect(animate).toHaveBeenCalledTimes(11);
  expect(motions.every((motion) => motion.play.mock.calls.length === 2)).toBe(
    true,
  );
});
it('none y movimiento reducido muestran la imagen armada sin crear animaciones', async () => {
  const mounted = render(<AttractPuzzle {...props()} reducedMotion />);
  await act(async () => {});
  expect(animate).not.toHaveBeenCalled();
  expect(
    mounted.container.querySelector('[data-motion="static"]'),
  ).toBeTruthy();
  expect(
    mounted.container
      .querySelector('[data-attract-complete]')
      ?.getAttribute('src'),
  ).toBe('blob:square-puzzle');
  brand.attract.animation = 'none';
  mounted.rerender(<AttractPuzzle {...props()} />);
  expect(animate).not.toHaveBeenCalled();
});
