import { describe, expect, it } from 'vitest';
import { createSolved, emptyId, isSolved, manhattan } from '../board';
import { defaultRng, mulberry32 } from '../rng';
import { shuffle } from '../shuffle';
import { countInversions, isSolvable } from '../solvability';
import type { GridSize } from '../types';

describe.each<GridSize>([3, 4])('mezcla %i × %i', (size) => {
  it('property: 10.000 seeds distintas, resolubles, no resueltas y con dificultad mínima', () => {
    const min = size === 3 ? 10 : 24;
    const moves = size === 3 ? 60 : 160;
    const expectedIds = createSolved(size).tiles;
    for (let seed = 0; seed < 10_000; seed++) {
      const state = shuffle(size, {
        moves,
        rng: mulberry32(seed),
        minManhattan: min,
      });
      expect(isSolvable(state), `seed=${seed}`).toBe(true);
      expect(isSolved(state), `seed=${seed}`).toBe(false);
      expect(manhattan(state), `seed=${seed}`).toBeGreaterThanOrEqual(min);
      expect(
        [...state.tiles].sort((a, b) => a - b),
        `seed=${seed}`,
      ).toEqual(expectedIds);
      expect(state.tiles[state.emptyIndex], `seed=${seed}`).toBe(emptyId(size));
    }
  }, 30_000);

  it('misma seed produce el mismo tablero y no comparte arrays', () => {
    const opts = { moves: size === 3 ? 60 : 160 };
    const a = shuffle(size, { ...opts, rng: mulberry32(42) });
    const b = shuffle(size, { ...opts, rng: mulberry32(42) });
    expect(a).toEqual(b);
    expect(a.tiles).not.toBe(b.tiles);
  });

  it('permutar dos fichas reales hace un tablero insoluble', () => {
    const state = createSolved(size);
    const tiles = state.tiles.slice();
    [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
    expect(countInversions(tiles, emptyId(size))).toBe(1);
    expect(isSolvable({ ...state, tiles })).toBe(false);
  });

  it('no devuelve un tablero bajo el mínimo si agota hardCap', () => {
    expect(() =>
      shuffle(size, { moves: 1, minManhattan: 1000, rng: mulberry32(1) }),
    ).toThrow(/No se alcanzó minManhattan/);
  });

  it('permite mínimo cero pero sigue rechazando el tablero resuelto', () => {
    const state = shuffle(size, {
      moves: 1,
      minManhattan: 0,
      rng: mulberry32(1),
    });
    expect(isSolved(state)).toBe(false);
    expect(isSolvable(state)).toBe(true);
  });
});

it('rechaza opciones que invalidan el contrato o impiden terminar', () => {
  for (const moves of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    expect(() => shuffle(3, { moves })).toThrow(RangeError);
  for (const minManhattan of [-1, NaN, Infinity])
    expect(() => shuffle(3, { moves: 60, minManhattan })).toThrow(RangeError);
  for (const value of [-1, 1, NaN, Infinity])
    expect(() => shuffle(3, { moves: 60, rng: () => value })).toThrow(/rng/);
});

it('mulberry32 es reproducible y permanece en [0, 1)', () => {
  const a = mulberry32(8675309),
    b = mulberry32(8675309);
  for (let i = 0; i < 1000; i++) {
    const value = a();
    expect(value).toBe(b());
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
});

it('defaultRng funciona con WebCrypto sin React ni DOM', () => {
  const value = defaultRng();
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThan(1);
});

it('countInversions ignora el hueco', () => {
  expect(countInversions([8, 0, 1, 2], 8)).toBe(0);
  expect(countInversions([2, 8, 1, 0], 8)).toBe(3);
});
