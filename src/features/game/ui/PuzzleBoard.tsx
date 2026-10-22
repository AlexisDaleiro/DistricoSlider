import { memo } from 'react';
import { useBrand } from '../../../brand/BrandProvider';
import { t } from '../../../brand/t';
import type { Direction, PuzzleState } from '../engine/types';
import { Tile } from './Tile';
import { useSwipe } from './useSwipe';

interface Props {
  state: PuzzleState;
  imageUrl: string;
  onTapPosition: (position: number) => void;
  onSwipe: (direction: Direction) => void;
  durationMs: number;
  showNumber: boolean;
  disabled?: boolean;
  fullImageVisible?: boolean;
  animateReveal?: boolean;
  invalidMoveRevision?: number;
  id?: string;
}

export const PuzzleBoard = memo(function PuzzleBoard({
  state,
  imageUrl,
  onTapPosition,
  onSwipe,
  durationMs,
  showNumber,
  disabled = false,
  fullImageVisible = false,
  animateReveal = false,
  invalidMoveRevision = 0,
  id,
}: Props) {
  const { game } = useBrand();
  const swipe = useSwipe(onSwipe, {
    threshold: game.swipeThresholdPx,
    disabled,
    onTap: (target) => {
      const tile =
        target instanceof Element
          ? target.closest<HTMLElement>('[data-position]')
          : null;
      if (tile) onTapPosition(Number(tile.dataset.position));
    },
  });
  return (
    <div
      className="puzzle-stage"
      style={{
        minWidth: state.size * 48,
        animationName:
          invalidMoveRevision === 0
            ? 'none'
            : invalidMoveRevision % 2
              ? 'puzzle-shake-a'
              : 'puzzle-shake-b',
        animationDuration: `${game.invalidMoveAnimationMs}ms`,
      }}
    >
      <div
        id={id}
        role="group"
        aria-label={t('game.board', { size: state.size })}
        className="relative aspect-square w-full touch-none rounded-brand bg-tile-gap select-none"
        {...swipe}
      >
        {state.tiles.map((tileId, position) =>
          tileId === state.size * state.size - 1 ? null : (
            <Tile
              key={tileId}
              id={tileId}
              position={position}
              size={state.size}
              imageUrl={imageUrl}
              durationMs={durationMs}
              showNumber={showNumber}
              onTap={onTapPosition}
              disabled={disabled}
            />
          ),
        )}
        <img
          aria-hidden="true"
          draggable={false}
          src={imageUrl}
          alt=""
          className="puzzle-reveal pointer-events-none absolute inset-0 h-full w-full rounded-brand"
          style={{
            opacity: fullImageVisible ? 1 : 0,
            transition: animateReveal
              ? `opacity ${game.victoryAnimationMs}ms ease-out`
              : 'none',
          }}
        />
      </div>
    </div>
  );
});
