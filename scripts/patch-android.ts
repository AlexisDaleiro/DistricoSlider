import {
  copyFile,
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { BrandConfig } from '../src/brand/schema.ts';
import { projectRoot, validateBrand } from './validate-brand.ts';
import { runNode } from './run-command.ts';

const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');

/** Solo modifica identidad/recursos; conserva la Activity y sus protecciones. */
export async function patchAndroid(brand: BrandConfig, root = projectRoot) {
  const app = resolve(root, 'android/app');
  const gradlePath = resolve(app, 'build.gradle');
  const gradle = await readFile(gradlePath, 'utf8');
  const previous = gradle.match(/namespace\s*=?\s*["']([^"']+)["']/)?.[1];
  if (!previous) throw new Error('No se encontró namespace Android.');
  const id = brand.brand.androidAppId;
  if (
    !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(id) ||
    !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(previous)
  )
    throw new Error('Paquete Android inválido.');
  const oldFile = resolve(
    app,
    'src/main/java',
    ...previous.split('.'),
    'MainActivity.java',
  );
  const newFile = resolve(
    app,
    'src/main/java',
    ...id.split('.'),
    'MainActivity.java',
  );
  const activity = await readFile(oldFile, 'utf8');
  await mkdir(resolve(newFile, '..'), { recursive: true });
  await writeFile(
    newFile,
    activity.replace(/^package\s+[^;]+;/m, `package ${id};`),
  );
  if (oldFile !== newFile) await unlink(oldFile);
  const pkg = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  ) as { version: string };
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version))
    throw new Error('Versión Android inválida.');
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  await writeFile(
    gradlePath,
    gradle
      .replace(/namespace\s*=?\s*["'][^"']+["']/, `namespace = "${id}"`)
      .replace(/applicationId\s*=?\s*["'][^"']+["']/, `applicationId "${id}"`)
      .replace(
        /versionName\s*=?\s*["'][^"']+["']/,
        `versionName "${pkg.version}"`,
      )
      .replace(
        /versionCode\s*=?\s*\d+/,
        `versionCode ${major * 1000000 + minor * 1000 + patch + 1}`,
      ),
  );
  const manifest = resolve(app, 'src/main/AndroidManifest.xml');
  const orientation =
    brand.kiosk.orientation === 'landscape'
      ? 'sensorLandscape'
      : 'sensorPortrait';
  await writeFile(
    manifest,
    (await readFile(manifest, 'utf8')).replace(
      /android:screenOrientation="[^"]+"/,
      `android:screenOrientation="${orientation}"`,
    ),
  );
  await writeFile(
    resolve(app, 'src/main/res/values/strings.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n<string name="app_name">${xml(brand.brand.appName)}</string>\n<string name="title_activity_main">${xml(brand.brand.appName)}</string>\n<string name="package_name">${id}</string>\n<string name="custom_url_scheme">${id}</string>\n</resources>\n`,
  );
  await writeFile(
    resolve(app, 'src/main/res/values/colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n<color name="colorPrimary">${brand.theme.colors.primary}</color>\n<color name="colorPrimaryDark">${brand.theme.colors.background}</color>\n<color name="colorAccent">${brand.theme.colors.secondary}</color>\n<color name="brandBackground">${brand.theme.colors.background}</color>\n</resources>\n`,
  );
}

export async function validateAndroidAssets(
  brand: BrandConfig,
  root = projectRoot,
) {
  const source = resolve(root, 'brands', brand.brand.id, 'assets/icon');
  for (const [name, size] of [
    ['icon-1024.png', 1024],
    ['splash-2732.png', 2732],
  ] as const) {
    const meta = await sharp(resolve(source, name)).metadata();
    if (meta.format !== 'png' || meta.width !== size || meta.height !== size)
      throw new Error(`${name} debe medir ${size}×${size}.`);
  }
}

/** Nombres del spec → nombres que espera @capacitor/assets (custom mode). */
export async function generateAndroidAssets(
  brand: BrandConfig,
  root = projectRoot,
) {
  await validateAndroidAssets(brand, root);
  const source = resolve(root, 'brands', brand.brand.id, 'assets/icon');
  const stage = resolve(root, '.android-assets', brand.brand.id);
  await mkdir(stage, { recursive: true });
  for (const name of ['icon-only.png', 'icon-foreground.png'])
    await copyFile(resolve(source, 'icon-1024.png'), resolve(stage, name));
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: brand.theme.colors.background,
    },
  })
    .png()
    .toFile(resolve(stage, 'icon-background.png'));
  for (const name of ['splash.png', 'splash-dark.png'])
    await copyFile(resolve(source, 'splash-2732.png'), resolve(stage, name));
  // La herramienta concatena projectRoot + assetPath; necesita ruta relativa.
  const started = Date.now();
  runNode(
    'node_modules/@capacitor/assets/bin/capacitor-assets',
    [
      'generate',
      '--android',
      '--assetPath',
      `.android-assets/${brand.brand.id}`,
    ],
    root,
  );
  const generated = await stat(
    resolve(root, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'),
  );
  if (generated.mtimeMs < started - 2000)
    throw new Error('@capacitor/assets no actualizó los recursos Android.');
  // El generador escribe variantes por orientación/densidad, pero deja el
  // drawable base de la plantilla. También debe pertenecer a la marca activa.
  for (const directory of ['drawable', 'drawable-night']) {
    await mkdir(resolve(root, 'android/app/src/main/res', directory), {
      recursive: true,
    });
    await sharp(resolve(source, 'splash-2732.png'))
      .resize(960, 960)
      .png()
      .toFile(
        resolve(root, 'android/app/src/main/res', directory, 'splash.png'),
      );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const brand = await validateBrand(
    process.argv[2] ?? process.env.VITE_BRAND ?? 'demo',
  );
  await patchAndroid(brand);
  await generateAndroidAssets(brand);
}
