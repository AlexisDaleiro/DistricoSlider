export type GridSize = 3 | 4;
export interface PuzzleState {
  readonly size: GridSize;
  readonly tiles: readonly number[];
  readonly emptyIndex: number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
