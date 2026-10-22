import { useEffect, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';

export function CountdownScreen({
  imageUrl,
  onComplete,
}: {
  imageUrl: string;
  onComplete: () => void;
}) {
  const { game } = useBrand();
  const [seconds, setSeconds] = useState(Math.ceil(game.countdownSec));
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    let previous = game.countdownSec;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil(game.countdownSec - (performance.now() - start) / 1000),
      );
      if (left === 0) {
        onComplete();
        return;
      }
      if (left !== previous) {
        previous = left;
        setSeconds(left);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [game.countdownSec, onComplete]);
  return (
    <main className="game-layout">
      <div className="puzzle-stage">
        <img
          className="aspect-square w-full rounded-brand"
          src={imageUrl}
          alt={t('game.imageAlt')}
          draggable={false}
        />
      </div>
      <section className="game-sidebar">
        <p className="game-eyebrow">{t('game.eyebrow')}</p>
        <h1 className="game-heading">{t('game.countdownTitle')}</h1>
        <p className="mt-4 leading-relaxed text-muted">
          {t('game.countdownBody')}
        </p>
        <div
          className="mt-8 inline-flex h-28 w-28 items-center justify-center rounded-full bg-secondary font-heading text-6xl font-bold text-on-secondary"
          role="status"
          aria-label={t('game.countdownValue', { seconds })}
        >
          {seconds}
        </div>
      </section>
    </main>
  );
}
