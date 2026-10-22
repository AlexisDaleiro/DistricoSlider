import type { BrandConfig } from '../../brand/schema';
import { createPinRepo } from '../../data/repos/pinRepo';
import type { PinHash } from '../../data/types';
export type { PinHash, PinState } from '../../data/types';
export type PinResult = { ok: boolean; lockedUntil: number };
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
export async function hashPin(
  pin: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
  iterations = 100000,
): Promise<PinHash> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN inválido.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return {
    salt: [...salt],
    hash: [...new Uint8Array(hash)],
    iterations,
    isDefault: pin === '0000',
  };
}
export async function matchesPin(pin: string, record: PinHash) {
  if (!/^\d{4}$/.test(pin)) return false;
  const next = await hashPin(
    pin,
    new Uint8Array(record.salt),
    record.iterations,
  );
  return constantTimeEqual(
    new Uint8Array(next.hash),
    new Uint8Array(record.hash),
  );
}
export function createPinService(
  repo: ReturnType<typeof createPinRepo>,
  policy: BrandConfig['kiosk']['admin'],
  initial = __INITIAL_ADMIN_PIN__,
) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => {});
    return next;
  };
  const ensure = () => repo.ensure(initial);
  const verify = (pin: string) =>
    serial(async (): Promise<PinResult> => {
      const record = await ensure();
      const state = await repo.state();
      if (state.lockedUntil > Date.now())
        return { ok: false, lockedUntil: state.lockedUntil };
      return repo.attempt(await matchesPin(pin, record), policy, record);
    });
  return {
    ensure,
    state: repo.state,
    verify,
    change: async (current: string, next: string, repeated: string) => {
      if (next !== repeated || !/^\d{4}$/.test(next)) return false;
      const previous = await ensure();
      if (!(await verify(current)).ok) return false;
      await repo.replace(await hashPin(next), previous);
      return true;
    },
  };
}
export function pinService(brand: BrandConfig) {
  return createPinService(createPinRepo(brand.brand.id), brand.kiosk.admin);
}
