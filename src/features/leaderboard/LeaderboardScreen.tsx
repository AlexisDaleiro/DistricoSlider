import { useEffect, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import {
  getLeaderboard,
  type LeaderboardEntry,
} from '../../data/repos/leaderboardRepo';
import { formatDuration } from '../../shared/lib/time';
import { formatPlayerName } from './formatPlayerName';

export function LeaderboardScreen({
  dayKey,
  gridSize,
  onFinish,
}: {
  dayKey: string;
  gridSize: 3 | 4;
  onFinish: () => void;
}) {
  const brand = useBrand();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void getLeaderboard(
      brand.event.id,
      dayKey,
      gridSize,
      brand.leaderboard.size,
    )
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [brand.event.id, brand.leaderboard.size, dayKey, gridSize, attempt]);
  return (
    <main className="mx-auto max-w-5xl px-5 pt-5 pb-10">
      <section className="rounded-brand bg-surface p-6 sm:p-8">
        <p className="game-eyebrow">{t('game.grid', { size: gridSize })}</p>
        <h1 className="game-heading mt-4">{t('leaderboard.title')}</h1>
        <p className="mt-3 text-sm text-muted">
          {new Date(`${dayKey}T12:00:00`).toLocaleDateString(
            brand.event.locale,
            { day: 'numeric', month: 'long', year: 'numeric' },
          )}
        </p>
        {error ? (
          <div role="alert" className="mt-6">
            <p className="text-danger">{t('leaderboard.error')}</p>
            <button
              className="game-button mt-3 text-primary"
              type="button"
              onClick={() => {
                setError(false);
                setEntries(null);
                setAttempt((value) => value + 1);
              }}
            >
              {t('game.retry')}
            </button>
          </div>
        ) : entries === null ? (
          <p role="status" className="mt-8 text-muted">
            {t('leaderboard.loading')}
          </p>
        ) : entries.length === 0 ? (
          <p className="mt-8 text-muted">{t('leaderboard.empty')}</p>
        ) : (
          <div className="mt-7 overflow-x-auto">
            <table className="ranking-table w-full text-left">
              <thead>
                <tr>
                  <th>{t('leaderboard.position')}</th>
                  <th>{t('leaderboard.player')}</th>
                  {brand.leaderboard.showCompany && (
                    <th>{t('leaderboard.company')}</th>
                  )}
                  <th>{t('game.time')}</th>
                  <th>{t('game.moves')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ lead, session }, index) => (
                  <tr key={session.uuid}>
                    <td className="font-heading text-xl font-bold text-primary">
                      {index + 1}
                    </td>
                    <td className="font-bold">
                      {formatPlayerName(
                        lead.name,
                        brand.leaderboard.nameFormat,
                      )}
                    </td>
                    {brand.leaderboard.showCompany && <td>{lead.company}</td>}
                    <td className="tabular-nums">
                      {formatDuration(session.durationMs!)}
                    </td>
                    <td className="tabular-nums">{session.moves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          className="game-button mt-8 bg-primary text-on-primary"
          type="button"
          onClick={onFinish}
        >
          {t('common.finish')}
        </button>
      </section>
    </main>
  );
}
