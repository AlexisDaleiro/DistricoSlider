import { normalizePhone } from '../../shared/lib/normalize';
import {
  sdk,
  type HubClient,
  type HubConfig,
  type HubEvent,
  type Participant,
} from './sdk';

export function missingConfiguration(config: HubConfig): string[] {
  const missing = (
    [
      'endpoint',
      'gameKey',
      'brandId',
      'brandName',
      'gameId',
      'gameName',
    ] as const
  ).filter((key) => !config[key].trim()) as string[];
  if (
    config.endpoint &&
    !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      config.endpoint,
    )
  )
    missing.push('endpoint válido /exec');
  for (const key of ['brandId', 'gameId'] as const) {
    if (config[key] && !/^[a-z0-9][a-z0-9-]{1,79}$/.test(config[key]))
      missing.push(`${key} válido`);
  }
  if (
    config.gameKey &&
    (config.gameKey.length < 8 || config.gameKey.length > 100)
  )
    missing.push('gameKey válida');
  for (const key of ['brandName', 'gameName'] as const) {
    if (config[key] && (config[key].length < 2 || config[key].length > 80))
      missing.push(`${key} válido`);
  }
  return missing;
}

interface Participation {
  participant: Participant;
  sessionId: string;
  registration: HubEvent;
  confirmed: boolean;
}
interface Round {
  runId: string;
  durationMs: number;
  moves: number;
  gridSize: number;
  image: string;
  terminal: HubEvent | null;
}

/** Los reintentos pertenecen al SDK. Este objeto conserva la identidad de cada envío. */
export class HubParticipation {
  private participation: Participation | null = null;
  private round: Round | null = null;
  private listeners = new Set<() => void>();
  private snapshot = '';
  private pendingKey = '';
  private tracked = new Set<string>();
  readonly preview: boolean;
  readonly missing: string[];
  constructor(
    readonly config: HubConfig,
    readonly client: HubClient = new sdk.Client(config),
  ) {
    this.preview = client.preview;
    this.missing = missingConfiguration(config);
    this.refresh();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getSyncSnapshot = () => `${this.snapshot}\n${this.pendingKey}`;
  get hasRejected() {
    return [...this.tracked].some(
      (id) => this.client.receipts.get(id)?.ok === false,
    );
  }
  refresh = () => {
    const rejected = this.hasRejected;
    const pendingKey = this.client.queue[0]?.event.eventId ?? '';
    const next = this.preview
      ? 'Modo de prueba: los datos no se envían ni se guardan en la central.'
      : this.missing.length
        ? `Conexión pendiente. Faltan: ${this.missing.join(', ')}.`
        : this.client.queue.length
          ? `Guardado pendiente en la central (${this.client.queue.length} envíos). Conservá esta pestaña abierta y reintentá con conexión.`
          : rejected
            ? 'La central rechazó un envío. Revisá la configuración con el administrador.'
            : this.tracked.size
              ? 'Envíos confirmados por la central.'
              : 'El registro requiere conexión con la central.';
    if (next !== this.snapshot || pendingKey !== this.pendingKey) {
      this.snapshot = next;
      this.pendingKey = pendingKey;
      this.listeners.forEach((listener) => listener());
    }
  };
  get identityLocked() {
    return this.participation !== null;
  }
  get canPlay() {
    return (
      !!this.participation && (this.participation.confirmed || this.preview)
    );
  }
  get sessionId() {
    return this.participation?.sessionId;
  }
  private send(event: HubEvent) {
    this.tracked.add(event.eventId);
    if (this.tracked.size > 100)
      this.tracked.delete(this.tracked.values().next().value!);
    const pending = this.client.send(event);
    this.refresh();
    return pending.finally(this.refresh);
  }
  async register(name: string, value: string) {
    if (!this.preview && this.missing.length)
      throw new Error(this.getSnapshot());
    const participant = {
      name: sdk.normalizeName(name),
      phone: normalizePhone(
        sdk.normalizePhone(value, this.config.defaultCallingCode ?? '598'),
      ),
    };
    if (!participant.phone)
      throw new Error(
        'Ingresá un celular válido, con + y código de país si no es de Uruguay.',
      );
    if (!this.participation) {
      const details = {
        participant: participant as Participant,
        sessionId: sdk.uuid(),
        metrics: {},
      };
      this.participation = {
        ...details,
        registration: this.client.event('registration', details),
        confirmed: false,
      };
    }
    const current = this.participation;
    if (
      current.participant.name !== participant.name ||
      current.participant.phone !== participant.phone
    )
      throw new Error(
        'Reintentá con los mismos datos o cambiá de participante.',
      );
    const receipt = await this.send(current.registration);
    if (current !== this.participation)
      throw new Error('La participación fue cancelada.');
    if (this.preview) return current.participant;
    if (!receipt.ok)
      throw new Error(
        receipt.error?.message ||
          'El registro todavía no está confirmado. Reintentá con conexión.',
      );
    current.confirmed = true;
    return current.participant;
  }
  startRound(runId: string, gridSize: number, image: string) {
    if (!this.canPlay || !this.participation)
      throw new Error('Registrate antes de jugar.');
    if (this.round && !this.round.terminal)
      throw new Error('Ya hay una ronda en curso.');
    this.round = {
      runId,
      durationMs: 0,
      moves: 0,
      gridSize,
      image,
      terminal: null,
    };
    this.enqueue('game_started', {
      score: 0,
      durationSeconds: 0,
      gridSize,
      image,
    });
  }
  progress = (score: { durationMs: number; moves: number }) => {
    if (this.round && !this.round.terminal) Object.assign(this.round, score);
  };
  finish(
    status: 'completed' | 'timeout' | 'abandoned',
    score: { durationMs: number; moves: number },
    reason: string = status,
  ) {
    if (!this.round || this.round.terminal) return;
    this.progress(score);
    // El puzzle se clasifica por tiempo y movimientos (menor es mejor); no inventar un puntaje.
    this.round.terminal = this.enqueue(
      status === 'abandoned' ? 'game_abandoned' : 'game_completed',
      {
        score: score.moves,
        moves: score.moves,
        durationSeconds: score.durationMs / 1000,
        finishReason: reason,
        solved: status === 'completed',
        gridSize: this.round.gridSize,
        image: this.round.image,
      },
    );
  }
  private enqueue(
    type: 'game_started' | 'game_completed' | 'game_abandoned',
    metrics: HubEvent['metrics'],
  ) {
    if (!this.participation || !this.round) throw new Error('No hay ronda.');
    const event = this.client.event(type, {
      participant: this.participation.participant,
      sessionId: this.participation.sessionId,
      runId: this.round.runId,
      metrics,
    });
    void this.send(event).catch(() => {
      /* El SDK conserva el envío original. */
    });
    return event;
  }
  clear = (reason = 'participant_change') => {
    if (this.round && !this.round.terminal)
      this.finish('abandoned', this.round, reason);
    this.participation = null;
    this.round = null;
  };
  async retry() {
    try {
      await this.client.flush();
    } finally {
      this.refresh();
    }
  }
}
