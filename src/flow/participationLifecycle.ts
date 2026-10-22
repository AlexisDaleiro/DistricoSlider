const listeners = new Set<(reason: string) => void>();
export function onParticipationReset(listener: (reason: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function resetParticipation(reason: string) {
  listeners.forEach((listener) => listener(reason));
}
