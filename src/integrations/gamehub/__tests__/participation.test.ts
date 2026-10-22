import { describe, expect, it, vi } from 'vitest';
import { HubParticipation, missingConfiguration } from '../HubParticipation';
import { sdk, type HubConfig, type HubEvent, type Receipt } from '../sdk';

export const testConfig: HubConfig = {
  endpoint: 'https://script.google.com/macros/s/TEST_ONLY/exec',
  gameKey: 'test-game-key-only',
  brandId: 'test-brand',
  brandName: 'Marca de prueba',
  gameId: 'test-puzzle',
  gameName: 'Puzzle de prueba',
  gameVersion: '0.1.0',
  allowPreview: false,
};
const ack = (event: HubEvent): Receipt => ({
  ok: true,
  eventId: event.eventId,
});
function make(
  transport = vi.fn(async (event: HubEvent) => ack(event)),
  config = testConfig,
) {
  const client = new sdk.Client(config, { transport, storage: null });
  return { hub: new HubParticipation(config, client), client, transport };
}

describe('participación central con el SDK común real', () => {
  it('una confirmación tardía no vuelve a habilitar una participación cancelada', async () => {
    let confirm!: () => void;
    const { hub } = make(
      vi.fn(
        (event: HubEvent) =>
          new Promise<Receipt>((resolve) => {
            confirm = () => resolve(ack(event));
          }),
      ),
    );
    const registration = hub.register('Ana', '099123456');
    hub.clear();
    confirm();
    await expect(registration).rejects.toThrow('cancelada');
    expect(hub.canPlay).toBe(false);
    expect(hub.identityLocked).toBe(false);
    expect(hub.sessionId).toBeUndefined();
  });
  it('exige nombre y celular válido, normaliza Uruguay y admite otro prefijo', async () => {
    const { hub, transport } = make();
    for (const [name, phone] of [
      ['', '099123456'],
      ['A', '099123456'],
      ['Ana', ''],
      ['Ana', '123'],
      ['Ana', 'abc 099123456'],
      ['Ana', '+59800000000'],
    ]) {
      await expect(hub.register(name, phone)).rejects.toThrow();
      expect(hub.canPlay).toBe(false);
    }
    expect(transport).not.toHaveBeenCalled();
    expect(await hub.register(' Ana   Pérez ', '099 123 456')).toEqual({
      name: 'Ana Pérez',
      phone: '+59899123456',
    });
    hub.clear();
    expect(await hub.register('Ana', '001 202 555 0123')).toEqual({
      name: 'Ana',
      phone: '+12025550123',
    });
  });
  it('no permite jugar antes del ok real, ni ante rechazo o respuesta opaca', async () => {
    let resolve!: (receipt: Receipt) => void;
    const transport = vi.fn(
      (event: HubEvent) =>
        new Promise<Receipt>((done) => {
          resolve = () => done(ack(event));
        }),
    );
    const { hub } = make(transport);
    const pending = hub.register('Ana', '099123456');
    expect(hub.canPlay).toBe(false);
    expect(() => hub.startRound(sdk.uuid(), 3, 'a.jpg')).toThrow();
    resolve({ ok: true, eventId: '' });
    await pending;
    expect(hub.canPlay).toBe(true);
    const rejected = make(
      vi.fn(async (event: HubEvent) => ({
        ok: false,
        eventId: event.eventId,
        error: {
          code: 'DISABLED_GAME',
          message: 'Deshabilitado',
          retryable: false,
        },
      })),
    );
    await expect(rejected.hub.register('Ana', '099123456')).rejects.toThrow(
      'Deshabilitado',
    );
    expect(rejected.hub.canPlay).toBe(false);
    const opaque = make(
      vi.fn(async () => ({ type: 'opaque' }) as unknown as Receipt),
    );
    await expect(opaque.hub.register('Ana', '099123456')).rejects.toThrow(
      'confirmar',
    );
    expect(opaque.hub.canPlay).toBe(false);
  });
  it('mantiene evento, fecha y contenido tras desconexión y pérdida de confirmación', async () => {
    const saved = new Map<string, string>();
    let loseAck = true;
    const transport = vi.fn(async (event: HubEvent) => {
      const json = JSON.stringify(event);
      if (saved.has(event.eventId)) expect(saved.get(event.eventId)).toBe(json);
      saved.set(event.eventId, json);
      if (loseAck) {
        loseAck = false;
        throw new Error('desconectado después de guardar');
      }
      return ack(event);
    });
    const { hub, client } = make(transport);
    await expect(hub.register('Ana', '099123456')).rejects.toThrow(
      'desconectado',
    );
    expect(hub.canPlay).toBe(false);
    expect(client.queue).toHaveLength(1);
    await expect(hub.register('Otra persona', '098123456')).rejects.toThrow(
      'mismos datos',
    );
    await hub.register('Ana', '099123456');
    expect(hub.canPlay).toBe(true);
    expect(saved.size).toBe(1);
    expect(transport.mock.calls[0][0]).toEqual(transport.mock.calls[1][0]);
    expect(client.queue).toHaveLength(0);
  });
  it('mantiene sessionId por persona, runId por ronda y un solo final por ronda; conserva métricas', async () => {
    const { hub, transport } = make();
    await hub.register('Ana', '099123456');
    const sessionId = hub.sessionId;
    const first = sdk.uuid(),
      second = sdk.uuid();
    hub.startRound(first, 3, 'a.jpg');
    hub.finish('completed', { moves: 17, durationMs: 12345 });
    hub.finish('completed', { moves: 17, durationMs: 12345 });
    hub.startRound(second, 4, 'b.jpg');
    hub.progress({ moves: 3, durationMs: 1500 });
    hub.clear('inactivity');
    await hub.retry();
    const events = transport.mock.calls.map(([event]) => event);
    expect(events.map((event) => event.type)).toEqual([
      'registration',
      'game_started',
      'game_completed',
      'game_started',
      'game_abandoned',
    ]);
    expect(new Set(events.map((event) => event.sessionId))).toEqual(
      new Set([sessionId]),
    );
    expect(events.slice(1).map((event) => event.runId)).toEqual([
      first,
      first,
      second,
      second,
    ]);
    expect(events[2].metrics).toMatchObject({
      score: 17,
      moves: 17,
      durationSeconds: 12.345,
      finishReason: 'completed',
      solved: true,
    });
    expect(events[4].metrics).toMatchObject({
      score: 3,
      durationSeconds: 1.5,
      finishReason: 'inactivity',
    });
    for (const event of events) {
      expect(event).toMatchObject({
        schemaVersion: 1,
        gameId: testConfig.gameId,
        gameVersion: '0.1.0',
        participant: { name: 'Ana', phone: '+59899123456' },
      });
      expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    }
    expect(hub.sessionId).toBeUndefined();
    expect(hub.identityLocked).toBe(false);
    expect(hub.canPlay).toBe(false);
    await hub.register('Luis', '098123456');
    expect(hub.sessionId).not.toBe(sessionId);
  });
  it('encola inicio y final offline y los reintenta en orden con los mismos datos', async () => {
    let online = true;
    const received: HubEvent[] = [];
    const { hub, client } = make(
      vi.fn(async (event: HubEvent) => {
        if (!online) throw new Error('offline');
        received.push(event);
        return ack(event);
      }),
    );
    await hub.register('Ana', '099123456');
    online = false;
    hub.startRound(sdk.uuid(), 3, 'a.jpg');
    hub.finish('timeout', { moves: 8, durationMs: 300001 });
    await expect(hub.retry()).rejects.toThrow('offline');
    const queued = JSON.parse(JSON.stringify(client.queue));
    expect(queued).toHaveLength(2);
    expect(hub.getSnapshot()).toContain('pendiente');
    online = true;
    await hub.retry();
    expect(received.slice(1)).toEqual(
      queued.map((item: { event: HubEvent }) => item.event),
    );
    expect(received[2].metrics).toMatchObject({
      finishReason: 'timeout',
      solved: false,
    });
    expect(hub.getSnapshot()).toContain('confirmados');
  });
  it('dos juegos usan una central sin duplicar teléfonos ni mezclar partidas', async () => {
    const people = new Set<string>();
    const events = new Map<string, HubEvent>();
    const runs = new Set<string>();
    const transport = vi.fn(async (event: HubEvent) => {
      people.add(event.participant.phone);
      events.set(event.eventId, event);
      if (event.runId) runs.add(`${event.gameId}::${event.runId}`);
      return ack(event);
    });
    const a = make(transport).hub;
    const b = make(transport, {
      ...testConfig,
      gameId: 'test-second-game',
      gameKey: 'test-other-key',
      gameName: 'Otro juego',
    }).hub;
    await a.register('Ana', '099123456');
    await b.register('Ana', '+59899123456');
    const sameRun = sdk.uuid();
    a.startRound(sameRun, 3, 'a.jpg');
    b.startRound(sameRun, 3, 'a.jpg');
    a.finish('completed', { moves: 5, durationMs: 1000 });
    b.clear();
    await Promise.all([a.retry(), b.retry()]);
    expect(people.size).toBe(1);
    expect(runs.size).toBe(2);
    expect(events.size).toBe(6);
  });
  it('reporta configuración faltante y preview sin simular guardado', async () => {
    const config = {
      ...testConfig,
      endpoint: '',
      gameKey: '',
      brandId: '',
      brandName: '',
      gameId: '',
      gameName: '',
    };
    expect(missingConfiguration(config)).toHaveLength(6);
    const production = make(undefined, config).hub;
    await expect(production.register('Ana', '099123456')).rejects.toThrow(
      'Faltan',
    );
    expect(production.canPlay).toBe(false);
    const { hub, transport } = make(undefined, {
      ...config,
      allowPreview: true,
    });
    await hub.register('Ana', '099123456');
    expect(hub.canPlay).toBe(true);
    expect(hub.getSnapshot()).toContain('no se envían ni se guardan');
    expect(transport).not.toHaveBeenCalled();
  });
});
