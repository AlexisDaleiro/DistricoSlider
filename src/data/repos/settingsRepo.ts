import { db, type KioskDB } from '../db';

export function createSettingsRepo(database: KioskDB) {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return (await database.settings.get(key))?.value as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await database.settings.put({ key, value });
    },
  };
}
export const settingsRepo = createSettingsRepo(db);
