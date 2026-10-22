import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

export function installGameClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) =>
    window.clearTimeout(id),
  );
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly isPrimary: boolean;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
      this.isPrimary = options.isPrimary ?? true;
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
}

export function gesture(element: Element, dx = 0, dy = 0, pointerId = 1) {
  fireEvent.pointerDown(element, {
    clientX: 100,
    clientY: 100,
    pointerId,
    button: 0,
  });
  fireEvent.pointerUp(element, {
    clientX: 100 + dx,
    clientY: 100 + dy,
    pointerId,
    button: 0,
  });
}
