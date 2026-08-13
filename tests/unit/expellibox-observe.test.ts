import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  buildLeaveObservation,
  decideExpelliboxAction,
  EXPELLIBOX_POLL_MAX_MS,
  EXPELLIBOX_POLL_MS,
} from '../../src/content/expellibox-observe.js';
import { parseExpellibox } from '../../src/parsers/expellibox.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function load(rel: string): Document {
  return new JSDOM(readFileSync(join(root, rel), 'utf8')).window.document;
}

const NOW = 2_200_000_000_000;

describe('decideExpelliboxAction (poll until classified)', () => {
  it('empty shell while polling continues without sending unknown', () => {
    const empty = new JSDOM(
      '<!doctype html><body><div id="main_div"></div></body>',
    ).window.document;
    const result = parseExpellibox(empty, NOW);
    expect(result.diagnostics).toContain('expellibox-unknown-dom');
    expect(decideExpelliboxAction(result, 'polling')).toEqual({
      type: 'continue-polling',
    });
  });

  it('cooldown during poll sends estimate and would stop', () => {
    const result = parseExpellibox(load('expellibox/cooldown.html'), NOW);
    const action = decideExpelliboxAction(result, 'polling');
    expect(action.type).toBe('send');
    if (action.type === 'send') {
      expect(action.observations[0]?.activityStatus).toBe('cooldown');
      expect(action.observations[0]?.timerQuality).toBe('estimate');
    }
  });

  it('playable during poll arms leave only', () => {
    const result = parseExpellibox(load('expellibox/available.html'), NOW);
    expect(decideExpelliboxAction(result, 'polling')).toEqual({
      type: 'arm-leave',
    });
  });

  it('final phase after max window may send unknown once', () => {
    const empty = new JSDOM(
      '<!doctype html><body><div id="main_div"></div></body>',
    ).window.document;
    const result = parseExpellibox(empty, NOW);
    const action = decideExpelliboxAction(result, 'final');
    expect(action.type).toBe('send');
    if (action.type === 'send') {
      expect(action.observations[0]?.activityStatus).toBe('unknown');
    }
  });

  it('poll interval is frequent; max window is bounded', () => {
    expect(EXPELLIBOX_POLL_MS).toBeLessThanOrEqual(1500);
    expect(EXPELLIBOX_POLL_MS).toBeGreaterThanOrEqual(500);
    expect(EXPELLIBOX_POLL_MAX_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('leave observation remains estimate cooldown', () => {
    const o = buildLeaveObservation(NOW);
    expect(o.activityStatus).toBe('cooldown');
    expect(o.timerQuality).toBe('estimate');
  });
});
