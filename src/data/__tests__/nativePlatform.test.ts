import { afterEach, expect, it, vi } from 'vitest';
import { installNativeFilePlatform } from '../files/nativePlatform';
import { getFilePlatform, setFilePlatform } from '../files/platform';
import { saveExportFile, shareExportFile } from '../export/saveExportFile';

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  write: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  share: vi.fn(),
  battery: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS', Data: 'DATA' },
  Filesystem: {
    writeFile: mocks.write,
    readdir: mocks.list,
    deleteFile: mocks.delete,
  },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@capacitor/device', () => ({
  Device: { getBatteryInfo: mocks.battery },
}));
afterEach(() => {
  setFilePlatform(null);
  vi.resetAllMocks();
});
it('navegador conserva Blob y no instala plataforma nativa', () => {
  mocks.native.mockReturnValue(false);
  installNativeFilePlatform();
  expect(getFilePlatform()).toBeNull();
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.battery).not.toHaveBeenCalled();
});
it('CSV conserva bytes BOM/base64 en Documents y comparte la URI local exacta', async () => {
  mocks.native.mockReturnValue(true);
  mocks.write.mockResolvedValue({
    uri: 'file:///storage/emulated/0/Documents/KioskPuzzle/exports/test.csv',
  });
  installNativeFilePlatform();
  const saved = await saveExportFile(
    'test.csv',
    new Uint8Array([239, 187, 191, 65]),
    'text/csv',
  );
  expect(mocks.write).toHaveBeenCalledWith({
    path: 'KioskPuzzle/exports/test.csv',
    data: '77u/QQ==',
    directory: 'DOCUMENTS',
    recursive: true,
  });
  expect(saved.location).toBe('documents');
  await shareExportFile(saved.uri, 'Compartir');
  expect(mocks.share).toHaveBeenCalledWith({
    url: saved.uri,
    title: 'Compartir',
    dialogTitle: 'Compartir',
  });
});
it('Documents denegado cae a Data; listado/poda y batería usan plugins reales adaptados', async () => {
  mocks.native.mockReturnValue(true);
  mocks.write
    .mockRejectedValueOnce(new Error('denegado'))
    .mockResolvedValueOnce({ uri: 'file:///data/file.csv' });
  mocks.list.mockResolvedValue({
    files: [{ name: 'backup.json', type: 'file' }],
  });
  mocks.battery.mockResolvedValue({ batteryLevel: 0.75, isCharging: true });
  installNativeFilePlatform();
  const saved = await saveExportFile(
    'test.csv',
    new Uint8Array([65]),
    'text/csv',
  );
  expect(saved.location).toBe('data');
  expect(mocks.write.mock.calls[1][0].directory).toBe('DATA');
  const platform = getFilePlatform()!;
  expect(
    (
      await platform.readdir({
        path: 'KioskPuzzle/backups',
        directory: 'DOCUMENTS',
      })
    ).files[0].name,
  ).toBe('backup.json');
  await platform.deleteFile({
    path: 'KioskPuzzle/backups/old.json',
    directory: 'DOCUMENTS',
  });
  expect(mocks.delete).toHaveBeenCalledWith({
    path: 'KioskPuzzle/backups/old.json',
    directory: 'DOCUMENTS',
  });
  expect(await platform.battery!()).toEqual({ level: 0.75, isCharging: true });
  mocks.battery.mockResolvedValue({});
  await expect(platform.battery!()).rejects.toThrow('Batería no disponible');
});
