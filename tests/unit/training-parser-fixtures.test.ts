import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  parseTraining,
  TRAINING_FIXTURE_GATE_COMPLETE,
  TRAINING_FIXTURES_AVAILABLE,
} from '../../src/parsers/training.js';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/training',
);

function load(name: string): Document {
  const html = readFileSync(join(fixtureDir, name), 'utf8');
  return new JSDOM(html).window.document;
}

const NOW = 1_700_000_000_000;
const EXPECTED_MS = 1 * 3_600_000 + 10 * 60_000 + 45_000;

describe('training parser (partial fixture-backed)', () => {
  it('marks full gate incomplete but partial parse enabled', () => {
    expect(TRAINING_FIXTURE_GATE_COMPLETE).toBe(false);
    expect(TRAINING_FIXTURES_AVAILABLE).toBe(true);
  });

  it('mystery-active: one training observation', () => {
    const doc = load('mystery-active.html');
    const before = doc.documentElement.outerHTML;
    const { observations, activityObservations } = parseTraining(
      doc,
      'mystery',
      NOW,
    );
    expect(observations).toHaveLength(1);
    expect(observations[0]?.dueAt).toBe(NOW + EXPECTED_MS);
    expect(activityObservations[0]?.timerQuality).toBe('snapshot');
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it('mystery-ready: Course Finished → ready', () => {
    const { observations, activityObservations } = parseTraining(
      load('mystery-ready.html'),
      'mystery',
      NOW,
    );
    expect(observations).toHaveLength(1);
    expect(observations[0]?.state).toBe('ready');
    expect(activityObservations[0]?.activityStatus).toBe('ready');
  });

  it('pirate-active: snapshot timer', () => {
    const { observations } = parseTraining(
      load('pirate-active.html'),
      'pirate',
      NOW,
    );
    expect(observations).toHaveLength(1);
    expect(observations[0]?.petName).toBe('FixturePetPirateActive');
  });

  it('multiple-pets: only active row', () => {
    const { observations } = parseTraining(
      load('multiple-pets.html'),
      'mystery',
      NOW,
    );
    expect(observations).toHaveLength(1);
    expect(observations[0]?.petName).toBe('FixturePet06');
  });

  it('pirate-ready: Course Finished → ready', () => {
    const { observations, activityObservations } = parseTraining(
      load('pirate-ready.html'),
      'pirate',
      NOW,
    );
    expect(observations).toHaveLength(1);
    expect(observations[0]?.state).toBe('ready');
    expect(activityObservations[0]?.activityStatus).toBe('ready');
  });

  it('mystery-available: zero timers', () => {
    expect(
      parseTraining(load('mystery-available.html'), 'mystery', NOW)
        .observations,
    ).toEqual([]);
  });

  it('malformed: no fabricated deadline', () => {
    expect(
      parseTraining(load('malformed.html'), 'mystery', NOW).observations,
    ).toEqual([]);
  });

  it('ninja school unsupported', () => {
    const { observations, activityObservations } = parseTraining(
      load('mystery-active.html'),
      'ninja',
      NOW,
    );
    expect(observations).toEqual([]);
    expect(activityObservations[0]?.activityStatus).toBe('unsupported');
  });
});
