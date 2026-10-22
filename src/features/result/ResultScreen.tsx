import { useEffect, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import type { GameSession } from '../../data/types';
import { getRankFor } from '../../data/repos/leaderboardRepo';
import { HUD } from '../game/ui/HUD';

export function ResultScreen({
  session,
  imageUrl,
  onLeaderboard,
  onFinish,
}: {
  session: GameSession;
  imageUrl: string;
  onLeaderboard: () => void;
  onFinish: () => void;
}) {
  const brand = useBrand();
  const [rank, setRank] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (session.status !== 'completed') return;
    let active = true;
    void getRankFor(session.uuid)
      .then((rank) => {
        if (active) setRank(rank);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [session.uuid, session.status, attempt]);
  return (
    <main className="game-layout">
      <div className="puzzle-stage">
        <img
          src={imageUrl}
          className="aspect-square w-full rounded-brand"
          alt={t('game.imageAlt')}
          draggable={false}
        />
      </div>
      <section className="game-sidebar">
        <p className="game-eyebrow">{t('game.eyebrow')}</p>
        <h1 className="game-heading mt-4">
          {session.status === 'completed'
            ? t('result.title')
            : t('game.timeoutTitle')}
        </h1>
        <div className="my-7">
          <HUD elapsedMs={session.durationMs ?? 0} moves={session.moves ?? 0} />
        </div>
        <p className="leading-relaxed text-muted">
          {session.status === 'completed'
            ? t('game.completedBody')
            : t('game.timeoutBody')}
        </p>
        {session.status === 'completed' &&
          (error ? (
            <div role="alert" className="mt-4">
              <p className="text-danger">{t('leaderboard.error')}</p>
              <button
                className="game-button text-primary"
                type="button"
                onClick={() => {
                  setError(false);
                  setAttempt((value) => value + 1);
                }}
              >
                {t('game.retry')}
              </button>
            </div>
          ) : (
            <p role="status" className="mt-5 font-bold text-primary">
              {rank === undefined
                ? t('leaderboard.loading')
                : rank !== null && rank <= brand.leaderboard.size
                  ? t('result.rank', { rank })
                  : t('result.outOfTop', { size: brand.leaderboard.size })}
            </p>
          ))}
        <button
          type="button"
          className="game-button mt-7 w-full bg-primary text-on-primary"
          onClick={onLeaderboard}
        >
          {t('result.ranking')}
        </button>
        <button
          type="button"
          className="game-button mt-3 w-full text-muted"
          onClick={onFinish}
        >
          {t('common.finish')}
        </button>
      </section>
    </main>
  );
}
