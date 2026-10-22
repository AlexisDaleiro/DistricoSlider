import type { BrandConfig } from '../brand/schema';

export function qaRequested(development: boolean, search: string) {
  return development && new URLSearchParams(search).get('qa') === '1';
}
export const QA_ENABLED =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  qaRequested(true, window.location.search);

/** El JSON original sigue validándose: estos plazos solo existen en dev ?qa=1. */
export function qaBrand(config: BrandConfig): BrandConfig {
  const scale = (ms: number) => ms * 0.1;
  return {
    ...config,
    game: {
      ...config.game,
      countdownSec: scale(config.game.countdownSec),
      maxDurationSec: scale(config.game.maxDurationSec),
      tileAnimationMs: scale(config.game.tileAnimationMs),
      victoryAnimationMs: scale(config.game.victoryAnimationMs),
      invalidMoveAnimationMs: scale(config.game.invalidMoveAnimationMs),
    },
    kiosk: {
      ...config.kiosk,
      inactivityMs: Object.fromEntries(
        Object.entries(config.kiosk.inactivityMs).map(([key, value]) => [
          key,
          scale(value),
        ]),
      ) as BrandConfig['kiosk']['inactivityMs'],
      warningMs: scale(config.kiosk.warningMs),
      errorRecoveryMs: scale(config.kiosk.errorRecoveryMs),
      admin: {
        ...config.kiosk.admin,
        pinTimeoutMs: scale(config.kiosk.admin.pinTimeoutMs),
      },
    },
  };
}
