// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HubParticipation } from '../HubParticipation';
import { HubSyncNotice } from '../HubSyncNotice';
import { sdk, type HubEvent, type Receipt } from '../sdk';

const config = {
  endpoint: 'https://script.google.com/macros/s/TEST_ONLY/exec',
  gameKey: 'test-key-only',
  brandId: 'test-brand',
  brandName: 'Marca de prueba',
  gameId: 'test-notice',
  gameName: 'Prueba',
  gameVersion: '1.0.0',
  allowPreview: false,
  syncFeedbackDelayMs: 10000,
};
let hub: HubParticipation;
let responses: (() => void)[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T20:00:00Z'));
  responses = [];
  const client = new sdk.Client(config, {
    storage: null,
    transport: (event: HubEvent) =>
      new Promise<Receipt>((resolve) => {
        responses.push(() => resolve({ ok: true, eventId: event.eventId }));
      }),
  });
  hub = new HubParticipation(config, client);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const advance = (milliseconds: number) =>
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
const retry = () =>
  screen.queryByRole('button', { name: 'Reintentar envíos a la central' });

it('un envío rápido y su confirmación no muestran mensajes ni botón', async () => {
  const registration = hub.register('Prueba', '+12025550123');
  render(<HubSyncNotice hub={hub} />);
  expect(screen.queryByLabelText('Estado de conexión')).toBeNull();
  advance(9000);
  expect(retry()).toBeNull();
  await act(async () => {
    responses[0]();
    await registration;
  });
  advance(2000);
  expect(screen.queryByLabelText('Estado de conexión')).toBeNull();
  expect(hub.canPlay).toBe(true);
});

it('a los 10 segundos aparece el reintento y se oculta al confirmar, sin habilitar juego antes del ok', async () => {
  const registration = hub.register('Prueba', '+12025550123');
  render(<HubSyncNotice hub={hub} />);
  advance(9999);
  expect(retry()).toBeNull();
  expect(hub.canPlay).toBe(false);
  advance(1);
  expect(retry()).toBeTruthy();
  expect(hub.canPlay).toBe(false);
  const originalEvent = JSON.stringify(hub.client.queue[0].event);
  fireEvent.click(retry()!);
  expect(JSON.stringify(hub.client.queue[0].event)).toBe(originalEvent);
  await act(async () => {
    responses[0]();
    await registration;
  });
  expect(retry()).toBeNull();
  expect(screen.queryByLabelText('Estado de conexión')).toBeNull();
});

it('cada nuevo envío vuelve a esperar 10 segundos, aunque el anterior haya demorado', async () => {
  const registration = hub.register('Prueba', '+12025550123');
  render(<HubSyncNotice hub={hub} />);
  advance(10000);
  expect(retry()).toBeTruthy();
  await act(async () => {
    responses[0]();
    await registration;
  });
  act(() => hub.startRound(sdk.uuid(), 3, 'a.jpg'));
  expect(retry()).toBeNull();
  advance(9999);
  expect(retry()).toBeNull();
  advance(1);
  expect(retry()).toBeTruthy();
  await act(async () => {
    responses[1]();
    await hub.retry();
  });
  expect(retry()).toBeNull();
});

it('al remontar conserva la antigüedad del envío y limpia el timer al desmontar', async () => {
  const registration = hub.register('Prueba', '+12025550123');
  const first = render(<HubSyncNotice hub={hub} />);
  advance(6000);
  first.unmount();
  expect(vi.getTimerCount()).toBe(0);
  advance(2000);
  render(<HubSyncNotice hub={hub} />);
  advance(1999);
  expect(retry()).toBeNull();
  advance(1);
  expect(retry()).toBeTruthy();
  await act(async () => {
    responses[0]();
    await registration;
  });
});

it('sigue mostrando el modo de prueba y la configuración incompleta sin simular guardado', () => {
  const preview = new HubParticipation({
    ...config,
    endpoint: '',
    gameKey: '',
    allowPreview: true,
  });
  const view = render(<HubSyncNotice hub={preview} />);
  expect(screen.getByRole('status').textContent).toContain('Modo de prueba');
  expect(retry()).toBeNull();
  const missing = new HubParticipation({
    ...config,
    endpoint: '',
    gameKey: '',
  });
  view.rerender(<HubSyncNotice hub={missing} />);
  expect(screen.getByRole('status').textContent).toContain('Faltan');
});
