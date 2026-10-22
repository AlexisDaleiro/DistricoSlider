import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  maxDurationSec: number;
  onTimeout: (durationMs: number) => void;
}

export function useGameTimer({ maxDurationSec, onTimeout }: Options) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startAt = useRef<number | null>(null);
  const running = useRef(false);
  const stoppedAt = useRef(0);

  const getElapsedMs = useCallback(
    () =>
      running.current && startAt.current !== null
        ? performance.now() - startAt.current
        : stoppedAt.current,
    [],
  );

  const start = useCallback(() => {
    if (startAt.current !== null) return;
    startAt.current = performance.now();
    running.current = true;
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    const duration = Math.round(getElapsedMs());
    running.current = false;
    stoppedAt.current = duration;
    setElapsedMs(duration);
    setIsRunning(false);
    return duration;
  }, [getElapsedMs]);

  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;
    let lastPaint = -Infinity;
    const tick = (now: number) => {
      if (!running.current) return;
      const elapsed = getElapsedMs();
      if (elapsed > maxDurationSec * 1000) {
        const duration = stop();
        onTimeout(duration);
        return;
      }
      // Frecuencia técnica de render (~10 Hz), sin pausar el reloj monotónico.
      if (now - lastPaint >= 100) {
        lastPaint = now;
        setElapsedMs(elapsed);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, maxDurationSec, onTimeout, getElapsedMs, stop]);

  return { elapsedMs, isRunning, start, stop, getElapsedMs };
}
