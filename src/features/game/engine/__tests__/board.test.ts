import { describe, expect, it } from 'vitest';
import {
  colOf,
  createSolved,
  emptyId,
  isSolved,
  manhattan,
  moveByDirection,
  moveTileAt,
  neighbors,
  rowOf,
  slideLineTo,
} from '../board';
import type { Direction, GridSize } from '../types';
import { isSolvable } from '../solvability';

describe.each<GridSize>([3, 4])('tablero %i × %i', (size) => {
  it('crea el estado resuelto con el hueco abajo a la derecha', () => {
    const state = createSolved(size);
    expect(state.tiles).toEqual(
      Array.from({ length: size * size }, (_, index) => index),
    );
    expect(state.emptyIndex).toBe(emptyId(size));
    expect(isSolved(state)).toBe(true);
    expect(isSolvable(state)).toBe(true);
    expect(manhattan(state)).toBe(0);
    expect(rowOf(state.emptyIndex, size)).toBe(size - 1);
    expect(colOf(state.emptyIndex, size)).toBe(size - 1);
  });

  it('vecinos ortogonales, sin cruzar filas ni bordes', () => {
    expect(neighbors(0, size)).toEqual([size, 1]);
    expect(neighbors(size - 1, size)).toEqual([size * 2 - 1, size - 2]);
    expect(neighbors(size + 1, size)).toEqual([
      1,
      2 * size + 1,
      size,
      size + 2,
    ]);
    for (const index of [-1, size * size, 0.5, NaN, Infinity])
      expect(neighbors(index, size)).toEqual([]);
  });

  it('rechaza movimientos no adyacentes y mantiene inmutable el original', () => {
    const state = createSolved(size);
    Object.freeze(state.tiles);
    Object.freeze(state);
    for (const index of [0, state.emptyIndex, -1, size * size, 0.5, NaN])
      expect(moveTileAt(state, index)).toBeNull();
    const next = moveTileAt(state, state.emptyIndex - 1)!;
    expect(next).not.toBe(state);
    expect(next.tiles).not.toBe(state.tiles);
    expect(next.emptyIndex).toBe(state.emptyIndex - 1);
    expect(next.tiles[state.emptyIndex]).toBe(state.emptyIndex - 1);
    expect(next.tiles[next.emptyIndex]).toBe(emptyId(size));
    expect(isSolved(state)).toBe(true);
    expect(isSolved(next)).toBe(false);
    expect(manhattan(next)).toBe(1);
    expect(moveTileAt(next, state.emptyIndex)).toEqual(state);
  });

  it('desliza una fila completa en ambas direcciones y cuenta cada ficha', () => {
    const state = createSolved(size);
    Object.freeze(state.tiles);
    const target = size * (size - 1);
    const result = slideLineTo(state, target)!;
    expect(result.moved).toBe(size - 1);
    expect(result.state.emptyIndex).toBe(target);
    expect(result.state.tiles.slice(target)).toEqual([
      emptyId(size),
      ...state.tiles.slice(target, -1),
    ]);
    expect(slideLineTo(result.state, state.emptyIndex)).toEqual({
      state,
      moved: size - 1,
    });
    expect(isSolved(state)).toBe(true);
  });

  it('desliza una columna completa en ambas direcciones', () => {
    const state = createSolved(size);
    const result = slideLineTo(state, size - 1)!;
    expect(result.moved).toBe(size - 1);
    for (let row = 1; row < size; row++)
      expect(result.state.tiles[row * size + size - 1]).toBe(
        (row - 1) * size + size - 1,
      );
    expect(result.state.tiles[size - 1]).toBe(emptyId(size));
    expect(slideLineTo(result.state, state.emptyIndex)).toEqual({
      state,
      moved: size - 1,
    });
  });

  it('rechaza diagonales, el hueco e índices fuera del tablero', () => {
    const state = createSolved(size);
    for (const index of [
      0,
      state.emptyIndex,
      -1,
      size * size,
      size * size + size - 1,
      0.5,
      NaN,
      Infinity,
    ])
      expect(slideLineTo(state, index)).toBeNull();
  });

  it('respeta las cuatro direcciones de gesto y sus bordes', () => {
    const solved = createSolved(size);
    expect(moveByDirection(solved, 'left')).toBeNull();
    expect(moveByDirection(solved, 'up')).toBeNull();
    expect(moveByDirection(solved, 'right')).toEqual(
      moveTileAt(solved, solved.emptyIndex - 1),
    );
    expect(moveByDirection(solved, 'down')).toEqual(
      moveTileAt(solved, solved.emptyIndex - size),
    );
    const topLeft = slideLineTo(slideLineTo(solved, size - 1)!.state, 0)!.state;
    expect(moveByDirection(topLeft, 'right')).toBeNull();
    expect(moveByDirection(topLeft, 'down')).toBeNull();
    expect(moveByDirection(topLeft, 'left')).toEqual(moveTileAt(topLeft, 1));
    expect(moveByDirection(topLeft, 'up')).toEqual(moveTileAt(topLeft, size));
    const inverse: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const state = slideLineTo(
        slideLineTo(solved, size * 2 - 1)!.state,
        size + 1,
      )!.state;
      const next = moveByDirection(state, dir)!;
      expect(moveByDirection(next, inverse[dir])).toEqual(state);
    }
  });
});
