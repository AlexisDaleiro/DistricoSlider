import { expect, it } from 'vitest';
import { csvToUtf8BomBytes, escapeCsvValue, toCsv } from '../csv';
import {
  EXPORT_HEADERS,
  exportColumns,
  localDateTime,
  rowsFromSnapshot,
} from '../buildExportRows';
import { toXlsx } from '../xlsx';
import type { Lead, GameSession } from '../../types';

it.each([
  ['a;b', '"a;b"'],
  ['A "B"', '"A ""B"""'],
  ['a\nb', '"a\nb"'],
  ['=CMD() ', "'=CMD() "],
  ['+59899123456', "'+59899123456"],
  ['-1', "'-1"],
  ['@SUM(A1)', "'@SUM(A1)"],
  ['\tformula', "'\tformula"],
  ['  =SUM(A1)', "'  =SUM(A1)"],
  [true, 'SI'],
  [false, 'NO'],
  [null, ''],
  [undefined, ''],
])('escapa/neutraliza %s sin romper el CSV', (value, expected) =>
  expect(escapeCsvValue(value, ';')).toBe(expected),
);

it('CSV tiene CRLF, columnas estables, BOM exacto y roundtrip UTF-8 sin línea sep=', () => {
  const csv = toCsv(
    [{ name: 'Peña, María', company: 'A;B' }],
    [
      { header: 'nombre', value: (r) => r.name },
      { header: 'empresa', value: (r) => r.company },
    ],
  );
  expect(csv).toBe('nombre;empresa\r\nPeña, María;"A;B"\r\n');
  const bytes = csvToUtf8BomBytes(csv);
  expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
  expect(new TextDecoder().decode(bytes)).toBe(csv);
  expect(csv).not.toContain('sep=');
  expect(() => toCsv([], [], '|')).toThrow();
});

const at = new Date(2026, 9, 21, 12, 34, 56).getTime();
const lead: Lead = {
  uuid: 'lead',
  eventId: 'expo',
  brandId: 'demo',
  createdAt: at,
  dayKey: '2026-10-21',
  name: 'Peña, María',
  email: 'maria@example.test',
  emailNormalized: 'maria@example.test',
  company: 'A;B',
  phone: '+59899123456',
  consent: true,
  consentVersion: 'v1',
  marketingOptIn: false,
};
const session = (
  uuid: string,
  status: GameSession['status'],
  time: number,
  moves: number,
  startedAt = at,
): GameSession => ({
  uuid,
  leadUuid: 'lead',
  eventId: 'expo',
  dayKey: '2026-10-21',
  gridSize: 3,
  imageSrc: 'puzzle.jpg',
  startedAt,
  finishedAt: at + 1000,
  durationMs: time,
  moves,
  status,
});
it('una fila por lead, mejor sesión propia, recuento y última partida sin dedupe de leads repetidos', () => {
  const rows = rowsFromSnapshot({
    leads: [lead, { ...lead, uuid: 'repeat' }],
    sessions: [
      session('s1', 'completed', 1234, 5),
      session('s2', 'completed', 1234, 4),
      session('s3', 'timeout', 900, 1, at + 2000),
    ],
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    fecha_hora: '2026-10-21 12:34:56',
    mejor_tiempo_seg: 1.234,
    movimientos: 4,
    partidas_jugadas: 3,
    estado_ultima_partida: 'timeout',
  });
  expect(rows[1]).toMatchObject({
    mejor_tiempo_seg: null,
    movimientos: null,
    partidas_jugadas: 0,
    estado_ultima_partida: '',
  });
  expect(localDateTime(at)).toBe('2026-10-21 12:34:56');
  expect(toCsv(rows, exportColumns(';'), ';')).toContain('1,234;4;3;timeout');
  expect(toCsv(rows, exportColumns(','), ',')).toContain('1.234,4,3,timeout');
});

it('XLSX se vuelve a abrir con columnas, números y tildes; entradas fórmula siguen siendo texto', async () => {
  const { read, utils } = await import('xlsx');
  const row = rowsFromSnapshot({
    leads: [{ ...lead, company: '=CMD()' }],
    sessions: [session('s', 'completed', 1234, 4)],
  })[0];
  const workbook = read(await toXlsx([row]), { type: 'array' });
  const sheet = workbook.Sheets.Leads;
  expect(utils.sheet_to_json(sheet, { header: 1 })[0]).toEqual(EXPORT_HEADERS);
  const parsed = utils.sheet_to_json<Record<string, unknown>>(sheet)[0];
  expect(parsed.nombre).toBe('Peña, María');
  expect(parsed.mejor_tiempo_seg).toBe(1.234);
  expect(parsed.empresa).toBe("'=CMD()");
  expect(sheet.D2.f).toBeUndefined();
  expect(sheet.I2.t).toBe('n');
});
