import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseGraveDanger } from '../../src/parsers/grave-danger.js';
import { parseHealingSprings } from '../../src/parsers/healing-springs.js';
import { parseHospital } from '../../src/parsers/hospital.js';
import { applyActivityObservation } from '../../src/shared/generation.js';
import { HEALING_SPRINGS_COOLDOWN_MS } from '../../src/shared/types.js';
import {
  classifyPageUrl,
  canonicalUrlForKind,
} from '../../src/shared/url-allowlist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function load(rel: string): Document {
  const html = readFileSync(join(root, rel), 'utf8');
  return new JSDOM(html).window.document;
}

const NOW = 2_000_000_000_000;

describe('url classifiers', () => {
  it('classifies new activity URLs', () => {
    expect(
      classifyPageUrl('https://www.neopets.com/hospital/volunteer.phtml'),
    ).toEqual({ kind: 'hospital' });
    expect(
      classifyPageUrl('https://www.neopets.com/halloween/gravedanger/'),
    ).toEqual({ kind: 'grave-danger' });
    expect(
      classifyPageUrl('https://www.neopets.com/faerieland/springs.phtml'),
    ).toEqual({ kind: 'healing-springs' });
    expect(canonicalUrlForKind('grave-danger')).toContain('gravedanger');
  });
});

describe('hospital parser', () => {
  it('active snapshots', () => {
    const { observations } = parseHospital(
      load('hospital-volunteer/active.html'),
      NOW,
    );
    expect(observations.length).toBe(2);
    expect(observations.every((o) => o.activityStatus === 'active')).toBe(true);
    expect(observations.every((o) => o.timerQuality === 'snapshot')).toBe(true);
    expect(observations[0]?.dueAt).toBeGreaterThan(NOW);
  });

  it('active with inline script in clock (live regression)', () => {
    const html = `<!doctype html><body>
      <div class="vc-fight-details">
        <div class="vc-title" title="Battle for Brightvale I">Battle for Brightvale I</div>
        <span class="vc-status">Time Remaining: </span>
        <span class="vc-fight-time">
          <span>0</span><span>0</span>:<span>3</span><span>4</span>:<span>5</span><span>3</span>
          <script>let clock3 = new vcClock(0, 39, 59); /* redacted */</script>
        </span>
        <span class="vc-pet-name">FixturePetHospital01</span>
        <span> is volunteering!</span>
        <button class="vc-button">Cancel</button>
      </div>
    </body>`;
    const doc = new JSDOM(html).window.document;
    const { observations, diagnostics } = parseHospital(doc, NOW);
    expect(diagnostics).not.toContain('skip-unparseable-hospital-clock');
    expect(observations).toHaveLength(1);
    expect(observations[0]?.activityStatus).toBe('active');
    // 00:34:53
    expect(observations[0]?.dueAt).toBe(NOW + (34 * 60 + 53) * 1000);
  });

  it('ready collect prize', () => {
    const { observations } = parseHospital(
      load('hospital-volunteer/ready.html'),
      NOW,
    );
    expect(observations.every((o) => o.activityStatus === 'ready')).toBe(true);
  });

  it('client Complete label is ready', () => {
    const doc = new JSDOM(`<!doctype html><body>
      <div class="vc-fight finished">
        <div class="vc-fight-details">
          <div class="vc-title" title="Battle for Brightvale I">Battle for Brightvale I</div>
          <span class="vc-status">Time Remaining: </span>
          <span class="vc-fight-time"><span>0</span><span>0</span>:<span>0</span><span>0</span>:<span>0</span><span>0</span></span>
          <span class="vc-pet-name">FixturePetComplete</span>
          <button>Complete</button>
        </div>
      </div>
    </body>`).window.document;
    expect(parseHospital(doc, NOW).observations[0]?.activityStatus).toBe(
      'ready',
    );
  });

  it('available join shift is not persisted', () => {
    const { observations } = parseHospital(
      load('hospital-volunteer/available.html'),
      NOW,
    );
    expect(observations).toEqual([]);
  });

  it('malformed safe', () => {
    const { observations } = parseHospital(
      load('hospital-volunteer/malformed.html'),
      NOW,
    );
    expect(
      observations.every(
        (o) => o.timerQuality !== 'snapshot' || o.dueAt >= NOW,
      ),
    ).toBe(true);
  });
});

describe('grave danger parser', () => {
  it('active remaining', () => {
    const { observations, pageKind } = parseGraveDanger(
      load('grave-danger/active.html'),
      NOW,
    );
    expect(pageKind).toBe('active');
    expect(observations).toHaveLength(1);
    expect(observations[0]?.subject).toBe('FixturePetpetGD01');
    expect(observations[0]?.timerQuality).toBe('snapshot');
  });

  it('end and selection clear scope; unknown does not', () => {
    expect(parseGraveDanger(load('grave-danger/end.html'), NOW)).toMatchObject({
      pageKind: 'end',
      shouldClearScope: true,
      observations: [],
    });
    expect(
      parseGraveDanger(load('grave-danger/selection.html'), NOW),
    ).toMatchObject({
      pageKind: 'selection',
      shouldClearScope: true,
      observations: [],
    });
    const unknown = parseGraveDanger(
      new JSDOM('<!doctype html><body></body>').window.document,
      NOW,
    );
    expect(unknown.pageKind).toBe('unknown');
    expect(unknown.shouldClearScope).toBe(false);
  });
});

describe('healing springs parser', () => {
  it('available', () => {
    const { observations } = parseHealingSprings(
      load('healing-springs/available.html'),
      NOW,
    );
    expect(observations[0]?.activityStatus).toBe('available');
  });

  it('success → local 30m estimate', () => {
    const { observations } = parseHealingSprings(
      load('healing-springs/success-heal.html'),
      NOW,
    );
    expect(observations[0]?.timerQuality).toBe('estimate');
    expect(observations[0]?.dueAt).toBe(NOW + HEALING_SPRINGS_COOLDOWN_MS);
  });

  it('cooldown estimate; keeps fresher success estimate', () => {
    const { observations } = parseHealingSprings(
      load('healing-springs/cooldown.html'),
      NOW,
    );
    expect(observations[0]?.activityStatus).toBe('cooldown');

    const success = applyActivityObservation(undefined, {
      kind: 'healing-springs',
      idKey: 'self',
      subject: 'Healing Springs',
      observedAt: NOW - 5 * 60_000,
      dueAt: NOW - 5 * 60_000 + HEALING_SPRINGS_COOLDOWN_MS,
      status: 'scheduled',
      activityStatus: 'cooldown',
      timerQuality: 'estimate',
      parserVersion: 1,
    });
    expect(success.action).toBe('upsert');
    if (success.action !== 'upsert') return;

    const merged = applyActivityObservation(success.record, observations[0]!);
    expect(merged.action).toBe('upsert');
    if (merged.action === 'upsert') {
      expect(merged.record.dueAt).toBe(success.record.dueAt);
    }
  });

  it('does not treat empty faerie-battle alone as success', () => {
    const doc = new JSDOM(
      '<!doctype html><body><div class="faerie-battle"></div></body>',
    ).window.document;
    const { observations } = parseHealingSprings(doc, NOW);
    expect(observations[0]?.activityStatus).toBe('unknown');
    expect(observations[0]?.timerQuality).toBe('none');
  });
});
