export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}
const FORMULA_START = /^[=+\-@\t\r\n]|^\s+[=+\-@]/;
export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}
export function escapeCsvValue(v: unknown, sep: string): string {
  let s =
    v == null ? '' : typeof v === 'boolean' ? (v ? 'SI' : 'NO') : String(v);
  s = neutralizeFormula(s);
  if (s.includes('"') || s.includes(sep) || /[\r\n]/.test(s))
    s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  sep = ';',
): string {
  if (sep !== ';' && sep !== ',') throw new Error('Separador CSV inválido.');
  const head = columns.map((c) => escapeCsvValue(c.header, sep)).join(sep);
  return (
    [
      head,
      ...rows.map((r) =>
        columns.map((c) => escapeCsvValue(c.value(r), sep)).join(sep),
      ),
    ].join('\r\n') + '\r\n'
  );
}
export function csvToUtf8BomBytes(csv: string): Uint8Array {
  const body = new TextEncoder().encode(csv);
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}
