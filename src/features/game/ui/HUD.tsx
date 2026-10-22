import { t } from '../../../brand/t';
import { formatDuration } from '../../../shared/lib/time';

export function HUD({
  elapsedMs,
  moves,
}: {
  elapsedMs: number;
  moves: number;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-brand bg-bg p-5">
        <dt className="mb-2 text-sm text-muted">{t('game.time')}</dt>
        <dd
          data-testid="game-time"
          className="font-heading text-3xl font-bold tabular-nums"
        >
          {formatDuration(elapsedMs)}
        </dd>
      </div>
      <div className="rounded-brand bg-bg p-5">
        <dt className="mb-2 text-sm text-muted">{t('game.moves')}</dt>
        <dd
          data-testid="game-moves"
          className="font-heading text-3xl font-bold tabular-nums"
        >
          {moves}
        </dd>
      </div>
    </dl>
  );
}
