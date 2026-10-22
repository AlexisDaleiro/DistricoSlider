import type { ExportRow } from './buildExportRows';
import { EXPORT_HEADERS } from './buildExportRows';
import { neutralizeFormula } from './csv';
export async function toXlsx(rows: readonly ExportRow[]): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const safeRows = rows.map((row) =>
    Object.fromEntries(
      EXPORT_HEADERS.map((key) => [
        key,
        typeof row[key] === 'string' ? neutralizeFormula(row[key]) : row[key],
      ]),
    ),
  );
  const sheet = XLSX.utils.json_to_sheet(safeRows, { header: EXPORT_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Leads');
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
  );
}
