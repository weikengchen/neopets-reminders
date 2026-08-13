import { describe, expect, it } from 'vitest';
import {
  parseTraining,
  TRAINING_FIXTURE_GATE_COMPLETE,
  TRAINING_FIXTURES_AVAILABLE,
} from '../../src/parsers/training.js';
import { JSDOM } from 'jsdom';

describe('training parser fixture gate policy', () => {
  it('full six-file gate remains incomplete', () => {
    expect(TRAINING_FIXTURE_GATE_COMPLETE).toBe(false);
  });

  it('partial fixture parsing is enabled', () => {
    expect(TRAINING_FIXTURES_AVAILABLE).toBe(true);
  });

  it('empty markup fails safe without mutation', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body><div id="x">hello</div></body></html>',
    );
    const before = dom.window.document.documentElement.outerHTML;
    const result = parseTraining(dom.window.document, 'pirate', Date.now());
    expect(result.observations).toEqual([]);
    expect(dom.window.document.documentElement.outerHTML).toBe(before);
  });
});
