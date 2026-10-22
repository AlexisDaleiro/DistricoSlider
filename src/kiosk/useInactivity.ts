import { useEffect, useMemo, useRef, useState } from 'react';
import { getIdleMs, markActivity, setCheckNow } from './activityTracker';

interface Options {
  timeoutMs: number;
  warningMs: number;
  enabled: boolean;
  onTimeout: () => void;
  activityKey?: string | number;
}

export function useInactivity({
  timeoutMs,
  warningMs,
  enabled,
  onTimeout,
  activityKey,
}: Options) {
  const scope = useMemo(
    () => ({ enabled, timeoutMs, warningMs, activityKey }),
    [enabled, timeoutMs, warningMs, activityKey],
  );
  const [warning, setWarning] = useState<{
    scope: typeof scope;
    secondsLeft: number | null;
  } | null>(null);
  const callback = useRef(onTimeout);
  useEffect(() => {
    callback.current = onTimeout;
  }, [onTimeout]);
  useEffect(() => {
    if (!enabled) return;
    markActivity();
    let fired = false;
    const tick = () => {
      if (fired) return;
      const idle = getIdleMs();
      if (idle >= timeoutMs) {
        fired = true;
        setWarning({ scope, secondsLeft: null });
        callback.current();
      } else {
        const secondsLeft =
          idle >= timeoutMs - warningMs
            ? Math.ceil((timeoutMs - idle) / 1000)
            : null;
        setWarning((previous) =>
          previous?.scope === scope && previous.secondsLeft === secondsLeft
            ? previous
            : { scope, secondsLeft },
        );
      }
    };
    const clearCheck = setCheckNow(tick);
    const id = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(id);
      clearCheck();
    };
  }, [enabled, timeoutMs, warningMs, scope]);
  return {
    secondsLeft:
      enabled && warning?.scope === scope ? warning.secondsLeft : null,
    keepAlive: () => {
      markActivity();
      setWarning({ scope, secondsLeft: null });
    },
  };
}
