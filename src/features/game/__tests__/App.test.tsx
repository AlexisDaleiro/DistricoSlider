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
import { leadsRepo } from '../../../data/repos/leadsRepo';
import { sessionsRepo } from '../../../data/repos/sessionsRepo';
import { prepareImage } from '../image/prepareImage';
import { flowStore } from '../../../flow/flowStore';
import { checkActivityNow } from '../../../kiosk/activityTracker';

vi.mock('../image/prepareImage', () => ({ prepareImage: vi.fn() }));
// Los tiempos de countdown tienen su propia suite. Aquí se prueba el commit y la navegación con IDB realista.
vi.mock('../CountdownScreen', () => ({
  CountdownScreen: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Continuar countdown</button>
  ),
}));
vi.mock('../engine/shuffle', async () => {
  const { createSolved, moveTileAt } = await import('../engine/board');
  return {
    shuffle: (size: 3 | 4) => moveTileAt(createSolved(size), size * size - 2)!,
  };
});
beforeEach(async () => {
  flowStore.setState({
    screen: 'attract',
    leadUuid: null,
    sessionUuid: null,
    visit: 0,
  });
  vi.mocked(prepareImage).mockReset();
  vi.mocked(prepareImage).mockResolvedValue({
    url: 'blob:decoded',
    release: vi.fn(),
  });
  await db.open();
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await db.delete();
});

async function openForm() {
  fireEvent.click(
    await screen.findByRole('button', { name: brand.attract.cta }),
  );
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {
    target: { value: 'Ana Pérez' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: ' ANA@EXAMPLE.COM ' },
  });
  fireEvent.click(screen.getByLabelText(brand.form.consent.text));
}
async function submit() {
  await act(async () => {
    fireEvent.submit(document.querySelector('form')!);
  });
}
async function enterGame() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Continuar countdown' }),
  );
}
function solve() {
  fireEvent.click(
    document.querySelector(
      `[data-position="${brand.game.gridSize ** 2 - 1}"]`,
    )!,
  );
}

it('espera decode y commit antes de countdown; Terminar abandona sin perder el lead y limpia el formulario', async () => {
  let resolveImage:
    ((image: { url: string; release: () => void }) => void) | undefined;
  const release = vi.fn();
  vi.mocked(prepareImage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveImage = resolve;
      }),
  );
  const mounted = render(<App />);
  await openForm();
  expect(
    (
      screen.getByRole('button', {
        name: brand.texts['game.loading'],
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(await db.leads.count()).toBe(0);
  await act(async () => {
    resolveImage?.({ url: 'blob:decoded', release });
  });
  await submit();
  await enterGame();
  expect(await db.leads.count()).toBe(1);
  expect((await db.sessions.toArray())[0].status).toBe('started');
  expect(screen.getByTestId('game-time').textContent).toBe('00:00.0');
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['common.finish'] }),
  );
  await screen.findByRole('button', { name: brand.attract.cta });
  await waitFor(async () =>
    expect((await db.sessions.toArray())[0].status).toBe('abandoned'),
  );
  expect(await db.leads.count()).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: brand.attract.cta }));
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
  mounted.unmount();
  expect(release).toHaveBeenCalled();
});

function idleClock() {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  return (ms: number) => {
    now += ms;
    act(() => {
      checkActivityNow();
    });
    return clock;
  };
}

it('el aviso conserva borrador al continuar, pero timeout limpia inputs, consent y foco', async () => {
  const idle = idleClock();
  render(<App />);
  await openForm();
  const email = screen.getByLabelText('Email') as HTMLInputElement;
  const previousName = email.name;
  email.focus();
  idle(brand.kiosk.inactivityMs.form - brand.kiosk.warningMs);
  expect(screen.getByRole('dialog').textContent).toContain(
    brand.texts['inactivity.title'],
  );
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['inactivity.continue'] }),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(email.value).toContain('ANA@EXAMPLE.COM');
  idle(brand.kiosk.inactivityMs.form);
  await screen.findByRole('button', { name: brand.attract.cta });
  expect(document.activeElement).not.toBe(email);
  fireEvent.click(screen.getByRole('button', { name: brand.attract.cta }));
  const clean = screen.getByLabelText('Email') as HTMLInputElement;
  expect(clean.value).toBe('');
  expect(clean.name).not.toBe(previousName);
  expect(
    (screen.getByLabelText(brand.form.consent.text) as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(await db.leads.count()).toBe(0);
});

it.each(['countdown', 'game'] as const)(
  'inactividad en %s abandona la sesión, conserva el lead y libera recursos',
  async (phase) => {
    const idle = idleClock();
    render(<App />);
    await openForm();
    await submit();
    await screen.findByRole('button', { name: 'Continuar countdown' });
    if (phase === 'game') await enterGame();
    idle(brand.kiosk.inactivityMs[phase] - brand.kiosk.warningMs);
    expect(screen.getByRole('dialog')).toBeTruthy();
    idle(brand.kiosk.warningMs);
    await screen.findByRole('button', { name: brand.attract.cta });
    await waitFor(async () =>
      expect((await db.sessions.toArray())[0].status).toBe('abandoned'),
    );
    expect(await db.leads.count()).toBe(1);
    expect(flowStore.getState().sessionUuid).toBeNull();
  },
);

