import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  GD_POLL_MS,
  GD_WAIT_MAX_MS,
  GraveDangerWaiter,
  decideGraveDangerWait,
  hasGraveDangerActiveShell,
} from '../../src/content/grave-danger-observe.js';
import { parseGraveDanger } from '../../src/parsers/grave-danger.js';
import type { ActivityObservation } from '../../src/shared/types.js';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/grave-danger',
);
const NOW = 3_100_000_000_000;

function loadFixture(name: string): Document {
  return new JSDOM(readFileSync(join(fixtureDir, name), 'utf8')).window
    .document;
}

function loadActive(): Document {
  return loadFixture('active.html');
}

function emptyRemainingDoc(): Document {
  return new JSDOM(`<!doctype html><body>
    <div id="gdAdventure">
      <div id="gdActive">
        <span class="petpetName">FixturePetpetGD01</span>
        <span id="gdRemaining"></span>
      </div>
    </div>
  </body>`).window.document;
}

function startWaiter(doc: Document) {
  const sent: ActivityObservation[][] = [];
  const timers = new Map<number, { fn: () => void; due: number }>();
  let nextId = 1;
  let now = NOW;
  const waiter = new GraveDangerWaiter({
    send: (obs) => {
      sent.push(obs);
    },
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, due: now + ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    MutationObserver: undefined,
  });
  waiter.start(doc);
  const flush = (ms: number): void => {
    now += ms;
    for (const [id, t] of [...timers.entries()]) {
      if (t.due <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { waiter, sent, flush };
}

describe('decideGraveDangerWait', () => {
  it('1. parseable remaining sends immediately', () => {
    const result = parseGraveDanger(loadActive(), NOW);
    expect(result.observations).toHaveLength(1);
    expect(decideGraveDangerWait(result, true)).toEqual({ type: 'send-once' });
  });

  it('6. unknown page does not wait or clear', () => {
    const doc = new JSDOM('<!doctype html><body><p>no gd</p></body>')
      .window.document;
    const result = parseGraveDanger(doc, NOW);
    expect(hasGraveDangerActiveShell(doc)).toBe(false);
    expect(result.shouldClearScope).toBe(false);
    expect(decideGraveDangerWait(result, false)).toEqual({
      type: 'stop-no-guess',
    });
  });

  it('empty remaining with shell waits', () => {
    const doc = emptyRemainingDoc();
    const result = parseGraveDanger(doc, NOW);
    expect(hasGraveDangerActiveShell(doc)).toBe(true);
    expect(decideGraveDangerWait(result, true)).toEqual({
      type: 'wait-for-remaining',
    });
  });
});

describe('GraveDangerWaiter', () => {
  it('1. initial parseable remaining sends once and does not wait', () => {
    const { waiter, sent, flush } = startWaiter(loadActive());
    expect(sent).toHaveLength(1);
    expect(sent[0]?.[0]?.activityStatus).toBe('active');
    flush(GD_WAIT_MAX_MS);
    expect(sent).toHaveLength(1);
    expect(waiter.isStopped).toBe(true);
  });

  it('2. empty remaining then page fill sends once', () => {
    const doc = emptyRemainingDoc();
    const { waiter, sent, flush } = startWaiter(doc);
    expect(sent).toHaveLength(0);
    doc.querySelector('#gdRemaining')!.textContent =
      '2 hours, 37 minutes, 1 second';
    flush(GD_POLL_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.[0]?.timerQuality).toBe('snapshot');
    expect(waiter.didSend).toBe(true);
  });

  it('3. later countdown ticks do not send again', () => {
    const doc = emptyRemainingDoc();
    const { sent, flush } = startWaiter(doc);
    const el = doc.querySelector('#gdRemaining')!;
    el.textContent = '2 hours, 37 minutes, 1 second';
    flush(GD_POLL_MS);
    expect(sent).toHaveLength(1);
    el.textContent = '2 hours, 37 minutes, 0 seconds';
    flush(GD_POLL_MS);
    el.textContent = '2 hours, 36 minutes, 59 seconds';
    flush(GD_POLL_MS);
    expect(sent).toHaveLength(1);
  });

  it('4. timeout does not guess an observation', () => {
    const doc = emptyRemainingDoc();
    const { sent, flush } = startWaiter(doc);
    flush(GD_WAIT_MAX_MS + GD_POLL_MS);
    expect(sent).toHaveLength(0);
  });

  it('5. pagehide/stop cancels wait', () => {
    const doc = emptyRemainingDoc();
    const { waiter, sent, flush } = startWaiter(doc);
    waiter.stop();
    doc.querySelector('#gdRemaining')!.textContent = '1 hour, 0 minutes, 0 seconds';
    flush(GD_POLL_MS);
    expect(sent).toHaveLength(0);
  });

  it('6. no shell never starts long wait', () => {
    const doc = new JSDOM('<!doctype html><body></body>').window.document;
    const { waiter, sent, flush } = startWaiter(doc);
    expect(sent).toHaveLength(0);
    expect(waiter.isStopped).toBe(true);
    flush(GD_WAIT_MAX_MS);
    expect(sent).toHaveLength(0);
  });

  it('7. #gdReward end fixture sends empty replaceScope clear', () => {
    const result = parseGraveDanger(loadFixture('end.html'), NOW);
    expect(result.pageKind).toBe('end');
    expect(result.shouldClearScope).toBe(true);
    expect(result.observations).toEqual([]);
    expect(decideGraveDangerWait(result, false)).toEqual({ type: 'send-clear' });

    const { sent, waiter } = startWaiter(loadFixture('end.html'));
    expect(sent).toEqual([[]]);
    expect(waiter.didSend).toBe(true);
    expect(waiter.isStopped).toBe(true);
  });

  it('8. #gdSelection + POST #gdForm sends empty replaceScope clear', () => {
    const result = parseGraveDanger(loadFixture('selection.html'), NOW);
    expect(result.pageKind).toBe('selection');
    expect(result.shouldClearScope).toBe(true);
    expect(result.observations).toEqual([]);

    const { sent } = startWaiter(loadFixture('selection.html'));
    expect(sent).toEqual([[]]);
  });

  it('9. unknown / no-petpet does not send replacement clear', () => {
    const doc = new JSDOM(
      '<!doctype html><body><div id="gdSelect">pick a petpet</div></body>',
    ).window.document;
    const result = parseGraveDanger(doc, NOW);
    expect(result.pageKind).toBe('unknown');
    expect(result.shouldClearScope).toBe(false);
    expect(result.observations).toEqual([]);
    expect(decideGraveDangerWait(result, false)).toEqual({
      type: 'stop-no-guess',
    });

    const { sent, waiter } = startWaiter(doc);
    expect(sent).toHaveLength(0);
    expect(waiter.didSend).toBe(false);
  });
});
