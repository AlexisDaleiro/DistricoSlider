import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { projectRoot, validateBrand } from './scripts/validate-brand.ts';

export default defineConfig(async () => {
  const brand = process.env.VITE_BRAND ?? 'demo';
  await validateBrand(brand);
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@brand': resolve(projectRoot, 'brands', brand) } },
    build: { assetsInlineLimit: 0, target: 'es2020' },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    },
  };
});
