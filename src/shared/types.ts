export type TrainingSchool = 'pirate' | 'mystery' | 'ninja';

export type ReminderKind =
  | 'training'
  | 'hospital'
  | 'grave-danger'
  | 'healing-springs'
  | 'coltzan'
  | 'expellibox';

/** Alarm/completion lifecycle */
export type ReminderStatus = 'scheduled' | 'ready';

/**
 * Best-effort UI activity status. Not every value implies a timer.
 */
export type ActivityUiStatus =
  | 'active'
  | 'ready'
  | 'available'
  | 'cooldown'
  | 'unsupported'
  | 'unknown';

/** How dueAt should be interpreted in the popup */
export type TimerQuality = 'snapshot' | 'estimate' | 'none';

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  subject: string;
  /** Training school only */
  school?: TrainingSchool;
  /** Human label for activity/context (shift title, etc.) */
  contextLabel?: string;
  observedAt: number;
  dueAt: number;
  status: ReminderStatus;
  activityStatus: ActivityUiStatus;
  timerQuality: TimerQuality;
  /** Short redacted note for UI (e.g. estimate policy) */
  sourceNote?: string;
  parserVersion: 1;
  generation: number;
  notifiedGeneration?: number;
  lastNotificationAt?: number;
}

export interface Settings {
  /** Master switch for all best-effort activity reminders/alarms */
  trainingEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface StoredStateV1 {
  schemaVersion: 1;
  reminders: Record<string, ReminderRecord>;
  settings: Settings;
}

export interface TrainingObservation {
  kind: 'training';
  petName: string;
  school: TrainingSchool;
  observedAt: number;
  dueAt: number;
  state: 'training' | 'ready';
  parserVersion: 1;
}

/** Generic observation produced by any best-effort page parser */
export interface ActivityObservation {
  kind: ReminderKind;
  subject: string;
  school?: TrainingSchool;
  contextLabel?: string;
  observedAt: number;
  dueAt: number;
  status: ReminderStatus;
  activityStatus: ActivityUiStatus;
  timerQuality: TimerQuality;
  sourceNote?: string;
  parserVersion: 1;
  /** Stable id fragment after kind prefix, built by parser helpers */
  idKey: string;
}

export const SCHEMA_VERSION = 1 as const;
export const PARSER_VERSION = 1 as const;

export const DEFAULT_SETTINGS: Settings = {
  trainingEnabled: true,
  notificationsEnabled: true,
};

export function createDefaultState(): StoredStateV1 {
  return {
    schemaVersion: SCHEMA_VERSION,
    reminders: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const TRAINING_SCHOOLS: readonly TrainingSchool[] = [
  'pirate',
  'mystery',
  'ninja',
] as const;

export const SCHOOL_LABELS: Record<TrainingSchool, string> = {
  pirate: 'Swashbuckling Academy',
  mystery: 'Mystery Island Training School',
  ninja: 'Secret Ninja Training School',
};

export const KIND_LABELS: Record<ReminderKind, string> = {
  training: 'Training',
  hospital: 'Hospital Volunteer',
  'grave-danger': 'Grave Danger',
  'healing-springs': 'Healing Springs',
  coltzan: "Coltzan's Shrine",
  expellibox: 'Qasalan Expellibox',
};

/** Conservative max future duration for validation (30 days). */
export const MAX_FUTURE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Same-generation deadline drift tolerance. */
export const GENERATION_DUE_TOLERANCE_MS = 60_000;

export const ALARM_PREFIX = 'neo-reminder:';
export const NOTIFICATION_PREFIX = 'neo-notify:';
export const TEST_NOTIFICATION_ID = 'neo-notify:test';

export const MAX_OBSERVATIONS_PER_MESSAGE = 20;
export const MAX_PET_NAME_LENGTH = 64;

export const HEALING_SPRINGS_COOLDOWN_MS = 30 * 60 * 1000;
