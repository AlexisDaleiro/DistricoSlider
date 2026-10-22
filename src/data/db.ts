import Dexie, { type Table } from 'dexie';
import type { Lead, GameSession, Setting, AuditEntry } from './types';

export class KioskDB extends Dexie {
  leads!: Table<Lead, number>;
  sessions!: Table<GameSession, number>;
  settings!: Table<Setting, string>;
  audit!: Table<AuditEntry, number>;

  constructor(name = 'kiosk-puzzle') {
    super(name);
    // Versión 1 inmutable: las modificaciones futuras deben crear otra versión.
    this.version(1).stores({
      leads:
        '++id, &uuid, eventId, createdAt, dayKey, emailNormalized, [eventId+emailNormalized]',
      sessions:
        '++id, &uuid, leadUuid, eventId, status, startedAt, [eventId+dayKey+gridSize+status]',
      settings: '&key',
      audit: '++id, at',
    });
  }
}
export const db = new KioskDB();
