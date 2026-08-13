import type { ObservationScope } from './scope-reconcile.js';
import type {
  ActivityObservation,
  ReminderRecord,
  Settings,
  TrainingObservation,
} from './types.js';

export type ContentMessage =
  | {
      type: 'TRAINING_OBSERVED';
      observations: TrainingObservation[];
    }
  | {
      type: 'ACTIVITY_OBSERVED';
      observations: ActivityObservation[];
      /** When true, remove same-scope reminders not in this observation set (may be empty). */
      replaceScope: boolean;
      scope: ObservationScope;
    };

export type PopupRequest =
  | { type: 'GET_STATE' }
  | { type: 'REMOVE_REMINDER'; id: string }
  | { type: 'OPEN_REMINDER'; id: string }
  | { type: 'OPEN_URL'; url: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'TEST_NOTIFICATION' };

export type PopupResponse =
  | {
      type: 'STATE';
      reminders: ReminderRecord[];
      settings: Settings;
      now: number;
      support: SupportMatrix;
      error?: string;
    }
  | { type: 'OK' }
  | { type: 'ERROR'; message: string };

export type SupportMatrix = {
  training: {
    mystery: string;
    pirate: string;
    ninja: string;
  };
  hospital: string;
  graveDanger: string;
  healingSprings: string;
  coltzan: string;
  expellibox: string;
};

export const SUPPORT_MATRIX: SupportMatrix = {
  training: {
    mystery: 'best-effort active + Course Finished ready + idle skip',
    pirate: 'best-effort active + Course Finished ready',
    ninja: 'unsupported (no fixtures)',
  },
  hospital: 'best-effort active/ready snapshots (focused tab)',
  graveDanger:
    'best-effort active + end/selection clear; no-petpet unsupported',
  healingSprings:
    'best-effort available/success/cooldown; 30m local estimate only',
  coltzan: 'best-effort; min(+13h, next ~12:26 NST) estimate',
  expellibox: 'best-effort; cooldown DOM or leave-after-visit +7h7m',
};

export function isPopupRequest(msg: unknown): msg is PopupRequest {
  if (!msg || typeof msg !== 'object') return false;
  const t = (msg as { type?: unknown }).type;
  return (
    t === 'GET_STATE' ||
    t === 'REMOVE_REMINDER' ||
    t === 'OPEN_REMINDER' ||
    t === 'OPEN_URL' ||
    t === 'UPDATE_SETTINGS' ||
    t === 'TEST_NOTIFICATION'
  );
}

export function isContentMessage(msg: unknown): msg is ContentMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    ((msg as { type?: unknown }).type === 'TRAINING_OBSERVED' ||
      (msg as { type?: unknown }).type === 'ACTIVITY_OBSERVED')
  );
}
