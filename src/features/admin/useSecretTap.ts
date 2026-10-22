import { useCallback, useRef } from 'react';
export function useSecretTap(
  count: number,
  windowMs: number,
  onUnlock: () => void,
) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < windowMs), now];
    if (taps.current.length >= count) {
      taps.current = [];
      onUnlock();
    }
  }, [count, windowMs, onUnlock]);
}
