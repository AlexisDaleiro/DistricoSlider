import type { CSSProperties } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import { AttractMedia } from './AttractMedia';
import { AttractPuzzle, type AttractImage } from './AttractPuzzle';
import { useAttractPreferences } from './useAttractPreferences';
import { BrandHeader } from '../../shared/ui/BrandHeader';
import { AdminHotspot } from '../admin/AdminHotspot';

export function AttractScreen({
  onStart,
  onLeaderboard,
  startError,
  onAdmin,
  gridSize,
  image,
  prepared,
}: {
  onStart: () => void;
  onLeaderboard: () => void;
  startError: boolean;
  onAdmin?: () => void;
  gridSize?: 3 | 4;
  image?: AttractImage;
  prepared?: { url: string | null };
}) {
  const brand = useBrand();
  const { visible, reducedMotion } = useAttractPreferences();
  return (
    <div
      className="attract-screen min-h-dvh"
      data-paused={!visible}
      style={
        {
          '--attract-cycle': `${brand.attract.animationCycleMs}ms`,
        } as CSSProperties
      }
    >
      {brand.attract.media.length > 0 && (
        <div className="attract-backdrop" aria-hidden="true">
          <AttractMedia active={visible && !reducedMotion} />
        </div>
      )}
      {onAdmin && <AdminHotspot onUnlock={onAdmin} />}
      <BrandHeader />
      <main className="attract-layout">
        <section className="attract-copy">
          <p className="game-eyebrow">{t('game.eyebrow')}</p>
          <h1 className="attract-headline">{brand.attract.headline}</h1>
          <p className="attract-description text-muted">
            {t('showcase.description')}
          </p>
          {startError && (
            <p role="alert" className="mt-5 text-danger">
              {t('game.loadError')}
            </p>
          )}
        </section>
        <div className="attract-actions">
          <button
            className="game-button attract-button attract-start bg-primary text-on-primary"
            type="button"
            onClick={onStart}
          >
            {brand.attract.startButton}
          </button>
          <button
            className="game-button attract-button bg-secondary text-on-secondary"
            type="button"
            onClick={onLeaderboard}
          >
            {brand.attract.rankingButton}
          </button>
        </div>
        <figure className="attract-figure">
          <AttractPuzzle
            prepared={prepared}
            image={image ?? brand.game.images[0]}
            size={gridSize ?? brand.game.gridSize}
            visible={visible}
            reducedMotion={reducedMotion}
          />
          <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span>{t('showcase.imageCaption')}</span>
            <span className="rounded-full bg-surface px-4 py-2 font-bold text-primary">
              {t('game.grid', { size: gridSize ?? brand.game.gridSize })}
            </span>
          </figcaption>
        </figure>
      </main>
    </div>
  );
}
