import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import {
  createSolved,
  isSolved,
  moveByDirection,
  slideLineTo,
} from './engine/board';
import { QA_ENABLED } from '../../qa/config';
import { useGameSounds } from './useGameSounds';
import type { Direction, PuzzleState } from './engine/types';
import { HUD } from './ui/HUD';
import { PuzzleBoard } from './ui/PuzzleBoard';
import { PreviewButton } from './ui/PreviewButton';
import { useGameTimer } from './useGameTimer';

export interface GameOutcome {
  status: 'completed' | 'timeout';
  durationMs: number;
  moves: number;
}
type Phase = 'playing' | 'settling' | 'revealing' | 'completed' | 'timeout';
interface Props {
  initialState: PuzzleState;
  imageUrl: string;
  onExit: () => void;
  onFinish?: (outcome: GameOutcome) => void;
  onProgress?: (score: { durationMs: number; moves: number }) => void;
}

export function GameScreen({
  initialState,
  imageUrl,
  onExit,
  onFinish,
  onProgress,
}: Props) {
  const { game } = useBrand();
  const playSound = useGameSounds();
  const boardId = useId();
  const [state, setState] = useState(initialState);
  const [moves, setMoves] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  const [preview, setPreview] = useState(false);
  const [invalidRevision, setInvalidRevision] = useState(0);
  const current = useRef({
    state: initialState,
    moves: 0,
    phase: 'playing' as Phase,
  });
  const outcome = useRef<GameOutcome | null>(null);

  const timeout = useCallback(
    (durationMs: number) => {
      if (current.current.phase !== 'playing') return;
      current.current.phase = 'timeout';
      const result: GameOutcome = {
        status: 'timeout',
        durationMs,
        moves: current.current.moves,
      };
      outcome.current = result;
      setPhase('timeout');
      setPreview(false);
      onFinish?.(result);
    },
    [onFinish],
  );
  const timer = useGameTimer({
    maxDurationSec: game.maxDurationSec,
    onTimeout: timeout,
  });
  const { start, stop, getElapsedMs } = timer;
  useEffect(() => {
    onProgress?.({ durationMs: Math.round(getElapsedMs()), moves });
  }, [timer.elapsedMs, moves, getElapsedMs, onProgress]);

  useEffect(() => {
    if (phase !== 'settling') return;
    const id = window.setTimeout(() => {
      current.current.phase = 'revealing';
      setPhase('revealing');
    }, game.tileAnimationMs);
    return () => window.clearTimeout(id);
  }, [phase, game.tileAnimationMs]);
  useEffect(() => {
    if (phase !== 'revealing') return;
    const id = window.setTimeout(() => {
      current.current.phase = 'completed';
      setPhase('completed');
      if (outcome.current) onFinish?.(outcome.current);
    }, game.victoryAnimationMs);
    return () => window.clearTimeout(id);
  }, [phase, game.victoryAnimationMs, onFinish]);

  const applyMove = useCallback(
    (next: { state: PuzzleState; moved: number } | null) => {
      if (current.current.phase !== 'playing' || preview) return;
      // También comprobar al interactuar: rAF puede estar suspendido en background.
      if (getElapsedMs() > game.maxDurationSec * 1000) {
        timeout(stop());
        return;
      }
      if (!next) {
        setInvalidRevision((revision) => revision + 1);
        return;
      }
      start();
      const nextMoves = current.current.moves + next.moved;
      current.current.state = next.state;
      current.current.moves = nextMoves;
      setState(next.state);
      setMoves(nextMoves);
      if (isSolved(next.state)) {
        playSound('win');
        outcome.current = {
          status: 'completed',
          durationMs: stop(),
          moves: nextMoves,
        };
        current.current.phase = 'settling';
        setPhase('settling');
        setPreview(false);
      } else playSound('move');
    },
    [
      preview,
      game.maxDurationSec,
      getElapsedMs,
      timeout,
      stop,
      start,
      playSound,
    ],
  );
  const tap = useCallback(
    (position: number) =>
      applyMove(slideLineTo(current.current.state, position)),
    [applyMove],
  );
  const swipe = useCallback(
    (direction: Direction) => {
      const next = moveByDirection(current.current.state, direction);
      applyMove(next ? { state: next, moved: 1 } : null);
    },
    [applyMove],
  );
  const finished = phase === 'completed' || phase === 'timeout';
  return (
    <main className="game-layout">
      <PuzzleBoard
        id={boardId}
        state={state}
        imageUrl={imageUrl}
        onTapPosition={tap}
        onSwipe={swipe}
        durationMs={game.tileAnimationMs}
        showNumber={game.showTileNumbers}
        disabled={phase !== 'playing' || preview}
        invalidMoveRevision={invalidRevision}
        animateReveal={phase === 'revealing' || phase === 'completed'}
        fullImageVisible={
          preview || phase === 'revealing' || phase === 'completed'
        }
      />
      <section className="game-sidebar">
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="game-eyebrow">{t('game.eyebrow')}</p>
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-on-secondary">
            {t('game.grid', { size: state.size })}
          </span>
        </div>
        <h1 className="game-heading" role={finished ? 'status' : undefined}>
          {phase === 'completed'
            ? t('result.title')
            : phase === 'timeout'
              ? t('game.timeoutTitle')
              : phase === 'playing'
                ? t('game.title')
                : t('game.settling')}
        </h1>
        <div className="my-7">
          <HUD elapsedMs={timer.elapsedMs} moves={moves} />
        </div>
        <p className="leading-relaxed text-muted">
          {phase === 'completed'
            ? t('game.completedBody')
            : phase === 'timeout'
              ? t('game.timeoutBody')
              : t('game.instructions')}
        </p>
        {!finished && moves === 0 && (
          <p className="mt-4 text-sm font-medium text-primary">
            {t('game.firstMove')}
          </p>
        )}
        {game.showPreviewButton && !finished && (
          <div className="mt-7">
            <PreviewButton
              controls={boardId}
              pressed={preview}
              disabled={phase !== 'playing'}
              onPressedChange={setPreview}
            />
            <p className="mt-3 text-center text-xs text-muted">
              {t('game.previewHint')}
            </p>
          </div>
        )}
        <button
          type="button"
          className={`game-button mt-7 w-full ${finished ? 'bg-primary text-on-primary' : 'text-muted'}`}
          onClick={onExit}
          disabled={phase === 'settling' || phase === 'revealing'}
        >
          {finished ? t('game.playAgain') : t('common.finish')}
        </button>
        {QA_ENABLED && (
          <button
            data-qa-solve
            type="button"
            className="game-button mt-3 w-full bg-secondary text-on-secondary"
            disabled={phase !== 'playing' || preview}
            onClick={() => {
              if (QA_ENABLED)
                applyMove({ state: createSolved(state.size), moved: 1 });
            }}
          >
            {t('qa.solve')}
          </button>
        )}
      </section>
    </main>
  );
}
