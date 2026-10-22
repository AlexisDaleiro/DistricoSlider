import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { sessionsRepo } from '../data/repos/sessionsRepo';
import { markActivity } from '../kiosk/activityTracker';
import { recordAudit, recordError } from '../kiosk/auditError';
import { TRANSITIONS, type Screen } from './transitions';

export type ResetReason =
  'inactivity' | 'finish' | 'cancel' | 'render_error' | 'invalid_transition';
interface FlowState {
  screen: Screen;
  leadUuid: string | null;
  sessionUuid: string | null;
  visit: number;
  go: (to: Screen) => void;
  setParticipation: (leadUuid: string, sessionUuid: string) => void;
  resetToAttract: (reason: ResetReason) => Promise<void>;
}

export function createFlowStore(development = import.meta.env.DEV) {
  return createStore<FlowState>((set, get) => ({
    screen: 'attract',
    leadUuid: null,
    sessionUuid: null,
    visit: 0,
    setParticipation: (leadUuid, sessionUuid) => set({ leadUuid, sessionUuid }),
    go: (to) => {
      const from = get().screen;
      if (!TRANSITIONS[from].includes(to)) {
        if (development)
          throw new Error(`Transición no permitida: ${from} → ${to}`);
        void get().resetToAttract('invalid_transition');
        return;
      }
      if (to === 'attract') {
        void get().resetToAttract('finish');
        return;
      }
      markActivity();
      set({ screen: to });
    },
    resetToAttract: async (reason) => {
      const { sessionUuid, screen, visit } = get();
      // La privacidad no espera una escritura: también se resetea si IDB está colgado.
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      set({
        screen: 'attract',
        leadUuid: null,
        sessionUuid: null,
        visit: visit + 1,
      });
      markActivity();
      if (sessionUuid) {
        try {
          await sessionsRepo.markAbandoned(sessionUuid);
        } catch (error) {
          await recordError('session_abandon_failed', error);
        }
      }
      await recordAudit('flow_reset', `${reason}:${screen}`);
    },
  }));
}

export const flowStore = createFlowStore();
export function useFlowStore<T>(selector: (state: FlowState) => T): T {
  return useStore(flowStore, selector);
}
