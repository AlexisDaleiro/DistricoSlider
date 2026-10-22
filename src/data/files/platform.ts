/** Contrato compartido por archivos web y plugins Android; los repos no importan Capacitor. */
export interface FilePlatform {
  writeFile(options: {
    path: string;
    data: string;
    directory: 'DOCUMENTS' | 'DATA';
    recursive: true;
  }): Promise<{ uri: string }>;
  readdir(options: {
    path: string;
    directory: 'DOCUMENTS';
  }): Promise<{ files: { name: string }[] }>;
  deleteFile(options: { path: string; directory: 'DOCUMENTS' }): Promise<void>;
  share(options: {
    url: string;
    title: string;
    dialogTitle: string;
  }): Promise<void>;
  battery?(): Promise<{ level: number; isCharging: boolean }>;
}
let platform: FilePlatform | null = null;
export const getFilePlatform = () => platform;
export function setFilePlatform(adapter: FilePlatform | null) {
  platform = adapter;
}
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
