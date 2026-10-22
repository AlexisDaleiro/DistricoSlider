import { eventRepo, fingerprintSessions } from '../repos/eventRepo';
import { exportColumns, rowsFromSnapshot } from './buildExportRows';
import { csvToUtf8BomBytes, toCsv } from './csv';
import { saveExportFile, type SavedExport } from './saveExportFile';
import { settingsRepo } from '../repos/settingsRepo';
interface StoredExport {
  saved: SavedExport;
  bytes: Uint8Array;
  mime: string;
  at: number;
  count: number;
}
export async function loadLastExport(
  eventId: string,
): Promise<ExportedFile | null> {
  const stored = await settingsRepo.get<StoredExport>(
    `lastExportFile:${eventId}`,
  );
  return stored
    ? {
        saved: stored.saved,
        file: new File([new Uint8Array(stored.bytes)], stored.saved.fileName, {
          type: stored.mime,
        }),
        at: stored.at,
        count: stored.count,
      }
    : null;
}
export interface ExportedFile {
  saved: SavedExport;
  file: File;
  at: number;
  count: number;
}
export async function exportEvent(
  eventId: string,
  prefix: string,
  separator: ';' | ',',
  format: 'csv' | 'xlsx',
  isAuthorized: () => boolean,
): Promise<ExportedFile> {
  const snapshot = await eventRepo.snapshot(eventId);
  const rows = rowsFromSnapshot(snapshot);
  const bytes =
    format === 'csv'
      ? csvToUtf8BomBytes(toCsv(rows, exportColumns(separator), separator))
      : await (await import('./xlsx')).toXlsx(rows);
  if (!isAuthorized()) throw new Error('La sesión admin expiró.');
  const at = Date.now();
  const fileName = `${prefix}_${eventId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${at}.${format}`;
  const mime =
    format === 'csv'
      ? 'text/csv;charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const saved = await saveExportFile(fileName, bytes, mime);
  await eventRepo.markExport(
    eventId,
    snapshot.leads.map((lead) => lead.uuid),
    fileName,
    fingerprintSessions(snapshot.sessions),
    { saved, bytes, mime, at, count: rows.length } satisfies StoredExport,
  );
  return {
    saved,
    file: new File([new Uint8Array(bytes)], fileName, { type: mime }),
    at,
    count: rows.length,
  };
}
