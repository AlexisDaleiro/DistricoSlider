import { expect, it } from 'vitest';
import { qaBrand, qaRequested } from '../config';
import { brandSchema } from '../../brand/schema';
import raw from '../../../brands/demo/theme.config.json';
it.each([
  [true, '?qa=1', true],
  [true, '', false],
  [true, '?qa=0', false],
  [false, '?qa=1', false],
])('QA requiere dev y query exacta (%s, %s)', (dev, query, expected) => {
  expect(qaRequested(dev as boolean, query as string)).toBe(expected);
});
it('reduce plazos ×0,1 sin mutar config ni debilitar PIN/holds de borrado', () => {
  const config = brandSchema.parse(raw),
    copy = structuredClone(config),
    qa = qaBrand(config);
  expect(config).toEqual(copy);
  for (const key of Object.keys(
    config.kiosk.inactivityMs,
  ) as (keyof typeof config.kiosk.inactivityMs)[])
    expect(qa.kiosk.inactivityMs[key]).toBe(
      config.kiosk.inactivityMs[key] * 0.1,
    );
  expect(qa.kiosk.warningMs).toBe(config.kiosk.warningMs * 0.1);
  expect(qa.game.countdownSec).toBeCloseTo(0.3);
  expect(qa.game.maxDurationSec).toBe(config.game.maxDurationSec * 0.1);
  expect(qa.kiosk.admin.maxAttempts).toBe(config.kiosk.admin.maxAttempts);
  expect(qa.kiosk.admin.deleteHoldMs).toBe(config.kiosk.admin.deleteHoldMs);
  expect(qa.kiosk.admin.lockoutBaseMs).toBe(config.kiosk.admin.lockoutBaseMs);
});
