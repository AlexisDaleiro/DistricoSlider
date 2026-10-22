import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KioskDB } from '../db';
import { createLeadsRepo } from '../repos/leadsRepo';
import { createSessionsRepo } from '../repos/sessionsRepo';
import { createLeaderboardRepo } from '../repos/leaderboardRepo';
import { initializeDatabase } from '../initialize';
import { dayKey } from '../../shared/lib/time';
import type { NewLeadInput } from '../types';

let database: KioskDB;
let now: number;
const input: NewLeadInput = {
  eventId: 'event',
  brandId: 'brand',
  name: ' Ana Pérez ',
  email: ' ANA@EXAMPLE.COM ',
  company: ' Empresa ',
  phone: '+59899123456',
  consent: true,
  consentVersion: 'v1',
  marketingOptIn: false,
};
beforeEach(async () => {
  now = new Date(2026, 9, 21, 12).getTime();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  database = new KioskDB(`kiosk-puzzle-test-${crypto.randomUUID()}`);
  await database.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});

it('guarda lead normalizado y sesión started atómicamente, conservando cada participación', async () => {
  const repo = createLeadsRepo(database);
  const first = await repo.createWithSession(input, 3, 'assets/puzzle/a.jpg');
  expect(first.lead).toMatchObject({
    name: 'Ana Pérez',
    email: 'ana@example.com',
    emailNormalized: 'ana@example.com',
    company: 'Empresa',
    phone: '+59899123456',
    consentVersion: 'v1',
    consent: true,
    dayKey: dayKey(now),
  });
  expect(first.session).toMatchObject({
    leadUuid: first.lead.uuid,
    status: 'started',
    imageSrc: 'assets/puzzle/a.jpg',
    gridSize: 3,
    eventId: 'event',
  });
  const second = await repo.createWithSession(input, 3, 'assets/puzzle/b.jpg');
  expect(first.lead.uuid).not.toBe(second.lead.uuid);
  expect(await database.leads.count()).toBe(2);
  expect(await database.sessions.count()).toBe(2);
});

it('si falla la sesión se revierte la transacción completa, sin dejar un lead aislado', async () => {
  vi.spyOn(database.sessions, 'add').mockRejectedValueOnce(
    new Error('write failed'),
  );
  await expect(
    createLeadsRepo(database).createWithSession(
      input,
      3,
      'assets/puzzle/a.jpg',
    ),
  ).rejects.toThrow('write failed');
  expect(await database.leads.count()).toBe(0);
  expect(await database.sessions.count()).toBe(0);
});

it('cerrar y reabrir otra conexión conserva los registros', async () => {
  const { lead, session } = await createLeadsRepo(database).createWithSession(
    input,
    3,
    'assets/puzzle/a.jpg',
  );
  database.close();
  const reopened = new KioskDB(database.name);
  try {
    await reopened.open();
    expect(
      await reopened.leads.where('uuid').equals(lead.uuid).first(),
    ).toEqual(lead);
    expect(
      await reopened.sessions.where('uuid').equals(session.uuid).first(),
    ).toEqual(session);
  } finally {
    reopened.close();
  }
});

it('finish es idempotente y ni abandonar ni timeout sobrescriben una partida completada', async () => {
  const { session } = await createLeadsRepo(database).createWithSession(
    input,
    3,
    'assets/puzzle/a.jpg',
  );
  const repo = createSessionsRepo(database);
  const first = await repo.finish(session.uuid, {
    durationMs: 1234,
    moves: 12,
  });
  now += 1000;
  expect(
    await repo.finish(session.uuid, { durationMs: 1234, moves: 12 }),
  ).toEqual(first);
  expect(await repo.markAbandoned(session.uuid)).toEqual(first);
  expect(await repo.markTimeout(session.uuid)).toEqual(first);
  await expect(
    repo.finish(session.uuid, { durationMs: 4, moves: 1 }),
  ).rejects.toThrow(/otro resultado/);
  await expect(
    repo.finish('missing', { durationMs: 1, moves: 1 }),
  ).rejects.toThrow(/no encontrada/);
  await expect(repo.start('missing', 3, 'a.jpg')).rejects.toThrow(/sin lead/);
});

