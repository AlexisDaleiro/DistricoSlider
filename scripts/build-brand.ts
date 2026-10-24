import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot, validateBrand } from './validate-brand.ts';
import {
  generateAndroidAssets,
  patchAndroid,
  validateAndroidAssets,
} from './patch-android.ts';
import { runCommand, runNode } from './run-command.ts';
import { checkWebBuild } from './check-web-build.ts';

export async function buildBrand(id: string, syncOnly = false) {
  const ids = id.split(',');
  const [first] = await Promise.all(ids.map((each) => validateBrand(each)));
  // Varias marcas comparten APK: identidad Android de la primera, nombre neutro.
  const brand =
    ids.length > 1
      ? { ...first, brand: { ...first.brand, appName: 'Slider' } }
      : first;
  await validateAndroidAssets(brand);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VITE_BRAND: id,
    NODE_ENV: 'production',
  };
  runNode('node_modules/typescript/bin/tsc', ['--noEmit']);
  runNode('node_modules/vite/bin/vite.js', ['build'], projectRoot, env);
  const web = await checkWebBuild(resolve(projectRoot, 'dist'));
  console.log(
    `Bundle inicial: ${(web.initialGzipBytes / 1024).toFixed(1)} KiB gzip; QA excluido.`,
  );
  await patchAndroid(brand);
  await generateAndroidAssets(brand);
  runNode(
    'node_modules/@capacitor/cli/bin/capacitor',
    ['sync', 'android'],
    projectRoot,
    env,
  );
  if (syncOnly) return;
  const android = resolve(projectRoot, 'android');
  const sdk =
    env.ANDROID_HOME ??
    env.ANDROID_SDK_ROOT ??
    resolve(projectRoot, '.android-sdk');
  try {
    await access(resolve(sdk, 'platforms/android-36/android.jar'));
  } catch {
    throw new Error(
      'Falta SDK Android 36. Instalalo y configurá ANDROID_HOME (ver README). Web y cap sync ya terminaron; no se generó un APK.',
    );
  }
  // No modifica configuración global del usuario.
  await writeFile(
    resolve(android, 'local.properties'),
    `sdk.dir=${sdk.replace(/\\/g, '/').replace(/:/g, '\\:')}\n`,
  );
  const signingKeys = [
    'ANDROID_KEYSTORE',
    'ANDROID_KEY_ALIAS',
    'ANDROID_STORE_PASSWORD',
    'ANDROID_KEY_PASSWORD',
  ] as const;
  const signing = signingKeys.filter((key) => env[key]);
  if (signing.length > 0 && signing.length !== signingKeys.length)
    throw new Error(
      'La firma propia requiere las cuatro variables ANDROID_KEYSTORE, ANDROID_KEY_ALIAS, ANDROID_STORE_PASSWORD y ANDROID_KEY_PASSWORD.',
    );
  if (!signing.length) {
    const directory = resolve(projectRoot, '.android-keys');
    const keystore = resolve(directory, 'development.jks');
    await mkdir(directory, { recursive: true });
    try {
      await access(keystore);
    } catch {
      const keytool = env.JAVA_HOME
        ? resolve(
            env.JAVA_HOME,
            'bin',
            process.platform === 'win32' ? 'keytool.exe' : 'keytool',
          )
        : 'keytool';
      runCommand(keytool, [
        '-genkeypair',
        '-keystore',
        keystore,
        '-storepass',
        'android',
        '-keypass',
        'android',
        '-alias',
        'androiddebugkey',
        '-dname',
        'CN=Android Debug,O=Android,C=US',
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '10000',
      ]);
    }
    console.log(
      'Firma de desarrollo local; para distribución usá una clave propia (README).',
    );
  }
  const gradleEnv = {
    ...env,
    ANDROID_HOME: sdk,
    GRADLE_USER_HOME:
      env.GRADLE_USER_HOME ?? resolve(projectRoot, '.gradle-cache'),
  };
  if (process.platform === 'win32')
    runCommand(
      'cmd.exe',
      ['/d', '/c', 'gradlew.bat', '--no-daemon', 'assembleRelease'],
      android,
      gradleEnv,
    );
  else
    runCommand(
      'sh',
      ['gradlew', '--no-daemon', 'assembleRelease'],
      android,
      gradleEnv,
    );
  const destination = resolve(projectRoot, 'artifacts/android');
  await mkdir(destination, { recursive: true });
  const file = resolve(
    destination,
    `${ids.join('-')}-${signing.length ? 'release' : 'development-release'}.apk`,
  );
  await copyFile(
    resolve(android, 'app/build/outputs/apk/release/app-release.apk'),
    file,
  );
  console.log(`APK: ${file}`);
}

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg.startsWith('--') && arg !== '--sync-only'))
    throw new Error(
      'Opción desconocida. Uso: npm run brand:build -- <marca> [--sync-only]',
    );
  await buildBrand(
    args.find((arg) => !arg.startsWith('--')) ??
      process.env.VITE_BRAND ??
      'demo',
    args.includes('--sync-only'),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
