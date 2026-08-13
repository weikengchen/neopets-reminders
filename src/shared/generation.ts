import {
  GENERATION_DUE_TOLERANCE_MS,
  PARSER_VERSION,
  type ActivityObservation,
  type ReminderRecord,
  type TrainingObservation,
} from './types.js';
import { buildTrainingReminderId } from './validation.js';

export type ApplyObservationResult =
  | { action: 'skip'; reason: string }
  | { action: 'upsert'; record: ReminderRecord; previous?: ReminderRecord };

function buildId(obs: ActivityObservation): string {
  return `${obs.kind}:${obs.idKey}`;
}

/**
 * Generic activity observation → record merge.
 */
export function applyActivityObservation(
  existing: ReminderRecord | undefined,
  observation: ActivityObservation,
): ApplyObservationResult {
  const id = buildId(observation);

  // Available/unknown/unsupported without a real deadline: store as non-alarm UI state
  const schedulesAlarm =
    observation.timerQuality !== 'none' &&
    observation.status === 'scheduled' &&
    observation.dueAt > observation.observedAt;

  const base: ReminderRecord = {
    id,
    kind: observation.kind,
    subject: observation.subject.trim(),
    observedAt: observation.observedAt,
    dueAt: observation.dueAt,
    status: schedulesAlarm ? 'scheduled' : observation.status,
    activityStatus: observation.activityStatus,
    timerQuality: observation.timerQuality,
    parserVersion: PARSER_VERSION,
    generation: 1,
  };
  if (observation.school !== undefined) base.school = observation.school;
  if (observation.contextLabel !== undefined)
    base.contextLabel = observation.contextLabel;
  if (observation.sourceNote !== undefined)
    base.sourceNote = observation.sourceNote;

  if (!existing) {
    return { action: 'upsert', record: base };
  }

  // Keep fresher fixed-cooldown estimate when re-seeing cooldown page
  const keepEstimateKinds = new Set([
    'healing-springs',
    'coltzan',
    'expellibox',
  ]);
  if (
    keepEstimateKinds.has(observation.kind) &&
    observation.activityStatus === 'cooldown' &&
    observation.timerQuality === 'estimate' &&
    existing.kind === observation.kind &&
    existing.timerQuality === 'estimate' &&
    existing.status === 'scheduled' &&
    existing.dueAt > observation.observedAt
  ) {
    return {
      action: 'upsert',
      previous: existing,
      record: {
        ...existing,
        observedAt: observation.observedAt,
        activityStatus: 'cooldown',
        sourceNote:
          existing.sourceNote ??
          'Kept prior estimate; page has no numeric remaining',
      },
    };
  }

  const isReady =
    observation.status === 'ready' || observation.activityStatus === 'ready';

  if (isReady && observation.timerQuality === 'none') {
    const record: ReminderRecord = {
      ...existing,
      subject: base.subject,
      observedAt: observation.observedAt,
      dueAt: Math.min(observation.dueAt, observation.observedAt),
      status: 'ready',
      activityStatus: observation.activityStatus,
      timerQuality: observation.timerQuality,
    };
    const note = observation.sourceNote ?? existing.sourceNote;
    if (note !== undefined) record.sourceNote = note;
    const ctx = observation.contextLabel ?? existing.contextLabel;
    if (ctx !== undefined) record.contextLabel = ctx;
    const school = observation.school ?? existing.school;
    if (school !== undefined) record.school = school;
    return { action: 'upsert', previous: existing, record };
  }

  const dueDelta = Math.abs(observation.dueAt - existing.dueAt);
  const existingWasReady = existing.status === 'ready';
  const materialChange =
    existingWasReady || dueDelta > GENERATION_DUE_TOLERANCE_MS;

  if (!materialChange) {
    const record: ReminderRecord = {
      ...existing,
      subject: base.subject,
      observedAt: observation.observedAt,
      dueAt: observation.dueAt,
      status: schedulesAlarm ? 'scheduled' : observation.status,
      activityStatus: observation.activityStatus,
      timerQuality: observation.timerQuality,
    };
    const note = observation.sourceNote ?? existing.sourceNote;
    if (note !== undefined) record.sourceNote = note;
    const ctx = observation.contextLabel ?? existing.contextLabel;
    if (ctx !== undefined) record.contextLabel = ctx;
    return { action: 'upsert', previous: existing, record };
  }

  return {
    action: 'upsert',
    previous: existing,
    record: {
      id: existing.id,
      kind: observation.kind,
      subject: base.subject,
      observedAt: observation.observedAt,
      dueAt: observation.dueAt,
      status: schedulesAlarm ? 'scheduled' : observation.status,
      activityStatus: observation.activityStatus,
      timerQuality: observation.timerQuality,
      parserVersion: PARSER_VERSION,
      generation: existing.generation + 1,
      ...(observation.school !== undefined ? { school: observation.school } : {}),
      ...(observation.contextLabel !== undefined
        ? { contextLabel: observation.contextLabel }
        : {}),
      ...(observation.sourceNote !== undefined
        ? { sourceNote: observation.sourceNote }
        : {}),
    },
  };
}

/**
 * Legacy training observation path.
 */
export function applyObservation(
  existing: ReminderRecord | undefined,
  observation: TrainingObservation,
): ApplyObservationResult {
  const id = buildTrainingReminderId(observation.school, observation.petName);
  if (!id) {
    return { action: 'skip', reason: 'invalid-pet-name' };
  }

  const activity: ActivityObservation = {
    kind: 'training',
    idKey: id.slice('training:'.length),
    subject: observation.petName,
    school: observation.school,
    observedAt: observation.observedAt,
    dueAt: observation.dueAt,
    status: observation.state === 'ready' ? 'ready' : 'scheduled',
    activityStatus: observation.state === 'ready' ? 'ready' : 'active',
    timerQuality: observation.state === 'ready' ? 'none' : 'snapshot',
    sourceNote:
      observation.state === 'ready'
        ? 'Course Finished! snapshot'
        : 'Server-rendered remaining snapshot',
    parserVersion: PARSER_VERSION,
  };

  return applyActivityObservation(existing, activity);
}

export function alarmNameFor(record: ReminderRecord): string {
  return `neo-reminder:${record.id}:g${record.generation}`;
}

export function notificationIdFor(record: ReminderRecord): string {
  return `neo-notify:${record.id}:g${record.generation}`;
}

export function parseAlarmName(
  name: string,
): { reminderId: string; generation: number } | null {
  const prefix = 'neo-reminder:';
  if (!name.startsWith(prefix)) return null;
  const rest = name.slice(prefix.length);
  const idx = rest.lastIndexOf(':g');
  if (idx <= 0) return null;
  const reminderId = rest.slice(0, idx);
  const generation = Number(rest.slice(idx + 2));
  if (!Number.isInteger(generation) || generation < 1) return null;
  if (!reminderId.includes(':')) return null;
  return { reminderId, generation };
}

export function parseNotificationId(
  id: string,
): { reminderId: string; generation: number } | null {
  const prefix = 'neo-notify:';
  if (!id.startsWith(prefix)) return null;
  if (id === 'neo-notify:test') return null;
  const rest = id.slice(prefix.length);
  const idx = rest.lastIndexOf(':g');
  if (idx <= 0) return null;
  const reminderId = rest.slice(0, idx);
  const generation = Number(rest.slice(idx + 2));
  if (!Number.isInteger(generation) || generation < 1) return null;
  return { reminderId, generation };
}
