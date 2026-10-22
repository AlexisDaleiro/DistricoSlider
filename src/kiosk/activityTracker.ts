const EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
] as const;
let lastActivity = 0;
let users = 0;
let checkNow = () => {};

export const getIdleMs = () => Math.max(0, performance.now() - lastActivity);
export const markActivity = () => {
  lastActivity = performance.now();
};
export const checkActivityNow = () => checkNow();

export function setCheckNow(fn: () => void) {
  checkNow = fn;
  return () => {
    if (checkNow === fn) checkNow = () => {};
  };
}
const onVisibility = () => {
  if (document.visibilityState === 'visible') checkActivityNow();
};

/** Un único conjunto global de listeners, incluso con StrictMode. */
export function startActivityTracking() {
  if (users++ === 0) {
    markActivity();
    EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, {
        capture: true,
        passive: true,
      }),
    );
    document.addEventListener('visibilitychange', onVisibility);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users === 0) {
      EVENTS.forEach((event) =>
        window.removeEventListener(event, markActivity, true),
      );
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
