import type {
  ActivityObservation,
  ReminderRecord,
  TrainingSchool,
} from './types.js';

export type ObservationScope =
  | { kind: 'training'; school: TrainingSchool }
  | { kind: 'hospital' }
  | { kind: 'grave-danger' }
  | { kind: 'healing-springs' }
  | { kind: 'coltzan' }
  | { kind: 'expellibox' };

export function observationId(obs: ActivityObservation): string {
  return `${obs.kind}:${obs.idKey}`;
}

export function recordInScope(
  record: ReminderRecord,
  scope: ObservationScope,
): boolean {
  if (record.kind !== scope.kind) return false;
  if (scope.kind === 'training') {
    return record.school === scope.school;
  }
  return true;
}

/**
 * After a successful page scan, drop stale reminders in the same scope that
 * were not present in the latest observation set (e.g. Course Finished claimed
 * → idle; hospital prize collected → Join Shift again).
 */
export function staleIdsAfterScan(
  reminders: Record<string, ReminderRecord>,
  scope: ObservationScope,
  keepIds: ReadonlySet<string>,
): string[] {
  const stale: string[] = [];
  for (const [id, record] of Object.entries(reminders)) {
    if (!recordInScope(record, scope)) continue;
    // Never drop the static ninja unsupported marker via empty mystery scans
    if (record.activityStatus === 'unsupported') continue;
    if (!keepIds.has(id)) stale.push(id);
  }
  return stale;
}
