// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { ResultScreen } from '../../result/ResultScreen';
import {
  getLeaderboard,
  getRankFor,
} from '../../../data/repos/leaderboardRepo';
import type { LeaderboardEntry } from '../../../data/repos/leaderboardRepo';
import { brand } from '../../../brand/brand';

vi.mock('../../../data/repos/leaderboardRepo', () => ({
  getLeaderboard: vi.fn(),
  getRankFor: vi.fn(),
}));
const entry: LeaderboardEntry = {
  lead: {
    uuid: 'lead',
    eventId: 'event',
    brandId: 'brand',
    createdAt: 0,
    dayKey: '2026-10-21',
    name: 'Ana Pérez',
    email: 'private@example.com',
    emailNormalized: 'private@example.com',
    company: 'Empresa',
    consent: true,
    consentVersion: 'v1',
    marketingOptIn: false,
  },
  session: {
    uuid: 'session',
    leadUuid: 'lead',
    eventId: 'event',
    dayKey: '2026-10-21',
    gridSize: 3,
    imageSrc: 'a.jpg',
    startedAt: 0,
    status: 'completed',
    finishedAt: 1000,
    durationMs: 1234,
    moves: 8,
  },
};
beforeEach(() => {
  vi.mocked(getLeaderboard).mockReset().mockResolvedValue([entry]);
  vi.mocked(getRankFor).mockReset().mockResolvedValue(2);
});
afterEach(cleanup);

it('ranking muestra nombre enmascarado, tiempo y movimientos; nunca email ni apellido completo', async () => {
  await act(async () => {
    render(
      <LeaderboardScreen dayKey="2026-10-21" gridSize={3} onFinish={vi.fn()} />,
    );
  });
  expect(screen.getByText('Ana P.')).toBeDefined();
  expect(screen.getByText('00:01.2')).toBeDefined();
  expect(document.body.textContent).not.toContain('private@example.com');
  expect(document.body.textContent).not.toContain('Pérez');
  expect(getLeaderboard).toHaveBeenCalledWith(
    brand.event.id,
    '2026-10-21',
    3,
    brand.leaderboard.size,
  );
});
it('ranking vacío y lectura fallida tienen mensajes propios y retry', async () => {
  vi.mocked(getLeaderboard)
    .mockRejectedValueOnce(new Error('read failed'))
    .mockResolvedValueOnce([]);
  await act(async () => {
    render(
      <LeaderboardScreen dayKey="2026-10-21" gridSize={3} onFinish={vi.fn()} />,
    );
  });
  expect(screen.getByRole('alert').textContent).toContain(
    brand.texts['leaderboard.error'],
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: brand.texts['game.retry'] }),
    );
  });
  expect(screen.getByText(brand.texts['leaderboard.empty'])).toBeDefined();
});
it('RESULT obtiene el puesto real del repo y permite pasar al ranking', async () => {
  const onLeaderboard = vi.fn();
  await act(async () => {
    render(
      <ResultScreen
        session={entry.session}
        imageUrl="blob:test"
        onFinish={vi.fn()}
        onLeaderboard={onLeaderboard}
      />,
    );
  });
  expect(screen.getByRole('status').textContent).toBe(
    'Quedaste en el puesto 2',
  );
  expect(getRankFor).toHaveBeenCalledWith('session');
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['result.ranking'] }),
  );
  expect(onLeaderboard).toHaveBeenCalledOnce();
});
it('timeout no consulta ni muestra un puesto de ranking', async () => {
  await act(async () => {
    render(
      <ResultScreen
        session={{ ...entry.session, status: 'timeout' }}
        imageUrl="blob:test"
        onFinish={vi.fn()}
        onLeaderboard={vi.fn()}
      />,
    );
  });
  expect(screen.getByRole('heading').textContent).toBe(
    brand.texts['game.timeoutTitle'],
  );
  expect(getRankFor).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).toBeNull();
});
