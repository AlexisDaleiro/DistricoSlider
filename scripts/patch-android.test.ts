import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { patchAndroid, validateAndroidAssets } from './patch-android';
import sharp from 'sharp';
import { parseBrand, projectRoot } from './validate-brand';
import demo from '../brands/demo/theme.config.json';
import districo from '../brands/districo/theme.config.json';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kiosk-android-test-'));
  const realGradle = await readFile(
    resolve(projectRoot, 'android/app/build.gradle'),
    'utf8',
  );
  const id = realGradle.match(/namespace = "([^"]+)"/)![1];
  for (const path of [
    'src/main/res/values',
    `src/main/java/${id.replace(/\./g, '/')}`,
  ])
    await mkdir(resolve(root, 'android/app', path), { recursive: true });
  for (const path of [
    'build.gradle',
    'src/main/AndroidManifest.xml',
    `src/main/java/${id.replace(/\./g, '/')}/MainActivity.java`,
  ])
    await copyFile(
      resolve(projectRoot, 'android/app', path),
      resolve(root, 'android/app', path),
    );
  await writeFile(
    resolve(root, 'package.json'),
    JSON.stringify({ version: '2.3.4' }),
  );
});
afterEach(async () => {
  if (!root.startsWith(join(tmpdir(), 'kiosk-android-test-')))
    throw new Error('Directorio temporal inesperado');
  await rm(root, { recursive: true, force: true });
});
it('cambia marca, paquete/ruta, versión, colores y orientación; repetir es idempotente', async () => {
  const brand = parseBrand(districo);
  brand.kiosk.orientation = 'portrait';
  brand.brand.appName = 'Puzzle & "Marca" O\'Brien';
  await patchAndroid(brand, root);
  const javaPath = resolve(
    root,
    'android/app/src/main/java',
    ...brand.brand.androidAppId.split('.'),
    'MainActivity.java',
  );
  const java = await readFile(javaPath, 'utf8');
  expect(java).toContain(`package ${brand.brand.androidAppId};`);
  expect(java).toContain('FLAG_KEEP_SCREEN_ON');
  expect(java).toContain('BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE');
  expect(java).toContain('SCREEN_ORIENTATION_SENSOR_LANDSCAPE');
  const gradlePath = resolve(root, 'android/app/build.gradle');
  const gradle = await readFile(gradlePath, 'utf8');
  expect(gradle).toContain(`applicationId "${brand.brand.androidAppId}"`);
  expect(gradle).toContain('versionName "2.3.4"');
  expect(gradle).toContain('versionCode 2003005');
  const manifest = await readFile(
    resolve(root, 'android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  expect(manifest).toContain('sensorPortrait');
  expect(manifest).toContain('adjustResize');
  expect(manifest).toContain('android:allowBackup="false"');
  const strings = await readFile(
    resolve(root, 'android/app/src/main/res/values/strings.xml'),
    'utf8',
  );
  expect(strings).toContain('Puzzle &amp; \\"Marca\\" O\\\'Brien');
  expect(
    await readFile(
      resolve(root, 'android/app/src/main/res/values/colors.xml'),
      'utf8',
    ),
  ).toContain(brand.theme.colors.background);
  await patchAndroid(brand, root);
  expect(await readFile(gradlePath, 'utf8')).toBe(gradle);
  expect(await readFile(javaPath, 'utf8')).toBe(java);
  await patchAndroid(parseBrand(demo), root);
  await expect(readFile(javaPath)).rejects.toThrow();
  expect(await readFile(gradlePath, 'utf8')).toContain(demo.brand.androidAppId);
});
it('rechaza paquete malicioso antes de modificar la Activity', async () => {
  const brand = parseBrand(demo);
  brand.brand.androidAppId = '../escape';
  await expect(patchAndroid(brand, root)).rejects.toThrow(
    'Paquete Android inválido',
  );
});
it('verifica los PNG de Android de las tres marcas antes del build', async () => {
  for (const id of ['demo', 'districo', '_template']) {
    const raw = JSON.parse(
      await readFile(
        resolve(projectRoot, 'brands', id, 'theme.config.json'),
        'utf8',
      ),
    ) as unknown;
    await expect(
      validateAndroidAssets(parseBrand(raw)),
    ).resolves.toBeUndefined();
  }
});
it('un icono ausente o con dimensiones incorrectas bloquea Android con error', async () => {
  await expect(validateAndroidAssets(parseBrand(demo), root)).rejects.toThrow();
  const dir = resolve(root, 'brands/demo/assets/icon');
  await mkdir(dir, { recursive: true });
  await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#000000' },
  })
    .png()
    .toFile(resolve(dir, 'icon-1024.png'));
  await expect(validateAndroidAssets(parseBrand(demo), root)).rejects.toThrow(
    'icon-1024.png debe medir 1024×1024',
  );
});
it('config release es local, sin depuración, y toma identidad/splash de la marca', async () => {
  vi.stubEnv('VITE_BRAND', 'districo');
  vi.stubEnv('NODE_ENV', 'production');
  try {
    vi.resetModules();
    const { default: config } = await import('../capacitor.config');
    expect(config.appId).toBe(districo.brand.androidAppId);
    expect(config.appName).toBe(districo.brand.appName);
    expect(config.server).toBeUndefined();
    expect(config.android?.webContentsDebuggingEnabled).toBe(false);
    expect(config.android?.allowMixedContent).toBe(false);
    expect(config.plugins?.SplashScreen?.launchShowDuration).toBe(
      districo.kiosk.splashMs,
    );
    expect(config.plugins?.SplashScreen?.backgroundColor).toBe(
      districo.theme.colors.background,
    );
  } finally {
    vi.unstubAllEnvs();
  }
});
