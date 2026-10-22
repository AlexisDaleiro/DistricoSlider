// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {
  setTimeout as frameTimeout,
  clearTimeout as clearFrameTimeout,
} from 'node:timers';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { brand } from '../../brand/brand';
import { db, KioskDB } from '../../data/db';
import { backupEvent } from '../../data/backup';
import { flowStore } from '../../flow/flowStore';
import { runSoak } from '../soak';

vi.mock('../config', async (original) => ({
  ...(await original<typeof import('../config')>()),
  QA_ENABLED: true,
}));
const live = new Set<string>();
let created = 0;
let controller: AbortController;
let pending: Promise<unknown> | null = null;
const frames = new Map<number, ReturnType<typeof frameTimeout>>();
beforeEach(async () => {
  controller = new AbortController();
  pending = null;
  brand.game.countdownSec = 0.01;
  brand.game.tileAnimationMs = 1;
  brand.game.victoryAnimationMs = 1;
  flowStore.setState({
    screen: 'attract',
    visit: 0,
    leadUuid: null,
    sessionUuid: null,
  });
  created = 0;
  live.clear();
  const BaseURL = URL;
  vi.stubGlobal(
    'URL',
    class extends BaseURL {
      static createObjectURL = () => {
        const url = `blob:soak-${++created}`;
        live.add(url);
        return url;
      };
      static revokeObjectURL = (url: string) => {
        live.delete(url);
      };
    },
  );
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(
      id,
      frameTimeout(() => {
        frames.delete(id);
        callback(performance.now());
      }, 1),
    );
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const timer = frames.get(id);
    if (timer) clearFrameTimeout(timer);
    frames.delete(id);
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, blob: async () => new Blob(['local']) }),
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 1200, height: 1200, close: vi.fn() }),
  );
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = async () => {};
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['webp'])),
  );
  await db.open();
});
afterEach(async () => {
  controller.abort();
  await pending?.catch(() => {});
  cleanup();
  frames.forEach(clearFrameTimeout);
  frames.clear();
  await backupEvent(brand.event.id, false);
  await db.delete();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('500 flujos reales: lead antes de GAME, resultado/ranking, formulario limpio, sin crecimiento de recursos', async () => {
  const production = new KioskDB('kiosk-puzzle');
  await production.settings.put({ key: 'sentinel', value: 'conservar' });
  expect(db.name).toBe('kiosk-puzzle-qa');
  render(<App />);
  await screen.findByRole('button', { name: brand.attract.cta });
  // Este harness recorre el event loop del navegador, no simula componentes.
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
  const progress: number[] = [];
  const work = runSoak({
    signal: controller.signal,
    pollMs: 1,
    onProgress: (cycle) => {
      progress.push(cycle);
      if (cycle % 100 === 0) console.info(`Soak: ${cycle}/500`);
    },
  });
  pending = work;
  const report = await work;
  expect(report.completed).toBe(500);
  expect(report.stable).toBe(true);
  expect(report.samples).toHaveLength(20);
  expect(progress).toHaveLength(500);
  expect(await db.leads.count()).toBe(500);
  expect(await db.sessions.where('status').equals('completed').count()).toBe(
    500,
  );
  expect(
    (await db.leads.toArray()).every((lead) =>
      lead.email.endsWith('@example.invalid'),
    ),
  ).toBe(true);
  expect(await production.settings.get('sentinel')).toEqual({
    key: 'sentinel',
    value: 'conservar',
  });
  expect(await production.leads.count()).toBe(0);
  expect(live.size).toBe(1);
  expect(created).toBeGreaterThan(500);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  cleanup();
  expect(live.size).toBe(0);
  await production.delete();
}, 400000);
it('cancelar restaura instrumentos y vuelve a ATTRACT conservando las capturas ya guardadas', async () => {
  render(<App />);
  await screen.findByRole('button', { name: brand.attract.cta });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
  const original = window.setTimeout;
  const work = runSoak({ signal: controller.signal, pollMs: 1, cycles: 5 });
  pending = work;
  await waitFor(() => expect(flowStore.getState().screen).toBe('game'));
  controller.abort();
  await expect(work).rejects.toThrow();
  expect(window.setTimeout).toBe(original);
  expect(flowStore.getState().screen).toBe('attract');
  expect(await db.leads.count()).toBe(1);
  expect(await db.sessions.count()).toBe(1);
});
