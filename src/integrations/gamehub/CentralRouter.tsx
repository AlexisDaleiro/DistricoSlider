import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { asset } from '../../brand/brand';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import { flowStore, useFlowStore } from '../../flow/flowStore';
import { onParticipationReset } from '../../flow/participationLifecycle';
import { LeadFormScreen } from '../../features/lead-form/LeadFormScreen';
import { normalize } from '../../features/lead-form/normalize';
import type { LeadFormValues } from '../../features/lead-form/buildLeadSchema';
import { AdminHotspot } from '../../features/admin/AdminHotspot';
import { AdminScreen } from '../../features/admin/AdminScreen';
import { CountdownScreen } from '../../features/game/CountdownScreen';
import { GameScreen, type GameOutcome } from '../../features/game/GameScreen';
import { ResultScreen } from '../../features/result/ResultScreen';
import { LeaderboardScreen } from '../../features/leaderboard/LeaderboardScreen';
import { shuffle } from '../../features/game/engine/shuffle';
import type { PuzzleState } from '../../features/game/engine/types';
import { usePreparedImage } from '../../features/game/image/usePreparedImage';
import { selectGameImage } from '../../features/game/image/selectGameImage';
import { leadsRepo } from '../../data/repos/leadsRepo';
import { sessionsRepo } from '../../data/repos/sessionsRepo';
import { settingsRepo } from '../../data/repos/settingsRepo';
import type { Lead, GameSession } from '../../data/types';
import { dayKey } from '../../shared/lib/time';
import { getGameHub } from './runtime';

