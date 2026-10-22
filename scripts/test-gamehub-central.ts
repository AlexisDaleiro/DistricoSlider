/** Prueba el Code.gs entregado, en memoria. No publica ni modifica la central. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createHash, createHmac } from 'node:crypto';
import {
  sdk,
  type HubConfig,
  type HubEvent,
  type Receipt,
} from '../src/integrations/gamehub/sdk';

const directory = process.argv[2];
if (!directory)
  throw new Error('Indicá la carpeta del paquete Central-Juegos-Integracion.');
const source = await readFile(resolve(directory, 'Code.gs'), 'utf8');
type Cell = string | number | boolean;
class Sheet {
  constructor(readonly rows: Cell[][]) {}
  getLastRow() {
    return this.rows.length;
  }
  appendRow(values: Cell[]) {
    this.rows.push([...values]);
  }
  getRange(row: number, column: number, height = 1, width = 1) {
    const getValues = () =>
      Array.from({ length: height }, (_, index) =>
        Array.from(
          { length: width },
          (_, col) => this.rows[row - 1 + index]?.[column - 1 + col] ?? '',
        ),
      );
    return {
      getValues,
      getValue: () => getValues()[0][0],
      setValues: (values: Cell[][]) =>
        values.forEach((cells, index) => {
          this.rows[row - 1 + index] ??= [];
          cells.forEach((value, col) => {
            this.rows[row - 1 + index][column - 1 + col] = value;
          });
        }),
      createTextFinder: (value: string) => {
        const finder = {
          matchEntireCell: () => finder,
          useRegularExpression: () => finder,
          findNext: () => {
            const index = getValues().findIndex(
              (values) => String(values[0]) === value,
            );
            return index < 0 ? null : { getRow: () => row + index };
          },
        };
        return finder;
      },
    };
  }
}
const sheets = new Map<string, Sheet>();
const properties: Record<string, string> = {
  SPREADSHEET_ID: 'test-memory-sheet',
  PARTICIPANT_SALT: 'test-private-server-salt',
};
const context = createContext({
  console,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key: string) => properties[key],
    }),
  },
  SpreadsheetApp: {
    openById: () => ({ getSheetByName: (name: string) => sheets.get(name) }),
    flush: () => {},
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      hasLock: () => true,
      releaseLock: () => {},
    }),
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_algorithm: string, value: string) => [
      ...createHash('sha256').update(value).digest(),
    ],
    computeHmacSha256Signature: (value: string, key: string) => [
      ...createHmac('sha256', key).update(value).digest(),
    ],
  },
});
runInContext(source, context, { timeout: 1000 });
const headers = runInContext('HEADERS_', context) as Record<string, string[]>;
Object.entries(headers).forEach(([name, columns]) =>
  sheets.set(name, new Sheet([[...columns]])),
);
const first: HubConfig = {
  endpoint: 'https://script.google.com/macros/s/TEST_ONLY/exec',
  gameKey: 'test-first-game-key',
  gameId: 'test-first-game',
  gameName: 'Nombre enviado',
  brandId: 'test-brand',
  brandName: 'Marca enviada',
  gameVersion: '0.1.0',
  allowPreview: false,
};
const second = {
  ...first,
  gameId: 'test-second-game',
  gameKey: 'test-second-game-key',
  brandId: 'test-other-brand',
};
sheets
  .get('Juegos')!
  .appendRow([
    first.gameId,
    first.brandId,
    'Marca catálogo uno',
    'Juego catálogo uno',
    first.gameKey,
    true,
  ]);
sheets
  .get('Juegos')!
  .appendRow([
    second.gameId,
    second.brandId,
    'Marca catálogo dos',
    'Juego catálogo dos',
    second.gameKey,
    true,
  ]);
const receive = runInContext('recibirEvento', context) as (
  event: HubEvent,
) => Receipt & { duplicate?: boolean };
const clients = [
  new sdk.Client(first, { storage: null }),
  new sdk.Client(second, { storage: null }),
];
const participant = { name: 'Participante de prueba', phone: '+59899123456' };
const sessions = [sdk.uuid(), sdk.uuid()];
const registration = clients.map((client, index) =>
  client.event('registration', {
    participant,
    sessionId: sessions[index],
    metrics: {},
  }),
);
const check = (event: HubEvent) => {
  const result = receive(event);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
registration.forEach(check);
assert.equal(
  sheets.get('Participantes')!.rows.length,
  2,
  'Una persona por celular entre dos juegos',
);
const before = sheets.get('Eventos')!.rows.length;
assert.equal(check(registration[0]).duplicate, true);
assert.equal(
  sheets.get('Eventos')!.rows.length,
  before,
  'Reintento sin otra fila',
);
assert.equal(
  receive({ ...registration[0], metrics: { score: 1 } }).error?.code,
  'EVENT_CONFLICT',
);
const runId = sdk.uuid();
clients.forEach((client, index) =>
  check(
    client.event('game_started', {
      participant,
      sessionId: sessions[index],
      runId,
      metrics: { score: 0, durationSeconds: 0 },
    }),
  ),
);
const completed = clients[0].event('game_completed', {
  participant,
  sessionId: sessions[0],
  runId,
  metrics: {
    score: 17,
    moves: 17,
    durationSeconds: 12.345,
    finishReason: 'completed',
  },
});
check(completed);
assert.equal(check(completed).duplicate, true);
check(
  clients[1].event('game_abandoned', {
    participant,
    sessionId: sessions[1],
    runId,
    metrics: {
      score: 3,
      durationSeconds: 2,
      finishReason: 'participant_change',
    },
  }),
);
assert.equal(
  sheets.get('Partidas')!.rows.length,
  3,
  'Mismo runId aislado por gameId',
);
const firstRun = sheets.get('Partidas')!.rows[1];
assert.equal(firstRun[4], 'Marca catálogo uno');
assert.equal(firstRun[5], 'Juego catálogo uno');
assert.equal(firstRun[10], 'completada');
assert.equal(firstRun[13], 17);
assert.equal(firstRun[14], 12.345);
assert.equal(sheets.get('Partidas')!.rows[2][10], 'abandonada');
const nextRun = sdk.uuid();
check(
  clients[0].event('game_started', {
    participant,
    sessionId: sessions[0],
    runId: nextRun,
    metrics: {},
  }),
);
assert.equal(
  sheets.get('Participantes')!.rows.length,
  2,
  'Otra ronda conserva participante',
);
assert.equal(sheets.get('Partidas')!.rows.length, 4);
for (const invalid of [
  {
    ...registration[0],
    eventId: sdk.uuid(),
    participant: { ...participant, name: '' },
  },
  {
    ...registration[0],
    eventId: sdk.uuid(),
    participant: { ...participant, phone: '123' },
  },
  { ...registration[0], eventId: sdk.uuid(), gameKey: 'wrong-key' },
  { ...registration[0], eventId: sdk.uuid(), brandId: second.brandId },
])
  assert.equal(receive(invalid).ok, false);
console.log(
  'Contrato local del Code.gs original: OK. Dos juegos, participante compartido, rondas, catálogo, métricas, duplicados y entradas inválidas. No se accedió a Google Sheets.',
);
