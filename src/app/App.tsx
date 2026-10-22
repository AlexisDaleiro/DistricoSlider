import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../brand/brand';
import { useBrand } from '../brand/BrandProvider';
import { t } from '../brand/t';
import { CountdownScreen } from '../features/game/CountdownScreen';
import { GameScreen, type GameOutcome } from '../features/game/GameScreen';
import { shuffle } from '../features/game/engine/shuffle';
import type { PuzzleState } from '../features/game/engine/types';
import { usePreparedImage } from '../features/game/image/usePreparedImage';
import { selectGameImage } from '../features/game/image/selectGameImage';
import { LeadFormScreen } from '../features/lead-form/LeadFormScreen';
import type { LeadFormValues } from '../features/lead-form/buildLeadSchema';
import { normalize } from '../features/lead-form/normalize';
import { ResultScreen } from '../features/result/ResultScreen';
import { LeaderboardScreen } from '../features/leaderboard/LeaderboardScreen';
import { initializeData } from '../data/initialize';
import { leadsRepo } from '../data/repos/leadsRepo';
import { sessionsRepo } from '../data/repos/sessionsRepo';
import type { GameSession } from '../data/types';
import { dayKey } from '../shared/lib/time';

type Screen =
  'ready' | 'form' | 'countdown' | 'game' | 'saving' | 'result' | 'leaderboard';
type SaveTask =
  | { kind: 'abandon'; uuid: string }
  | { kind: 'score'; uuid: string; outcome: GameOutcome };

