import { db, type KioskDB } from './db';
import { createAuditRepo } from './repos/auditRepo';
import { createSessionsRepo } from './repos/sessionsRepo';
import { createPinRepo } from './repos/pinRepo';
import { brand } from '../brand/brand';

export async function initializeDatabase(
  database: KioskDB,
  persist: () => Promise<boolean | undefined> = async () =>
    navigator.storage?.persist?.(),
): Promise<void> {
  await database.open();
  const audit = createAuditRepo(database);
  const recovered = await createSessionsRepo(database).recoverOrphans();
  if (recovered) await audit.add('sessions_recovered', String(recovered));
  try {
    const granted = await persist();
    await audit.add(
      'storage_persist',
      granted === undefined ? 'unavailable' : String(granted),
    );
  } catch {
    // Una negativa de persist() no invalida IndexedDB ni interrumpe la captura.
    await audit.add('storage_persist', 'failed');
  }
}
let initialization: Promise<void> | null = null;
export function initializeData(): Promise<void> {
  initialization ??= initializeDatabase(db)
    .then(async () => {
      await createPinRepo(brand.brand.androidAppId).ensure(
        __INITIAL_ADMIN_PIN__,
      );
    })
    .catch((cause) => {
      initialization = null;
      throw cause;
    });
  return initialization;
}
