import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOSPITAL_DEBOUNCE_MS,
  HOSPITAL_ROOT_DISCOVERY_INTERVAL_MS,
  HOSPITAL_ROOT_DISCOVERY_MS,
  HospitalReobserver,
  hospitalSnapshotKey,
  isHospitalLifecycleMutation,
} from '../../src/content/hospital-observe.js';
import { parseHospital } from '../../src/parsers/hospital.js';
import type { ActivityObservation } from '../../src/shared/types.js';

const NOW = 3_000_000_000_000;

function clockSpans(h: string, m: string, s: string): string {
  const [h0, h1] = h.padStart(2, '0');
  const [m0, m1] = m.padStart(2, '0');
  const [s0, s1] = s.padStart(2, '0');
  return `<span class="vc-fight-time"><span>${h0}</span><span>${h1}</span>:<span>${m0}</span><span>${m1}</span>:<span>${s0}</span><span>${s1}</span></span>`;
}

function openCard(title: string, fightClass = 'open'): string {
  return `<div class="vc-fight ${fightClass}">
    <div class="vc-fight-details">
      <div class="vc-title" title="${title}">${title}</div>
      <span class="vc-status">Volunteer Time Needed: </span>
      ${clockSpans('03', '00', '00')}
      <button>Join Shift</button>
    </div>
  </div>`;
}

function servingBlock(pet: string): string {
  return `<div class="vc-fight-service">
    <span class="vc-pet-name">${pet}</span><span> is volunteering!</span>
    <button>Cancel</button>
  </div>`;
}

function childList(
  target: Node,
  added: Node[] = [],
  removed: Node[] = [],
): MutationRecord {
  return {
    type: 'childList',
    target,
    addedNodes: added as unknown as NodeList,
    removedNodes: removed as unknown as NodeList,
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    previousSibling: null,
    oldValue: null,
  } as MutationRecord;
}

function attrClass(target: Element): MutationRecord {
  return {
    type: 'attributes',
    target,
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    attributeName: 'class',
    attributeNamespace: null,
    nextSibling: null,
    previousSibling: null,
    oldValue: null,
  } as MutationRecord;
}

function makeDoc(inner: string): Document {
  return new JSDOM(
    `<!doctype html><body><div id="VolunteerFightInfo">${inner}</div></body>`,
  ).window.document;
}

