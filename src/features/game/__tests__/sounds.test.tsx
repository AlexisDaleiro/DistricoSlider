// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { brand } from '../../../brand/brand';
import { useGameSounds } from '../useGameSounds';
import { GameScreen } from '../GameScreen';
import { createSolved, moveTileAt } from '../engine/board';
let config = structuredClone(brand);
vi.mock('../../../brand/BrandProvider', () => ({ useBrand: () => config }));
const instances: {
  src: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
}[] = [];
beforeEach(() => {
  config = structuredClone(brand);
  instances.length = 0;
  vi.stubGlobal(
    'Audio',
    class {
      currentTime = 0;
      preload = '';
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      load = vi.fn();
      removeAttribute = vi.fn();
      constructor(public src: string) {
        instances.push(this);
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('apagado no crea reproductores; habilitado reutiliza y libera al desmontar', async () => {
  const first = renderHook(() => useGameSounds());
  act(() => first.result.current('move'));
  expect(instances).toHaveLength(0);
  first.unmount();
  config.game.sounds.enabled = true;
  const second = renderHook(() => useGameSounds());
  act(() => {
    second.result.current('move');
    second.result.current('move');
  });
  expect(instances).toHaveLength(1);
  expect(instances[0].play).toHaveBeenCalledTimes(2);
  instances[0].play.mockRejectedValue(new Error('autoplay'));
  await act(async () => second.result.current('move'));
  second.unmount();
  expect(instances[0].pause).toHaveBeenCalledOnce();
  expect(instances[0].removeAttribute).toHaveBeenCalledWith('src');
});
it('inválido no suena, movimiento válido usa move y victoria usa win', () => {
  config.game.sounds.enabled = true;
  const initial = moveTileAt(moveTileAt(createSolved(3), 7)!, 6)!;
  render(
    <GameScreen
      initialState={initial}
      imageUrl="blob:puzzle"
      onExit={() => {}}
    />,
  );
  fireEvent.click(document.querySelector('[data-position="4"]')!);
  expect(instances).toHaveLength(0);
  fireEvent.click(document.querySelector('[data-position="7"]')!);
  fireEvent.click(document.querySelector('[data-position="8"]')!);
  expect(instances.map((audio) => audio.src)).toEqual([
    expect.stringContaining('move.wav'),
    expect.stringContaining('win.wav'),
  ]);
});
