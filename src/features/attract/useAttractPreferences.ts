import { useEffect, useState } from 'react';

export function useAttractPreferences() {
  const [visible, setVisible] = useState(
    () => document.visibilityState !== 'hidden',
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState !== 'hidden');
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    document.addEventListener('visibilitychange', visibility);
    preference?.addEventListener('change', changed);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      preference?.removeEventListener('change', changed);
    };
  }, []);
  return { visible, reducedMotion };
}