function startObserver(doc: Document) {
  const sent: ActivityObservation[][] = [];
  const timers = new Map<number, { fn: () => void; due: number }>();
  let nextId = 1;
  let now = NOW;
  const reobserver = new HospitalReobserver({
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
  reobserver.start(doc);

  const flush = (ms: number): void => {
    now += ms;
    for (const [id, t] of [...timers.entries()]) {
      if (t.due <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };

  return { reobserver, sent, flush, get now() { return now; } };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('hospital parser finished labels', () => {
  it('Complete + 000000 is ready', () => {
    const doc = new JSDOM(`<!doctype html><body>
      <div class="vc-fight finished">
        <div class="vc-fight-details">
          <div class="vc-title" title="Battle for Brightvale I">Battle for Brightvale I</div>
          <span class="vc-status">Time Remaining: </span>
          ${clockSpans('00', '00', '00')}
          <span class="vc-pet-name">FixturePetA</span>
          <button>Complete</button>
        </div>
      </div>
    </body>`).window.document;
    const { observations } = parseHospital(doc, NOW);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.activityStatus).toBe('ready');
  });

  it('Collect Prize + 000000 is ready', () => {
    const doc = new JSDOM(`<!doctype html><body>
      <div class="vc-fight-details">
        <div class="vc-title" title="Battle for Brightvale I">Battle for Brightvale I</div>
        <span class="vc-status">Time Remaining: </span>
        ${clockSpans('00', '00', '00')}
        <span class="vc-pet-name">FixturePetB</span>
        <button>Collect Prize</button>
      </div>
    </body>`).window.document;
    expect(parseHospital(doc, NOW).observations[0]?.activityStatus).toBe(
      'ready',
    );
  });
});

describe('isHospitalLifecycleMutation', () => {
  it('ignores clock digit childList', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I'));
    const time = doc.querySelector('.vc-fight-time')!;
    const span = time.querySelector('span')!;
    expect(isHospitalLifecycleMutation(childList(time, [], [span]))).toBe(
      false,
    );
  });

  it('treats .vc-fight class change as lifecycle', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I'));
    const fight = doc.querySelector('.vc-fight')!;
    expect(isHospitalLifecycleMutation(attrClass(fight))).toBe(true);
  });

  it('treats service node insert as lifecycle', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I'));
    const details = doc.querySelector('.vc-fight-details')!;
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('PetA');
    const service = wrap.firstElementChild!;
    expect(isHospitalLifecycleMutation(childList(details, [service]))).toBe(
      true,
    );
  });
});

describe('HospitalReobserver', () => {
  it('1. initial parse still works', () => {
    const doc = makeDoc(
      openCard('Battle for Brightvale I') + openCard('Battle for Brightvale II'),
    );
    const { sent } = startObserver(doc);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([]);
  });

  it('2. open → serving emits one debounced active snapshot', () => {
    const doc = makeDoc(
      openCard('Battle for Brightvale I') + openCard('Battle for Brightvale II'),
    );
    const { reobserver, sent, flush } = startObserver(doc);
    const fight = doc.querySelector('.vc-fight')!;
    const details = fight.querySelector('.vc-fight-details')!;
    fight.classList.remove('open');
    fight.classList.add('serving');
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    const service = wrap.firstElementChild!;
    details.append(service);

    reobserver.handleMutations([
      attrClass(fight),
      childList(details, [service]),
    ]);
    expect(sent).toHaveLength(1);
    flush(HOSPITAL_DEBOUNCE_MS);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toHaveLength(1);
    expect(sent[1]?.[0]?.activityStatus).toBe('active');
    expect(sent[1]?.[0]?.contextLabel).toBe('Battle for Brightvale I');
  });

  it('3. second Join yields two actives without duplicates', () => {
    const doc = makeDoc(
      openCard('Battle for Brightvale I') + openCard('Battle for Brightvale II'),
    );
    const { reobserver, sent, flush } = startObserver(doc);
    const fights = [...doc.querySelectorAll('.vc-fight')];

    const join = (fight: Element, pet: string) => {
      const details = fight.querySelector('.vc-fight-details')!;
      fight.classList.remove('open');
      fight.classList.add('serving');
      details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
      const wrap = doc.createElement('div');
      wrap.innerHTML = servingBlock(pet);
      const service = wrap.firstElementChild!;
      details.append(service);
      reobserver.handleMutations([
        attrClass(fight),
        childList(details, [service]),
      ]);
      flush(HOSPITAL_DEBOUNCE_MS);
    };

    join(fights[0]!, 'FixturePet01');
    join(fights[1]!, 'FixturePet02');
    const last = sent[sent.length - 1]!;
    expect(last).toHaveLength(2);
    expect(new Set(last.map((o) => o.idKey)).size).toBe(2);
  });

  it('4. clock digit mutations do not send', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I', 'serving'));
    const details = doc.querySelector('.vc-fight-details')!;
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    details.append(wrap.firstElementChild!);

    const { reobserver, sent, flush } = startObserver(doc);
    const initial = sent.length;
    const time = doc.querySelector('.vc-fight-time')!;
    const digit = time.querySelectorAll('span')[5]!;
    digit.textContent = '1';
    reobserver.handleMutations([childList(time, [], [digit])]);
    flush(HOSPITAL_DEBOUNCE_MS);
    expect(sent).toHaveLength(initial);
  });

  it('5. serving → finished Complete + 000000 is ready', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I', 'serving'));
    const fight = doc.querySelector('.vc-fight')!;
    const details = fight.querySelector('.vc-fight-details')!;
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    details.append(wrap.firstElementChild!);

    const { reobserver, sent, flush } = startObserver(doc);
    fight.classList.remove('serving');
    fight.classList.add('finished');
    details.querySelector('button')!.textContent = 'Complete';
    for (const s of details.querySelectorAll('.vc-fight-time span')) {
      s.textContent = '0';
    }
    reobserver.handleMutations([attrClass(fight)]);
    flush(HOSPITAL_DEBOUNCE_MS);
    const last = sent[sent.length - 1]!;
    expect(last).toHaveLength(1);
    expect(last[0]?.activityStatus).toBe('ready');
  });

  it('6. Collect Prize finished remains ready', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I', 'finished'));
    const details = doc.querySelector('.vc-fight-details')!;
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    details.append(wrap.firstElementChild!);
    details.querySelector('button')!.textContent = 'Collect Prize';
    for (const s of details.querySelectorAll('.vc-fight-time span')) {
      s.textContent = '0';
    }
    const { sent } = startObserver(doc);
    expect(sent[0]?.[0]?.activityStatus).toBe('ready');
  });

  it('7. Collect one of two ready keeps the other', () => {
    const doc = makeDoc(
      openCard('Battle for Brightvale I', 'finished') +
        openCard('Battle for Brightvale II', 'finished'),
    );
    const fights = [...doc.querySelectorAll('.vc-fight')];
    fights.forEach((fight, i) => {
      const details = fight.querySelector('.vc-fight-details')!;
      details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
      const wrap = doc.createElement('div');
      wrap.innerHTML = servingBlock(`FixturePet0${i + 1}`);
      details.append(wrap.firstElementChild!);
      details.querySelector('button')!.textContent = 'Collect Prize';
      for (const s of details.querySelectorAll('.vc-fight-time span')) {
        s.textContent = '0';
      }
    });

    const { reobserver, sent, flush } = startObserver(doc);
    expect(sent[0]).toHaveLength(2);

    const first = fights[0]!;
    const service = first.querySelector('.vc-fight-service')!;
    service.remove();
    first.classList.remove('finished');
    first.classList.add('open');
    first.querySelector('.vc-status')!.textContent = 'Volunteer Time Needed: ';
    first.querySelector('button')!.textContent = 'Join Shift';
    reobserver.handleMutations([
      attrClass(first),
      childList(first.querySelector('.vc-fight-details')!, [], [service]),
    ]);
    flush(HOSPITAL_DEBOUNCE_MS);
    const last = sent[sent.length - 1]!;
    expect(last).toHaveLength(1);
    expect(last[0]?.contextLabel).toBe('Battle for Brightvale II');
  });

  it('8. last Collect sends empty replaceScope snapshot', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I', 'finished'));
    const fight = doc.querySelector('.vc-fight')!;
    const details = fight.querySelector('.vc-fight-details')!;
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    const service = wrap.firstElementChild!;
    details.append(service);
    details.querySelector('button')!.textContent = 'Collect Prize';
    for (const s of details.querySelectorAll('.vc-fight-time span')) {
      s.textContent = '0';
    }

    const { reobserver, sent, flush } = startObserver(doc);
    expect(sent[0]).toHaveLength(1);
    service.remove();
    fight.classList.remove('finished');
    fight.classList.add('open');
    details.querySelector('.vc-status')!.textContent = 'Volunteer Time Needed: ';
    details.querySelector('button')!.textContent = 'Join Shift';
    reobserver.handleMutations([
      attrClass(fight),
      childList(details, [], [service]),
    ]);
    flush(HOSPITAL_DEBOUNCE_MS);
    expect(sent[sent.length - 1]).toEqual([]);
  });

  it('9. mutation burst only sends once after debounce', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I'));
    const { reobserver, sent, flush } = startObserver(doc);
    const fight = doc.querySelector('.vc-fight')!;
    const details = fight.querySelector('.vc-fight-details')!;
    fight.classList.add('serving');
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    const service = wrap.firstElementChild!;
    details.append(service);
    reobserver.handleMutations([attrClass(fight)]);
    reobserver.handleMutations([childList(details, [service])]);
    reobserver.handleMutations([attrClass(fight)]);
    expect(sent).toHaveLength(1);
    flush(HOSPITAL_DEBOUNCE_MS);
    expect(sent).toHaveLength(2);
  });

  it('10. identical snapshot does not resend', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I', 'serving'));
    const details = doc.querySelector('.vc-fight-details')!;
    details.querySelector('.vc-status')!.textContent = 'Time Remaining: ';
    const wrap = doc.createElement('div');
    wrap.innerHTML = servingBlock('FixturePet01');
    details.append(wrap.firstElementChild!);
    const { reobserver, sent, flush } = startObserver(doc);
    const n = sent.length;
    reobserver.handleMutations([attrClass(doc.querySelector('.vc-fight')!)]);
    flush(HOSPITAL_DEBOUNCE_MS);
    expect(sent).toHaveLength(n);
    expect(
      hospitalSnapshotKey(sent[0]!) === hospitalSnapshotKey(sent[sent.length - 1]!),
    ).toBe(true);
  });

  it('11. pagehide/stop cancels pending debounce', () => {
    const doc = makeDoc(openCard('Battle for Brightvale I'));
    const { reobserver, sent, flush } = startObserver(doc);
    const fight = doc.querySelector('.vc-fight')!;
    fight.classList.add('serving');
    reobserver.handleMutations([attrClass(fight)]);
    reobserver.stop();
    flush(HOSPITAL_DEBOUNCE_MS);
    expect(sent).toHaveLength(1);
  });

  it('12. root-discovery fallback stops after max wait', () => {
    const doc = new JSDOM(
      `<!doctype html><body>${openCard('Battle for Brightvale I')}</body>`,
    ).window.document;
    const { sent, flush } = startObserver(doc);
    expect(sent).toHaveLength(1);
    flush(HOSPITAL_ROOT_DISCOVERY_MS + HOSPITAL_ROOT_DISCOVERY_INTERVAL_MS);
    expect(sent).toHaveLength(1);
  });
});
