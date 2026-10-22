import { asset } from '../../brand/brand';
import { useBrand } from '../../brand/BrandProvider';

export function BrandHeader() {
  const brand = useBrand();
  return (
    <header className="game-header">
      <div className="flex items-center gap-4">
        <img
          className="h-20 w-20 rounded-brand object-contain"
          src={asset(brand.brand.logo)}
          alt={brand.brand.name}
          draggable={false}
        />
        <span className="font-heading text-lg font-bold tracking-tight md:text-xl">
          {brand.brand.appName}
        </span>
      </div>
      <span className="max-w-48 text-right text-sm text-muted">
        {brand.event.name}
      </span>
    </header>
  );
}
