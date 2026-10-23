// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createFlowStore } from '../flowStore';
import { TRANSITIONS, type Screen } from '../transitions';
import { sessionsRepo } from '../../data/repos/sessionsRepo';
import { auditRepo } from '../../data/repos/auditRepo';

vi.mock('../../data/repos/sessionsRepo', () => ({
  sessionsRepo: { markAbandoned: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../data/repos/auditRepo', () => ({
  auditRepo: { add: vi.fn().mockResolvedValue(1) },
}));
afterEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
});

it('la portada abre formulario o ranking y todos los flujos vuelven a ella; verifica las 49 combinaciones', () => {
  expect(TRANSITIONS).toEqual({
    attract: ['form', 'leaderboard', 'admin'],
    form: ['countdown', 'attract'],
    countdown: ['game', 'attract'],
    game: ['result', 'attract'],
    result: ['leaderboard', 'countdown', 'attract'],
    leaderboard: ['attract'],
    admin: ['attract'],
  });
  for (const from of Object.keys(TRANSITIONS) as Screen[])
    for (const to of Object.keys(TRANSITIONS) as Screen[]) {
      const store = createFlowStore(true);
      store.setState({ screen: from });
      if (TRANSITIONS[from].includes(to)) {
        store.getState().go(to);
        expect(store.getState().screen).toBe(to);
      } else {
        expect(() => store.getState().go(to)).toThrow(
          'Transición no permitida',
        );
        expect(store.getState().screen).toBe(from);
      }
    }
});

it('una transición inválida en producción resetea y audita, sin lanzar', async () => {
  const store = createFlowStore(false);
  store.getState().go('game');
  expect(store.getState()).toMatchObject({ screen: 'attract', visit: 1 });
  await vi.waitFor(() =>
    expect(auditRepo.add).toHaveBeenCalledWith(
      'flow_reset',
      'invalid_transition:attract',
    ),
  );
});

it('limpia IDs, cambia montaje y quita foco antes de esperar el abandono pendiente', async () => {
  let finish: (() => void) | undefined;
  vi.mocked(sessionsRepo.markAbandoned).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({} as Awaited<ReturnType<typeof sessionsRepo.markAbandoned>>);
      }),
  );
  const store = createFlowStore();
  store.setState({ screen: 'game', leadUuid: 'lead', sessionUuid: 'session' });
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  const pending = store.getState().resetToAttract('inactivity');
  expect(store.getState()).toMatchObject({
    screen: 'attract',
    visit: 1,
    leadUuid: null,
    sessionUuid: null,
  });
  expect(document.activeElement).not.toBe(input);
  expect(sessionsRepo.markAbandoned).toHaveBeenCalledWith('session');
  finish?.();
  await pending;
  expect(auditRepo.add).toHaveBeenCalledWith('flow_reset', 'inactivity:game');
});

it('un fallo de abandono y de auditoría no impide limpiar ni genera otra excepción', async () => {
  vi.mocked(sessionsRepo.markAbandoned).mockRejectedValueOnce(
    new Error('IDB unavailable'),
  );
  vi.mocked(auditRepo.add).mockRejectedValueOnce(
    new Error('audit unavailable'),
  );
  const store = createFlowStore();
  store.setState({
    screen: 'countdown',
    leadUuid: 'lead',
    sessionUuid: 'session',
  });
  await expect(
    store.getState().resetToAttract('inactivity'),
  ).resolves.toBeUndefined();
  expect(store.getState().screen).toBe('attract');
  expect(auditRepo.add).toHaveBeenCalledWith(
    'session_abandon_failed',
    expect.stringContaining('IDB unavailable'),
  );
});
