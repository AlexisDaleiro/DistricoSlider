import { useEffect, useState, useSyncExternalStore } from 'react';
import type { HubParticipation } from './HubParticipation';

/** Fast sends leave no banner; slow sends retain the SDK's original retry. */
export function HubSyncNotice({ hub }: { hub: HubParticipation }) {
  useSyncExternalStore(hub.subscribe, hub.getSyncSnapshot);
  const pending = hub.client.queue[0];
  const eventId = pending?.event.eventId;
  const queuedAt = pending?.queuedAt;
  const delay = hub.config.syncFeedbackDelayMs ?? 10000;
  const [revealedEvent, setRevealedEvent] = useState<string | null>(null);
  useEffect(() => {
    if (!eventId || queuedAt === undefined) return;
    const timer = window.setTimeout(
      () => setRevealedEvent(eventId),
      Math.max(0, queuedAt + delay - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [eventId, queuedAt, delay]);
  const slow = Boolean(eventId && revealedEvent === eventId);
  const important = hub.preview || hub.missing.length > 0 || hub.hasRejected;
  if (!slow && !important) return null;
  return (
    <aside
      className="mx-auto max-w-xl px-5 pt-5 text-sm"
      aria-label="Estado de conexión"
    >
      <p role={hub.hasRejected ? 'alert' : 'status'}>{hub.getSnapshot()}</p>
      {slow && (
        <button
          type="button"
          className="game-button mt-2"
          onClick={() => {
            void hub.retry().catch(() => {});
          }}
        >
          Reintentar envíos a la central
        </button>
      )}
    </aside>
  );
}
