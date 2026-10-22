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
  expect((await db.sessions.toArray())[0].status).toBe('abandoned');
  expect(await db.leads.count()).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: brand.attract.cta }));
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
  mounted.unmount();
  expect(release).toHaveBeenCalled();
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
