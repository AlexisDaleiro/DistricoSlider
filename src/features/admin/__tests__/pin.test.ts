import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KioskDB } from '../../../data/db';
import { createPinRepo } from '../../../data/repos/pinRepo';
import {
  createPinService,
  constantTimeEqual,
  hashPin,
  matchesPin,
} from '../pin';
import { brand } from '../../../brand/brand';
let database: KioskDB;
let now: number;
beforeEach(async () => {
  database = new KioskDB(`test-pin-${crypto.randomUUID()}`);
  await database.open();
  now = 1000000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});
const service = async () =>
  createPinService(
    createPinRepo('brand', database),
    brand.kiosk.admin,
    await hashPin('1234'),
  );
it('PBKDF2 SHA-256 de 100.000 iteraciones usa salts aleatorios y comparación de bytes', async () => {
  const a = await hashPin('1234');
  const b = await hashPin('1234');
  expect(a.salt).toHaveLength(16);
  expect(a.hash).toHaveLength(32);
  expect(a.iterations).toBe(100000);
  expect(a.salt).not.toEqual(b.salt);
  expect(a.hash).not.toEqual(b.hash);
  expect(await matchesPin('1234', a)).toBe(true);
  expect(await matchesPin('4321', a)).toBe(false);
  expect(await matchesPin('123', a)).toBe(false);
  expect(
    constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])),
  ).toBe(true);
  expect(
    constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])),
  ).toBe(false);
  expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(
    false,
  );
});
it('solo guarda hash y conserva el PIN existente al cambiar la semilla del build', async () => {
  const first = await service();
  await first.ensure();
  const stored = await database.settings.toArray();
  expect(JSON.stringify(stored)).not.toContain('1234');
  const next = createPinService(
    createPinRepo('brand', database),
    brand.kiosk.admin,
    await hashPin('9999'),
  );
  expect((await next.verify('1234')).ok).toBe(true);
  expect((await next.verify('9999')).ok).toBe(false);
});
it('3 fallos bloquean 30 s, persiste al reabrir, duplica hasta 15 min y éxito limpia escalada', async () => {
  let pin = await service();
  for (let level = 0; level < 7; level++) {
    const failures = await Promise.all([
      pin.verify('9999'),
      pin.verify('9999'),
      pin.verify('9999'),
    ]);
    const duration = Math.min(900000, 30000 * 2 ** level);
    expect(failures[2].lockedUntil - now).toBe(duration);
    database.close();
    await database.open();
    pin = await service();
    expect((await pin.verify('1234')).ok).toBe(false);
    now += duration;
  }
  expect((await pin.verify('1234')).ok).toBe(true);
  expect(await pin.state()).toEqual({ failures: 0, level: 0, lockedUntil: 0 });
  expect(
    await database.audit
      .filter((entry) => entry.action === 'admin_pin_failed')
      .count(),
  ).toBe(21);
});
it('cambiar requiere PIN actual y repetición, modifica hash sin almacenar texto plano', async () => {
  const pin = await service();
  expect(await pin.change('9999', '5678', '5678')).toBe(false);
  expect(await pin.change('1234', '5678', '5679')).toBe(false);
  expect(await pin.change('1234', '5678', '5678')).toBe(true);
  expect((await pin.verify('5678')).ok).toBe(true);
  expect((await pin.verify('1234')).ok).toBe(false);
  expect(
    await database.audit
      .filter((entry) => entry.action === 'admin_pin_changed')
      .count(),
  ).toBe(1);
});
