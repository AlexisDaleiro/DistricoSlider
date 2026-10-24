import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';
import type { BrandConfig } from './src/brand/schema';

// brand:build valida el mismo JSON antes de invocar Capacitor.
// Varias marcas comparten APK: la primera da la identidad Android.
const ids = (process.env.VITE_BRAND ?? 'demo').split(',');
if (!ids.every((id) => /^(?:[a-z0-9][a-z0-9_-]*|_template)$/.test(id)))
  throw new Error('VITE_BRAND inválida.');
const brand = JSON.parse(
  readFileSync(resolve('brands', ids[0], 'theme.config.json'), 'utf8'),
) as BrandConfig;

const config: CapacitorConfig = {
  appId: brand.brand.androidAppId,
  appName: ids.length > 1 ? 'Slider' : brand.brand.appName,
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
    backgroundColor: brand.theme.colors.background,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: brand.kiosk.splashMs ?? 1200,
      launchAutoHide: true,
      backgroundColor: brand.theme.colors.background,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};
export default config;
