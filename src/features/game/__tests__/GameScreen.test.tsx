// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brand } from '../../../brand/brand';
import { createSolved, moveTileAt } from '../engine/board';
import type { GridSize } from '../engine/types';
import { GameScreen } from '../GameScreen';
import { CountdownScreen } from '../CountdownScreen';
import { gesture, installGameClock } from './testUtils';

let config = structuredClone(brand);
vi.mock('../../../brand/BrandProvider', () => ({ useBrand: () => config }));

beforeEach(() => {
  config = structuredClone(brand);
  installGameClock();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderGame(size: GridSize = 3) {
  const initialState = moveTileAt(createSolved(size), size * size - 2)!;
  const onFinish = vi.fn(),
    onExit = vi.fn();
  render(
    <GameScreen
      initialState={initialState}
      imageUrl="blob:test-puzzle"
      onFinish={onFinish}
      onExit={onExit}
    />,
  );
  return { onFinish, onExit, initialState };
}
const tileAt = (position: number) =>
  document.querySelector(`[data-position="${position}"]`)!;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe.each<GridSize>([3, 4])('UI con grilla %i', (size) => {
  it('solo un movimiento por tap/swipe, conserva los nodos por tileId y permite jugar durante la transición', () => {
    renderGame(size);
    const last = size * size - 1;
    const target = tileAt(last - 2);
    gesture(target);
    fireEvent.click(target, { detail: 1 });
    expect(screen.getByTestId('game-moves').textContent).toBe('1');
    expect(document.querySelector(`[data-tile-id="${last - 2}"]`)).toBe(target);
    // Gesto hacia la izquierda mueve la ficha a la derecha del hueco.
    gesture(tileAt(0), -60, 0);
    expect(screen.getByTestId('game-moves').textContent).toBe('2');
    expect(document.querySelectorAll('[data-tile-id]').length).toBe(
      size * size - 1,
    );
    expect((target as HTMLButtonElement).disabled).toBe(false);
  });

  it('un tap de fila y otro de columna suman todas las fichas intermedias', () => {
    renderGame(size);
    // El hueco empieza en la última fila, penúltima columna.
    fireEvent.click(tileAt(size * (size - 1)));
    expect(screen.getByTestId('game-moves').textContent).toBe(String(size - 2));
    fireEvent.click(tileAt(0));
    expect(screen.getByTestId('game-moves').textContent).toBe(
      String(size - 2 + size - 1),
    );
  });

  it('no inicia el reloj por un tap inválido; detecta victoria, bloquea input y revela imagen completa', () => {
    const { onFinish } = renderGame(size);
    fireEvent.click(tileAt(0));
    advance(5000);
    expect(screen.getByTestId('game-time').textContent).toBe('00:00.0');
    expect(screen.getByTestId('game-moves').textContent).toBe('0');
    fireEvent.click(tileAt(size * size - 3));
    advance(1234);
    expect(screen.getByTestId('game-time').textContent).not.toBe('00:00.0');
    fireEvent.click(tileAt(size * size - 1));
    expect(screen.getByTestId('game-moves').textContent).toBe('3');
    expect(screen.getByTestId('game-time').textContent).toBe('00:01.2');
    expect((tileAt(0) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(tileAt(0));
    expect(screen.getByTestId('game-moves').textContent).toBe('3');
    expect(
      (document.querySelector('.puzzle-reveal') as HTMLElement).style.opacity,
    ).toBe('0');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ver imagen' }), {
      pointerId: 2,
      button: 0,
    });
    expect(
      (document.querySelector('.puzzle-reveal') as HTMLElement).style.opacity,
    ).toBe('0');
    advance(config.game.tileAnimationMs);
    expect(
      (document.querySelector('.puzzle-reveal') as HTMLElement).style.opacity,
    ).toBe('1');
    advance(config.game.victoryAnimationMs);
    expect(screen.getByRole('status').textContent).toBe('¡Lo lograste!');
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      status: 'completed',
      moves: 3,
      durationMs: 1234,
    });
    advance(2000);
    expect(onFinish).toHaveBeenCalledOnce();
  });
});

it('preview solo durante el hold, libera en pointercancel, blur y teclado; el reloj continúa', () => {
  renderGame();
  fireEvent.click(tileAt(6));
  const button = screen.getByRole('button', { name: 'Ver imagen' });
  fireEvent.pointerDown(button, { pointerId: 2, button: 0 });
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(
    (document.querySelector('.puzzle-reveal') as HTMLElement).style.opacity,
  ).toBe('1');
  advance(1000);
  expect(screen.getByTestId('game-time').textContent).not.toBe('00:00.0');
  fireEvent.pointerUp(button, { pointerId: 2 });
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(
    (document.querySelector('.puzzle-reveal') as HTMLElement).style.opacity,
  ).toBe('0');
  fireEvent.keyDown(button, { key: ' ' });
  expect(button.getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyUp(button, { key: ' ' });
  expect(button.getAttribute('aria-pressed')).toBe('false');
  fireEvent.pointerDown(button, { pointerId: 2, button: 0 });
  fireEvent.pointerCancel(button, { pointerId: 2 });
  expect(button.getAttribute('aria-pressed')).toBe('false');
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.blur(button);
  expect(button.getAttribute('aria-pressed')).toBe('false');
});

it('timeout sin victoria; no sigue moviendo fichas ni llama dos veces al callback', () => {
  config.game.maxDurationSec = 1;
  const { onFinish } = renderGame();
  fireEvent.click(tileAt(6));
  advance(1100);
  expect(screen.getByRole('status').textContent).toBe('¡Gracias por jugar!');
  expect(onFinish).toHaveBeenCalledOnce();
  expect(onFinish.mock.calls[0][0]).toMatchObject({
    status: 'timeout',
    moves: 1,
  });
  fireEvent.click(tileAt(8));
  advance(5000);
  expect(screen.getByTestId('game-moves').textContent).toBe('1');
  expect(onFinish).toHaveBeenCalledOnce();
});

it('countdown muestra 3, 2, 1 con la imagen decodificada y limpia sus frames', () => {
  const onComplete = vi.fn();
  const { unmount } = render(
    <CountdownScreen imageUrl="blob:ready" onComplete={onComplete} />,
  );
  expect(screen.getByRole('status').textContent).toBe('3');
  advance(1008);
  expect(screen.getByRole('status').textContent).toBe('2');
  advance(1000);
  expect(screen.getByRole('status').textContent).toBe('1');
  advance(1000);
  expect(onComplete).toHaveBeenCalledOnce();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('no acepta victoria fuera de plazo si todavía no corrió el siguiente rAF', () => {
  config.game.maxDurationSec = 1;
  const { onFinish } = renderGame();
  fireEvent.click(tileAt(6));
  vi.spyOn(performance, 'now').mockReturnValue(1500);
  fireEvent.click(tileAt(8));
  expect(onFinish).toHaveBeenCalledExactlyOnceWith({
    status: 'timeout',
    moves: 1,
    durationMs: 1500,
  });
});

it('desmontar a mitad de victoria cancela la transición y los callbacks pendientes', () => {
  const onFinish = vi.fn();
  const { unmount } = render(
    <GameScreen
      initialState={moveTileAt(createSolved(3), 7)!}
      imageUrl="blob:ready"
      onExit={vi.fn()}
      onFinish={onFinish}
    />,
  );
  fireEvent.click(tileAt(8));
  unmount();
  advance(3000);
  expect(onFinish).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
