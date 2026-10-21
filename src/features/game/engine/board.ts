import type { GridSize, PuzzleState, Direction } from './types';

export const emptyId = (size: GridSize) => size * size - 1;
export const rowOf = (i: number, size: number) => Math.floor(i / size);
export const colOf = (i: number, size: number) => i % size;

export function createSolved(size: GridSize): PuzzleState {
  const tiles = Array.from({ length: size * size }, (_, i) => i);
  return { size, tiles, emptyIndex: emptyId(size) };
}

export function neighbors(index: number, size: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= size * size) return [];
  const r = rowOf(index, size),
    c = colOf(index, size);
  const out: number[] = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

function swap(tiles: readonly number[], a: number, b: number): number[] {
  const next = tiles.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function moveTileAt(
  state: PuzzleState,
  index: number,
): PuzzleState | null {
  if (!neighbors(state.emptyIndex, state.size).includes(index)) return null;
  return {
    ...state,
    tiles: swap(state.tiles, index, state.emptyIndex),
    emptyIndex: index,
  };
}

/** Cada ficha desplazada cuenta como un movimiento. */
export function slideLineTo(
  state: PuzzleState,
  index: number,
): { state: PuzzleState; moved: number } | null {
  const { size, emptyIndex } = state;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size * size ||
    index === emptyIndex
  )
    return null;
  const sameRow = rowOf(index, size) === rowOf(emptyIndex, size);
  const sameCol = colOf(index, size) === colOf(emptyIndex, size);
  if (!sameRow && !sameCol) return null;
  const step = sameRow
    ? Math.sign(index - emptyIndex)
    : Math.sign(index - emptyIndex) * size;
  let current = state;
  let moved = 0;
  while (current.emptyIndex !== index) {
    const next = moveTileAt(current, current.emptyIndex + step);
    if (!next) return null;
    current = next;
    moved++;
  }
  return { state: current, moved };
}

/** La dirección describe el gesto de la ficha, opuesto al desplazamiento del hueco. */
export function moveByDirection(
  state: PuzzleState,
  dir: Direction,
): PuzzleState | null {
  const { size, emptyIndex } = state;
  const r = rowOf(emptyIndex, size),
    c = colOf(emptyIndex, size);
  const source =
    dir === 'left'
      ? c < size - 1
        ? emptyIndex + 1
        : -1
      : dir === 'right'
        ? c > 0
          ? emptyIndex - 1
          : -1
        : dir === 'up'
          ? r < size - 1
            ? emptyIndex + size
            : -1
          : r > 0
            ? emptyIndex - size
            : -1;
  return source < 0 ? null : moveTileAt(state, source);
}

export function isSolved(state: PuzzleState): boolean {
  return state.tiles.every((id, i) => id === i);
}

export function manhattan(state: PuzzleState): number {
  const { size, tiles } = state;
  let d = 0;
  tiles.forEach((id, i) => {
    if (id === emptyId(size)) return;
    d +=
      Math.abs(rowOf(id, size) - rowOf(i, size)) +
      Math.abs(colOf(id, size) - colOf(i, size));
  });
  return d;
}
