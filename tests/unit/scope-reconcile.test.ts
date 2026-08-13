import { describe, expect, it } from 'vitest';
import {
  observationId,
  staleIdsAfterScan,
} from '../../src/shared/scope-reconcile.js';
import type { ReminderRecord } from '../../src/shared/types.js';

function rec(
  partial: Pick<ReminderRecord, 'id' | 'kind'> &
    Partial<ReminderRecord>,
): ReminderRecord {
  return {
    subject: 'x',
    observedAt: 1,
    dueAt: 1,
    status: 'ready',
    activityStatus: 'ready',
    timerQuality: 'none',
    parserVersion: 1,
    generation: 1,
    ...partial,
  };
}

describe('staleIdsAfterScan', () => {
  it('removes training ready not on latest mystery scan', () => {
    const reminders = {
      'training:mystery:pet-a': rec({
        id: 'training:mystery:pet-a',
        kind: 'training',
        school: 'mystery',
        activityStatus: 'ready',
      }),
      'training:mystery:pet-b': rec({
        id: 'training:mystery:pet-b',
        kind: 'training',
        school: 'mystery',
        activityStatus: 'active',
        status: 'scheduled',
        dueAt: 99,
        timerQuality: 'snapshot',
      }),
      'training:pirate:pet-c': rec({
        id: 'training:pirate:pet-c',
        kind: 'training',
        school: 'pirate',
        activityStatus: 'ready',
      }),
      'hospital:shift:pet': rec({
        id: 'hospital:shift:pet',
        kind: 'hospital',
        activityStatus: 'ready',
      }),
    };

    const keep = new Set(['training:mystery:pet-b']);
    const stale = staleIdsAfterScan(
      reminders,
      { kind: 'training', school: 'mystery' },
      keep,
    );
    expect(stale).toEqual(['training:mystery:pet-a']);
  });

  it('empty hospital scan clears all hospital rows', () => {
    const reminders = {
      'hospital:a:p1': rec({
        id: 'hospital:a:p1',
        kind: 'hospital',
        activityStatus: 'ready',
      }),
      'hospital:b:p2': rec({
        id: 'hospital:b:p2',
        kind: 'hospital',
        activityStatus: 'active',
        status: 'scheduled',
        timerQuality: 'snapshot',
        dueAt: 9,
      }),
    };
    const stale = staleIdsAfterScan(
      reminders,
      { kind: 'hospital' },
      new Set(),
    );
    expect(stale.sort()).toEqual(['hospital:a:p1', 'hospital:b:p2']);
  });

  it('keeps unsupported markers', () => {
    const reminders = {
      'training:ninja:unsupported': rec({
        id: 'training:ninja:unsupported',
        kind: 'training',
        school: 'ninja',
        activityStatus: 'unsupported',
      }),
    };
    const stale = staleIdsAfterScan(
      reminders,
      { kind: 'training', school: 'ninja' },
      new Set(),
    );
    expect(stale).toEqual([]);
  });
});

describe('observationId', () => {
  it('joins kind and idKey', () => {
    expect(
      observationId({
        kind: 'hospital',
        idKey: 'battle:pet',
        subject: 'p',
        observedAt: 1,
        dueAt: 1,
        status: 'ready',
        activityStatus: 'ready',
        timerQuality: 'none',
        parserVersion: 1,
      }),
    ).toBe('hospital:battle:pet');
  });
});
