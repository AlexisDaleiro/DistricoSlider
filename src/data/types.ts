export interface Lead {
  id?: number;
  uuid: string;
  eventId: string;
  brandId: string;
  createdAt: number;
  dayKey: string;
  name: string;
  email: string;
  emailNormalized: string;
  company?: string;
  phone?: string;
  extra?: Record<string, string>;
  consent: boolean;
  consentVersion: string;
  marketingOptIn: boolean;
  exportedAt?: number;
}
export type SessionStatus = 'started' | 'completed' | 'abandoned' | 'timeout';
export interface GameSession {
  id?: number;
  uuid: string;
  leadUuid: string;
  eventId: string;
  dayKey: string;
  gridSize: 3 | 4;
  imageSrc: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  moves?: number;
  status: SessionStatus;
}
export interface Setting {
  key: string;
  value: unknown;
}
export interface AuditEntry {
  id?: number;
  at: number;
  action: string;
  detail?: string;
}
export interface NewLeadInput {
  eventId: string;
  brandId: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  extra?: Record<string, string>;
  consent: boolean;
  consentVersion: string;
  marketingOptIn: boolean;
}
