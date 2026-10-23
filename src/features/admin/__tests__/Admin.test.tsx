// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
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
import { checkActivityNow } from '../../../kiosk/activityTracker';
import { settingsRepo } from '../../../data/repos/settingsRepo';
import { createLeadsRepo } from '../../../data/repos/leadsRepo';
import { pinService } from '../pin';
import { backupEvent } from '../../../data/backup';
import { setFilePlatform } from '../../../data/files/platform';
import { eventRepo } from '../../../data/repos/eventRepo';
import { handleNativeBack } from '../../../kiosk/backNavigation';

vi.mock('../../game/image/prepareImage', () => ({
  prepareImage: vi
    .fn()
    .mockResolvedValue({ url: 'blob:image', release: vi.fn() }),
}));
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  flowStore.setState({
    screen: 'attract',
    leadUuid: null,
    sessionUuid: null,
    visit: 0,
  });
  await db.open();
});
afterEach(async () => {
  cleanup();
  await backupEvent(brand.event.id, false);
  setFilePlatform(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.delete();
});
it('CSV habilita borrado, pero exige reingresar PIN y sostener antes de eliminar solo ese evento', async () => {
  const original = brand.kiosk.admin.deleteHoldMs;
  brand.kiosk.admin.deleteHoldMs = 20;
  try {
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file://test.csv' });
    setFilePlatform({
      writeFile,
      readdir: vi.fn().mockResolvedValue({ files: [] }),
      deleteFile: vi.fn(),
      share: vi.fn(),
    });
    await createLeadsRepo(db).createWithSession(
      {
        eventId: brand.event.id,
        brandId: brand.brand.id,
        name: 'María Peña',
        email: 'maria@example.test',
        consent: true,
        consentVersion: 'v1',
        marketingOptIn: false,
      },
      3,
      brand.game.images[0].src,
    );
    await login();
    fireEvent.click(
      screen.getByRole('button', { name: brand.texts['admin.exportCsv'] }),
    );
    await waitFor(async () =>
      expect(await eventRepo.lastExport(brand.event.id)).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: brand.texts['admin.deleteEvent'],
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole('button', { name: brand.texts['admin.deleteEvent'] }),
    );
    expect(screen.getByRole('dialog').textContent).toContain(
      brand.texts['admin.reenterPin'],
    );
    expect(await db.leads.count()).toBe(1);
    await pin();
    const hold = await screen.findByRole('button', {
      name: brand.texts['admin.hold'].replace('{seconds}', '0.02'),
    });
    fireEvent.click(hold);
    expect(await db.leads.count()).toBe(1);
    fireEvent.pointerDown(hold, { button: 0 });
    await waitFor(async () => expect(await db.leads.count()).toBe(0));
    fireEvent.pointerUp(window);
    expect(await db.sessions.count()).toBe(0);
    expect(writeFile).toHaveBeenCalled();
  } finally {
    brand.kiosk.admin.deleteHoldMs = original;
  }
});
async function openAdmin() {
  render(<App />);
  await screen.findByRole('button', { name: brand.attract.startButton });
  const hotspot = screen.getByTestId('admin-hotspot');
  for (let i = 0; i < 4; i++) fireEvent.click(hotspot);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(hotspot);
  await screen.findByRole('dialog');
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: '0',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
}
async function pin(value = '0000') {
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: value[0] }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  for (const digit of value)
    fireEvent.click(screen.getByRole('button', { name: digit }));
  await act(async () => {});
}
async function login() {
  await openAdmin();
  await pin();
  await screen.findByRole('heading', { name: brand.texts['admin.title'] });
}

it('hotspot abre PIN; PIN correcto abre métricas, banner por defecto y salida elimina acceso', async () => {
  await login();
  await screen.findByText(brand.texts['admin.total']);
  expect(screen.getByText(brand.texts['admin.defaultPin'])).toBeTruthy();
  expect(screen.queryByTestId('admin-hotspot')).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: brand.texts['admin.deleteEvent'],
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['admin.exit'] }),
  );
  await screen.findByRole('button', { name: brand.attract.startButton });
  expect(
    screen.queryByRole('heading', { name: brand.texts['admin.title'] }),
  ).toBeNull();
});
it('tres intentos incorrectos bloquean también al volver a abrir el acceso', async () => {
  await openAdmin();
  for (let i = 0; i < 3; i++) {
    await pin('1111');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    if (i < 2)
      await waitFor(() =>
        expect(
          (
            screen.getByRole('button', {
              name: '1',
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
  }
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: '1',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  await waitFor(async () =>
    expect((await pinService(brand).state()).lockedUntil).toBeGreaterThan(
      Date.now(),
    ),
  );
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['admin.cancel'] }),
  );
  await screen.findByRole('button', { name: brand.attract.startButton });
  for (let i = 0; i < 5; i++)
    fireEvent.click(screen.getByTestId('admin-hotspot'));
  await screen.findByRole('dialog');
  expect(
    (
      screen.getByRole('button', {
        name: '1',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it('grilla se guarda y admin por inactividad cierra también sus modales sin perder leads', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  await createLeadsRepo(db).createWithSession(
    {
      eventId: brand.event.id,
      brandId: brand.brand.id,
      name: 'María Peña',
      email: 'maria@example.test',
      consent: true,
      consentVersion: 'v1',
      marketingOptIn: false,
    },
    3,
    brand.game.images[0].src,
  );
  await login();
  fireEvent.click(
    screen.getByRole('button', {
      name: brand.texts['game.grid'].split('{size}').join('4'),
    }),
  );
  await waitFor(async () =>
    expect(await settingsRepo.get(`gridSize:${brand.event.id}`)).toBe(4),
  );
  // El commit del override precede al refresh y al desbloqueo del dashboard.
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: brand.texts['admin.resetRanking'],
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['admin.resetRanking'] }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  now = brand.kiosk.inactivityMs.admin;
  act(() => checkActivityNow());
  await screen.findByRole('button', { name: brand.attract.startButton });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(await db.leads.count()).toBe(1);
  fireEvent.click(
    screen.getByRole('button', { name: brand.attract.startButton }),
  );
  await screen.findByLabelText('Email');
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
});

it('Atrás nativo cierra primero el modal, después admin, y vuelve a exigir PIN', async () => {
  await login();
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['admin.resetRanking'] }),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  act(() => handleNativeBack());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(flowStore.getState().screen).toBe('admin');
  act(() => handleNativeBack());
  await screen.findByRole('button', { name: brand.attract.startButton });
  for (let i = 0; i < 5; i++)
    fireEvent.click(screen.getByTestId('admin-hotspot'));
  await screen.findByRole('dialog');
  expect(
    screen.queryByRole('button', { name: brand.texts['admin.exportCsv'] }),
  ).toBeNull();
  act(() => handleNativeBack());
  await screen.findByRole('button', { name: brand.attract.startButton });
});
