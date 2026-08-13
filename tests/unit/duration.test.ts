import { describe, expect, it } from 'vitest';
import { parseDurationMs } from '../../src/parsers/duration.js';

describe('parseDurationMs', () => {
  it('parses mixed units', () => {
    expect(parseDurationMs('2 hrs, 5 minutes, 9 seconds')).toBe(
      2 * 3_600_000 + 5 * 60_000 + 9_000,
    );
  });

  it('parses singular forms', () => {
    expect(parseDurationMs('1 hr, 1 minute, 1 second')).toBe(
      3_600_000 + 60_000 + 1_000,
    );
  });

  it('handles case and whitespace', () => {
    expect(parseDurationMs('  3  HRS   10  MINS  ')).toBe(
      3 * 3_600_000 + 10 * 60_000,
    );
  });

  it('allows omitted zero units', () => {
    expect(parseDurationMs('45 minutes')).toBe(45 * 60_000);
    expect(parseDurationMs('2 hours')).toBe(2 * 3_600_000);
  });

  it('returns null for malformed / unitless / negative / duplicate', () => {
    expect(parseDurationMs('')).toBeNull();
    expect(parseDurationMs('soon')).toBeNull();
    expect(parseDurationMs('5')).toBeNull();
    expect(parseDurationMs('2 hrs 5')).toBeNull();
    expect(parseDurationMs('2 hrs, 2 hours')).toBeNull();
    expect(parseDurationMs('-1 minutes')).toBeNull();
  });
});