/** Coordinación local de Fase 4; la máquina de kiosco corresponde a Fase 5. */
export function App() {
  const brand = useBrand();
  const [screen, setScreen] = useState<Screen>('ready');
  const [image, setImage] = useState(() => selectGameImage(brand.game.images));
  const [attempt, setAttempt] = useState(0);
  const [initialState, setInitialState] = useState<PuzzleState | null>(null);
  const [startError, setStartError] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [saveTask, setSaveTask] = useState<SaveTask | null>(null);
  const [saveError, setSaveError] = useState(false);
  const writing = useRef(false);
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
  const prepared = usePreparedImage(
    asset(image.src),
    image.focalPoint.x,
    image.focalPoint.y,
    attempt,
  );
  const completeCountdown = useCallback(() => setScreen('game'), []);
  const reset = useCallback(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    setScreen('ready');
    setInitialState(null);
    setSession(null);
    setSaveTask(null);
    setSaveError(false);
    setImage(selectGameImage(brand.game.images));
  }, [brand.game.images]);
  const runSave = useCallback(
    async (task: SaveTask) => {
      if (writing.current) return;
      writing.current = true;
      setSaveError(false);
      try {
        if (task.kind === 'abandon') {
          await sessionsRepo.markAbandoned(task.uuid);
          reset();
        } else {
          const stored =
            task.outcome.status === 'completed'
              ? await sessionsRepo.finish(task.uuid, task.outcome)
              : await sessionsRepo.markTimeout(task.uuid, task.outcome);
          setSession(stored);
          setSaveTask(null);
          setScreen('result');
        }
      } catch {
        setSaveError(true);
      } finally {
        writing.current = false;
      }
    },
    [reset],
  );
  const finishGame = useCallback(
    (outcome: GameOutcome) => {
      if (!session) return;
      const task: SaveTask = { kind: 'score', uuid: session.uuid, outcome };
      setSaveTask(task);
      setScreen('saving');
      void runSave(task);
    },
    [session, runSave],
  );
  const exitGame = () => {
    if (!session) return;
    const task: SaveTask = { kind: 'abandon', uuid: session.uuid };
    setSaveTask(task);
    setScreen('saving');
    void runSave(task);
  };
  const start = () => {
    try {
      const size = brand.game.gridSize;
      setInitialState(
        shuffle(size, {
          moves: brand.game.shuffleMoves[String(size) as '3' | '4']!,
        }),
      );
      setStartError(false);
      setScreen('form');
    } catch {
      setStartError(true);
    }
  };
  const submitLead = async (values: LeadFormValues) => {
    if (!prepared.url || !initialState)
      throw new Error('La imagen todavía no está lista.');
    const { session } = await leadsRepo.createWithSession(
      normalize(values, brand),
      brand.game.gridSize,
      image.src,
    );
    setSession(session);
    setScreen('countdown');
  };
  return (
    <div className="brand-showcase min-h-dvh bg-bg font-body text-fg">
      <header className="game-header">
        <div className="flex items-center gap-4">
          <img
            className="h-20 w-20 rounded-brand object-contain"
            src={asset(brand.brand.logo)}
            alt={brand.brand.name}
            draggable={false}
          />
          <span className="font-heading text-lg font-bold tracking-tight md:text-xl">
            {brand.brand.appName}
          </span>
        </div>
        <span className="max-w-48 text-right text-sm text-muted">
          {brand.event.name}
        </span>
      </header>
      {!dataReady && (
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
      )}
      {dataReady && screen === 'ready' && (
        <main className="game-layout">
          <section className="order-2 max-w-lg lg:order-1">
            <p className="game-eyebrow">{t('game.eyebrow')}</p>
            <h1 className="mt-5 font-heading text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
              {brand.attract.headline}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              {t('showcase.description')}
            </p>
            <p className="mt-4 text-sm font-medium text-primary">
              {t('game.firstMove')}
            </p>
            {startError ? (
              <div role="alert" className="mt-8">
                <p className="text-danger">{t('game.loadError')}</p>
                <button
                  className="game-button mt-4 bg-primary text-on-primary"
                  type="button"
                  onClick={() => {
                    setStartError(false);
                    start();
                  }}
                >
                  {t('game.retry')}
                </button>
              </div>
            ) : (
              <button
                className="game-button mt-8 bg-primary text-on-primary"
                type="button"
                onClick={start}
              >
                {brand.attract.cta}
                {
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 12h16m-6-6 6 6-6 6" />
                  </svg>
                }
              </button>
            )}
          </section>
          <figure className="order-1 mx-auto w-full rounded-brand bg-surface p-3 lg:order-2 lg:rotate-2">
            <img
              className="aspect-square w-full rounded-brand object-cover"
              src={asset(brand.attract.media[0])}
              alt={t('game.imageAlt')}
              draggable={false}
            />
            <figcaption className="flex items-center justify-between gap-3 px-2 py-4 text-sm">
              <span>{t('showcase.imageCaption')}</span>
              <span className="rounded-full bg-secondary px-3 py-1 font-bold text-on-secondary">
                {t('game.grid', { size: brand.game.gridSize })}
              </span>
            </figcaption>
          </figure>
        </main>
      )}
      {dataReady && screen === 'ready' && (
        <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <button
            className="game-button text-primary"
            type="button"
            onClick={() => setScreen('leaderboard')}
          >
            {t('result.ranking')}
          </button>
        </div>
      )}
      {screen === 'form' && (
        <LeadFormScreen
          onSubmit={submitLead}
          onCancel={reset}
          ready={Boolean(prepared.url) && Boolean(initialState)}
          imageError={prepared.error}
          onRetryImage={() => setAttempt((value) => value + 1)}
        />
      )}
      {screen === 'countdown' && prepared.url && (
        <CountdownScreen
          imageUrl={prepared.url}
          onComplete={completeCountdown}
        />
      )}
      {screen === 'game' && prepared.url && initialState && (
        <GameScreen
          initialState={initialState}
          imageUrl={prepared.url}
          onExit={exitGame}
          onFinish={finishGame}
        />
      )}
      {screen === 'saving' && (
        <main className="mx-auto max-w-xl px-5 py-12">
          <section
            className="game-sidebar"
            role={saveError ? 'alert' : 'status'}
          >
            <p>{saveError ? t('data.resultError') : t('data.savingResult')}</p>
            {saveError && saveTask && (
              <button
                className="game-button mt-5 bg-primary text-on-primary"
                type="button"
                onClick={() => void runSave(saveTask)}
              >
                {t('game.retry')}
              </button>
            )}
          </section>
        </main>
      )}
      {screen === 'result' && session && prepared.url && (
        <ResultScreen
          session={session}
          imageUrl={prepared.url}
          onLeaderboard={() => setScreen('leaderboard')}
          onFinish={reset}
        />
      )}
      {screen === 'leaderboard' && (
        <LeaderboardScreen
          dayKey={session?.dayKey ?? dayKey()}
          gridSize={session?.gridSize ?? brand.game.gridSize}
          onFinish={reset}
        />
      )}
    </div>
  );
}