export function CentralRouter({ visit }: { visit: number }) {
  const brand = useBrand();
  const hub = getGameHub();
  const screen = useFlowStore((state) => state.screen);
  const status = useSyncExternalStore(hub.subscribe, hub.getSnapshot);
  const [identityLocked, setIdentityLocked] = useState(hub.identityLocked);
  const [lead, setLead] = useState<Lead | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [board, setBoard] = useState<PuzzleState | null>(null);
  const [image] = useState(() => selectGameImage(brand.game.images));
  const [imageAttempt, setImageAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveTask, setSaveTask] = useState<GameOutcome | null>(null);
  const locked = useRef(false);
  const current = useCallback(
    () => flowStore.getState().visit === visit,
    [visit],
  );
  const prepared = usePreparedImage(
    asset(image.src),
    image.focalPoint.x,
    image.focalPoint.y,
    imageAttempt,
  );

  useEffect(() => {
    const unsubscribe = onParticipationReset(hub.clear);
    const retry = () => {
      void hub.retry().catch(() => {});
    };
    const onPageHide = () => {
      void flowStore.getState().resetToAttract('page_exit');
    };
    const timer = window.setInterval(retry, 20000);
    window.addEventListener('online', retry);
    window.addEventListener('pagehide', onPageHide);
    retry();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('online', retry);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [hub]);

  const changeParticipant = () => {
    void flowStore.getState().resetToAttract('finish');
  };
  const register = async (values: LeadFormValues) => {
    const pending = hub.register(values.fields.name, values.fields.phone);
    setIdentityLocked(hub.identityLocked);
    const participant = await pending;
    if (!current()) return;
    const registered = await leadsRepo.registerParticipant({
      ...normalize(values, brand),
      name: participant.name,
      phone: participant.phone,
      brandId: hub.config.brandId || brand.brand.id,
      marketingOptIn: false,
    });
    if (!current()) return;
    setLead(registered);
    flowStore.getState().go('form');
  };
  const startRound = async () => {
    if (locked.current || !lead || !hub.canPlay || !prepared.url) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const override = await settingsRepo.get<number>(
        `gridSize:${brand.event.id}`,
      );
      if (!current()) return;
      const size =
        override === 3 || override === 4 ? override : brand.game.gridSize;
      const initial = shuffle(size, {
        moves: brand.game.shuffleMoves[String(size) as '3' | '4']!,
      });
      const started = await sessionsRepo.start(lead.uuid, size, image.src);
      if (!current()) {
        await sessionsRepo.markAbandoned(started.uuid);
        return;
      }
      hub.startRound(started.uuid, size, image.src);
      setBoard(initial);
      setSession(started);
      setSaveTask(null);
      flowStore.getState().setParticipation(lead.uuid, started.uuid);
      flowStore.getState().go('countdown');
    } catch {
      if (current()) setError('No pudimos iniciar la ronda. Reintentá.');
    } finally {
      locked.current = false;
      if (current()) setBusy(false);
    }
  };
  const save = useCallback(
    async (outcome: GameOutcome) => {
      if (locked.current || !session || !current()) return;
      locked.current = true;
      setBusy(true);
      setError('');
      // Se encola una sola vez y antes de esperar IDB. Reintentar IDB no crea otro evento.
      hub.finish(outcome.status, outcome);
      setSaveTask(outcome);
      try {
        const stored =
          outcome.status === 'completed'
            ? await sessionsRepo.finish(session.uuid, outcome)
            : await sessionsRepo.markTimeout(session.uuid, outcome);
        if (!current()) return;
        setSession(stored);
        setSaveTask(null);
        flowStore.getState().go('result');
      } catch {
        if (current())
          setError('No pudimos guardar el resultado local. Reintentá.');
      } finally {
        locked.current = false;
        if (current()) setBusy(false);
      }
    },
    [session, hub, current],
  );
  const finish = useCallback(
    (outcome: GameOutcome) => {
      void save(outcome);
    },
    [save],
  );
  let content;
  if (screen === 'admin') content = <AdminScreen />;
  else if (screen === 'attract')
    content = (
      <>
        <AdminHotspot
          onUnlock={() => {
            hub.clear('admin');
            flowStore.getState().go('admin');
          }}
        />
        <LeadFormScreen
          onSubmit={register}
          onCancel={changeParticipant}
          ready={hub.preview || hub.missing.length === 0}
          imageError={false}
          onRetryImage={() => {}}
          identityLocked={identityLocked}
        />
      </>
    );
  else if (screen === 'form')
    content = (
      <main className="mx-auto max-w-xl px-5 py-10">
        <section className="game-sidebar">
          <h1 className="game-heading">Cómo jugar</h1>
          <p className="mt-5 text-muted">{t('game.instructions')}</p>
          <p className="mt-3 text-muted">{t('game.firstMove')}</p>
          <button
            type="button"
            className="game-button mt-7 w-full bg-primary text-on-primary"
            disabled={busy || !prepared.url || !hub.canPlay}
            onClick={() => void startRound()}
          >
            {prepared.url ? '¡Jugar!' : 'Preparando imagen…'}
          </button>
          {prepared.error && (
            <button
              type="button"
              className="game-button mt-3"
              onClick={() => setImageAttempt((n) => n + 1)}
            >
              Reintentar imagen
            </button>
          )}
          <button
            type="button"
            className="game-button mt-3 w-full"
            onClick={changeParticipant}
          >
            Cambiar participante
          </button>
        </section>
      </main>
    );
  else if (screen === 'countdown' && prepared.url)
    content = (
      <CountdownScreen
        imageUrl={prepared.url}
        onComplete={() => {
          if (current()) flowStore.getState().go('game');
        }}
      />
    );
  else if (screen === 'game' && saveTask)
    content = (
      <main className="mx-auto max-w-xl px-5 py-10">
        <p role="status">Guardando resultado local…</p>
        {error && (
          <button
            type="button"
            className="game-button mt-5"
            disabled={busy}
            onClick={() => void save(saveTask)}
          >
            Reintentar guardado local
          </button>
        )}
      </main>
    );
  else if (screen === 'game' && board && prepared.url)
    content = (
      <GameScreen
        initialState={board}
        imageUrl={prepared.url}
        onFinish={finish}
        onExit={changeParticipant}
        onProgress={hub.progress}
      />
    );
  else if (screen === 'result' && session && prepared.url)
    content = (
      <ResultScreen
        session={session}
        imageUrl={prepared.url}
        onLeaderboard={() => flowStore.getState().go('leaderboard')}
        onFinish={changeParticipant}
        onReplay={() => {
          void startRound();
        }}
      />
    );
  else if (screen === 'leaderboard')
    content = (
      <LeaderboardScreen
        dayKey={session?.dayKey ?? dayKey()}
        gridSize={session?.gridSize ?? brand.game.gridSize}
        onFinish={changeParticipant}
      />
    );
  return (
    <>
      <aside
        className="mx-auto max-w-xl px-5 pt-5 text-sm"
        aria-label="Estado de conexión"
      >
        <p role="status">{status}</p>
        {hub.client.queue.length > 0 && (
          <button
            type="button"
            className="game-button mt-2"
            onClick={() => {
              void hub.retry().catch(() => {});
            }}
          >
            Reintentar envíos a la central
          </button>
        )}
      </aside>
      {error && (
        <p role="alert" className="mx-auto max-w-xl px-5 pt-4 text-danger">
          {error}
        </p>
      )}
      {content}
    </>
  );
}
