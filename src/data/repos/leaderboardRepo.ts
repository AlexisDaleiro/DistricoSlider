import { db, type KioskDB } from '../db';
import type { Lead, GameSession } from '../types';

export interface LeaderboardEntry {
  session: GameSession;
  lead: Lead;
}
const compare = (a: GameSession, b: GameSession) =>
  a.durationMs! - b.durationMs! ||
  a.moves! - b.moves! ||
  a.finishedAt! - b.finishedAt!;
const resetKey = (eventId: string, dayKey: string) =>
  `leaderboardResetAt:${eventId}:${dayKey}`;

export function createLeaderboardRepo(database: KioskDB) {
  async function getLeaderboard(
    eventId: string,
    dayKey: string,
    gridSize: 3 | 4,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    const value = (await database.settings.get(resetKey(eventId, dayKey)))
      ?.value;
    const resetAt = typeof value === 'number' ? value : 0;
    const sessions = await database.sessions
      .where('[eventId+dayKey+gridSize+status]')
      .equals([eventId, dayKey, gridSize, 'completed'])
      .filter(
        (session) =>
          (session.finishedAt ?? 0) > resetAt &&
          Number.isSafeInteger(session.durationMs) &&
          Number.isSafeInteger(session.moves),
      )
      .toArray();
    if (sessions.length === 0) return [];
    const leads = new Map(
      (
        await database.leads
          .where('uuid')
          .anyOf(sessions.map((session) => session.leadUuid))
          .toArray()
      ).map((lead) => [lead.uuid, lead]),
    );
    const best = new Map<string, LeaderboardEntry>();
    for (const session of sessions) {
      const lead = leads.get(session.leadUuid);
      if (!lead) continue;
      const previous = best.get(lead.emailNormalized);
      if (!previous || compare(session, previous.session) < 0)
        best.set(lead.emailNormalized, { session, lead });
    }
    return [...best.values()]
      .sort((a, b) => compare(a.session, b.session))
      .slice(0, limit);
  }
  return {
    getLeaderboard,
    async getRankFor(sessionUuid: string): Promise<number | null> {
      const session = await database.sessions
        .where('uuid')
        .equals(sessionUuid)
        .first();
      if (!session || session.status !== 'completed') return null;
      const marker = (
        await database.settings.get(resetKey(session.eventId, session.dayKey))
      )?.value;
      if (
        (session.finishedAt ?? 0) <= (typeof marker === 'number' ? marker : 0)
      )
        return null;
      const lead = await database.leads
        .where('uuid')
        .equals(session.leadUuid)
        .first();
      if (!lead) return null;
      const entries = await getLeaderboard(
        session.eventId,
        session.dayKey,
        session.gridSize,
        Number.MAX_SAFE_INTEGER,
      );
      const index = entries.findIndex(
        (entry) => entry.lead.emailNormalized === lead.emailNormalized,
      );
      return index < 0 ? null : index + 1;
    },
    // Soporte de datos únicamente. El control protegido de admin pertenece a Fase 6.
    reset: (eventId: string, dayKey: string) =>
      database.transaction(
        'rw',
        database.settings,
        database.audit,
        async () => {
          const at = Date.now();
          await database.settings.put({
            key: resetKey(eventId, dayKey),
            value: at,
          });
          await database.audit.add({
            at,
            action: 'leaderboard_reset',
            detail: `${eventId}:${dayKey}`,
          });
        },
      ),
  };
}
export const leaderboardRepo = createLeaderboardRepo(db);
export const getLeaderboard = leaderboardRepo.getLeaderboard;
export const getRankFor = leaderboardRepo.getRankFor;
