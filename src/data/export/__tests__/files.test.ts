// @vitest-environment jsdom
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, expect, it, vi } from 'vitest';
import { saveExportFile, shareExportFile } from '../saveExportFile';
import {
  bytesToBase64,
  setFilePlatform,
  type FilePlatform,
} from '../../files/platform';
afterEach(() => {
  setFilePlatform(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('descarga web incluye bytes exactos, retira el anchor y revoca URL sin URI obsoleta', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('Blob', NodeBlob);
  const blobs: Blob[] = [];
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:export';
    }),
    revokeObjectURL: vi.fn(),
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const bytes = new Uint8Array([239, 187, 191, 195, 177]);
  const result = await saveExportFile('leads.csv', bytes, 'text/csv');
  expect([...new Uint8Array(await blobs[0].arrayBuffer())]).toEqual([...bytes]);
  expect(click).toHaveBeenCalledTimes(1);
  expect(document.querySelector('a')).toBeNull();
  expect(result).toMatchObject({ location: 'browser', uri: '' });
  vi.advanceTimersByTime(5000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
  await expect(
    saveExportFile('../outside.csv', bytes, 'text/csv'),
  ).rejects.toThrow();
});
it('Documents escribe base64 exacto con BOM; fallback informa Data y comparte URI persistente', async () => {
  const adapter: FilePlatform = {
    writeFile: vi
      .fn()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValue({ uri: 'file://data/leads.csv' }),
    readdir: vi.fn(),
    deleteFile: vi.fn(),
    share: vi.fn().mockResolvedValue(undefined),
  };
  setFilePlatform(adapter);
  const bytes = new Uint8Array([239, 187, 191, 65]);
  const result = await saveExportFile('leads.csv', bytes, 'text/csv');
  expect(adapter.writeFile).toHaveBeenNthCalledWith(1, {
    path: 'KioskPuzzle/exports/leads.csv',
    directory: 'DOCUMENTS',
    data: bytesToBase64(bytes),
    recursive: true,
  });
  expect(adapter.writeFile).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ directory: 'DATA' }),
  );
  expect(result.location).toBe('data');
  await shareExportFile(result.uri, 'Leads');
  expect(adapter.share).toHaveBeenCalledWith({
    url: 'file://data/leads.csv',
    title: 'Leads',
    dialogTitle: 'Leads',
  });
});
it('compartir web usa File, no un blob revocado; si no se puede compartir vuelve a descargar', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('File', NodeFile);
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: () => true,
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
  const file = new File(['ñ'], 'leads.csv', { type: 'text/csv' });
  await shareExportFile('', 'Leads', file);
  expect(share).toHaveBeenCalledWith({ files: [file], title: 'Leads' });
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: () => false,
  });
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:retry',
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await shareExportFile('', 'Leads', file);
  delete (navigator as { canShare?: unknown }).canShare;
  delete (navigator as { share?: unknown }).share;
});
