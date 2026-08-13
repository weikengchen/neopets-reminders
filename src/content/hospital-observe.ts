/**
 * Hospital Volunteer in-page re-observation.
 * Filtered MutationObserver on #VolunteerFightInfo; debounce + snapshot dedup.
 * Never fetches, clicks, or reloads.
 */
import { parseHospital } from '../parsers/hospital.js';
import type { ActivityObservation } from '../shared/types.js';

export const HOSPITAL_ROOT_SELECTOR = '#VolunteerFightInfo';
export const HOSPITAL_DEBOUNCE_MS = 400;
export const HOSPITAL_ROOT_DISCOVERY_MS = 4000;
export const HOSPITAL_ROOT_DISCOVERY_INTERVAL_MS = 250;

export type HospitalSend = (
  observations: ActivityObservation[],
  replaceScope: true,
) => void;

export interface HospitalObserveHooks {
  parse?: typeof parseHospital;
  send: HospitalSend;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (id: number) => void;
  MutationObserver?: typeof MutationObserver | undefined;
}

function asElement(node: Node | null): Element | null {
  if (!node || node.nodeType !== 1) return null;
  return node as Element;
}

function nodeInsideClock(node: Node | null): boolean {
  let el = asElement(node) ?? node?.parentElement ?? null;
  while (el) {
    if (el.classList.contains('vc-fight-time')) return true;
    el = el.parentElement;
  }
  return false;
}

function elementHasLifecycleClass(el: Element): boolean {
  return (
    el.classList.contains('vc-fight') ||
    el.classList.contains('vc-fight-details') ||
    el.classList.contains('vc-fight-service')
  );
}

export function isHospitalLifecycleMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    if (mutation.attributeName !== 'class') return false;
    const t = asElement(mutation.target);
    if (!t) return false;
    if (nodeInsideClock(t)) return false;
    return elementHasLifecycleClass(t);
  }

  if (mutation.type === 'characterData') {
    return !nodeInsideClock(mutation.target);
  }

  if (mutation.type === 'childList') {
    if (nodeInsideClock(mutation.target)) return false;
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (nodes.length === 0) return false;
    if (nodes.every((n) => nodeInsideClock(n))) return false;
    return true;
  }

  return false;
}

/** Stable fingerprint: ignore ticking dueAt so identical lifecycle states dedupe. */
export function hospitalSnapshotKey(
  observations: ActivityObservation[],
): string {
  const rows = observations
    .map((o) => `${o.idKey}|${o.activityStatus}|${o.status}|${o.timerQuality}`)
    .sort();
  return rows.join(';');
}

export class HospitalReobserver {
  private readonly parse: typeof parseHospital;
  private readonly send: HospitalSend;
  private readonly now: () => number;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => number;
  private readonly clearTimeoutFn: (id: number) => void;
  private readonly ObserverCtor: typeof MutationObserver | undefined;

  private observer: MutationObserver | null = null;
  private debounceId: number | undefined;
  private discoveryId: number | undefined;
  private lastKey: string | null = null;
  private stopped = false;
  private attached = false;
  private documentRef: Document | null = null;

  constructor(hooks: HospitalObserveHooks) {
    this.parse = hooks.parse ?? parseHospital;
    this.send = hooks.send;
    this.now = hooks.now ?? (() => Date.now());
    this.setTimeoutFn =
      hooks.setTimeout ??
      ((fn, ms) => window.setTimeout(fn, ms) as unknown as number);
    this.clearTimeoutFn =
      hooks.clearTimeout ?? ((id) => window.clearTimeout(id));
    this.ObserverCtor = hooks.MutationObserver ?? globalThis.MutationObserver;
  }

  start(document: Document): void {
    this.stopped = false;
    this.documentRef = document;
    const root = document.querySelector(HOSPITAL_ROOT_SELECTOR);
    if (root) {
      this.attach(root);
      this.emit(document, true);
      return;
    }

    // Fixtures / unexpected markup: still parse once, then bounded root wait
    this.emit(document, true);
    this.startRootDiscovery(document);
  }

  /** Test hook: feed mutations without a live observer. */
  handleMutations(mutations: MutationRecord[]): void {
    if (this.stopped) return;
    if (!mutations.some(isHospitalLifecycleMutation)) return;
    this.scheduleEmit();
  }

  stop(): void {
    this.stopped = true;
    this.observer?.disconnect();
    this.observer = null;
    this.attached = false;
    if (this.debounceId !== undefined) {
      this.clearTimeoutFn(this.debounceId);
      this.debounceId = undefined;
    }
    if (this.discoveryId !== undefined) {
      this.clearTimeoutFn(this.discoveryId);
      this.discoveryId = undefined;
    }
  }

  private attach(root: Element): void {
    if (this.attached || !this.ObserverCtor) return;
    this.observer = new this.ObserverCtor((mutations) => {
      this.handleMutations(mutations);
    });
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    this.attached = true;
  }

  private startRootDiscovery(document: Document): void {
    const began = this.now();
    const tick = (): void => {
      if (this.stopped || this.attached) return;
      const root = document.querySelector(HOSPITAL_ROOT_SELECTOR);
      if (root) {
        this.attach(root);
        this.emit(document, false);
        return;
      }
      if (this.now() - began >= HOSPITAL_ROOT_DISCOVERY_MS) {
        return;
      }
      this.discoveryId = this.setTimeoutFn(tick, HOSPITAL_ROOT_DISCOVERY_INTERVAL_MS);
    };
    this.discoveryId = this.setTimeoutFn(tick, HOSPITAL_ROOT_DISCOVERY_INTERVAL_MS);
  }

  private scheduleEmit(): void {
    if (this.debounceId !== undefined) {
      this.clearTimeoutFn(this.debounceId);
    }
    this.debounceId = this.setTimeoutFn(() => {
      this.debounceId = undefined;
      if (this.documentRef) this.emit(this.documentRef, false);
    }, HOSPITAL_DEBOUNCE_MS);
  }

  /** Exposed for tests that own the Document. */
  emit(document: Document, force: boolean): void {
    if (this.stopped) return;
    const { observations } = this.parse(document, this.now());
    const key = hospitalSnapshotKey(observations);
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.send(observations, true);
  }
}