it('ranking deduplica por email, desempata por movimientos y llegada, y separa evento/día/grilla/status', async () => {
  const leads = createLeadsRepo(database),
    sessions = createSessionsRepo(database);
  async function score(
    email: string,
    durationMs: number,
    moves: number,
    overrides: Partial<NewLeadInput> = {},
    size: 3 | 4 = 3,
  ) {
    now += 100;
    const participation = await leads.createWithSession(
      { ...input, email, ...overrides },
      size,
      'a.jpg',
    );
    await sessions.finish(participation.session.uuid, { durationMs, moves });
    return participation;
  }
  const a = await score('a@example.com', 1000, 10);
  const b = await score('b@example.com', 1000, 8);
  const c = await score('c@example.com', 1000, 8);
  const bestA = await score(' A@EXAMPLE.COM ', 500, 20);
  const worseA = await score('a@example.com', 2000, 40);
  await score('other@example.com', 10, 1, { eventId: 'other' });
  await score('grid4@example.com', 10, 1, {}, 4);
  const yesterday = await score('old@example.com', 10, 1);
  await database.sessions.update(yesterday.session.id!, {
    dayKey: '2026-10-20',
  });
  const abandoned = await leads.createWithSession(
    { ...input, email: 'abandoned@example.com' },
    3,
    'a.jpg',
  );
  await sessions.markAbandoned(abandoned.session.uuid);
  const timeout = await leads.createWithSession(
    { ...input, email: 'timeout@example.com' },
    3,
    'a.jpg',
  );
  await sessions.markTimeout(timeout.session.uuid, {
    durationMs: 300001,
    moves: 7,
  });
  const ranking = createLeaderboardRepo(database);
  const rows = await ranking.getLeaderboard('event', dayKey(now), 3, 10);
  expect(rows.map((row) => row.session.uuid)).toEqual([
    bestA.session.uuid,
    b.session.uuid,
    c.session.uuid,
  ]);
  expect(await ranking.getRankFor(worseA.session.uuid)).toBe(1);
  expect(await ranking.getRankFor(a.session.uuid)).toBe(1);
  expect(await ranking.getRankFor(timeout.session.uuid)).toBeNull();
  expect(await ranking.getLeaderboard('event', dayKey(now), 3, 1)).toHaveLength(
    1,
  );
  expect(await database.leads.count()).toBe(10);
});

it('reiniciar ranking guarda un marcador y auditoría; no borra leads ni sesiones', async () => {
  const leads = createLeadsRepo(database),
    sessions = createSessionsRepo(database),
    ranking = createLeaderboardRepo(database);
  const first = await leads.createWithSession(input, 3, 'a.jpg');
  await sessions.finish(first.session.uuid, { durationMs: 1000, moves: 10 });
  now += 100;
  await ranking.reset('event', dayKey(now));
  expect(await ranking.getLeaderboard('event', dayKey(now), 3, 10)).toEqual([]);
  expect(await ranking.getRankFor(first.session.uuid)).toBeNull();
  expect(await database.leads.count()).toBe(1);
  expect(await database.sessions.count()).toBe(1);
  expect((await database.audit.toArray())[0].action).toBe('leaderboard_reset');
  now += 100;
  const next = await leads.createWithSession(input, 3, 'b.jpg');
  await sessions.finish(next.session.uuid, { durationMs: 2000, moves: 20 });
  expect(
    (await ranking.getLeaderboard('event', dayKey(now), 3, 10))[0].session.uuid,
  ).toBe(next.session.uuid);
  expect(await database.leads.count()).toBe(2);
});

it('recupera solo started de más de 15 minutos y no toca las recientes ni completadas', async () => {
  const leads = createLeadsRepo(database),
    sessions = createSessionsRepo(database);
  const old = await leads.createWithSession(input, 3, 'a.jpg');
  const recent = await leads.createWithSession(input, 3, 'a.jpg');
  const finished = await leads.createWithSession(input, 3, 'a.jpg');
  await database.sessions.update(old.session.id!, {
    startedAt: now - 16 * 60 * 1000,
  });
  await database.sessions.update(recent.session.id!, {
    startedAt: now - 15 * 60 * 1000,
  });
  await sessions.finish(finished.session.uuid, { durationMs: 10, moves: 1 });
  expect(await sessions.recoverOrphans(now)).toBe(1);
  expect((await sessions.get(old.session.uuid))?.status).toBe('abandoned');
  expect((await sessions.get(recent.session.uuid))?.status).toBe('started');
  expect((await sessions.get(finished.session.uuid))?.status).toBe('completed');
  expect(await database.leads.count()).toBe(3);
});

it('startup solicita persistencia y audita negativa, ausencia o fallo sin borrar datos', async () => {
  await createLeadsRepo(database).create(input);
  const persist = vi.fn().mockResolvedValue(false);
  await initializeDatabase(database, persist);
  expect(persist).toHaveBeenCalledOnce();
  await initializeDatabase(database, async () => undefined);
  await initializeDatabase(database, async () => {
    throw new Error('denied');
  });
  expect((await database.audit.toArray()).map((entry) => entry.detail)).toEqual(
    ['false', 'unavailable', 'failed'],
  );
  expect(await database.leads.count()).toBe(1);
});
