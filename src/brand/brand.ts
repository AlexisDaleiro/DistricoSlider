import { brandSchema, type BrandConfig } from './schema';
import { QA_ENABLED, qaBrand } from '../qa/config';

const configs = import.meta.glob<unknown>('/brands/*/theme.config.json', {
  eager: true,
  import: 'default',
});
// ponytail: incluye los assets de todas las carpetas de brands/, no solo las de
// VITE_BRAND; filtrar con un plugin de Vite si el peso del APK llega a importar.
const assetUrls = import.meta.glob<string>('/brands/*/assets/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Marcas incluidas en esta compilación (VITE_BRAND, separadas por coma). */
export const brandIds: readonly string[] = __BRANDS__;
const storageKey = 'kiosk.brand';

function storedBrand(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

const stored = storedBrand();
const activeId = stored && brandIds.includes(stored) ? stored : brandIds[0];
const config = (id: string) => configs[`/brands/${id}/theme.config.json`];
const parsed = brandSchema.parse(config(activeId));
export const brand: BrandConfig = QA_ENABLED ? qaBrand(parsed) : parsed;

export const brandNames: Record<string, string> = Object.fromEntries(
  brandIds.map((id) => [id, (config(id) as BrandConfig).brand.name]),
);

/** Guarda la marca en la tablet y recarga para aplicar tema, textos y datos. */
export function selectBrand(id: string): void {
  if (!brandIds.includes(id)) throw new Error(`Marca no incluida: ${id}`);
  localStorage.setItem(storageKey, id);
  location.reload();
}

/** Resuelve exclusivamente assets locales incluidos por Vite. */
export function asset(relPath: string): string {
  const url = assetUrls[`/brands/${activeId}/${relPath}`];
  if (!url) throw new Error(`Asset no encontrado en la marca: ${relPath}`);
  return url;
}
