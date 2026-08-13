import {
  MAX_FUTURE_DURATION_MS,
  MAX_OBSERVATIONS_PER_MESSAGE,
  MAX_PET_NAME_LENGTH,
  PARSER_VERSION,
  SCHEMA_VERSION,
  TRAINING_SCHOOLS,
  type ActivityObservation,
  type ActivityUiStatus,
  type ReminderKind,
  type ReminderRecord,
  type Settings,
  type StoredStateV1,
  type TimerQuality,
  type TrainingObservation,
  type TrainingSchool,
} from './types.js';
import type { ObservationScope } from './scope-reconcile.js';
import { classifyPageUrl, classifyTrainingUrl } from './url-allowlist.js';

export class SchemaVersionError extends Error {
  constructor(public readonly foundVersion: number) {
    super(
      `Unsupported storage schema version ${foundVersion} (supported: ${SCHEMA_VERSION}). Refusing to overwrite.`,
    );
    this.name = 'SchemaVersionError';
  }
}

const KINDS: readonly ReminderKind[] = [
  'training',
  'hospital',
  'grave-danger',
  'healing-springs',
  'coltzan',
  'expellibox',
];

const UI_STATUSES: readonly ActivityUiStatus[] = [
  'active',
  'ready',
  'available',
  'cooldown',
  'unsupported',
  'unknown',
];

const TIMER_QUALITIES: readonly TimerQuality[] = [
  'snapshot',
  'estimate',
  'none',
];

export function isTrainingSchool(value: unknown): value is TrainingSchool {
  return (
    typeof value === 'string' &&
    (TRAINING_SCHOOLS as readonly string[]).includes(value)
  );
}

export function isReminderKind(value: unknown): value is ReminderKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

export function isFiniteSafeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value);
}

export function normalizePetName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_PET_NAME_LENGTH) return null;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return null;
  }
  return trimmed;
}

export function buildTrainingReminderId(
  school: TrainingSchool,
  displayName: string,
): string | null {
  const trimmed = normalizePetName(displayName);
  if (!trimmed) return null;
  const normalized = trimmed.normalize('NFKC').toLocaleLowerCase('en-US');
  if (!normalized) return null;
  return `training:${school}:${encodeURIComponent(normalized)}`;
}

export function validateTrainingObservation(
  value: unknown,
  now: number,
  expectedSchool?: TrainingSchool,
): TrainingObservation | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;

  if (o.kind !== 'training') return null;
  if (!isTrainingSchool(o.school)) return null;
  if (expectedSchool !== undefined && o.school !== expectedSchool) return null;
  if (o.parserVersion !== PARSER_VERSION) return null;
  if (o.state !== 'training' && o.state !== 'ready') return null;

  const petName = normalizePetName(String(o.petName ?? ''));
  if (!petName) return null;

  if (!isFiniteSafeNumber(o.observedAt) || !isFiniteSafeNumber(o.dueAt)) return null;
  if (o.observedAt < 0 || o.dueAt < 0) return null;
  if (o.observedAt > now + 60_000) return null;
  if (o.dueAt > now + MAX_FUTURE_DURATION_MS) return null;
  if (o.state === 'ready' && o.dueAt > o.observedAt + 60_000) return null;
  if (o.state === 'training' && o.dueAt < o.observedAt - 60_000) return null;

  return {
    kind: 'training',
    petName,
    school: o.school,
    observedAt: o.observedAt,
    dueAt: o.dueAt,
    state: o.state,
    parserVersion: PARSER_VERSION,
  };
}

