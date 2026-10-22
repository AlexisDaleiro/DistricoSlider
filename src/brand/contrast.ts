import type { BrandConfig } from './schema.ts';

export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function reviewContrast(config: BrandConfig) {
  const colors = config.theme.colors;
  const pairs = [
    ['primary', 'onPrimary'],
    ['secondary', 'onSecondary'],
    ...(['background', 'surface'] as const).flatMap((background) =>
      (['text', 'textMuted', 'primary', 'danger', 'success'] as const).map(
        (foreground) => [background, foreground] as const,
      ),
    ),
  ] as const;
  return pairs.map(([background, foreground]) => ({
    pair: `${background}/${foreground}`,
    ratio: contrastRatio(colors[background], colors[foreground]),
    minimum: 4.5,
  }));
}
