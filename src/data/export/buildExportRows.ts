import { eventRepo } from '../repos/eventRepo';
import type { Lead, GameSession } from '../types';
import { dayKey } from '../../shared/lib/time';
import type { CsvColumn } from './csv';
export function localDateTime(at: number): string {
  const d = new Date(at);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${dayKey(at)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
export function rowsFromSnapshot({
  leads,
  sessions,
}: {
  leads: Lead[];
  sessions: GameSession[];
}) {
  return leads.map((lead) => {
    const games = sessions.filter((s) => s.leadUuid === lead.uuid);
    const best = games
      .filter((s) => s.status === 'completed')
      .sort(
        (a, b) =>
          a.durationMs! - b.durationMs! ||
          a.moves! - b.moves! ||
          a.finishedAt! - b.finishedAt!,
      )[0];
    const latest = [...games].sort(
      (a, b) => b.startedAt - a.startedAt || (b.id ?? 0) - (a.id ?? 0),
    )[0];
    return {
      fecha_hora: localDateTime(lead.createdAt),
      nombre: lead.name,
      email: lead.email,
      empresa: lead.company ?? '',
      telefono: lead.phone ?? '',
      consentimiento: lead.consent,
      version_consentimiento: lead.consentVersion,
      acepta_marketing: lead.marketingOptIn,
      mejor_tiempo_seg:
        best?.durationMs === undefined ? null : best.durationMs / 1000,
      movimientos: best?.moves ?? null,
      partidas_jugadas: games.length,
      estado_ultima_partida: latest?.status ?? '',
      evento: lead.eventId,
      lead_id: lead.uuid,
    };
  });
}
export type ExportRow = ReturnType<typeof rowsFromSnapshot>[number];
export const EXPORT_HEADERS: (keyof ExportRow)[] = [
  'fecha_hora',
  'nombre',
  'email',
  'empresa',
  'telefono',
  'consentimiento',
  'version_consentimiento',
  'acepta_marketing',
  'mejor_tiempo_seg',
  'movimientos',
  'partidas_jugadas',
  'estado_ultima_partida',
  'evento',
  'lead_id',
];
export const exportColumns = (sep: ';' | ','): CsvColumn<ExportRow>[] =>
  EXPORT_HEADERS.map((header) => ({
    header,
    value: (row) =>
      header === 'mejor_tiempo_seg' && row[header] !== null
        ? row[header]!.toFixed(3).replace('.', sep === ';' ? ',' : '.')
        : row[header],
  }));
export async function buildExportRows(eventId: string) {
  return rowsFromSnapshot(await eventRepo.snapshot(eventId));
}
