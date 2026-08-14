import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseMeteor } from '../../src/parsers/meteor.js';
import { applyActivityObservation } from '../../src/shared/generation.js';
import {
  METEOR_VISIT_COOLDOWN_MS,
  meteorPrizeDueAtUtcMs,
  meteorVisitDueAtUtcMs,
  nextNstMidnightUtcMs,
  nstWallTimeToUtcMs,
} from '../../src/shared/nst.js';
import { classifyPageUrl, canonicalUrlForKind } from '../../src/shared/url-allowlist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/meteor');

function load(name: string): Document {
  return new JSDOM(readFileSync(join(root, name), 'utf8')).window.document;
}

const NOW = 2_400_000_000_000;

describe('meteor URL', () => {
  it('classifies canonical and query variants', () => {
    expect(
      classifyPageUrl('https://www.neopets.com/moon/meteor.phtml'),
    ).toEqual({ kind: 'meteor' });
    expect(
      classifyPageUrl('https://www.neopets.com/moon/meteor.phtml?getclose=1'),
    ).toEqual({ kind: 'meteor' });
    expect(
      classifyPageUrl('https://www.neopets.com/moon/meteor.phtml?errorm=3'),
    ).toEqual({ kind: 'meteor' });
    expect(canonicalUrlForKind('meteor')).toBe(
      'https://www.neopets.com/moon/meteor.phtml',
    );
  });
});

describe('meteor parser fixtures', () => {
  it('available has no timer', () => {
    const { observations } = parseMeteor(load('available.html'), NOW);
    expect(observations[0]?.activityStatus).toBe('available');
    expect(observations[0]?.timerQuality).toBe('none');
  });

  it('action-selection starts +60m visit cooldown', () => {
    const { observations } = parseMeteor(load('action-selection.html'), NOW);
    expect(observations[0]?.activityStatus).toBe('cooldown');
    expect(observations[0]?.dueAt).toBe(NOW + METEOR_VISIT_COOLDOWN_MS);
    expect(observations[0]?.prizeWonToday).toBe(false);
  });

  it('result-miss is +60m', () => {
    const { observations } = parseMeteor(load('result-miss.html'), NOW);
    expect(observations[0]?.dueAt).toBe(meteorVisitDueAtUtcMs(NOW));
    expect(observations[0]?.prizeWonToday).toBe(false);
  });

  it('alternate miss copy', () => {
    const doc = new JSDOM(
      `<!doctype html><body><p>This must not be your lucky day. The meteor just disappeared. Try again later.</p></body>`,
    ).window.document;
    const { observations } = parseMeteor(doc, NOW);
    expect(observations[0]?.timerQuality).toBe('estimate');
    expect(observations[0]?.prizeWonToday).toBe(false);
  });

  it('cooldown It\'s gone! is +60m', () => {
    const { observations } = parseMeteor(load('cooldown.html'), NOW);
    expect(observations[0]?.activityStatus).toBe('cooldown');
    expect(observations[0]?.dueAt).toBe(NOW + METEOR_VISIT_COOLDOWN_MS);
  });

  it('prize locks until next NST midnight', () => {
    const { observations } = parseMeteor(load('result-prize.html'), NOW);
    expect(observations[0]?.prizeWonToday).toBe(true);
    expect(observations[0]?.dueAt).toBe(meteorPrizeDueAtUtcMs(NOW));
    expect(observations[0]?.dueAt).toBe(nextNstMidnightUtcMs(NOW));
  });

  it('does not invent too-hot or scientist-away', () => {
    const doc = new JSDOM(
      '<!doctype html><body><h1>Meteor Crash Site 725-XZ</h1><p>hello</p></body>',
    ).window.document;
    expect(parseMeteor(doc, NOW).observations[0]?.activityStatus).toBe(
      'unknown',
    );
  });
});

describe('meteor merge', () => {
  it('keeps earlier visit estimate on cooldown re-read', () => {
    const first = parseMeteor(load('result-miss.html'), NOW).observations[0]!;
    const created = applyActivityObservation(undefined, first);
    expect(created.action).toBe('upsert');
    if (created.action !== 'upsert') return;
    const later = parseMeteor(load('cooldown.html'), NOW + 10_000)
      .observations[0]!;
    const merged = applyActivityObservation(created.record, later);
    expect(merged.action).toBe('upsert');
    if (merged.action === 'upsert') {
      expect(merged.record.dueAt).toBe(first.dueAt);
    }
  });

  it('prize replaces a shorter visit cooldown', () => {
    const miss = parseMeteor(load('result-miss.html'), NOW).observations[0]!;
    const created = applyActivityObservation(undefined, miss);
    if (created.action !== 'upsert') return;
    const prize = parseMeteor(load('result-prize.html'), NOW + 1000)
      .observations[0]!;
    const merged = applyActivityObservation(created.record, prize);
    expect(merged.action).toBe('upsert');
    if (merged.action === 'upsert') {
      expect(merged.record.prizeWonToday).toBe(true);
      expect(merged.record.dueAt).toBe(prize.dueAt);
    }
  });

  it('keeps prize midnight lock over a later miss/available-style cooldown', () => {
    const afternoon = nstWallTimeToUtcMs(2026, 8, 13, 15, 0, 0);
    const prize = parseMeteor(load('result-prize.html'), afternoon)
      .observations[0]!;
    const created = applyActivityObservation(undefined, prize);
    if (created.action !== 'upsert') return;
    const miss = parseMeteor(load('result-miss.html'), afternoon + 1000)
      .observations[0]!;
    const merged = applyActivityObservation(created.record, miss);
    if (merged.action === 'upsert') {
      expect(merged.record.prizeWonToday).toBe(true);
      expect(merged.record.dueAt).toBe(prize.dueAt);
    }
  });
});
