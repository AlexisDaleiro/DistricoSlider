import { asset } from '../brand/brand';
import { useBrand } from '../brand/BrandProvider';
import { t } from '../brand/t';

/** Muestra estática de marca de Fase 1. La UI jugable pertenece a Fase 3. */
export function App() {
  const brand = useBrand();
  return (
    <div className="brand-showcase min-h-dvh bg-bg font-body text-fg">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-8 md:px-12">
        <div className="flex items-center gap-3">
          <img
            className="h-11 w-11"
            src={asset(brand.brand.logo)}
            alt=""
            draggable={false}
          />
          <span className="font-heading text-2xl font-bold tracking-tight">
            {brand.brand.name}
          </span>
        </div>
        <span className="text-right text-sm text-muted">
          {brand.event.name}
        </span>
      </header>
      <main className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-10 md:px-12 lg:grid-cols-2 lg:gap-20 lg:py-16">
        <section>
          <p className="mb-7 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            {t('showcase.eyebrow')}
          </p>
          <h1 className="max-w-xl font-heading text-6xl leading-[1.02] font-bold tracking-tight md:text-8xl">
            {brand.attract.headline}
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-muted">
            {t('showcase.description')}
          </p>
          <div className="mt-10 inline-flex items-center gap-3 rounded-brand bg-primary px-5 py-3 text-sm font-medium text-on-primary">
            <span aria-hidden="true">●</span>
            {t('showcase.status')}
          </div>
        </section>
        <figure className="rounded-brand bg-surface p-4 md:p-6">
          <img
            className="aspect-square w-full rounded-brand object-cover"
            src={asset(brand.game.images[0].src)}
            alt={t('showcase.imageAlt')}
            draggable={false}
          />
          <figcaption className="mt-5 flex items-center justify-between gap-3 text-sm">
            <span>{t('showcase.imageCaption')}</span>
            <span className="text-secondary">
              {t('showcase.grid', { size: brand.game.gridSize })}
            </span>
          </figcaption>
        </figure>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-xs text-muted md:px-12">
        <span>{brand.brand.appName}</span>
        <span>{t('showcase.scope')}</span>
      </footer>
    </div>
  );
}
