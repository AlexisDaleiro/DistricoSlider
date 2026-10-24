import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { brandIds, brandNames, selectBrand } from '../../brand/brand';
import { t } from '../../brand/t';
import { eventRepo } from '../../data/repos/eventRepo';
import { settingsRepo } from '../../data/repos/settingsRepo';
import { leaderboardRepo } from '../../data/repos/leaderboardRepo';
import { auditRepo } from '../../data/repos/auditRepo';
import type { AuditEntry } from '../../data/types';
import { backupEvent } from '../../data/backup';
import {
  exportEvent,
  loadLastExport,
  type ExportedFile,
} from '../../data/export/exportEvent';
import { shareExportFile } from '../../data/export/saveExportFile';
import { getFilePlatform } from '../../data/files/platform';
import { flowStore } from '../../flow/flowStore';
import { dayKey, formatDuration } from '../../shared/lib/time';
import { Modal } from '../../shared/ui/Modal';
import { PinGate } from './PinGate';
import { ChangePin } from './ChangePin';
import { HoldToConfirmButton } from './HoldToConfirmButton';
import type { pinService } from './pin';
import { registerAdminBack } from '../../kiosk/backNavigation';

type Metrics = Awaited<ReturnType<typeof eventRepo.metrics>>;
type Dialog = null | 'pin' | 'reset' | 'deletePin' | 'delete' | 'audit';
export function AdminDashboard({
  service,
}: {
  service: ReturnType<typeof pinService>;
}) {
  const brand = useBrand();
  const eventId = brand.event.id;
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [defaultPin, setDefaultPin] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  useEffect(
    () =>
      registerAdminBack(() => {
        if (dialog) setDialog(null);
        else void flowStore.getState().resetToAttract('finish');
      }),
    [dialog],
  );
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ExportedFile | null>(null);
  const [grid, setGrid] = useState(brand.game.gridSize);
  const [storage, setStorage] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  const active = useRef(true);
  const backupStarted = useRef(false);
  const visit = useRef(flowStore.getState().visit);
  const authorized = useCallback(
    () =>
      active.current &&
      flowStore.getState().screen === 'admin' &&
      flowStore.getState().visit === visit.current,
    [],
  );
  const refresh = useCallback(async () => {
    const [data, pin, size, saved] = await Promise.all([
      eventRepo.metrics(eventId),
      service.ensure(),
      settingsRepo.get<number>(`gridSize:${eventId}`),
      loadLastExport(eventId),
    ]);
    if (!authorized()) return;
    setMetrics(data);
    setLast(saved);
    setDefaultPin(pin.isDefault);
    setGrid(size === 3 || size === 4 ? size : brand.game.gridSize);
  }, [eventId, service, authorized, brand.game.gridSize]);
  useEffect(() => {
    active.current = true;
    void Promise.resolve()
      .then(refresh)
      .catch(() => {
        if (authorized()) setError(true);
      });
    if (!backupStarted.current) {
      backupStarted.current = true;
      void backupEvent(eventId);
    }
    void navigator.storage
      ?.estimate?.()
      .then((value) => {
        if (authorized()) setStorage(value.usage ?? null);
      })
      .catch(() => {});
    void getFilePlatform()
      ?.battery?.()
      .then((value) => {
        if (authorized()) setBattery(value.level * 100);
      })
      .catch(() => {});
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active.current = false;
      window.clearInterval(clock);
    };
  }, [refresh, eventId, authorized]);
  const run = async (task: () => Promise<void>) => {
    if (lock.current || !authorized()) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      await task();
      if (authorized()) await refresh();
    } catch {
      if (authorized()) setError(true);
    } finally {
      lock.current = false;
      if (authorized()) setBusy(false);
    }
  };
  const fresh = Boolean(
    metrics?.lastExport &&
    now >= metrics.lastExport.at &&
    now - metrics.lastExport.at < brand.kiosk.admin.exportFreshMs,
  );
  const doExport = (format: 'csv' | 'xlsx') =>
    void run(async () => {
      const result = await exportEvent(
        eventId,
        brand.export.filePrefix,
        brand.export.csvSeparator,
        format,
        authorized,
      );
      if (authorized()) {
        setLast(result);
        setMessage(
          t('admin.exported', {
            count: result.count,
            location: t(`admin.location.${result.saved.location}`),
            path: result.saved.path,
          }),
        );
      }
    });
  const number = (value: number) =>
    new Intl.NumberFormat(brand.event.locale, {
      maximumFractionDigits: 1,
    }).format(value);
  const cards = metrics
    ? [
        ['admin.total', metrics.total],
        ['admin.today', metrics.today],
        ['admin.completed', metrics.completed],
        ['admin.abandoned', metrics.abandoned],
        ['admin.timeout', metrics.timeout],
        ['admin.completionRate', `${number(metrics.completionRate)}%`],
        [
          'admin.bestToday',
          metrics.bestToday === null
            ? t('admin.unavailable')
            : formatDuration(metrics.bestToday),
        ],
        [
          'admin.average',
          metrics.average === null
            ? t('admin.unavailable')
            : formatDuration(metrics.average),
        ],
        ['admin.marketing', `${number(metrics.marketing)}%`],
        [
          'admin.lastExport',
          metrics.lastExport
            ? new Date(metrics.lastExport.at).toLocaleString(brand.event.locale)
            : t('admin.never'),
        ],
        [
          'admin.storage',
          storage === null
            ? t('admin.unavailable')
            : t('admin.megabytes', { value: number(storage / 1024 / 1024) }),
        ],
        [
          'admin.battery',
          battery === null ? t('admin.unavailable') : `${number(battery)}%`,
        ],
      ]
    : [];
  return (
    <>
      <main inert={dialog !== null} className="mx-auto max-w-6xl px-5 pb-10">
        <section className="rounded-brand bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="game-heading">{t('admin.title')}</h1>
            <button
              className="game-button text-primary"
              type="button"
              onClick={() => void flowStore.getState().resetToAttract('finish')}
            >
              {t('admin.exit')}
            </button>
          </div>
          {defaultPin && (
            <p
              role="status"
              className="mt-5 rounded-brand bg-secondary p-4 text-on-secondary"
            >
              {t('admin.defaultPin')}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-5 text-danger">
              {t('admin.operationError')}
            </p>
          )}
          {message && (
            <p role="status" className="mt-5 rounded-brand bg-bg p-4">
              {message}
            </p>
          )}
          {!metrics ? (
            <p className="mt-6">{t('admin.loading')}</p>
          ) : (
            <>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map(([label, value]) => (
                  <div className="rounded-brand bg-bg p-4" key={label}>
                    <dt className="text-sm text-muted">{t(String(label))}</dt>
                    <dd className="mt-2 font-heading text-xl font-bold">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <h2 className="mt-8 font-heading text-xl font-bold">
                {t('admin.hours')}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <div className="grid min-w-[48rem] grid-cols-24 items-end gap-1">
                  {metrics.hours.map((count, hour) => (
                    <div className="text-center text-xs" key={hour}>
                      <span>{count}</span>
                      <div
                        className="mx-auto mt-1 w-4 bg-primary"
                        style={{
                          height: `${(count / Math.max(1, ...metrics.hours)) * 96}px`,
                        }}
                      />
                      <span>{hour}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              className="game-button bg-primary text-on-primary"
              disabled={busy}
              onClick={() => doExport('csv')}
            >
              {t('admin.exportCsv')}
            </button>
            {brand.export.includeXlsx && (
              <button
                type="button"
                className="game-button bg-primary text-on-primary"
                disabled={busy}
                onClick={() => doExport('xlsx')}
              >
                {t('admin.exportXlsx')}
              </button>
            )}
            <button
              type="button"
              className="game-button bg-bg text-primary"
              disabled={busy || !last}
              onClick={() =>
                void run(async () => {
                  if (last)
                    await shareExportFile(
                      last.saved.uri,
                      t('admin.shareTitle'),
                      last.file,
                    );
                })
              }
            >
              {t('admin.share')}
            </button>
            <button
              type="button"
              className="game-button bg-bg text-primary"
              disabled={busy}
              onClick={() => setDialog('reset')}
            >
              {t('admin.resetRanking')}
            </button>
            <button
              type="button"
              className="game-button bg-bg text-primary"
              disabled={busy}
              onClick={() => setDialog('pin')}
            >
              {t('admin.changePin')}
            </button>
            <button
              type="button"
              className="game-button bg-bg text-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const entries = await auditRepo.latest(100);
                  if (authorized()) {
                    setAudit(entries);
                    setDialog('audit');
                  }
                })
              }
            >
              {t('admin.audit')}
            </button>
          </div>
          <fieldset className="mt-7">
            <legend className="font-bold">{t('admin.grid')}</legend>
            <div className="mt-3 flex gap-3">
              {([3, 4] as const).map((size) => (
                <button
                  className={`game-button ${grid === size ? 'bg-primary text-on-primary' : 'bg-bg text-primary'}`}
                  type="button"
                  disabled={
                    busy ||
                    brand.game.shuffleMoves[String(size) as '3' | '4'] ===
                      undefined
                  }
                  key={size}
                  aria-pressed={grid === size}
                  onClick={() =>
                    void run(async () => {
                      await eventRepo.setGrid(eventId, size);
                    })
                  }
                >
                  {t('game.grid', { size })}
                </button>
              ))}
            </div>
          </fieldset>
          {brandIds.length > 1 && (
            <fieldset className="mt-7">
              <legend className="font-bold">{t('admin.brand')}</legend>
              <div className="mt-3 flex gap-3">
                {brandIds.map((id) => (
                  <button
                    className={`game-button ${brand.brand.id === id ? 'bg-primary text-on-primary' : 'bg-bg text-primary'}`}
                    type="button"
                    disabled={busy || brand.brand.id === id}
                    key={id}
                    aria-pressed={brand.brand.id === id}
                    onClick={() =>
                      void run(async () => {
                        await auditRepo.add('brand_changed', id);
                        selectBrand(id);
                      })
                    }
                  >
                    {brandNames[id]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <section className="mt-8 border-t border-muted/25 pt-6">
            <p className="text-sm text-muted">
              {t('admin.deleteRequirement', {
                minutes: brand.kiosk.admin.exportFreshMs / 60000,
              })}
            </p>
            <button
              type="button"
              className="game-button mt-3 text-danger"
              disabled={busy || !fresh}
              onClick={() => setDialog('deletePin')}
            >
              {t('admin.deleteEvent')}
            </button>
          </section>
          <p className="mt-8 text-xs text-muted">
            {t('admin.support', {
              version: __APP_VERSION__,
              brand: brand.brand.id,
              event: eventId,
            })}
          </p>
        </section>
      </main>
      {dialog && (
        <Modal
          title={t(
            dialog === 'audit'
              ? 'admin.audit'
              : dialog === 'pin'
                ? 'admin.changePin'
                : dialog === 'reset'
                  ? 'admin.resetRanking'
                  : 'admin.deleteEvent',
          )}
        >
          {dialog === 'pin' ? (
            <ChangePin
              service={service}
              onCancel={() => setDialog(null)}
              onDone={() => {
                setDialog(null);
                void refresh().catch(() => {
                  if (authorized()) setError(true);
                });
                setMessage(t('admin.pinChanged'));
              }}
            />
          ) : dialog === 'deletePin' ? (
            <PinGate
              service={service}
              onCancel={() => setDialog(null)}
              onVerified={() => {
                if (authorized()) setDialog('delete');
              }}
              label={t('admin.reenterPin')}
            />
          ) : dialog === 'audit' ? (
            <>
              <ul className="mt-5 space-y-4 text-sm">
                {audit.map((entry) => (
                  <li className="break-words" key={entry.id}>
                    <time>
                      {new Date(entry.at).toLocaleString(brand.event.locale)}
                    </time>
                    <p className="font-bold">{entry.action}</p>
                    <p className="text-muted">{entry.detail}</p>
                  </li>
                ))}
              </ul>
              <button
                className="game-button mt-5 w-full text-primary"
                onClick={() => setDialog(null)}
                type="button"
              >
                {t('admin.close')}
              </button>
            </>
          ) : (
            <>
              <p className="my-5 text-muted">
                {t(
                  dialog === 'reset'
                    ? 'admin.resetExplanation'
                    : 'admin.deleteExplanation',
                )}
              </p>
              <HoldToConfirmButton
                durationMs={
                  dialog === 'reset'
                    ? brand.kiosk.admin.resetHoldMs
                    : brand.kiosk.admin.deleteHoldMs
                }
                disabled={busy || (dialog === 'delete' && !fresh)}
                onConfirm={() =>
                  void run(async () => {
                    if (dialog === 'reset')
                      await leaderboardRepo.reset(eventId, dayKey());
                    else if (metrics?.lastExport)
                      await eventRepo.deleteEvent(
                        eventId,
                        brand.kiosk.admin.exportFreshMs,
                        metrics.lastExport.at,
                      );
                    if (authorized()) {
                      setDialog(null);
                      setMessage(t('admin.done'));
                    }
                  })
                }
              >
                {t('admin.hold', {
                  seconds:
                    (dialog === 'reset'
                      ? brand.kiosk.admin.resetHoldMs
                      : brand.kiosk.admin.deleteHoldMs) / 1000,
                })}
              </HoldToConfirmButton>
              <button
                className="game-button mt-3 w-full text-muted"
                type="button"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                {t('admin.cancel')}
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
