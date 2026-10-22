import { db, type KioskDB } from '../db';
import { dayKey } from '../../shared/lib/time';
import type { GameSession } from '../types';
export interface ExportReceipt {
  at: number;
  leadUuids: string[];
  fileName: string;
  sessionFingerprint: string;
}
export const fingerprintSessions = (sessions: readonly GameSession[]) =>
  JSON.stringify(
    [...sessions]
      .sort((a, b) => a.uuid.localeCompare(b.uuid))
      .map((s) => [
        s.uuid,
        s.status,
        s.startedAt,
        s.finishedAt,
        s.durationMs,
        s.moves,
      ]),
  );
export const lastExportKey = (eventId: string) => `lastExport:${eventId}`;
export const gridKey = (eventId: string) => `gridSize:${eventId}`;
export function createEventRepo(database: KioskDB) {
  const snapshot = (eventId: string) =>
    database.transaction('r', database.leads, database.sessions, async () => ({
      leads: await database.leads
        .where('eventId')
        .equals(eventId)
        .sortBy('createdAt'),
      sessions: await database.sessions
        .where('eventId')
        .equals(eventId)
        .toArray(),
    }));
  const lastExport = async (eventId: string) =>
    (await database.settings.get(lastExportKey(eventId)))?.value as
      ExportReceipt | undefined;
  return {
    snapshot,
    lastExport,
    async metrics(eventId: string) {
      const { leads, sessions } = await snapshot(eventId);
      const completed = sessions.filter(
        (s) => s.status === 'completed' && s.durationMs !== undefined,
      );
      const today = completed.filter((s) => s.dayKey === dayKey());
      const hours = Array.from({ length: 24 }, () => 0);
      leads
        .filter((l) => l.dayKey === dayKey())
        .forEach((l) => hours[new Date(l.createdAt).getHours()]++);
      return {
        total: leads.length,
        today: leads.filter((l) => l.dayKey === dayKey()).length,
        completed: completed.length,
        abandoned: sessions.filter((s) => s.status === 'abandoned').length,
        timeout: sessions.filter((s) => s.status === 'timeout').length,
        completionRate: sessions.length
          ? (completed.length / sessions.length) * 100
          : 0,
        bestToday: today.length
          ? Math.min(...today.map((s) => s.durationMs!))
          : null,
        average: completed.length
          ? completed.reduce((sum, s) => sum + s.durationMs!, 0) /
            completed.length
          : null,
        marketing: leads.length
          ? (leads.filter((l) => l.marketingOptIn).length / leads.length) * 100
          : 0,
        hours,
        lastExport: await lastExport(eventId),
      };
    },
    markExport: (
      eventId: string,
      leadUuids: string[],
      fileName: string,
      sessionFingerprint?: string,
      savedFile?: unknown,
    ) =>
      database.transaction(
        'rw',
        database.leads,
        database.sessions,
        database.settings,
        database.audit,
        async () => {
          const receipt = {
            at: Date.now(),
            leadUuids,
            fileName,
            sessionFingerprint:
              sessionFingerprint ??
              fingerprintSessions(
                await database.sessions
                  .where('eventId')
                  .equals(eventId)
                  .toArray(),
              ),
          };
          await database.leads
            .where('eventId')
            .equals(eventId)
            .and((l) => leadUuids.includes(l.uuid))
            .modify({ exportedAt: receipt.at });
          await database.settings.put({
            key: lastExportKey(eventId),
            value: receipt,
          });
          if (savedFile)
            await database.settings.put({
              key: `lastExportFile:${eventId}`,
              value: savedFile,
            });
          await database.audit.add({
            at: receipt.at,
            action: 'export',
            detail: `${eventId}:${fileName}:${leadUuids.length}`,
          });
          return receipt;
        },
      ),
    setGrid: (eventId: string, size: 3 | 4) =>
      database.transaction(
        'rw',
        database.settings,
        database.audit,
        async () => {
          await database.settings.put({ key: gridKey(eventId), value: size });
          await database.audit.add({
            at: Date.now(),
            action: 'grid_changed',
            detail: `${eventId}:${size}`,
          });
        },
      ),
    /** La autorización PIN/hold se verifica en el controlador admin antes de invocar. */
    deleteEvent: (
      eventId: string,
      freshnessMs: number,
      expectedExportAt: number,
    ) =>
      database.transaction(
        'rw',
        database.leads,
        database.sessions,
        database.settings,
        database.audit,
        async () => {
          const receipt = await lastExport(eventId);
          const now = Date.now();
          if (
            !receipt ||
            receipt.at !== expectedExportAt ||
            receipt.at > now ||
            now - receipt.at >= freshnessMs
          )
            throw new Error('Se requiere una exportación reciente.');
          const leads = await database.leads
            .where('eventId')
            .equals(eventId)
            .toArray();
          if (
            leads.some(
              (l) =>
                !receipt.leadUuids.includes(l.uuid) ||
                (l.exportedAt ?? 0) < receipt.at,
            )
          )
            throw new Error('Hay leads posteriores a la exportación.');
          if (
            receipt.sessionFingerprint !==
            fingerprintSessions(
              await database.sessions
                .where('eventId')
                .equals(eventId)
                .toArray(),
            )
          )
            throw new Error('Hay partidas posteriores a la exportación.');
          await database.leads.where('eventId').equals(eventId).delete();
          await database.sessions.where('eventId').equals(eventId).delete();
          await database.settings.delete(lastExportKey(eventId));
          await database.settings.delete(`lastExportFile:${eventId}`);
          await database.settings.delete(`backupLeadCount:${eventId}`);
          // Conservar PIN, auditoría y backups. El marcador de ranking previo no afecta partidas futuras.
          await database.audit.add({
            at: now,
            action: 'event_deleted',
            detail: `${eventId}:${leads.length}`,
          });
        },
      ),
  };
}
export const eventRepo = createEventRepo(db);
