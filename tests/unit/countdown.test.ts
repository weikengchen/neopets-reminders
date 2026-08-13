import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatCountdownPrecise,
} from '../../src/shared/countdown.js';

describe('formatCountdown', () => {
  const now = 1_000_000;

  it('shows Ready now when due', () => {
    expect(formatCountdown(now, now)).toBe('Ready now');
    expect(formatCountdown(now - 1, now)).toBe('Ready now');
  });

  it('formats minute-level remaining', () => {
    expect(formatCountdown(now + 90_000, now)).toBe('2m');
    expect(formatCountdown(now + 3_600_000 + 120_000, now)).toBe('1h 2m');
  });
});

describe('formatCountdownPrecise', () => {
  const now = 1_000_000;

  it('shows Ready now when due', () => {
    expect(formatCountdownPrecise(now, now)).toBe('Ready now');
  });

  it('formats h:mm:ss and m:ss', () => {
    expect(formatCountdownPrecise(now + 4 * 3_600_000 + 33 * 60_000 + 10_000, now)).toBe(
      '4:33:10',
    );
    expect(formatCountdownPrecise(now + 12 * 60_000 + 5_000, now)).toBe('12:05');
    expect(formatCountdownPrecise(now + 9_000, now)).toBe('0:09');
  });

  it('floors seconds so the display ticks down', () => {
    expect(formatCountdownPrecise(now + 1999, now)).toBe('0:01');
    expect(formatCountdownPrecise(now + 1000, now)).toBe('0:01');
    expect(formatCountdownPrecise(now + 999, now)).toBe('0:00');
  });
});
