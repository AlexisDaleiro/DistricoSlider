import { db, type KioskDB } from '../db';
import type { PinHash, PinState } from '../types';
import type { BrandConfig } from '../../brand/schema';
export function createPinRepo(brandId: string, database: KioskDB = db) {
  const hashKey = `adminPin:${brandId}`;
  const lockKey = `adminLockout:${brandId}`;
  const state = async (): Promise<PinState> =>
    ((await database.settings.get(lockKey))?.value as PinState | undefined) ?? {
      failures: 0,
      level: 0,
      lockedUntil: 0,
    };
  return {
    state,
    ensure: (initial: PinHash): Promise<PinHash> =>
      database.transaction('rw', database.settings, async () => {
        const record = await database.settings.get(hashKey);
        if (record) return record.value as PinHash;
        await database.settings.put({ key: hashKey, value: initial });
        return initial;
      }),
    attempt: (
      valid: boolean,
      policy: BrandConfig['kiosk']['admin'],
      expected?: PinHash,
    ) =>
      database.transaction(
        'rw',
        database.settings,
        database.audit,
        async () => {
          const current = await state();
          const now = Date.now();
          if (
            expected &&
            JSON.stringify((await database.settings.get(hashKey))?.value) !==
              JSON.stringify(expected)
          )
            valid = false;
          if (current.lockedUntil > now)
            return { ok: false, lockedUntil: current.lockedUntil };
          if (valid) {
            await database.settings.put({
              key: lockKey,
              value: { failures: 0, level: 0, lockedUntil: 0 },
            });
            await database.audit.add({ at: now, action: 'admin_pin_ok' });
            return { ok: true, lockedUntil: 0 };
          }
          const failures = current.failures + 1;
          const lock = failures >= policy.maxAttempts;
          const lockedUntil = lock
            ? now +
              Math.min(
                policy.lockoutMaxMs,
                policy.lockoutBaseMs * 2 ** Math.min(current.level, 30),
              )
            : 0;
          await database.settings.put({
            key: lockKey,
            value: {
              failures: lock ? 0 : failures,
              level: lock ? current.level + 1 : current.level,
              lockedUntil,
            },
          });
          await database.audit.add({
            at: now,
            action: 'admin_pin_failed',
            detail: lock ? String(lockedUntil) : undefined,
          });
          return { ok: false, lockedUntil };
        },
      ),
    replace: (hash: PinHash, expected: PinHash) =>
      database.transaction(
        'rw',
        database.settings,
        database.audit,
        async () => {
          const current = (await database.settings.get(hashKey))?.value as
            PinHash | undefined;
          if (JSON.stringify(current) !== JSON.stringify(expected))
            throw new Error('El PIN cambió durante la operación.');
          await database.settings.put({ key: hashKey, value: hash });
          await database.audit.add({
            at: Date.now(),
            action: 'admin_pin_changed',
          });
        },
      ),
  };
}