it.each(['result', 'leaderboard'] as const)(
  'inactividad en %s vuelve a ATTRACT sin alterar un resultado completado',
  async (phase) => {
    const idle = idleClock();
    render(<App />);
    await openForm();
    await submit();
    await enterGame();
    solve();
    await screen.findByRole('heading', { name: brand.texts['result.title'] });
    if (phase === 'leaderboard')
      fireEvent.click(
        screen.getByRole('button', { name: brand.texts['result.ranking'] }),
      );
    idle(brand.kiosk.inactivityMs[phase] - brand.kiosk.warningMs);
    expect(screen.getByRole('dialog')).toBeTruthy();
    idle(brand.kiosk.warningMs);
    await screen.findByRole('button', { name: brand.attract.cta });
    expect((await db.sessions.toArray())[0].status).toBe('completed');
    expect(await db.leads.count()).toBe(1);
  },
);

it('un commit tardío tras el reset conserva el lead, abandona esa sesión y no navega al visitante siguiente', async () => {
  const idle = idleClock();
  const originalCreate = leadsRepo.createWithSession;
  let commit: (() => Promise<void>) | undefined;
  vi.spyOn(leadsRepo, 'createWithSession').mockImplementationOnce(
    (...args) =>
      new Promise<Awaited<ReturnType<typeof originalCreate>>>((resolve) => {
        commit = async () => resolve(await originalCreate(...args));
      }) as ReturnType<typeof originalCreate>,
  );
  render(<App />);
  await openForm();
  await submit();
  idle(brand.kiosk.inactivityMs.form);
  await screen.findByRole('button', { name: brand.attract.cta });
  fireEvent.click(screen.getByRole('button', { name: brand.attract.cta }));
  await act(async () => {
    await commit?.();
  });
  await waitFor(async () =>
    expect((await db.sessions.toArray())[0].status).toBe('abandoned'),
  );
  expect(await db.leads.count()).toBe(1);
  expect(flowStore.getState().screen).toBe('form');
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
  expect(flowStore.getState().sessionUuid).toBeNull();
});

it('una respuesta tardía de resultado no revive RESULT tras resetear', async () => {
  const idle = idleClock();
  const originalFinish = sessionsRepo.finish;
  let complete: (() => Promise<void>) | undefined;
  vi.spyOn(sessionsRepo, 'finish').mockImplementationOnce(async (...args) => {
    const stored = await originalFinish(...args);
    return new Promise((resolve) => {
      complete = async () => resolve(stored);
    });
  });
  render(<App />);
  await openForm();
  await submit();
  await enterGame();
  solve();
  await waitFor(() => expect(complete).toBeDefined());
  idle(brand.kiosk.inactivityMs.game);
  await screen.findByRole('button', { name: brand.attract.cta });
  await act(async () => {
    await complete?.();
  });
  expect(flowStore.getState().screen).toBe('attract');
  expect(
    screen.queryByRole('heading', { name: brand.texts['result.title'] }),
  ).toBeNull();
  expect((await db.sessions.toArray())[0].status).toBe('completed');
});

it('un fallo de preparación muestra error propio en FORM y permite reintentar antes de guardar', async () => {
  vi.mocked(prepareImage)
    .mockRejectedValueOnce(new Error('local decode failure'))
    .mockResolvedValueOnce({ url: 'blob:retry', release: vi.fn() });
  render(<App />);
  await openForm();
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      brand.texts['game.loadError'],
    ),
  );
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['game.retry'] }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: brand.form.submit,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(await db.leads.count()).toBe(0);
});

it('si IndexedDB falla al enviar se conserva el borrador y no empieza la partida', async () => {
  vi.spyOn(leadsRepo, 'createWithSession').mockRejectedValueOnce(
    new Error('quota'),
  );
  render(<App />);
  await openForm();
  await submit();
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      brand.texts['form.saveError'],
    ),
  );
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toContain(
    'ANA@EXAMPLE.COM',
  );
  expect(await db.leads.count()).toBe(0);
  await submit();
  await enterGame();
  expect(await db.leads.count()).toBe(1);
});

it('persiste victoria antes de RESULT, muestra ranking enmascarado y conserva datos al remonte/recarga', async () => {
  const first = render(<App />);
  await openForm();
  await submit();
  await enterGame();
  solve();
  await screen.findByRole('heading', { name: brand.texts['result.title'] });
  expect((await db.sessions.toArray())[0]).toMatchObject({
    status: 'completed',
    moves: 1,
  });
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['result.ranking'] }),
  );
  await screen.findByText('Ana P.');
  expect(document.body.textContent).not.toContain('ana@example.com');
  first.unmount();
  db.close();
  await db.open();
  flowStore.setState({
    screen: 'attract',
    leadUuid: null,
    sessionUuid: null,
    visit: flowStore.getState().visit + 1,
  });
  render(<App />);
  fireEvent.click(
    await screen.findByRole('button', { name: brand.texts['result.ranking'] }),
  );
  await screen.findByText('Ana P.');
  expect(await db.leads.count()).toBe(1);
});

it('un fallo al guardar resultado conserva la sesión y permite retry sin duplicar ni perder el lead', async () => {
  vi.spyOn(sessionsRepo, 'finish').mockRejectedValueOnce(
    new Error('storage temporarily unavailable'),
  );
  render(<App />);
  await openForm();
  await submit();
  await enterGame();
  solve();
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      brand.texts['data.resultError'],
    ),
  );
  expect(await db.leads.count()).toBe(1);
  expect((await db.sessions.toArray())[0].status).toBe('started');
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['game.retry'] }),
  );
  await screen.findByRole('heading', { name: brand.texts['result.title'] });
  expect((await db.sessions.toArray())[0].status).toBe('completed');
  expect(await db.leads.count()).toBe(1);
  expect(await db.sessions.count()).toBe(1);
});
