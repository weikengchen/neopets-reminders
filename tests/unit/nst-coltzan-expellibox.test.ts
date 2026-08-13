import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseColtzan } from '../../src/parsers/coltzan.js';
import {
  expelliboxLeaveAssumption,
  parseExpellibox,
} from '../../src/parsers/expellibox.js';
import {
  COLTZAN_COOLDOWN_MS,
  EXPELLIBOX_COOLDOWN_MS,
  coltzanDueAtUtcMs,
  expelliboxDueAtUtcMs,
  nextColtzanResetUtcMs,
  nstWallTimeToUtcMs,
} from '../../src/shared/nst.js';
import { classifyPageUrl, canonicalUrlForKind } from '../../src/shared/url-allowlist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function load(rel: string): Document {
  return new JSDOM(readFileSync(join(root, rel), 'utf8')).window.document;
}

describe('NST / Coltzan dueAt (JN examples)', () => {
  it('maps NST wall times via America/Los_Angeles', () => {
    // 2026-08-12 07:01:00 NST should be a finite UTC instant
    const ms = nstWallTimeToUtcMs(2026, 8, 12, 7, 1, 0);
    expect(Number.isFinite(ms)).toBe(true);
  });

  it('7:01am NST → next due is +13h (8:01pm), not next 12:26am', () => {
    const observed = nstWallTimeToUtcMs(2026, 8, 12, 7, 1, 0);
    const due = coltzanDueAtUtcMs(observed);
    const plus13 = observed + COLTZAN_COOLDOWN_MS;
    const reset = nextColtzanResetUtcMs(observed);
    expect(due).toBe(Math.min(plus13, reset));
    expect(due).toBe(plus13);
    expect(due).toBeLessThan(reset);
  });

  it('9:05pm NST → next due is ~12:26am next day (before +13h)', () => {
    const observed = nstWallTimeToUtcMs(2026, 8, 12, 21, 5, 0);
    const due = coltzanDueAtUtcMs(observed);
    const plus13 = observed + COLTZAN_COOLDOWN_MS;
    const reset = nextColtzanResetUtcMs(observed);
    expect(due).toBe(reset);
    expect(due).toBeLessThan(plus13);
  });
});

describe('Expellibox cooldown ms', () => {
  it('is 7h7m', () => {
    const now = 1_700_000_000_000;
    expect(expelliboxDueAtUtcMs(now) - now).toBe(EXPELLIBOX_COOLDOWN_MS);
    expect(EXPELLIBOX_COOLDOWN_MS).toBe((7 * 60 + 7) * 60 * 1000);
  });
});

describe('URL classifiers', () => {
  it('classifies shrine and ncmall giveaway', () => {
    expect(
      classifyPageUrl('https://www.neopets.com/desert/shrine.phtml'),
    ).toEqual({ kind: 'coltzan' });
    expect(
      classifyPageUrl(
        'https://ncmall.neopets.com/mall/shop.phtml?page=giveaway',
      ),
    ).toEqual({ kind: 'expellibox' });
    expect(canonicalUrlForKind('coltzan')).toContain('shrine.phtml');
    expect(canonicalUrlForKind('expellibox')).toContain('ncmall.neopets.com');
  });
});

describe('coltzan parser fixtures', () => {
  const NOW = 2_100_000_000_000;

  it('available', () => {
    const { observations } = parseColtzan(
      load('coltzans-shrine/available.html'),
      NOW,
    );
    expect(observations[0]?.activityStatus).toBe('available');
    expect(observations[0]?.timerQuality).toBe('none');
  });

  it('success → cooldown estimate', () => {
    const { observations } = parseColtzan(
      load('coltzans-shrine/success.html'),
      NOW,
    );
    expect(observations[0]?.activityStatus).toBe('cooldown');
    expect(observations[0]?.timerQuality).toBe('estimate');
    expect(observations[0]?.dueAt).toBe(coltzanDueAtUtcMs(NOW));
  });

  it('wait-a-while cooldown', () => {
    const { observations } = parseColtzan(
      load('coltzans-shrine/cooldown.html'),
      NOW,
    );
    expect(observations[0]?.activityStatus).toBe('cooldown');
    expect(observations[0]?.sourceNote).toMatch(/Cooldown copy/);
  });
});

describe('expellibox parser fixtures', () => {
  const NOW = 2_100_000_000_000;

  it('available is playable visit without immediate timer', () => {
    const r = parseExpellibox(load('expellibox/available.html'), NOW);
    expect(r.isPlayableVisit).toBe(true);
    expect(r.isCooldown).toBe(false);
    expect(r.observations).toEqual([]);
  });

  it('success shell is still playable (canvas unreadable)', () => {
    const r = parseExpellibox(load('expellibox/success.html'), NOW);
    expect(r.isPlayableVisit).toBe(true);
  });

  it('cooldown and used-cooldown start 7h7m estimate', () => {
    for (const f of ['expellibox/cooldown.html', 'expellibox/used-cooldown.html']) {
      const r = parseExpellibox(load(f), NOW);
      expect(r.isCooldown).toBe(true);
      expect(r.observations[0]?.dueAt).toBe(NOW + EXPELLIBOX_COOLDOWN_MS);
    }
  });

  it('leave assumption', () => {
    const o = expelliboxLeaveAssumption(NOW);
    expect(o.dueAt).toBe(NOW + EXPELLIBOX_COOLDOWN_MS);
    expect(o.sourceNote).toMatch(/Assumed played/);
  });
});
