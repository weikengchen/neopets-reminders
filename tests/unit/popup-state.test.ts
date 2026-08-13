import { describe, expect, it } from 'vitest';
import { formatCountdown } from '../../src/shared/countdown.js';
import type { ReminderRecord } from '../../src/shared/types.js';

/**
 * Popup partitioning logic (Ready vs Upcoming) without DOM.
 */
function partition(reminders: ReminderRecord[], now: number) {
  const ready = reminders
    .filter((r) => r.status === 'ready' || r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
  const upcoming = reminders
    .filter((r) => r.status === 'scheduled' && r.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt);
  return { ready, upcoming };
}

const NOW = 1000;

function r(
  partial: Partial<ReminderRecord> & Pick<ReminderRecord, 'id' | 'dueAt' | 'status'>,
): ReminderRecord {
  return {
    kind: 'training',
    subject: 'P',
    school: 'pirate',
    observedAt: NOW,
    activityStatus: partial.status === 'ready' ? 'ready' : 'active',
    timerQuality: partial.status === 'ready' ? 'none' : 'snapshot',
    parserVersion: 1,
    generation: 1,
    ...partial,
  };
}

describe('popup list partition', () => {
  it('empty', () => {
    const { ready, upcoming } = partition([], NOW);
    expect(ready).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
  });

  it('ready and upcoming', () => {
    const list = [
      r({ id: 'a', dueAt: NOW + 5000, status: 'scheduled' }),
      r({ id: 'b', dueAt: NOW - 1, status: 'ready' }),
      r({ id: 'c', dueAt: NOW + 1000, status: 'scheduled' }),
    ];
    const { ready, upcoming } = partition(list, NOW);
    expect(ready.map((x) => x.id)).toEqual(['b']);
    expect(upcoming.map((x) => x.id)).toEqual(['c', 'a']);
    expect(formatCountdown(upcoming[0]!.dueAt, NOW)).toBe('1m');
  });

  it('scheduled past due appears ready in UI', () => {
    const { ready, upcoming } = partition(
      [r({ id: 'x', dueAt: NOW - 10, status: 'scheduled' })],
      NOW,
    );
    expect(ready).toHaveLength(1);
    expect(upcoming).toHaveLength(0);
  });
});
