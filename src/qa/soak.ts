import { brand } from '../brand/brand';
import { t } from '../brand/t';
import { db } from '../data/db';
import { sessionsRepo } from '../data/repos/sessionsRepo';
import { flowStore } from '../flow/flowStore';
import { markActivity } from '../kiosk/activityTracker';
import { QA_ENABLED } from './config';
import {
  observeResources,
  stableResources,
  type ResourceSample,
} from './resources';

export const SOAK_CYCLES = 500;
let running = false;
function check(signal: AbortSignal) {
  signal.throwIfAborted();
  if (document.visibilityState === 'hidden') throw new Error(t('qa.hidden'));
}
async function until(
  predicate: () => boolean,
  signal: AbortSignal,
  pollMs: number,
  screen: string,
) {
  const start = performance.now();
  while (!predicate()) {
    check(signal);
    markActivity();
    const alert = document.querySelector('main [role=alert]');
    if (alert)
      throw new Error(
        t('qa.stageError', { screen, detail: alert.textContent?.trim() ?? '' }),
      );
    if (performance.now() - start > 15000)
      throw new Error(t('qa.wrongScreen', { screen }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, pollMs));
  }
  check(signal);
}
function clickText(label: string) {
  const control = Array.from(
    document.querySelectorAll<HTMLButtonElement>('main button'),
  ).find((button) => button.textContent?.trim() === label && !button.disabled);
  if (!control) throw new Error(t('qa.missingControl', { control: label }));
  markActivity();
  control.click();
}
function setInput(input: HTMLInputElement, value: string) {
  // Evitar el value tracker de React al simular entrada desde una herramienta dev.
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export interface SoakReport {
  completed: number;
  stable: boolean;
  samples: ResourceSample[];
}
export class SoakFailure extends Error {
  constructor(
    message: string,
    readonly report: SoakReport,
  ) {
    super(message);
    this.name = 'SoakFailure';
  }
}
export async function runSoak(options: {
  signal: AbortSignal;
  onProgress?: (done: number) => void;
  cycles?: number;
  pollMs?: number;
}): Promise<SoakReport> {
  if (!QA_ENABLED || db.name !== 'kiosk-puzzle-qa')
    throw new Error(t('qa.onlyDev'));
  if (running) throw new Error(t('qa.busy'));
  const { signal, onProgress, cycles = SOAK_CYCLES, pollMs = 25 } = options;
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > SOAK_CYCLES)
    throw new RangeError('cycles');
  running = true;
  const monitor = observeResources();
  const samples: ResourceSample[] = [];
  const runId = crypto.randomUUID().slice(0, 8);
  let completed = 0;
  try {
    await flowStore.getState().resetToAttract('finish');
    for (let cycle = 1; cycle <= cycles; cycle++) {
      await until(
        () =>
          flowStore.getState().screen === 'attract' &&
          Boolean(document.querySelector('main button')),
        signal,
        pollMs,
        'attract',
      );
      clickText(brand.attract.cta);
      await until(
        () =>
          flowStore.getState().screen === 'form' &&
          Boolean(document.querySelector('form')),
        signal,
        pollMs,
        'form',
      );
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('[data-lead-field]'),
      );
      const checks = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'form input[type=checkbox]',
        ),
      );
      if (
        inputs.some((input) => input.value !== '') ||
        checks.some((input) => input.checked)
      )
        throw new Error(t('qa.dirtyForm'));
      const email = `qa-${runId}-${cycle}@example.invalid`;
      for (const input of inputs) {
        const field = brand.form.fields.find(
          (field) => field.id === input.dataset.leadField,
        )!;
        let value =
          field.id === 'email'
            ? email
            : field.id === 'name'
              ? t('qa.fakeName', { cycle })
              : field.type === 'tel'
                ? '+59899123456'
                : t('qa.fakeCompany');
        if (field.type === 'text')
          value = value
            .padEnd(field.minLength ?? 0, 'Q')
            .slice(0, field.maxLength);
        setInput(input, value);
      }
      checks[0]?.click();
      if (cycle % 2 === 0) checks[1]?.click();
      await until(
        () =>
          Boolean(
            document.querySelector<HTMLButtonElement>(
              'form button[type=submit]:not(:disabled)',
            ),
          ),
        signal,
        pollMs,
        'form-ready',
      );
      markActivity();
      document.querySelector<HTMLFormElement>('form')!.requestSubmit();
      await until(
        () => flowStore.getState().screen === 'countdown',
        signal,
        pollMs,
        'countdown',
      );
      const { leadUuid, sessionUuid } = flowStore.getState();
      const lead = await db.leads.where('uuid').equals(leadUuid!).first();
      const started = await sessionsRepo.get(sessionUuid!);
      if (
        lead?.email !== email ||
        started?.status !== 'started' ||
        started.leadUuid !== leadUuid
      )
        throw new Error(t('qa.badData'));
      await until(
        () =>
          flowStore.getState().screen === 'game' &&
          Boolean(document.querySelector('[data-qa-solve]:not(:disabled)')),
        signal,
        pollMs,
        'game',
      );
      markActivity();
      document.querySelector<HTMLButtonElement>('[data-qa-solve]')!.click();
      await until(
        () =>
          flowStore.getState().screen === 'result' &&
          Boolean(document.querySelector('main h1')),
        signal,
        pollMs,
        'result',
      );
      const result = await sessionsRepo.get(sessionUuid!);
      if (
        result?.status !== 'completed' ||
        result.moves !== 1 ||
        result.durationMs === undefined
      )
        throw new Error(t('qa.badData'));
      clickText(t('result.ranking'));
      await until(
        () =>
          flowStore.getState().screen === 'leaderboard' &&
          Boolean(document.querySelector('.ranking-table tbody tr')),
        signal,
        pollMs,
        'leaderboard',
      );
      if (document.querySelector('main')!.textContent!.includes('@'))
        throw new Error(t('qa.badData'));
      clickText(t('common.finish'));
      await until(
        () =>
          flowStore.getState().screen === 'attract' &&
          Boolean(document.querySelector('main button')),
        signal,
        pollMs,
        'attract',
      );
      if (flowStore.getState().leadUuid || flowStore.getState().sessionUuid)
        throw new Error(t('qa.dirtyForm'));
      // React limpia efectos y termina la preparación de la siguiente imagen.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      completed = cycle;
      check(signal);
      onProgress?.(completed);
      if (cycle % 25 === 0 || cycle === cycles)
        samples.push(monitor.sample(cycle));
    }
    const stable = stableResources(samples);
    if (!stable)
      throw new SoakFailure(t('qa.resources'), { completed, stable, samples });
    return { completed, stable, samples };
  } catch (error) {
    if (signal.aborted || error instanceof SoakFailure) throw error;
    throw new SoakFailure(
      error instanceof Error ? error.message : String(error),
      {
        completed,
        stable: stableResources(samples),
        samples: [...samples, monitor.sample(completed)],
      },
    );
  } finally {
    monitor.stop();
    running = false;
    if (signal.aborted || completed !== cycles)
      await flowStore.getState().resetToAttract('finish');
  }
}