export function validateActivityObservation(
  value: unknown,
  now: number,
  expectedKind?: ReminderKind,
): ActivityObservation | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  if (!isReminderKind(o.kind)) return null;
  if (expectedKind && o.kind !== expectedKind) return null;
  if (o.parserVersion !== PARSER_VERSION) return null;
  if (typeof o.idKey !== 'string' || !o.idKey || o.idKey.length > 200) return null;
  if (typeof o.subject !== 'string' || !normalizePetName(o.subject)) {
    // subject can be activity name
    if (typeof o.subject !== 'string' || !o.subject.trim()) return null;
    if (o.subject.trim().length > MAX_PET_NAME_LENGTH) return null;
  }
  if (o.status !== 'scheduled' && o.status !== 'ready') return null;
  if (
    typeof o.activityStatus !== 'string' ||
    !(UI_STATUSES as readonly string[]).includes(o.activityStatus)
  ) {
    return null;
  }
  if (
    typeof o.timerQuality !== 'string' ||
    !(TIMER_QUALITIES as readonly string[]).includes(o.timerQuality)
  ) {
    return null;
  }
  if (!isFiniteSafeNumber(o.observedAt) || !isFiniteSafeNumber(o.dueAt)) return null;
  if (o.observedAt < 0 || o.dueAt < 0) return null;
  if (o.observedAt > now + 60_000) return null;
  if (o.dueAt > now + MAX_FUTURE_DURATION_MS) return null;

  if (o.kind === 'training') {
    if (!isTrainingSchool(o.school)) return null;
  }

  const obs: ActivityObservation = {
    kind: o.kind,
    idKey: o.idKey,
    subject: String(o.subject).trim(),
    observedAt: o.observedAt,
    dueAt: o.dueAt,
    status: o.status,
    activityStatus: o.activityStatus as ActivityUiStatus,
    timerQuality: o.timerQuality as TimerQuality,
    parserVersion: PARSER_VERSION,
  };
  if (isTrainingSchool(o.school)) obs.school = o.school;
  if (typeof o.contextLabel === 'string' && o.contextLabel.trim()) {
    obs.contextLabel = o.contextLabel.trim().slice(0, 80);
  }
  if (typeof o.sourceNote === 'string' && o.sourceNote.trim()) {
    obs.sourceNote = o.sourceNote.trim().slice(0, 200);
  }
  return obs;
}

export function validateContentMessage(
  message: unknown,
  senderUrl: string | undefined,
  now: number,
): TrainingObservation[] | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  if (m.type !== 'TRAINING_OBSERVED') return null;
  if (!Array.isArray(m.observations)) return null;
  if (m.observations.length === 0) return null;
  if (m.observations.length > MAX_OBSERVATIONS_PER_MESSAGE) return null;

  if (!senderUrl) return null;
  const school = classifyTrainingUrl(senderUrl);
  if (!school) return null;

  const out: TrainingObservation[] = [];
  for (const item of m.observations) {
    const obs = validateTrainingObservation(item, now, school);
    if (!obs) return null;
    out.push(obs);
  }
  return out;
}

export type ValidatedActivityMessage = {
  observations: ActivityObservation[];
  replaceScope: boolean;
  scope: ObservationScope;
};

export function validateActivityMessage(
  message: unknown,
  senderUrl: string | undefined,
  now: number,
): ValidatedActivityMessage | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  if (m.type !== 'ACTIVITY_OBSERVED') return null;
  if (!Array.isArray(m.observations)) return null;
  // Empty allowed when replaceScope clears stale ready/active rows
  if (m.observations.length > MAX_OBSERVATIONS_PER_MESSAGE) return null;
  if (!senderUrl) return null;

  const page = classifyPageUrl(senderUrl);
  if (!page) return null;

  const replaceScope = m.replaceScope === true;
  if (!replaceScope && m.observations.length === 0) return null;

  const scope: ValidatedActivityMessage['scope'] =
    page.kind === 'training'
      ? { kind: 'training', school: page.school }
      : { kind: page.kind };

  // Optional explicit scope must match sender page
  if (m.scope && typeof m.scope === 'object') {
    const s = m.scope as Record<string, unknown>;
    if (s.kind !== scope.kind) return null;
    if (scope.kind === 'training' && s.school !== scope.school) return null;
  }

  const out: ActivityObservation[] = [];
  for (const item of m.observations) {
    const obs = validateActivityObservation(item, now, page.kind);
    if (!obs) return null;
    if (page.kind === 'training' && obs.school !== page.school) return null;
    out.push(obs);
  }
  return { observations: out, replaceScope, scope };
}

