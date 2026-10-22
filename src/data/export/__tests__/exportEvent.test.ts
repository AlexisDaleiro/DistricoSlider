import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { createLeadsRepo } from '../../repos/leadsRepo';
import { eventRepo } from '../../repos/eventRepo';
import { setFilePlatform, type FilePlatform } from '../../files/platform';
import { exportEvent, loadLastExport } from '../exportEvent';
const adapter: FilePlatform = {
  writeFile: vi.fn(),
  readdir: vi.fn(),
  deleteFile: vi.fn(),
  share: vi.fn(),
};
beforeEach(async () => {
  await db.open();
  setFilePlatform(adapter);
  vi.mocked(adapter.writeFile)
    .mockReset()
    .mockResolvedValue({ uri: 'file://leads.csv' });
});
afterEach(async () => {
  setFilePlatform(null);
  await db.delete();
});
async function lead() {
  return createLeadsRepo(db).createWithSession(
    {
      eventId: 'expo',
      brandId: 'demo',
      name: 'María Peña',
      email: 'maria@example.test',
      company: 'A;B',
      consent: true,
      consentVersion: 'v1',
      marketingOptIn: false,
    },
    3,
    'a.jpg',
  );
}
it('exporta bytes CSV parseables, marca export solo tras guardar y conserva una fila por lead', async () => {
  const first = await lead();
  await lead();
  const result = await exportEvent('expo', 'leads', ';', 'csv', () => true);
  expect(result.count).toBe(2);
  const bytes = Buffer.from(
    vi.mocked(adapter.writeFile).mock.calls[0][0].data,
    'base64',
  );
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  const { read, utils } = await import('xlsx');
  const book = read(bytes, { type: 'buffer', FS: ';' });
  const rows = utils.sheet_to_json<Record<string, unknown>>(
    book.Sheets[book.SheetNames[0]],
  );
  expect(rows).toHaveLength(2);
  expect(rows[0].nombre).toBe('María Peña');
  expect(rows[0].empresa).toBe('A;B');
  expect((await db.leads.get(first.lead.id!))?.exportedAt).toBeGreaterThan(0);
  expect((await eventRepo.lastExport('expo'))?.leadUuids).toHaveLength(2);
  db.close();
  await db.open();
  const restored = await loadLastExport('expo');
  expect(restored?.count).toBe(2);
  expect(restored?.file.name).toBe(result.file.name);
  expect([...new Uint8Array(await restored!.file.arrayBuffer())]).toEqual([
    ...bytes,
  ]);
});
it('si falla el archivo no marca export ni habilita borrado; sesión expirada no genera archivo', async () => {
  const first = await lead();
  vi.mocked(adapter.writeFile).mockRejectedValue(new Error('no space'));
  await expect(
    exportEvent('expo', 'leads', ';', 'csv', () => true),
  ).rejects.toThrow('no space');
  expect((await db.leads.get(first.lead.id!))?.exportedAt).toBeUndefined();
  expect(await eventRepo.lastExport('expo')).toBeUndefined();
  vi.mocked(adapter.writeFile).mockClear();
  await expect(
    exportEvent('expo', 'leads', ';', 'csv', () => false),
  ).rejects.toThrow('expiró');
  expect(adapter.writeFile).not.toHaveBeenCalled();
});
