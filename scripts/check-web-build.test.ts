import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { checkWebBuild } from './check-web-build';
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kiosk-release-test-'));
  await mkdir(join(root, '.vite'));
  await writeFile(
    join(root, '.vite/manifest.json'),
    JSON.stringify({
      'index.html': {
        file: 'entry.js',
        isEntry: true,
        imports: ['shared'],
        css: ['style.css'],
        dynamicImports: ['xlsx'],
      },
      shared: { file: 'shared.js', imports: ['shared'] },
      xlsx: { file: 'xlsx.js' },
    }),
  );
  for (const [file, code] of Object.entries({
    'entry.js': 'export const entry=1;',
    'shared.js': 'export const shared=2;',
    'style.css': 'body{margin:0}',
    'xlsx.js': 'export const xlsx=3;',
  }))
    await writeFile(join(root, file), code);
});
afterEach(async () => {
  if (!root.startsWith(join(tmpdir(), 'kiosk-release-test-')))
    throw new Error('Directorio inesperado');
  await rm(root, { recursive: true, force: true });
});
it('suma JS/CSS iniciales una vez y excluye los chunks dinámicos', async () => {
  const report = await checkWebBuild(root);
  expect(report.files.sort()).toEqual(['entry.js', 'shared.js', 'style.css']);
  expect(report.initialGzipBytes).toBe(
    gzipSync('export const entry=1;').length +
      gzipSync('export const shared=2;').length +
      gzipSync('body{margin:0}').length,
  );
});
it('rechaza herramientas QA aun dentro de un chunk dinámico', async () => {
  await writeFile(
    join(root, 'xlsx.js'),
    'document.querySelector("[data-qa-report]")',
  );
  await expect(checkWebBuild(root)).rejects.toThrow('contiene herramientas QA');
});
it('bloquea un bundle sobre el límite sin cambiar el umbral de warnings de Vite', async () => {
  await expect(checkWebBuild(root, 1)).rejects.toThrow('Bundle inicial');
});
