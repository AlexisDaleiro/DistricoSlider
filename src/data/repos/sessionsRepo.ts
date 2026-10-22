import { db, type KioskDB } from '../db';
import type { GameSession } from '../types';
import { dayKey } from '../../shared/lib/time';

export interface Score {
  durationMs: number;
  moves: number;
}
function validateScore(score: Score) {
  if (
    !Number.isSafeInteger(score.durationMs) ||
    score.durationMs < 0 ||
    !Number.isSafeInteger(score.moves) ||
    score.moves < 0
  )
    throw new Error('Puntaje inválido.');
}

export function createSessionsRepo(database: KioskDB) {
  const get = (uuid: string) =>
    database.sessions.where('uuid').equals(uuid).first();
  async function terminate(
    uuid: string,
    status: 'completed' | 'timeout' | 'abandoned',
    score?: Score,
  ): Promise<GameSession> {
    if (score) validateScore(score);
    return database.transaction('rw', database.sessions, async () => {
      const session = await get(uuid);
      if (!session?.id) throw new Error('Sesión no encontrada.');
      if (session.status !== 'started') {
        if (
          status === 'completed' &&
          (session.status !== 'completed' ||
            session.durationMs !== score?.durationMs ||
            session.moves !== score?.moves)
        )
          throw new Error('La sesión ya tiene otro resultado.');
        return session;
      }
      const finished: GameSession = {
        ...session,
        ...(score ? { durationMs: score.durationMs, moves: score.moves } : {}),
        status,
        finishedAt: Date.now(),
      };
      await database.sessions.put(finished);
      return finished;
    });
  }
  return {
    get,
    async start(
      leadUuid: string,
      gridSize: 3 | 4,
      imageSrc: string,
    ): Promise<GameSession> {
      const lead = await database.leads.where('uuid').equals(leadUuid).first();
      if (!lead) throw new Error('No se puede iniciar una sesión sin lead.');
      const now = Date.now();
      const session: GameSession = {
        uuid: crypto.randomUUID(),
        leadUuid,
        eventId: lead.eventId,
        dayKey: dayKey(now),
        gridSize,
        imageSrc,
        startedAt: now,
        status: 'started',
      };
      const id = await database.sessions.add(session);
      return { ...session, id };
    },
    finish: (uuid: string, score: Score) => terminate(uuid, 'completed', score),
    markTimeout: (uuid: string, score?: Score) =>
      terminate(uuid, 'timeout', score),
    markAbandoned: (uuid: string) => terminate(uuid, 'abandoned'),
    // Intervalo de recuperación de crash definido por 5.2, no timeout de pantalla.
    recoverOrphans: (now = Date.now()) =>
      database.sessions
        .where('status')
        .equals('started')
        .and((session) => session.startedAt < now - 15 * 60 * 1000)
        .modify({ status: 'abandoned', finishedAt: now }),
  };
}
export const sessionsRepo = createSessionsRepo(db);
