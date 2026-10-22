import { useEffect, useRef, useState } from 'react';
import { t } from '../brand/t';
import { QA_ENABLED } from './config';
import { runSoak, SOAK_CYCLES, SoakFailure, type SoakReport } from './soak';

export default function QaPanel() {
  const controller = useRef<AbortController | null>(null);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<SoakReport | null>(null);
  useEffect(
    () => () => {
      const owned = controller.current;
      controller.current = null;
      owned?.abort();
    },
    [],
  );
  if (!QA_ENABLED) return null;
  return (
    <aside
      className="mx-auto max-w-6xl rounded-brand border-2 border-primary bg-surface p-5 text-fg"
      aria-label={t('qa.title')}
    >
      <h2 className="font-heading text-xl font-bold">{t('qa.title')}</h2>
      <p className="mt-2 text-sm text-muted">{t('qa.note')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="game-button bg-primary text-on-primary"
          disabled={busy}
          type="button"
          onClick={() => {
            if (controller.current) return;
            const owned = new AbortController();
            controller.current = owned;
            setBusy(true);
            setDone(0);
            setReport(null);
            setMessage('');
            void runSoak({
              signal: owned.signal,
              onProgress: (cycle) => {
                if (!owned.signal.aborted) setDone(cycle);
              },
            })
              .then((report) => {
                if (!owned.signal.aborted) {
                  setReport(report);
                  setMessage(t('qa.done'));
                }
              })
              .catch((error: unknown) => {
                if (!owned.signal.aborted && error instanceof SoakFailure)
                  setReport(error.report);
                if (!owned.signal.aborted)
                  setMessage(
                    t('qa.failed', {
                      error:
                        error instanceof Error ? error.message : String(error),
                    }),
                  );
              })
              .finally(() => {
                if (controller.current === owned) {
                  controller.current = null;
                  setBusy(false);
                  if (owned.signal.aborted) setMessage(t('qa.stopped'));
                }
              });
          }}
        >
          {t('qa.start')}
        </button>
        <button
          className="game-button text-primary"
          type="button"
          disabled={!busy}
          onClick={() => controller.current?.abort()}
        >
          {t('qa.stop')}
        </button>
        <output aria-live="polite">
          {t('qa.progress', { done, total: SOAK_CYCLES })}
        </output>
      </div>
      {message && (
        <p className="mt-3" role="status">
          {message}
        </p>
      )}
      {report && (
        <details className="mt-3">
          <summary className="min-h-12 cursor-pointer py-3">
            {t('qa.report')}
          </summary>
          <pre data-qa-report className="overflow-x-auto text-xs">
            {JSON.stringify(report, null, 2)}
          </pre>
        </details>
      )}
    </aside>
  );
}
