// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { observeResources, stableResources } from '../resources';
let stop = () => {};
afterEach(() => {
  stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('observa y libera timers/frames/URLs/listeners globales sin retener nodos', async () => {
  const BaseURL = URL;
  vi.stubGlobal(
    'URL',
    class extends BaseURL {
      static createObjectURL = vi.fn(() => 'blob:qa');
      static revokeObjectURL = vi.fn();
    },
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 101),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const original = window.setTimeout,
    originalAdd = EventTarget.prototype.addEventListener;
  const monitor = observeResources();
  stop = monitor.stop;
  const base = monitor.sample(0);
  const callback = vi.fn();
  window.addEventListener('qa-event', callback);
  window.addEventListener('qa-event', callback);
  const url = URL.createObjectURL(new Blob(['x']));
  const timeout = window.setTimeout(callback, 10000),
    interval = window.setInterval(callback, 10000);
  const frame = requestAnimationFrame(callback);
  const active = monitor.sample(1);
  expect(active.listeners).toBe(1);
  expect(active.urls).toBe(1);
  expect(active.timeouts).toBeGreaterThanOrEqual(1);
  expect(active.intervals).toBe(1);
  expect(active.frames).toBe(1);
  expect(stableResources([base, active])).toBe(false);
  window.clearTimeout(timeout);
  window.clearInterval(interval);
  cancelAnimationFrame(frame);
  URL.revokeObjectURL(url);
  window.removeEventListener('qa-event', callback);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 1));
  expect(stableResources([base, monitor.sample(2)])).toBe(true);
  monitor.stop();
  monitor.stop();
  expect(window.setTimeout).toBe(original);
  expect(EventTarget.prototype.addEventListener).toBe(originalAdd);
});
