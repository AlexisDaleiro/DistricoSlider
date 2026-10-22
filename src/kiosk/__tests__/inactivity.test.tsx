// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  getIdleMs,
  markActivity,
  setCheckNow,
  startActivityTracking,
} from '../activityTracker';
import { useInactivity } from '../useInactivity';

beforeEach(() => {
  vi.useFakeTimers();
  markActivity();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

it('el tracker comparte listeners, registra en captura y no crea timers por movimiento', () => {
  const add = vi.spyOn(window, 'addEventListener');
  const stop = startActivityTracking();
  const stop2 = startActivityTracking();
  expect(
    add.mock.calls.filter(([event]) => event === 'pointermove'),
  ).toHaveLength(1);
  const child = document.createElement('button');
  document.body.append(child);
  child.addEventListener('pointerdown', (event) => event.stopPropagation());
  advance(500);
  fireEvent.pointerDown(child);
  expect(getIdleMs()).toBe(0);
  stop();
  advance(500);
  fireEvent.pointerMove(window);
  expect(getIdleMs()).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  stop2();
  stop2();
  advance(500);
  fireEvent.pointerMove(window);
  expect(getIdleMs()).toBe(500);
  child.remove();
});

it('avisa en el umbral, actividad/keepAlive renuevan el plazo, timeout dispara una vez', () => {
  const stop = startActivityTracking();
  const onTimeout = vi.fn();
  const { result } = renderHook(() =>
    useInactivity({
      timeoutMs: 5000,
      warningMs: 2000,
      enabled: true,
      onTimeout,
    }),
  );
  advance(2999);
  expect(result.current.secondsLeft).toBeNull();
  advance(1);
  expect(result.current.secondsLeft).toBe(2);
  fireEvent.pointerDown(window);
  advance(250);
  expect(result.current.secondsLeft).toBeNull();
  advance(3000);
  expect(result.current.secondsLeft).toBe(2);
  act(() => result.current.keepAlive());
  expect(result.current.secondsLeft).toBeNull();
  advance(5000);
  expect(onTimeout).toHaveBeenCalledTimes(1);
  advance(10000);
  expect(onTimeout).toHaveBeenCalledTimes(1);
  stop();
});

it('un rerender con callback nuevo no reinicia el plazo y una nueva pantalla sí', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { result, rerender } = renderHook(
    ({ callback, key }) =>
      useInactivity({
        timeoutMs: 5000,
        warningMs: 2000,
        enabled: true,
        onTimeout: callback,
        activityKey: key,
      }),
    { initialProps: { callback: first, key: 'form' } },
  );
  advance(2500);
  rerender({ callback: second, key: 'form' });
  advance(2500);
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  rerender({ callback: second, key: 'game' });
  advance(3000);
  expect(result.current.secondsLeft).toBe(2);
});

it('volver visible comprueba el deadline inmediatamente sin marcar actividad ni esperar interval', () => {
  const stop = startActivityTracking();
  const callback = vi.fn();
  renderHook(() =>
    useInactivity({
      timeoutMs: 5000,
      warningMs: 2000,
      enabled: true,
      onTimeout: callback,
    }),
  );
  // Simula suspensión de JS: transcurre el reloj sin ejecutar los intervalos.
  vi.spyOn(performance, 'now').mockReturnValue(6000);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(callback).toHaveBeenCalledTimes(1);
  stop();
});

it('ATTRACT deshabilita aviso; StrictMode y desmontaje eliminan timers y checkNow obsoletos', () => {
  const callback = vi.fn();
  const { result, rerender, unmount } = renderHook(
    ({ enabled }) =>
      useInactivity({
        timeoutMs: 5000,
        warningMs: 2000,
        enabled,
        onTimeout: callback,
      }),
    { initialProps: { enabled: true }, wrapper: StrictMode },
  );
  expect(vi.getTimerCount()).toBe(1);
  advance(3000);
  expect(result.current.secondsLeft).toBe(2);
  rerender({ enabled: false });
  advance(10000);
  expect(result.current.secondsLeft).toBeNull();
  expect(callback).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  rerender({ enabled: true });
  unmount();
  const check = vi.fn();
  const clear = setCheckNow(check);
  clear();
  advance(10000);
  expect(callback).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
