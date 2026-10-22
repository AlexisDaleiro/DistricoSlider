import { memo } from 'react';
import { t } from '../../../brand/t';

export interface TileProps {
  id: number;
  position: number;
  size: number;
  imageUrl: string;
  durationMs: number;
  showNumber: boolean;
  onTap: (position: number) => void;
  disabled?: boolean;
}

export const Tile = memo(function Tile({
  id,
  position,
  size,
  imageUrl,
  durationMs,
  showNumber,
  onTap,
  disabled = false,
}: TileProps) {
  const row = Math.floor(position / size),
    col = position % size;
  const solvedRow = Math.floor(id / size),
    solvedCol = id % size;
  const pct = (value: number) => (size === 1 ? 0 : (value / (size - 1)) * 100);
  return (
    <button
      type="button"
      data-position={position}
      data-tile-id={id}
      aria-label={t('game.tile', { number: id + 1 })}
      disabled={disabled}
      // El puntero se resuelve al soltar en useSwipe; detail=0 es teclado/AT.
      onClick={(event) => {
        if (event.detail === 0) onTap(position);
      }}
      className="puzzle-tile absolute top-0 left-0 p-[2px] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-4px]"
      style={{
        width: `${100 / size}%`,
        height: `${100 / size}%`,
        transform: `translate3d(${col * 100}%, ${row * 100}%, 0)`,
        transition: `transform ${durationMs}ms cubic-bezier(.2,.8,.2,1)`,
        willChange: 'transform',
      }}
    >
      <span
        className="relative block h-full w-full rounded-[6px]"
        style={{
          backgroundImage: `url(${JSON.stringify(imageUrl)})`,
          backgroundSize: `${size * 100}% ${size * 100}%`,
          backgroundPosition: `${pct(solvedCol)}% ${pct(solvedRow)}%`,
        }}
      >
        {showNumber && (
          <span className="absolute top-2 left-2 rounded bg-surface px-2 py-1 text-sm font-bold text-fg">
            {id + 1}
          </span>
        )}
      </span>
    </button>
  );
});
