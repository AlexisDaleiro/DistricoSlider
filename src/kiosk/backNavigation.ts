import { flowStore } from '../flow/flowStore';

let adminBack: (() => void) | null = null;
export function registerAdminBack(callback: () => void) {
  adminBack = callback;
  return () => {
    if (adminBack === callback) adminBack = null;
  };
}

/** Atrás nunca sale al launcher ni navega el historial del visitante. */
export function handleNativeBack() {
  if (flowStore.getState().screen !== 'admin') return;
  if (adminBack) adminBack();
  else void flowStore.getState().resetToAttract('finish');
}
