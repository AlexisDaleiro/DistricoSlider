import { bytesToBase64, getFilePlatform } from '../files/platform';
export interface SavedExport {
  uri: string;
  location: 'browser' | 'documents' | 'data';
  path: string;
  fileName: string;
}
export async function saveExportFile(
  fileName: string,
  bytes: Uint8Array,
  mime: string,
): Promise<SavedExport> {
  if (!/^[\p{L}\p{N}_.-]+$/u.test(fileName))
    throw new Error('Nombre de archivo inválido.');
  const adapter = getFilePlatform();
  if (!adapter) {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: mime }),
    );
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: fileName,
    });
    document.body.append(a);
    try {
      a.click();
    } finally {
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    // No devolver el blob revocado como si fuera un archivo persistente.
    return { uri: '', location: 'browser', path: fileName, fileName };
  }
  const path = `KioskPuzzle/exports/${fileName}`;
  try {
    const result = await adapter.writeFile({
      path,
      data: bytesToBase64(bytes),
      directory: 'DOCUMENTS',
      recursive: true,
    });
    return { uri: result.uri, location: 'documents', path, fileName };
  } catch {
    const result = await adapter.writeFile({
      path,
      data: bytesToBase64(bytes),
      directory: 'DATA',
      recursive: true,
    });
    return { uri: result.uri, location: 'data', path, fileName };
  }
}
export async function shareExportFile(uri: string, title: string, file?: File) {
  const adapter = getFilePlatform();
  if (adapter && uri)
    return adapter.share({ url: uri, title, dialogTitle: title });
  if (file && navigator.canShare?.({ files: [file] }))
    return navigator.share({ files: [file], title });
  if (file) {
    await saveExportFile(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    return;
  }
  throw new Error('Archivo no disponible para compartir.');
}
