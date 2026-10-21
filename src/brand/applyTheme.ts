import { asset } from './brand';
import type { BrandConfig } from './schema';

export function applyTheme(brand: BrandConfig): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(brand.theme.colors)) {
    const kebab = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    root.style.setProperty(`--brand-${kebab}`, value);
  }
  root.style.setProperty('--brand-radius', brand.theme.radius);
  for (const [role, font] of Object.entries(brand.theme.fonts)) {
    root.style.setProperty(`--brand-font-${role}`, JSON.stringify(font.family));
  }
  root.style.setProperty(
    '--brand-background-image',
    brand.theme.backgroundImage
      ? `url(${JSON.stringify(asset(brand.theme.backgroundImage))})`
      : 'none',
  );
  const style =
    document.getElementById('brand-fonts') ?? document.createElement('style');
  style.id = 'brand-fonts';
  style.textContent = Object.values(brand.theme.fonts)
    .map(
      (font) =>
        `@font-face { font-family: ${JSON.stringify(font.family)}; src: url(${JSON.stringify(asset(font.file))}) format('woff2'); font-weight: ${font.weight}; font-style: normal; font-display: swap; }`,
    )
    .join('\n');
  if (!style.isConnected) document.head.append(style);
  root.lang = brand.event.locale;
  document.title = brand.brand.appName;
}
