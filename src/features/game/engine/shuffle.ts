import { createSolved, neighbors, isSolved, manhattan } from './board';
import type { GridSize, PuzzleState } from './types';
import { defaultRng, type Rng } from './rng';

export interface ShuffleOptions {
  moves: number;
  rng?: Rng;
  minManhattan?: number;
}

/** Mezcla por movimientos reversibles, sin deshacer el paso anterior. */
export function shuffle(size: GridSize, opts: ShuffleOptions): PuzzleState {
  const rng = opts.rng ?? defaultRng;
  const minM = opts.minManhattan ?? (size === 3 ? 10 : 24);
  if (
    !Number.isSafeInteger(opts.moves) ||
    opts.moves <= 0 ||
    opts.moves > Number.MAX_SAFE_INTEGER / 10
  )
    throw new RangeError(
      'moves debe ser un entero positivo con límite seguro.',
    );
  if (!Number.isFinite(minM) || minM < 0)
    throw new RangeError('minManhattan debe ser finito y no negativo.');
  const tiles = createSolved(size).tiles.slice();
  let empty = size * size - 1;
  let prev = -1;
  const hardCap = opts.moves * 10;
  const current = (): PuzzleState => ({
    size,
    tiles: tiles.slice(),
    emptyIndex: empty,
  });
  for (let i = 1; i <= hardCap; i++) {
    const options = neighbors(empty, size).filter((n) => n !== prev);
    const random = rng();
    if (!Number.isFinite(random) || random < 0 || random >= 1)
      throw new RangeError('rng debe devolver un número en [0, 1).');
    const pick = options[Math.floor(random * options.length)];
    [tiles[empty], tiles[pick]] = [tiles[pick], tiles[empty]];
    prev = empty;
    empty = pick;
    if (i >= opts.moves) {
      const state = current();
      if (!isSolved(state) && manhattan(state) >= minM) return state;
    }
  }
  // La referencia retornaba aquí un tablero que podía incumplir el contrato.
  throw new Error(
    `No se alcanzó minManhattan=${minM} en ${hardCap} movimientos. Revisá moves, minManhattan o rng.`,
  );
}
