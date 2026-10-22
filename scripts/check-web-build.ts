import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

interface Chunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  css?: string[];
}
/** Comprueba el artefacto real, sin importar módulos de la app ni habilitar QA. */
export async function checkWebBuild(
  directory = resolve('dist'),
  limit = 500 * 1024,
) {
  const manifest = JSON.parse(
    await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'),
  ) as Record<string, Chunk>;
  const initial = new Set<string>(),
    visited = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Chunk ausente: ${key}`);
    initial.add(chunk.file);
    chunk.css?.forEach((path) => initial.add(path));
    chunk.imports?.forEach(visit);
  };
  const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry);
  if (!entries.length) throw new Error('El build no tiene entry points.');
  entries.forEach(([key]) => visit(key));
  const read = async (path: string) => {
    const file = resolve(directory, path),
      rel = relative(resolve(directory), file);
    if (rel.startsWith('..') || isAbsolute(rel))
      throw new Error('Archivo fuera del build.');
    return readFile(file);
  };
  for (const chunk of Object.values(manifest)) {
    if (!chunk.file.endsWith('.js')) continue;
    const code = await read(chunk.file);
    if (/data-qa-solve|data-qa-report|usedJSHeapSize/.test(code.toString()))
      throw new Error('El build de producción contiene herramientas QA.');
  }
  let initialGzipBytes = 0;
  for (const file of initial)
    initialGzipBytes += gzipSync(await read(file)).length;
  if (initialGzipBytes >= limit)
    throw new Error(
      `Bundle inicial ${initialGzipBytes} bytes gzip; debe ser menor a ${limit}.`,
    );
  return { initialGzipBytes, files: [...initial] };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await checkWebBuild();
    console.log(
      `Release sin herramientas QA; bundle inicial ${(result.initialGzipBytes / 1024).toFixed(1)} KiB gzip.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
