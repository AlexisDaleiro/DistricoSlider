// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSwipe } from '../ui/useSwipe';
import { gesture, installGameClock } from './testUtils';

beforeEach(installGameClock);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('clasifica las cuatro direcciones por eje dominante, incluido el umbral exacto', () => {
  const onSwipe = vi.fn(),
    onTap = vi.fn();
  function Surface() {
    return (
      <div
        data-testid="surface"
        {...useSwipe(onSwipe, { threshold: 24, onTap })}
      />
    );
  }
  render(<Surface />);
  const element = screen.getByTestId('surface');
  for (const [dx, dy] of [
    [24, 0],
    [-25, 8],
    [5, -40],
    [0, 30],
  ])
    gesture(element, dx, dy);
  expect(onSwipe.mock.calls.map(([direction]) => direction)).toEqual([
    'right',
    'left',
    'up',
    'down',
  ]);
  expect(onTap).not.toHaveBeenCalled();
  gesture(element, 23, 23);
  expect(onTap).toHaveBeenCalledOnce();
  expect(onSwipe).toHaveBeenCalledTimes(4);
});

it('cancela gestos interrumpidos e ignora otro dedo, botón secundario y movimiento deshabilitado', () => {
  const onSwipe = vi.fn(),
    onTap = vi.fn();
  function Surface({ disabled = false }) {
    return (
      <div
        data-testid="surface"
        {...useSwipe(onSwipe, { threshold: 24, onTap, disabled })}
      />
    );
  }
  const { rerender } = render(<Surface />);
  const element = screen.getByTestId('surface');
  fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 100 });
  fireEvent.pointerUp(element, { pointerId: 2, clientX: 200 });
  expect(onSwipe).not.toHaveBeenCalled();
  fireEvent.pointerCancel(element, { pointerId: 1 });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: 200 });
  fireEvent.pointerDown(element, { pointerId: 2, button: 2 });
  fireEvent.pointerUp(element, { pointerId: 2 });
  fireEvent.pointerDown(element, { pointerId: 2, button: 0, isPrimary: false });
  fireEvent.pointerUp(element, { pointerId: 2 });
  rerender(<Surface disabled />);
  gesture(element, 100, 0);
  expect(onTap).not.toHaveBeenCalled();
  expect(onSwipe).not.toHaveBeenCalled();
});
