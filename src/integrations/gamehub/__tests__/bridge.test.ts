// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { sdk, type HubClient, type HubEvent, type Receipt } from '../sdk';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('usa el puente original, sin datos personales en URL, y valida nonce, origen, ventana y eventId del ack', async () => {
  vi.useFakeTimers();
  const client = new sdk.Client(
    {
      endpoint: 'https://script.google.com/macros/s/TEST_ONLY/exec',
      gameKey: 'test-key-only',
      brandId: 'test-brand',
      brandName: 'Prueba',
      gameId: 'test-bridge',
      gameName: 'Prueba',
      gameVersion: '0.1.0',
      allowPreview: false,
    },
    { storage: null },
  );
  const internal = client as HubClient & {
    nonce: string;
    pending: Map<string, unknown>;
    _message(event: { data: unknown; origin: string; source: unknown }): void;
  };
  const event = client.event('registration', {
    participant: { name: 'Persona Privada', phone: '+59899123456' },
    sessionId: sdk.uuid(),
    metrics: {},
  });
  const pending = client.send(event);
  const frame = document.querySelector('iframe')!;
  const url = new URL(frame.src);
  expect(url.searchParams.get('view')).toBe('bridge');
  expect([...url.searchParams.keys()].sort()).toEqual([
    'nonce',
    'parentOrigin',
    'view',
  ]);
  expect(url.href).not.toContain('Persona');
  expect(url.href).not.toContain('99123456');
  const source = { postMessage: vi.fn() };
  const ready = { channel: 'gamehub.v1', nonce: internal.nonce, type: 'ready' };
  internal._message({ data: ready, origin: 'https://evil.example', source });
  expect(source.postMessage).not.toHaveBeenCalled();
  const origin = 'https://test-script.googleusercontent.com';
  internal._message({ data: ready, origin, source });
  await vi.waitFor(() =>
    expect(
      source.postMessage.mock.calls.some(
        ([message]) => message.type === 'event',
      ),
    ).toBe(true),
  );
  const [message, target] = source.postMessage.mock.calls.find(
    ([message]) => message.type === 'event',
  )!;
  expect(target).toBe(origin);
  expect(message.payload).toEqual(event);
  const ack = {
    channel: 'gamehub.v1',
    nonce: internal.nonce,
    type: 'ack',
    requestId: message.requestId,
    response: { ok: true, eventId: event.eventId },
  };
  internal._message({ data: ack, origin, source: {} });
  internal._message({ data: { ...ack, nonce: 'wrong' }, origin, source });
  internal._message({ data: ack, origin: 'https://evil.example', source });
  expect(internal.pending.size).toBe(1);
  internal._message({ data: ack, origin, source });
  expect(await pending).toMatchObject({ ok: true, eventId: event.eventId });
  expect(internal.pending.size).toBe(0);
  expect(client.queue).toHaveLength(0);
});

it('restaura la cola de sessionStorage conservando todo el contenido original', async () => {
  const config = {
    endpoint: 'https://script.google.com/macros/s/TEST_ONLY/exec',
    gameKey: 'test-key-only',
    brandId: 'test-brand',
    brandName: 'Prueba',
    gameId: 'test-storage',
    gameName: 'Prueba',
    gameVersion: '0.1.0',
    allowPreview: false,
  };
  const storage = window.sessionStorage;
  storage.clear();
  const first = new sdk.Client(config, {
    storage,
    transport: async () => {
      throw new Error('offline');
    },
  });
  const event = first.event('registration', {
    participant: { name: 'Ana', phone: '+59899123456' },
    sessionId: sdk.uuid(),
    metrics: {},
  });
  await expect(first.send(event)).rejects.toThrow('offline');
  const transport = vi.fn(async (event: HubEvent): Promise<Receipt> => ({
    ok: true,
    eventId: event.eventId,
  }));
  const reloaded = new sdk.Client(config, { storage, transport });
  await reloaded.flush();
  expect(transport).toHaveBeenCalledWith(event);
  expect(
    JSON.parse(storage.getItem('gamehub.pending.v1.test-storage')!),
  ).toEqual([]);
  storage.clear();
});
