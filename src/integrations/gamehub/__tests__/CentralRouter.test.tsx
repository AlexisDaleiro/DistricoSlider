// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import { brand } from '../../../brand/brand';
import { db } from '../../../data/db';
import { flowStore } from '../../../flow/flowStore';
import { prepareImage } from '../../../features/game/image/prepareImage';
import { HubParticipation } from '../HubParticipation';
import { sdk, type HubEvent, type Receipt } from '../sdk';
import { checkActivityNow } from '../../../kiosk/activityTracker';

vi.mock('../../../brand/brand', async () => {
  const { brandSchema } = await import('../../../brand/schema');
  const { default: raw } =
    await import('../../../../brands/districo/theme.config.json');
  return { brand: brandSchema.parse(raw), asset: (src: string) => src };
});
vi.mock('../runtime', () => ({ getGameHub: () => hub }));
vi.mock('../../../features/game/image/prepareImage', () => ({
  prepareImage: vi.fn(),
}));
vi.mock('../../../features/game/CountdownScreen', () => ({
  CountdownScreen: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Continuar countdown</button>
  ),
}));
vi.mock('../../../features/game/engine/shuffle', async () => {
  const { createSolved, moveTileAt } =
    await import('../../../features/game/engine/board');
  return {
    shuffle: (size: 3 | 4) => moveTileAt(createSolved(size), size * size - 2)!,
  };
});
let hub: HubParticipation;
let online: boolean;
let events: HubEvent[];
beforeEach(async () => {
  online = true;
  events = [];
  const config = {
    endpoint: 'https://script.google.com/macros/s/TEST_ONLY/exec',
    gameKey: 'test-key-only',
    brandId: 'test-brand',
    brandName: 'Marca de prueba',
    gameId: 'test-ui',
    gameName: 'Puzzle de prueba',
    gameVersion: '0.1.0',
    allowPreview: false,
  };
  hub = new HubParticipation(
    config,
    new sdk.Client(config, {
      storage: null,
      transport: async (event): Promise<Receipt> => {
        if (!online) throw new Error('Sin conexión');
        events.push(event);
        return { ok: true, eventId: event.eventId };
      },
    }),
  );
  flowStore.setState({
    screen: 'attract',
    visit: 0,
    leadUuid: null,
    sessionUuid: null,
  });
  vi.mocked(prepareImage).mockResolvedValue({
    url: 'blob:decoded',
    release: vi.fn(),
  });
  await db.open();
});
afterEach(async () => {
  cleanup();
  hub.clear();
  vi.restoreAllMocks();
  await db.delete();
});
function fill(name = 'Ana Pérez', phone = '099123456') {
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText('Celular'), {
    target: { value: phone },
  });
  fireEvent.click(screen.getByLabelText(brand.form.consent.text));
}
async function openForm() {
  fireEvent.click(
    await screen.findByRole('button', { name: brand.attract.startButton }),
  );
  await screen.findByLabelText('Celular');
}
async function submit() {
  await act(async () => {
    fireEvent.submit(document.querySelector('form')!);
  });
}
async function enterGame() {
  fireEvent.click(await screen.findByRole('button', { name: '¡Jugar!' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Continuar countdown' }),
  );
}
async function solve() {
  fireEvent.click(
    document.querySelector(
      `[data-position="${brand.game.gridSize ** 2 - 1}"]`,
    )!,
  );
  await screen.findByRole('button', { name: 'Jugar otra ronda' });
}
it('bloquea el juego cuando faltan los seis valores de conexión', async () => {
  hub = new HubParticipation({
    ...hub.config,
    endpoint: '',
    gameKey: '',
    brandId: '',
    brandName: '',
    gameId: '',
    gameName: '',
  });
  render(<App />);
  await openForm();
  const button = await screen.findByRole('button', {
    name: 'Conexión pendiente',
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(hub.missing).toHaveLength(6);
  expect(screen.queryByRole('heading', { name: 'Cómo jugar' })).toBeNull();
  expect(events).toHaveLength(0);
});
it('pide solo nombre/celular antes de instrucciones y exige registro confirmado para avanzar', async () => {
  render(<App />);
  await openForm();
  expect(screen.queryByLabelText('Email')).toBeNull();
  expect(screen.queryByLabelText('Empresa')).toBeNull();
  expect(
    screen.queryByText('Quiero recibir novedades y promociones.'),
  ).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Cómo jugar' })).toBeNull();
  await submit();
  expect(events).toHaveLength(0);
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  fill();
  online = false;
  await submit();
  expect(screen.getByRole('alert').textContent).toContain('Sin conexión');
  expect(screen.queryByRole('heading', { name: 'Cómo jugar' })).toBeNull();
  expect(hub.canPlay).toBe(false);
  online = true;
  await submit();
  await screen.findByRole('heading', { name: 'Cómo jugar' });
  expect(events.map((event) => event.type)).toEqual(['registration']);
  expect(events[0].participant.phone).toBe('+59899123456');
  expect(await db.leads.count()).toBe(1);
});
it('varias rondas conservan participante, puntaje y sesión; cambiarlo limpia los datos', async () => {
  render(<App />);
  await openForm();
  fill();
  await submit();
  await enterGame();
  await solve();
  expect((await db.sessions.toArray())[0]).toMatchObject({
    status: 'completed',
    moves: 1,
  });
  const sessionId = hub.sessionId;
  fireEvent.click(screen.getByRole('button', { name: 'Jugar otra ronda' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Continuar countdown' }),
  );
  await solve();
  await hub.retry();
  expect(await db.leads.count()).toBe(1);
  expect(await db.sessions.count()).toBe(2);
  expect(events.map((event) => event.type)).toEqual([
    'registration',
    'game_started',
    'game_completed',
    'game_started',
    'game_completed',
  ]);
  expect(new Set(events.map((event) => event.sessionId)).size).toBe(1);
  expect(events[1].runId).toBe(events[2].runId);
  expect(events[3].runId).toBe(events[4].runId);
  expect(events[1].runId).not.toBe(events[3].runId);
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar participante' }));
  await openForm();
  expect((screen.getByLabelText('Celular') as HTMLInputElement).value).toBe('');
  expect(
    (screen.getByLabelText('Nombre y apellido') as HTMLInputElement).value,
  ).toBe('');
  expect(
    (screen.getByLabelText(brand.form.consent.text) as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(hub.canPlay).toBe(false);
  fill('Luis Silva', '098123456');
  await submit();
  await screen.findByRole('heading', { name: 'Cómo jugar' });
  expect(hub.sessionId).not.toBe(sessionId);
  expect(await db.leads.count()).toBe(2);
});
it('el registro inicial también se limpia por inactividad', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  render(<App />);
  await openForm();
  fill();
  now += brand.kiosk.inactivityMs.form + 1;
  act(() => {
    checkActivityNow();
  });
  await screen.findByRole('button', { name: brand.attract.startButton });
  await openForm();
  await waitFor(() =>
    expect((screen.getByLabelText('Celular') as HTMLInputElement).value).toBe(
      '',
    ),
  );
  expect(events).toHaveLength(0);
});

it('portada sin timeout, ranking directo con Volver y timeout del ranking a portada', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  render(<App />);
  await screen.findByRole('button', { name: brand.attract.startButton });
  expect(screen.queryByLabelText('Celular')).toBeNull();
  now += 10 * 60 * 1000;
  act(() => checkActivityNow());
  expect(flowStore.getState().visit).toBe(0);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: brand.attract.rankingButton }),
  );
  await screen.findByRole('heading', {
    name: brand.texts['leaderboard.title'],
  });
  expect(events).toHaveLength(0);
  fireEvent.click(
    screen.getByRole('button', { name: brand.attract.backButton }),
  );
  await screen.findByRole('button', { name: brand.attract.startButton });
  fireEvent.click(
    screen.getByRole('button', { name: brand.attract.rankingButton }),
  );
  await screen.findByRole('heading', {
    name: brand.texts['leaderboard.title'],
  });
  now += brand.kiosk.inactivityMs.leaderboard + 1;
  act(() => checkActivityNow());
  await screen.findByRole('button', { name: brand.attract.startButton });
  expect(flowStore.getState().screen).toBe('attract');
});

it('el hotspot de cinco toques abre el admin desde la portada', async () => {
  render(<App />);
  await screen.findByRole('button', { name: brand.attract.startButton });
  for (let tap = 0; tap < 5; tap++)
    fireEvent.click(screen.getByTestId('admin-hotspot'));
  await waitFor(() => expect(flowStore.getState().screen).toBe('admin'));
  expect(screen.queryByLabelText('Celular')).toBeNull();
  expect(events).toHaveLength(0);
});
