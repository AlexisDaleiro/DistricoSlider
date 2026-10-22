import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import { AttractMedia } from './AttractMedia';
import { BrandHeader } from '../../shared/ui/BrandHeader';
import { AdminHotspot } from '../admin/AdminHotspot';

export function AttractScreen({
  onStart,
  onLeaderboard,
  startError,
  onAdmin,
  gridSize,
}: {
  onStart: () => void;
  onLeaderboard: () => void;
  startError: boolean;
  onAdmin?: () => void;
  gridSize?: 3 | 4;
}) {
  const brand = useBrand();
  return (
    <div className="min-h-dvh cursor-pointer" onClick={onStart}>
      {onAdmin && <AdminHotspot onUnlock={onAdmin} />}
      <BrandHeader />
      <main className="game-layout">
        <section className="order-2 max-w-lg lg:order-1">
          <p className="game-eyebrow">{t('game.eyebrow')}</p>
          <h1 className="mt-5 font-heading text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {brand.attract.headline}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            {t('showcase.description')}
          </p>
          <p className="mt-4 text-sm font-medium text-primary">
            {t('game.firstMove')}
          </p>
          {startError && (
            <p role="alert" className="mt-6 text-danger">
              {t('game.loadError')}
            </p>
          )}
          <button
            className="game-button mt-8 bg-primary text-on-primary"
            type="button"
          >
            {startError ? t('game.retry') : brand.attract.cta}
          </button>
          <button
            className="game-button mt-3 text-primary"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onLeaderboard();
            }}
          >
            {t('result.ranking')}
          </button>
        </section>
        <figure className="order-1 mx-auto w-full rounded-brand bg-surface p-3 lg:order-2 lg:rotate-2">
          <AttractMedia />
          <figcaption className="flex items-center justify-between gap-3 px-2 py-4 text-sm">
            <span>{t('showcase.imageCaption')}</span>
            <span className="rounded-full bg-secondary px-3 py-1 font-bold text-on-secondary">
              {t('game.grid', { size: gridSize ?? brand.game.gridSize })}
            </span>
          </figcaption>
        </figure>
      </main>
    </div>
  );
}