export function validateReminderRecord(value: unknown): ReminderRecord | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id.includes(':')) return null;
  if (!isReminderKind(r.kind)) return null;
  if (typeof r.subject !== 'string' || !r.subject.trim()) return null;
  if (r.subject.trim().length > MAX_PET_NAME_LENGTH) return null;
  if (!isFiniteSafeNumber(r.observedAt) || !isFiniteSafeNumber(r.dueAt)) return null;
  if (r.status !== 'scheduled' && r.status !== 'ready') return null;
  if (r.parserVersion !== PARSER_VERSION) return null;
  if (!isFiniteSafeNumber(r.generation) || r.generation < 1) return null;

  // Back-compat defaults for older training-only records
  const activityStatus: ActivityUiStatus =
    typeof r.activityStatus === 'string' &&
    (UI_STATUSES as readonly string[]).includes(r.activityStatus)
      ? (r.activityStatus as ActivityUiStatus)
      : r.status === 'ready'
        ? 'ready'
        : 'active';

  const timerQuality: TimerQuality =
    typeof r.timerQuality === 'string' &&
    (TIMER_QUALITIES as readonly string[]).includes(r.timerQuality)
      ? (r.timerQuality as TimerQuality)
      : r.status === 'ready'
        ? 'none'
        : 'snapshot';

  if (r.kind === 'training') {
    if (!isTrainingSchool(r.school) && !r.id.startsWith('training:')) return null;
  }

  const record: ReminderRecord = {
    id: r.id,
    kind: r.kind,
    subject: r.subject.trim(),
    observedAt: r.observedAt,
    dueAt: r.dueAt,
    status: r.status,
    activityStatus,
    timerQuality,
    parserVersion: PARSER_VERSION,
    generation: Math.floor(r.generation),
  };

  if (isTrainingSchool(r.school)) record.school = r.school;
  else if (r.kind === 'training' && r.id.startsWith('training:')) {
    const parts = r.id.split(':');
    if (parts[1] && isTrainingSchool(parts[1])) record.school = parts[1];
  }

  if (typeof r.contextLabel === 'string' && r.contextLabel.trim()) {
    record.contextLabel = r.contextLabel.trim().slice(0, 80);
  }
  if (typeof r.sourceNote === 'string' && r.sourceNote.trim()) {
    record.sourceNote = r.sourceNote.trim().slice(0, 200);
  }
  if (r.notifiedGeneration !== undefined) {
    if (!isFiniteSafeNumber(r.notifiedGeneration)) return null;
    record.notifiedGeneration = Math.floor(r.notifiedGeneration);
  }
  if (r.lastNotificationAt !== undefined) {
    if (!isFiniteSafeNumber(r.lastNotificationAt)) return null;
    record.lastNotificationAt = r.lastNotificationAt;
  }

  return record;
}

export function validateSettings(value: unknown): Settings {
  const base = { trainingEnabled: true, notificationsEnabled: true };
  if (!value || typeof value !== 'object') return base;
  const s = value as Record<string, unknown>;
  return {
    trainingEnabled: typeof s.trainingEnabled === 'boolean' ? s.trainingEnabled : true,
    notificationsEnabled:
      typeof s.notificationsEnabled === 'boolean' ? s.notificationsEnabled : true,
  };
}

export function parseStoredState(raw: unknown): StoredStateV1 {
  if (raw == null || typeof raw !== 'object') {
    return {
      schemaVersion: SCHEMA_VERSION,
      reminders: {},
      settings: validateSettings(undefined),
    };
  }

  const obj = raw as Record<string, unknown>;
  const candidate =
    'schemaVersion' in obj
      ? obj
      : typeof obj.state === 'object' && obj.state !== null
        ? (obj.state as Record<string, unknown>)
        : obj;

  if ('schemaVersion' in candidate) {
    const ver = candidate.schemaVersion;
    if (typeof ver === 'number' && ver > SCHEMA_VERSION) {
      throw new SchemaVersionError(ver);
    }
    if (ver !== SCHEMA_VERSION && ver !== undefined) {
      if (typeof ver === 'number' && ver < 1) {
        // fall through
      } else if (ver !== SCHEMA_VERSION) {
        return {
          schemaVersion: SCHEMA_VERSION,
          reminders: {},
          settings: validateSettings(candidate.settings),
        };
      }
    }
  }

  const remindersRaw =
    candidate.reminders && typeof candidate.reminders === 'object'
      ? (candidate.reminders as Record<string, unknown>)
      : {};

  const reminders: Record<string, ReminderRecord> = {};
  for (const [key, value] of Object.entries(remindersRaw)) {
    const rec = validateReminderRecord(value);
    if (rec && rec.id === key) {
      reminders[key] = rec;
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    reminders,
    settings: validateSettings(candidate.settings),
  };
}
