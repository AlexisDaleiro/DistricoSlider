import { z } from 'zod';
import { db, type KioskDB } from '../db';
import type { Lead, NewLeadInput } from '../types';
import { dayKey } from '../../shared/lib/time';
import { normalizeEmail, normalizePhone } from '../../shared/lib/normalize';
import { createSessionsRepo } from './sessionsRepo';
import { backupEvent } from '../backup';

export function createLeadsRepo(
  database: KioskDB,
  afterSave?: (eventId: string) => void,
) {
  async function create(input: NewLeadInput): Promise<Lead> {
    const email = input.email.trim()
      ? z.email().parse(normalizeEmail(input.email))
      : '';
    const name = z.string().trim().min(1).parse(input.name);
    const phone = input.phone?.trim() ? normalizePhone(input.phone) : undefined;
    if (phone === null)
      throw new Error('El teléfono debe estar normalizado a E.164.');
    if (!email && !phone) throw new Error('Se requiere email o celular.');
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
    registerParticipant: (input: NewLeadInput) =>
      database.transaction('rw', database.leads, async () => {
        if (!input.phone) throw new Error('Se requiere celular.');
        const existing = await database.leads
          .where('eventId')
          .equals(input.eventId)
          .filter((lead) => lead.phone === input.phone)
          .first();
        if (existing) {
          const updated = {
            ...existing,
            name: input.name,
            consent: input.consent,
            consentVersion: input.consentVersion,
          };
          await database.leads.put(updated);
          return updated;
        }
        return create(input);
      }),
    create: async (input: NewLeadInput) => {
      const lead = await create(input);
      afterSave?.(input.eventId);
      return lead;
    },
    createWithSession: async (
      input: NewLeadInput,
      gridSize: 3 | 4,
      imageSrc: string,
    ) => {
      const result = await database.transaction(
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
      );
      afterSave?.(input.eventId);
      return result;
    },
  };
}
export const leadsRepo = createLeadsRepo(db, (eventId) => {
  void backupEvent(eventId, false);
});
