import { expect, it, vi } from 'vitest';
import raw from '../../../../brands/districo/theme.config.json';
import { getGameHub } from '../runtime';

vi.mock('../../../brand/brand', async () => {
  const { brandSchema } = await import('../../../brand/schema');
  const { default: config } =
    await import('../../../../brands/districo/theme.config.json');
  return { brand: brandSchema.parse(config) };
});

it('usa el catálogo, versión y prefijo proporcionados, con producción sin preview', () => {
  const hub = getGameHub();
  expect(hub.missing).toEqual([]);
  expect(hub.preview).toBe(false);
  expect(hub.config).toMatchObject(raw.gameHub);
  expect(hub.config).toMatchObject({
    gameId: 'biofresh-puzzle',
    brandId: 'biofresh',
    gameName: 'Puzzle',
    gameVersion: '1.0.0',
    defaultCallingCode: '598',
    allowPreview: false,
  });
  const event = hub.client.event('registration', {
    participant: { name: 'Prueba local', phone: '+12025550123' },
    sessionId: crypto.randomUUID(),
    metrics: {},
  });
  expect(event).toMatchObject({
    gameId: 'biofresh-puzzle',
    brandName: 'Biofresh',
    gameVersion: '1.0.0',
    schemaVersion: 1,
  });
  expect(hub.client.queue).toHaveLength(0);
});
