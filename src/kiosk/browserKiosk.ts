import { recordError } from './auditError';

/** Únicamente protecciones web; los listeners nativos se agregan en Fase 7. */
export function startBrowserKiosk() {
  const block = (event: Event) => event.preventDefault();
  const touch = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey) event.preventDefault();
  };
  const error = (event: ErrorEvent) => {
    void recordError('window_error', event.error ?? event.message);
  };
  const rejection = (event: PromiseRejectionEvent) => {
    void recordError('unhandled_rejection', event.reason);
  };
  window.addEventListener('contextmenu', block);
  window.addEventListener('dragstart', block);
  window.addEventListener('gesturestart', block, { passive: false });
  window.addEventListener('touchmove', touch, { passive: false });
  window.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('error', error);
  window.addEventListener('unhandledrejection', rejection);
  return () => {
    window.removeEventListener('contextmenu', block);
    window.removeEventListener('dragstart', block);
    window.removeEventListener('gesturestart', block);
    window.removeEventListener('touchmove', touch);
    window.removeEventListener('wheel', wheel);
    window.removeEventListener('error', error);
    window.removeEventListener('unhandledrejection', rejection);
  };
}
