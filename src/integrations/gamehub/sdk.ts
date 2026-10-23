import './vendor/shared-sdk.js';

export interface HubConfig {
  endpoint: string;
  gameKey: string;
  brandId: string;
  brandName: string;
  gameId: string;
  gameName: string;
  gameVersion: string;
  defaultCallingCode?: string;
  syncFeedbackDelayMs?: number;
  allowPreview: boolean;
}
export interface Participant {
  name: string;
  phone: string;
}
export type EventType =
  'registration' | 'game_started' | 'game_completed' | 'game_abandoned';
export interface HubEvent {
  schemaVersion: 1;
  eventId: string;
  type: EventType;
  occurredAt: string;
  brandId: string;
  brandName: string;
  gameId: string;
  gameName: string;
  gameVersion: string;
  gameKey: string;
  participant: Participant;
  sessionId: string;
  runId?: string;
  metrics: Record<string, string | number | boolean>;
}
export interface Receipt {
  ok: boolean;
  eventId: string;
  preview?: boolean;
  pending?: boolean;
  error?: { code: string; message: string; retryable: boolean };
}
export interface HubClient {
  preview: boolean;
  configured: boolean;
  queue: { queuedAt: number; event: HubEvent }[];
  receipts: Map<string, Receipt>;
  event(
    type: EventType,
    details: Pick<HubEvent, 'participant' | 'sessionId' | 'metrics'> & {
      runId?: string;
    },
  ): HubEvent;
  send(event: HubEvent): Promise<Receipt>;
  flush(): Promise<void>;
}
interface GameHubSDK {
  Client: new (
    config: HubConfig,
    options?: {
      transport?: (event: HubEvent) => Promise<Receipt>;
      storage?: Storage | null;
    },
  ) => HubClient;
  uuid(): string;
  normalizeName(value: string): string;
  normalizePhone(value: string, callingCode?: string): string;
}
export const sdk = (
  (typeof window !== 'undefined' ? window : globalThis) as unknown as {
    GameHub: GameHubSDK;
  }
).GameHub;
