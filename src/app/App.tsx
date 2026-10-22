import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { QA_ENABLED } from '../qa/config';
import { useBrand } from '../brand/BrandProvider';
import { t } from '../brand/t';
import { initializeData } from '../data/initialize';
import { flowStore, useFlowStore } from '../flow/flowStore';
import {
  checkActivityNow,
  startActivityTracking,
} from '../kiosk/activityTracker';
import { initNativeKiosk } from '../kiosk/native';
import { handleNativeBack } from '../kiosk/backNavigation';
import { startBrowserKiosk } from '../kiosk/browserKiosk';
import { InactivityWarning } from '../kiosk/InactivityWarning';
import { useInactivity } from '../kiosk/useInactivity';
import { ScreenRouter } from './ScreenRouter';
import { BrandHeader } from '../shared/ui/BrandHeader';

const QaPanel = import.meta.env.DEV
  ? lazy(() => import('../qa/QaPanel'))
  : null;

export function App() {
  const brand = useBrand();
  const screen = useFlowStore((state) => state.screen);
  const visit = useFlowStore((state) => state.visit);
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  useEffect(() => {
    const stopTracking = startActivityTracking();
    const stopBrowser = startBrowserKiosk();
    return () => {
      stopTracking();
      stopBrowser();
    };
  }, []);
  useEffect(() => {
    let active = true;
    let stop = () => {};
    void initNativeKiosk(
      brand.kiosk.orientation,
      () => {
        if (active) handleNativeBack();
      },
      () => {
        if (active) checkActivityNow();
      },
    ).then((cleanup) => {
      if (active) stop = cleanup;
      else cleanup();
    });
    return () => {
      active = false;
      stop();
    };
  }, [brand.kiosk.orientation]);
  useEffect(() => {
    let active = true;
    void initializeData()
      .then(() => {
        if (active) setDataReady(true);
      })
      .catch(() => {
        if (active) setDataError(true);
      });
    return () => {
      active = false;
    };
  }, [bootAttempt]);
  const onTimeout = useCallback(() => {
    void flowStore.getState().resetToAttract('inactivity');
  }, []);
  const inactivity = useInactivity({
    timeoutMs:
      screen === 'attract'
        ? brand.gameHub
          ? brand.kiosk.inactivityMs.form
          : 0
        : brand.kiosk.inactivityMs[screen],
    warningMs: brand.kiosk.warningMs,
    enabled: dataReady && (screen !== 'attract' || Boolean(brand.gameHub)),
    onTimeout,
    activityKey: `${screen}:${visit}`,
  });
  return (
    <div className="brand-showcase min-h-dvh bg-bg font-body text-fg">
      {QA_ENABLED && QaPanel && dataReady && (
        <Suspense fallback={null}>
          <QaPanel />
        </Suspense>
      )}
      <div inert={inactivity.secondsLeft !== null}>
        {(!dataReady || screen !== 'attract' || brand.gameHub) && (
          <BrandHeader />
        )}
        {!dataReady ? (
          <main className="mx-auto max-w-xl px-5 py-12">
            <section
              className="game-sidebar"
              role={dataError ? 'alert' : 'status'}
            >
              <p>{dataError ? t('data.error') : t('data.loading')}</p>
              {dataError && (
                <button
                  className="game-button mt-5 bg-primary text-on-primary"
                  type="button"
                  onClick={() => {
                    setDataError(false);
                    setBootAttempt((value) => value + 1);
                  }}
                >
                  {t('game.retry')}
                </button>
              )}
            </section>
          </main>
        ) : (
          <ScreenRouter key={visit} visit={visit} />
        )}
      </div>
      {inactivity.secondsLeft !== null && (
        <InactivityWarning
          secondsLeft={inactivity.secondsLeft}
          onContinue={inactivity.keepAlive}
        />
      )}
    </div>
  );
}
