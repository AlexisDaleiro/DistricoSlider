import { z } from 'zod';
import { db, type KioskDB } from '../db';
import type { Lead, NewLeadInput } from '../types';
import { dayKey } from '../../shared/lib/time';
import { normalizeEmail, normalizePhone } from '../../shared/lib/normalize';
import { createSessionsRepo } from './sessionsRepo';

export function createLeadsRepo(database: KioskDB) {
  async function create(input: NewLeadInput): Promise<Lead> {
    const email = z.email().parse(normalizeEmail(input.email));
    const name = z.string().trim().min(1).parse(input.name);
    const phone = input.phone?.trim() ? normalizePhone(input.phone) : undefined;
    if (phone === null)
      throw new Error('El teléfono debe estar normalizado a E.164.');
    const now = Date.now();
    const lead: Lead = {
      ...input,
      name,
      email,
      emailNormalized: email,
      company: input.company?.trim() || undefined,
      phone,
      extra: input.extra
        ? Object.fromEntries(
            Object.entries(input.extra).map(([key, value]) => [
              key,
              value.trim(),
            ]),
          )
        : undefined,
      uuid: crypto.randomUUID(),
      createdAt: now,
      dayKey: dayKey(now),
    };
    const id = await database.leads.add(lead);
    return { ...lead, id };
  }
  return {
    create,
    createWithSession: (
      input: NewLeadInput,
      gridSize: 3 | 4,
      imageSrc: string,
    ) =>
      database.transaction(
        'rw',
        database.leads,
        database.sessions,
        async () => {
          const lead = await create(input);
          const session = await createSessionsRepo(database).start(
            lead.uuid,
            gridSize,
            imageSrc,
          );
          return { lead, session };
        },
      ),
  };
}
export const leadsRepo = createLeadsRepo(db);
