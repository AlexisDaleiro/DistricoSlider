import type { PuzzleState } from './types';

export function countInversions(
  tiles: readonly number[],
  emptyId: number,
): number {
  const arr = tiles.filter((tile) => tile !== emptyId);
  let inv = 0;
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) inv++;
  return inv;
}

/** Hueco objetivo abajo a la derecha; validación independiente por paridad. */
export function isSolvable(state: PuzzleState): boolean {
  const { size, tiles, emptyIndex } = state;
  const inv = countInversions(tiles, size * size - 1);
  if (size % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = size - Math.floor(emptyIndex / size);
  return (inv + rowFromBottom) % 2 === 1;
}
