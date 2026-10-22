import { db, type KioskDB } from './db';
import { createEventRepo } from './repos/eventRepo';
import { bytesToBase64, getFilePlatform } from './files/platform';
export interface BackupSnapshot {
  fileName: string;
  at: number;
  eventId: string;
  leads: import('./types').Lead[];
  sessions: import('./types').GameSession[];
}
const queues = new WeakMap<KioskDB, Promise<void>>();
export function backupEvent(
  eventId: string,
  force = true,
  database = db,
): Promise<void> {
  const run = async () => {
    try {
      const snapshot = await createEventRepo(database).snapshot(eventId);
      const key = `backups:${eventId}`;
      const previous = ((await database.settings.get(key))?.value ??
        []) as BackupSnapshot[];
      const previousCount = (
        await database.settings.get(`backupLeadCount:${eventId}`)
      )?.value as number | undefined;
      if (!force && snapshot.leads.length - (previousCount ?? 0) < 10) return;
      const at = Date.now();
      const d = new Date(at);
      const p = (n: number) => String(n).padStart(2, '0');
      // Se agrega ms para que dos backups en el mismo minuto no se sobreescriban.
      const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${at}`;
      const safeEvent = encodeURIComponent(eventId);
      const backup: BackupSnapshot = {
        at,
        eventId,
        fileName: `backup_${safeEvent}_${stamp}.json`,
        ...snapshot,
      };
      const adapter = getFilePlatform();
      if (adapter) {
        const path = 'KioskPuzzle/backups';
        await adapter.writeFile({
          path: `${path}/${backup.fileName}`,
          directory: 'DOCUMENTS',
          recursive: true,
          data: bytesToBase64(new TextEncoder().encode(JSON.stringify(backup))),
        });
        const prefix = `backup_${safeEvent}_`;
        const files = (
          await adapter.readdir({ path, directory: 'DOCUMENTS' })
        ).files
          .filter(
            (file) =>
              file.name.startsWith(prefix) && file.name.endsWith('.json'),
          )
          .sort((a, b) => b.name.localeCompare(a.name));
        for (const file of files.slice(5))
          await adapter.deleteFile({
            path: `${path}/${file.name}`,
            directory: 'DOCUMENTS',
          });
      }
      await database.transaction(
        'rw',
        database.settings,
        database.audit,
        async () => {
          // Web: conservar 5 snapshots en IndexedDB, sin diálogos ni descargas automáticas.
          await database.settings.put({
            key,
            value: adapter ? [] : [backup, ...previous].slice(0, 5),
          });
          await database.settings.put({
            key: `backupLeadCount:${eventId}`,
            value: snapshot.leads.length,
          });
          await database.audit.add({
            at,
            action: 'backup',
            detail: `${eventId}:${adapter ? 'documents' : 'indexeddb'}:${snapshot.leads.length}`,
          });
        },
      );
    } catch {
      try {
        await database.audit.add({
          at: Date.now(),
          action: 'backup_failed',
          detail: eventId,
        });
      } catch {
        /* Nunca interrumpir la captura. */
      }
    }
  };
  const next = (queues.get(database) ?? Promise.resolve()).then(run, run);
  queues.set(database, next);
  return next;
}
