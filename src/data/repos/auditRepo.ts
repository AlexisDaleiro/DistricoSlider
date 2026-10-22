import { db, type KioskDB } from '../db';

export function createAuditRepo(database: KioskDB) {
  return {
    add: (action: string, detail?: string) =>
      database.audit.add({
        at: Date.now(),
        action,
        ...(detail === undefined ? {} : { detail }),
      }),
  };
}
export const auditRepo = createAuditRepo(db);
