import raw from '@brand/theme.config.json';
import { brandSchema, type BrandConfig } from './schema';
import { QA_ENABLED, qaBrand } from '../qa/config';

const assetUrls = import.meta.glob<string>('@brand/assets/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

const parsed = brandSchema.parse(raw);
export const brand: BrandConfig = QA_ENABLED ? qaBrand(parsed) : parsed;

/** Resuelve exclusivamente assets locales incluidos por Vite. */
export function asset(relPath: string): string {
  const key = Object.keys(assetUrls).find((key) => key.endsWith('/' + relPath));
  if (!key) throw new Error(`Asset no encontrado en la marca: ${relPath}`);
  return assetUrls[key];
}
