import { useCallback, useEffect, useRef } from 'react';
import { asset } from '../../brand/brand';
import { useBrand } from '../../brand/BrandProvider';

export function useGameSounds() {
  const {
    game: { sounds },
  } = useBrand();
  const players = useRef(new Map<'move' | 'win', HTMLAudioElement>());
  useEffect(() => {
    const owned = players.current;
    return () => {
      owned.forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
      owned.clear();
    };
  }, []);
  return useCallback(
    (kind: 'move' | 'win') => {
      const path = sounds[kind];
      if (!sounds.enabled || !path) return;
      try {
        let audio = players.current.get(kind);
        if (!audio) {
          audio = new Audio(asset(path));
          audio.preload = 'none';
          players.current.set(kind, audio);
        }
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } catch {
        /* Sin audio disponible se conserva el juego. */
      }
    },
    [sounds],
  );
}
