import { resolve } from 'node:path';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { projectRoot, validateBrand } from './scripts/validate-brand.ts';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig(async () => {
  const brand = process.env.VITE_BRAND ?? 'demo';
  await validateBrand(brand);
  const pin = process.env.ADMIN_PIN ?? '0000';
  if (!/^\d{4}$/.test(pin))
    throw new Error('ADMIN_PIN debe contener exactamente 4 dígitos.');
  const salt = randomBytes(16);
  return {
    define: {
      __INITIAL_ADMIN_PIN__: JSON.stringify({
        salt: [...salt],
        hash: [...pbkdf2Sync(pin, salt, 100000, 32, 'sha256')],
        iterations: 100000,
        isDefault: pin === '0000',
      }),
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@brand': resolve(projectRoot, 'brands', brand) } },
    build: { assetsInlineLimit: 0, target: 'es2020', manifest: true },
    optimizeDeps: { entries: ['index.html'] },
    server: {
      watch: {
        ignored: [
          '**/android/**',
          '**/.android-sdk/**',
          '**/.gradle-cache/**',
          '**/.android-assets/**',
          '**/artifacts/**',
        ],
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    },
  };
});
