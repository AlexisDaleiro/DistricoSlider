export function formatDuration(durationMs: number): string {
  const tenths = Math.floor(Math.max(0, durationMs) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

/** Día local del dispositivo; nunca convertir a UTC con toISOString(). */
export function dayKey(at = Date.now()): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
