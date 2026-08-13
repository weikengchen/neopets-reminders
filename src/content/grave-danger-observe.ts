/**
 * Grave Danger first-parseable remaining wait.
 * Send/zero already navigate; only the first #gdRemaining write races idle.
 * No permanent observer. Never guesses a reminder on timeout.
 */
import type { GraveDangerParseResult } from '../parsers/grave-danger.js';
import { parseGraveDanger } from '../parsers/grave-danger.js';
import type { ActivityObservation } from '../shared/types.js';

/**
 * Page starts setInterval(timer, 1000) without an immediate tick.
 * 8s covers the nominal first write plus background-tab interval throttling.
 */
export const GD_WAIT_MAX_MS = 8000;
export const GD_POLL_MS = 250;

export type GraveDangerSend = (
  observations: ActivityObservation[],
  replaceScope: true,
) => void;

export type GraveDangerWaitDecision =
  | { type: 'send-once' }
  | { type: 'send-clear' }
  | { type: 'wait-for-remaining' }
  | { type: 'stop-no-guess' };

export function hasGraveDangerActiveShell(document: Document): boolean {
  return !!(
    document.querySelector('#gdAdventure') || document.querySelector('#gdActive')
  );
}

export function decideGraveDangerWait(
  result: GraveDangerParseResult,
  hasShell: boolean,
): GraveDangerWaitDecision {
  if (result.observations.length > 0) return { type: 'send-once' };
  if (result.shouldClearScope) return { type: 'send-clear' };
  if (hasShell || result.pageKind === 'active') return { type: 'wait-for-remaining' };
  return { type: 'stop-no-guess' };
}

export interface GraveDangerObserveHooks {
  parse?: typeof parseGraveDanger;
  send: GraveDangerSend;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (id: number) => void;
  MutationObserver?: typeof MutationObserver | undefined;
}

export class GraveDangerWaiter {
  private readonly parse: typeof parseGraveDanger;
  private readonly send: GraveDangerSend;
  private readonly now: () => number;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => number;
  private readonly clearTimeoutFn: (id: number) => void;
  private readonly ObserverCtor: typeof MutationObserver | undefined;

  private observer: MutationObserver | null = null;
  private pollId: number | undefined;
  private timeoutId: number | undefined;
  private stopped = false;
  private sent = false;

  constructor(hooks: GraveDangerObserveHooks) {
    this.parse = hooks.parse ?? parseGraveDanger;
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
    this.sent = false;
    const result = this.parse(document, this.now());
    const decision = decideGraveDangerWait(
      result,
      hasGraveDangerActiveShell(document),
    );

    if (decision.type === 'send-once') {
      this.finishSend(result.observations);
      return;
    }
    if (decision.type === 'send-clear') {
      this.finishSend([]);
      return;
    }
    if (decision.type === 'stop-no-guess') {
      this.stop();
      return;
    }
    this.armWait(document);
  }

  /** Test hook: one local re-read. */
  tick(document: Document): boolean {
    if (this.stopped || this.sent) return false;
    const result = this.parse(document, this.now());
    if (result.observations.length > 0) {
      this.finishSend(result.observations);
      return true;
    }
    return false;
  }

  stop(): void {
    this.stopped = true;
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollId !== undefined) {
      this.clearTimeoutFn(this.pollId);
      this.pollId = undefined;
    }
    if (this.timeoutId !== undefined) {
      this.clearTimeoutFn(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  get didSend(): boolean {
    return this.sent;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  private finishSend(observations: ActivityObservation[]): void {
    if (this.sent) return;
    this.sent = true;
    this.send(observations, true);
    this.stop();
  }

  private armWait(document: Document): void {
    const remaining = document.querySelector('#gdRemaining');
    if (remaining && this.ObserverCtor) {
      this.observer = new this.ObserverCtor(() => {
        this.tick(document);
      });
      this.observer.observe(remaining, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    const poll = (): void => {
      if (this.stopped || this.sent) return;
      this.tick(document);
      if (this.stopped || this.sent) return;
      this.pollId = this.setTimeoutFn(poll, GD_POLL_MS);
    };
    this.pollId = this.setTimeoutFn(poll, GD_POLL_MS);

    this.timeoutId = this.setTimeoutFn(() => {
      // Hard stop: do not invent a reminder
      this.stop();
    }, GD_WAIT_MAX_MS);
  }
}
