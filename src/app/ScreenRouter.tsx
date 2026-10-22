import { useCallback, useRef, useState } from 'react';
import { asset } from '../brand/brand';
import { useBrand } from '../brand/BrandProvider';
import { t } from '../brand/t';
import { flowStore, useFlowStore } from '../flow/flowStore';
import { AttractScreen } from '../features/attract/AttractScreen';
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
import { leadsRepo } from '../data/repos/leadsRepo';
import { sessionsRepo } from '../data/repos/sessionsRepo';
import type { GameSession } from '../data/types';
import { dayKey } from '../shared/lib/time';
import { recordError } from '../kiosk/auditError';

/** El store solo conserva IDs; borrador, tablero y recursos viven en este montaje. */
export function ScreenRouter({ visit }: { visit: number }) {
  const brand = useBrand();
  const screen = useFlowStore((state) => state.screen);
  const [image] = useState(() => selectGameImage(brand.game.images));
  const [attempt, setAttempt] = useState(0);
  const [initialState, setInitialState] = useState<PuzzleState | null>(null);
  const [startError, setStartError] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [saveTask, setSaveTask] = useState<GameOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const writing = useRef(false);
  const isCurrent = useCallback(
    () => flowStore.getState().visit === visit,
    [visit],
  );
  const prepared = usePreparedImage(
    asset(image.src),
    image.focalPoint.x,
    image.focalPoint.y,
    attempt,
  );
  const completeCountdown = useCallback(() => {
    if (isCurrent()) flowStore.getState().go('game');
  }, [isCurrent]);
  const runSave = useCallback(
    async (outcome: GameOutcome, uuid: string) => {
      if (writing.current || !isCurrent()) return;
      writing.current = true;
      setSaving(true);
      setSaveError(false);
      try {
        const stored =
          outcome.status === 'completed'
            ? await sessionsRepo.finish(uuid, outcome)
            : await sessionsRepo.markTimeout(uuid, outcome);
        if (!isCurrent()) return;
        setSession(stored);
        setSaveTask(null);
        flowStore.getState().go('result');
      } catch {
        if (isCurrent()) setSaveError(true);
      } finally {
        writing.current = false;
        if (isCurrent()) setSaving(false);
      }
    },
    [isCurrent],
  );
  const finishGame = useCallback(
    (outcome: GameOutcome) => {
      if (!session || !isCurrent()) return;
      setSaveTask(outcome);
      void runSave(outcome, session.uuid);
    },
    [session, isCurrent, runSave],
  );
  const start = () => {
    try {
      const size = brand.game.gridSize;
      setInitialState(
        shuffle(size, {
          moves: brand.game.shuffleMoves[String(size) as '3' | '4']!,
        }),
      );
      setStartError(false);
      flowStore.getState().go('form');
    } catch {
      setStartError(true);
    }
  };
  const submitLead = async (values: LeadFormValues) => {
    if (!prepared.url || !initialState)
      throw new Error('La imagen todavía no está lista.');
    const created = await leadsRepo.createWithSession(
      normalize(values, brand),
      brand.game.gridSize,
      image.src,
    );
    if (!isCurrent()) {
      try {
        await sessionsRepo.markAbandoned(created.session.uuid);
      } catch (error) {
        void recordError('late_session_abandon_failed', error);
      }
      return;
    }
    setSession(created.session);
    flowStore
      .getState()
      .setParticipation(created.lead.uuid, created.session.uuid);
    flowStore.getState().go('countdown');
  };
  switch (screen) {
    case 'attract':
      return (
        <AttractScreen
          onStart={start}
          startError={startError}
          onLeaderboard={() => flowStore.getState().go('leaderboard')}
        />
      );
    case 'form':
      return (
        <LeadFormScreen
          onSubmit={submitLead}
          onCancel={() => void flowStore.getState().resetToAttract('cancel')}
          ready={Boolean(prepared.url) && Boolean(initialState)}
          imageError={prepared.error}
          onRetryImage={() => setAttempt((value) => value + 1)}
        />
      );
    case 'countdown':
      return (
        prepared.url && (
          <CountdownScreen
            imageUrl={prepared.url}
            onComplete={completeCountdown}
          />
        )
      );
    case 'game':
      if (saveTask)
        return (
          <main className="mx-auto max-w-xl px-5 py-12">
            <section
              className="game-sidebar"
              role={saveError ? 'alert' : 'status'}
            >
              <p>
                {saveError ? t('data.resultError') : t('data.savingResult')}
              </p>
              {saveError && session && (
                <button
                  className="game-button mt-5 bg-primary text-on-primary"
                  type="button"
                  disabled={saving}
                  onClick={() => void runSave(saveTask, session.uuid)}
                >
                  {t('game.retry')}
                </button>
              )}
            </section>
          </main>
        );
      return (
        prepared.url &&
        initialState && (
          <GameScreen
            initialState={initialState}
            imageUrl={prepared.url}
            onExit={() => void flowStore.getState().resetToAttract('finish')}
            onFinish={finishGame}
          />
        )
      );
    case 'result':
      return (
        session &&
        prepared.url && (
          <ResultScreen
            session={session}
            imageUrl={prepared.url}
            onLeaderboard={() => flowStore.getState().go('leaderboard')}
            onFinish={() => void flowStore.getState().resetToAttract('finish')}
          />
        )
      );
    case 'leaderboard':
      return (
        <LeaderboardScreen
          dayKey={session?.dayKey ?? dayKey()}
          gridSize={session?.gridSize ?? brand.game.gridSize}
          onFinish={() => void flowStore.getState().resetToAttract('finish')}
        />
      );
    case 'admin':
      // Estado reservado por la tabla del spec; no hay acceso ni UI admin hasta Fase 6.
      return null;
  }
}
