// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameTimer } from '../useGameTimer';
import { formatDuration } from '../../../shared/lib/time';
import { installGameClock } from './testUtils';

beforeEach(installGameClock);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('no cuenta al montar; usa el primer start y stop devuelve ms exactos sin sumar animaciones', () => {
  const onTimeout = vi.fn();
  const { result } = renderHook(() =>
    useGameTimer({ maxDurationSec: 300, onTimeout }),
  );
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.elapsedMs).toBe(0);
  act(() => result.current.start());
  act(() => vi.advanceTimersByTime(1234));
  act(() => result.current.start());
  expect(result.current.elapsedMs).toBeGreaterThan(1100);
  let duration = 0;
  act(() => {
    duration = result.current.stop();
  });
  expect(duration).toBe(1234);
  expect(result.current.elapsedMs).toBe(1234);
  act(() => vi.advanceTimersByTime(3000));
  expect(result.current.elapsedMs).toBe(1234);
  expect(onTimeout).not.toHaveBeenCalled();
});

it('timeout una sola vez, sin dejar frames vivos', () => {
  const onTimeout = vi.fn();
  const { result, unmount } = renderHook(() =>
    useGameTimer({ maxDurationSec: 1, onTimeout }),
  );
  act(() => result.current.start());
  act(() => vi.advanceTimersByTime(1200));
  expect(onTimeout).toHaveBeenCalledOnce();
  expect(onTimeout.mock.calls[0][0]).toBeGreaterThan(1000);
  expect(result.current.isRunning).toBe(false);
  act(() => vi.advanceTimersByTime(5000));
  expect(onTimeout).toHaveBeenCalledOnce();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('desmontar cancela rAF sin ejecutar timeout', () => {
  const onTimeout = vi.fn();
  const { result, unmount } = renderHook(() =>
    useGameTimer({ maxDurationSec: 1, onTimeout }),
  );
  act(() => result.current.start());
  unmount();
  act(() => vi.advanceTimersByTime(5000));
  expect(onTimeout).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('formatea mm:ss.d, truncando décimas y respetando el cambio de minuto', () => {
  expect(formatDuration(0)).toBe('00:00.0');
  expect(formatDuration(59_999)).toBe('00:59.9');
  expect(formatDuration(60_000)).toBe('01:00.0');
  expect(formatDuration(125_678)).toBe('02:05.6');
});
