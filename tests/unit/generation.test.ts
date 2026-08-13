import { describe, expect, it } from 'vitest';
import { applyObservation } from '../../src/shared/generation.js';
import { syntheticObservation } from '../../src/parsers/training.js';
import type { ReminderRecord } from '../../src/shared/types.js';

const NOW = 1_700_000_000_000;

function baseRecord(over: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'training:mystery:fluffy',
    kind: 'training',
    subject: 'Fluffy',
    school: 'mystery',
    observedAt: NOW - 10_000,
    dueAt: NOW + 3_600_000,
    status: 'scheduled',
    activityStatus: 'active',
    timerQuality: 'snapshot',
    parserVersion: 1,
    generation: 1,
    ...over,
  };
}

describe('applyObservation', () => {
  it('creates generation 1 for new id', () => {
    const r = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'Fluffy',
        school: 'mystery',
        observedAt: NOW,
        dueAt: NOW + 1000,
        state: 'training',
      }),
    );
    expect(r.action).toBe('upsert');
    if (r.action === 'upsert') {
      expect(r.record.generation).toBe(1);
      expect(r.record.status).toBe('scheduled');
    }
  });

  it('keeps generation for dueAt within 60s', () => {
    const existing = baseRecord({
      notifiedGeneration: 1,
      lastNotificationAt: NOW - 1000,
    });
    const r = applyObservation(
      existing,
      syntheticObservation({
        petName: 'Fluffy',
        school: 'mystery',
        observedAt: NOW,
        dueAt: existing.dueAt + 30_000,
        state: 'training',
      }),
    );
    if (r.action === 'upsert') {
      expect(r.record.generation).toBe(1);
      expect(r.record.notifiedGeneration).toBe(1);
    }
  });

  it('increments generation on material due change and clears notify meta', () => {
    const existing = baseRecord({
      notifiedGeneration: 1,
      lastNotificationAt: NOW - 1000,
    });
    const r = applyObservation(
      existing,
      syntheticObservation({
        petName: 'Fluffy',
        school: 'mystery',
        observedAt: NOW,
        dueAt: existing.dueAt + 120_000,
        state: 'training',
      }),
    );
    if (r.action === 'upsert') {
      expect(r.record.generation).toBe(2);
      expect(r.record.notifiedGeneration).toBeUndefined();
      expect(r.record.lastNotificationAt).toBeUndefined();
    }
  });

  it('ready on scheduled keeps generation', () => {
    const existing = baseRecord();
    const r = applyObservation(
      existing,
      syntheticObservation({
        petName: 'Fluffy',
        school: 'mystery',
        observedAt: NOW,
        dueAt: NOW,
        state: 'ready',
      }),
    );
    if (r.action === 'upsert') {
      expect(r.record.status).toBe('ready');
      expect(r.record.generation).toBe(1);
    }
  });

  it('ready then future training increments generation', () => {
    const existing = baseRecord({ status: 'ready', dueAt: NOW - 1000 });
    const r = applyObservation(
      existing,
      syntheticObservation({
        petName: 'Fluffy',
        school: 'mystery',
        observedAt: NOW,
        dueAt: NOW + 3_600_000,
        state: 'training',
      }),
    );
    if (r.action === 'upsert') {
      expect(r.record.generation).toBe(2);
      expect(r.record.status).toBe('scheduled');
    }
  });
});
