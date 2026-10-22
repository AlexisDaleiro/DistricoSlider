import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KioskDB } from '../db';
import { createEventRepo } from '../repos/eventRepo';
import { createLeadsRepo } from '../repos/leadsRepo';
import { createSessionsRepo } from '../repos/sessionsRepo';
import { backupEvent, type BackupSnapshot } from '../backup';
import { setFilePlatform, type FilePlatform } from '../files/platform';
import { dayKey } from '../../shared/lib/time';
let database: KioskDB;
let now: number;
beforeEach(async () => {
  database = new KioskDB(`test-admin-${crypto.randomUUID()}`);
  await database.open();
  now = new Date(2026, 9, 21, 12).getTime();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(async () => {
  setFilePlatform(null);
  vi.restoreAllMocks();
  await database.delete();
});
const add = (eventId = 'event') =>
  createLeadsRepo(database).createWithSession(
    {
      eventId,
      brandId: 'demo',
      name: 'María Peña',
      email: 'maria@example.test',
      consent: true,
      consentVersion: 'v1',
      marketingOptIn: true,
    },
    3,
    'a.jpg',
  );
it('métricas se limitan al evento e incluyen día, finalización, promedio y leads por hora', async () => {
  const a = await add();
  const b = await add();
  await add('other');
  await createSessionsRepo(database).finish(a.session.uuid, {
    durationMs: 1000,
    moves: 3,
  });
  await createSessionsRepo(database).markAbandoned(b.session.uuid);
  const metrics = await createEventRepo(database).metrics('event');
  expect(metrics).toMatchObject({
    total: 2,
    today: 2,
    completed: 1,
    abandoned: 1,
    timeout: 0,
    completionRate: 50,
    bestToday: 1000,
    average: 1000,
    marketing: 100,
  });
  expect(metrics.hours[12]).toBe(2);
});
it('no borra resultados modificados después de exportar y revierte todo si falla la auditoría', async () => {
  const first = await add();
  const repo = createEventRepo(database);
  const old = await repo.markExport('event', [first.lead.uuid], 'before.csv');
  await createSessionsRepo(database).finish(first.session.uuid, {
    durationMs: 1200,
    moves: 4,
  });
  await expect(repo.deleteEvent('event', 600000, old.at)).rejects.toThrow(
    'partidas posteriores',
  );
  const current = await repo.markExport(
    'event',
    [first.lead.uuid],
    'after.csv',
  );
  vi.spyOn(database.audit, 'add').mockRejectedValueOnce(
    new Error('audit disk error'),
  );
  await expect(repo.deleteEvent('event', 600000, current.at)).rejects.toThrow(
    'audit disk error',
  );
  expect(await database.leads.count()).toBe(1);
  expect(await database.sessions.count()).toBe(1);
});
it('export marca solo incluidos y borrado protege antigüedad/nuevos leads, conserva otro evento/PIN/audit', async () => {
  const repo = createEventRepo(database);
  const first = await add();
  await add('other');
  await database.settings.put({
    key: 'adminPin:demo',
    value: { hash: 'kept' },
  });
  await expect(repo.deleteEvent('event', 600000, now)).rejects.toThrow(
    'exportación',
  );
  const receipt = await repo.markExport(
    'event',
    [first.lead.uuid],
    'leads.csv',
  );
  expect((await database.leads.get(first.lead.id!))?.exportedAt).toBe(now);
  now += 600000;
  await expect(repo.deleteEvent('event', 600000, receipt.at)).rejects.toThrow();
  now -= 600000;
  const later = await add();
  await expect(repo.deleteEvent('event', 600000, receipt.at)).rejects.toThrow(
    'posteriores',
  );
  const fresh = await repo.markExport(
    'event',
    [first.lead.uuid, later.lead.uuid],
    'all.csv',
  );
  await repo.deleteEvent('event', 600000, fresh.at);
  expect(await database.leads.where('eventId').equals('event').count()).toBe(0);
  expect(await database.sessions.where('eventId').equals('event').count()).toBe(
    0,
  );
  expect(await database.leads.where('eventId').equals('other').count()).toBe(1);
  expect(await database.settings.get('adminPin:demo')).toBeTruthy();
  expect(
    await database.audit
      .filter((entry) => entry.action === 'event_deleted')
      .count(),
  ).toBe(1);
});
it('backup cada 10 leads y forzado al admin conserva 5 snapshots completos y separados por evento', async () => {
  for (let i = 0; i < 9; i++) await add();
  await backupEvent('event', false, database);
  expect(await database.settings.get('backups:event')).toBeUndefined();
  await add();
  await backupEvent('event', false, database);
  let backups = (await database.settings.get('backups:event'))
    ?.value as BackupSnapshot[];
  expect(backups).toHaveLength(1);
  expect(backups[0].leads).toHaveLength(10);
  expect(backups[0].sessions).toHaveLength(10);
  await backupEvent('event', false, database);
  expect((await database.settings.get('backups:event'))?.value).toHaveLength(1);
  for (let i = 0; i < 6; i++) {
    now++;
    await backupEvent('event', true, database);
  }
  backups = (await database.settings.get('backups:event'))
    ?.value as BackupSnapshot[];
  expect(backups).toHaveLength(5);
  expect(backups[0].at).toBe(now);
  await add('other');
  await backupEvent('other', true, database);
  expect((await database.settings.get('backups:other'))?.value).toHaveLength(1);
  expect(backups[0].leads.every((lead) => lead.dayKey === dayKey(now))).toBe(
    true,
  );
});
it('adaptador de archivos escribe snapshot en Documents, poda a cinco y audita fallos sin rechazar', async () => {
  const adapter: FilePlatform = {
    writeFile: vi.fn().mockResolvedValue({ uri: 'file://backup' }),
    readdir: vi.fn().mockResolvedValue({
      files: Array.from({ length: 7 }, (_, i) => ({
        name: `backup_event_20261021-${i}.json`,
      })),
    }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    share: vi.fn(),
  };
  setFilePlatform(adapter);
  await add();
  await backupEvent('event', true, database);
  expect(adapter.writeFile).toHaveBeenCalledWith(
    expect.objectContaining({
      directory: 'DOCUMENTS',
      recursive: true,
      path: expect.stringContaining('KioskPuzzle/backups/backup_event_'),
    }),
  );
  expect(adapter.deleteFile).toHaveBeenCalledTimes(2);
  vi.mocked(adapter.writeFile).mockRejectedValueOnce(new Error('disk full'));
  await expect(backupEvent('event', true, database)).resolves.toBeUndefined();
  expect(
    await database.audit
      .filter((entry) => entry.action === 'backup_failed')
      .count(),
  ).toBe(1);
  expect(await database.leads.count()).toBe(1);
});
