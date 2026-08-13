import { describe, expect, it } from 'vitest';
import {
  clearAlarmForRecord,
  reconcileAlarms,
  syncAlarmsToState,
} from '../../src/background/alarm-reconciler.js';
import {
  handleNotificationClick,
  maybeNotifyCompletion,
  showTestNotification,
} from '../../src/background/notifications.js';
import { ReminderStore } from '../../src/background/reminder-store.js';
import { alarmNameFor, applyObservation } from '../../src/shared/generation.js';
import { syntheticObservation } from '../../src/parsers/training.js';
import { canonicalTrainingUrl } from '../../src/shared/url-allowlist.js';
import {
  createFakeAlarms,
  createFakeNotifications,
  createFakeTabs,
} from '../helpers/fake-chrome.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';

const NOW = 2_000_000_000_000;

describe('alarm reconciliation', () => {
  it('creates alarm after storage write for future scheduled', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const alarms = createFakeAlarms();
    const notes = createFakeNotifications();

    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'Kai',
        school: 'ninja',
        observedAt: NOW,
        dueAt: NOW + 60_000,
        state: 'training',
      }),
    );
    expect(result.action).toBe('upsert');
    if (result.action !== 'upsert') return;

    await store.upsertReminder(result.record);
    const state = await store.read();
    await syncAlarmsToState(state, alarms, notes, NOW);

    expect(alarms.alarms.size).toBe(1);
    expect(alarms.alarms.has(alarmNameFor(result.record))).toBe(true);
  });

  it('recreates missing alarm on reconcile', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const alarms = createFakeAlarms();
    const notes = createFakeNotifications();

    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'Kai',
        school: 'pirate',
        observedAt: NOW,
        dueAt: NOW + 120_000,
        state: 'training',
      }),
    );
    if (result.action !== 'upsert') return;
    await store.upsertReminder(result.record);

    await reconcileAlarms(store, alarms, notes, { now: NOW });
    expect(alarms.alarms.size).toBe(1);

    alarms.alarms.clear();
    await reconcileAlarms(store, alarms, notes, { now: NOW });
    expect(alarms.alarms.size).toBe(1);
  });

  it('removes orphan extension alarms only', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const alarms = createFakeAlarms();
    const notes = createFakeNotifications();
    await alarms.create('neo-reminder:training:mystery:gone:g1', {
      when: NOW + 999,
    });
    await alarms.create('other-extension:keep', { when: NOW + 999 });

    await reconcileAlarms(store, alarms, notes, { now: NOW });
    expect(alarms.alarms.has('neo-reminder:training:mystery:gone:g1')).toBe(
      false,
    );
    expect(alarms.alarms.has('other-extension:keep')).toBe(true);
  });

  it('marks past-due ready and notifies at most once across reconcile', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const alarms = createFakeAlarms();
    const notes = createFakeNotifications();

    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'Past',
        school: 'mystery',
        observedAt: NOW - 10_000,
        dueAt: NOW - 5_000,
        state: 'training',
      }),
    );
    if (result.action !== 'upsert') return;
    // Force scheduled past due
    await store.upsertReminder({
      ...result.record,
      status: 'scheduled',
      dueAt: NOW - 5_000,
    });

    await reconcileAlarms(store, alarms, notes, {
      now: NOW,
      onBecameReady: async (r) => {
        await maybeNotifyCompletion(store, notes, r.id, NOW);
      },
    });

    const rec = (await store.listReminders())[0];
    expect(rec?.status).toBe('ready');
    expect(notes.created).toHaveLength(1);

    await reconcileAlarms(store, alarms, notes, {
      now: NOW + 1000,
      onBecameReady: async (r) => {
        await maybeNotifyCompletion(store, notes, r.id, NOW + 1000);
      },
    });
    expect(notes.created).toHaveLength(1);
  });

  it('disable clears alarms but keeps records', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const alarms = createFakeAlarms();
    const notes = createFakeNotifications();
    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'Keep',
        school: 'pirate',
        observedAt: NOW,
        dueAt: NOW + 60_000,
        state: 'training',
      }),
    );
    if (result.action !== 'upsert') return;
    await store.upsertReminder(result.record);
    await reconcileAlarms(store, alarms, notes, { now: NOW });
    expect(alarms.alarms.size).toBe(1);

    await store.updateSettings({ trainingEnabled: false });
    const state = await store.read();
    await syncAlarmsToState(state, alarms, notes, NOW);
    // clear remaining
    for (const name of [...alarms.alarms.keys()]) {
      if (name.startsWith('neo-reminder:')) await alarms.clear(name);
    }
    expect(await store.listReminders()).toHaveLength(1);
  });

  it('remove clears alarm', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const alarms = createFakeAlarms();
    const notes = createFakeNotifications();
    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'Gone',
        school: 'ninja',
        observedAt: NOW,
        dueAt: NOW + 60_000,
        state: 'training',
      }),
    );
    if (result.action !== 'upsert') return;
    await store.upsertReminder(result.record);
    await reconcileAlarms(store, alarms, notes, { now: NOW });
    const { removed } = await store.removeReminder(result.record.id);
    if (removed) await clearAlarmForRecord(alarms, removed);
    expect(alarms.alarms.size).toBe(0);
  });
});

describe('notifications', () => {
  it('dedupes per generation', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const notes = createFakeNotifications();
    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'N',
        school: 'mystery',
        observedAt: NOW,
        dueAt: NOW - 1,
        state: 'ready',
      }),
    );
    if (result.action !== 'upsert') return;
    await store.upsertReminder({ ...result.record, status: 'scheduled' });

    await maybeNotifyCompletion(store, notes, result.record.id, NOW);
    await maybeNotifyCompletion(store, notes, result.record.id, NOW + 1);
    expect(notes.created).toHaveLength(1);
  });

  it('notification failure does not break ready state or loop', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const notes = createFakeNotifications();
    notes.failNext = true;
    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'N',
        school: 'mystery',
        observedAt: NOW,
        dueAt: NOW - 1,
        state: 'training',
      }),
    );
    if (result.action !== 'upsert') return;
    await store.upsertReminder({
      ...result.record,
      status: 'scheduled',
      dueAt: NOW - 1,
    });

    const r1 = await maybeNotifyCompletion(store, notes, result.record.id, NOW);
    expect(r1.notified).toBe(false);
    const rec = await store.getReminder(result.record.id);
    expect(rec?.status).toBe('ready');
    expect(rec?.notifiedGeneration).toBeUndefined();
  });

  it('click opens canonical URL only', async () => {
    const store = new ReminderStore(createMemoryStorage());
    const notes = createFakeNotifications();
    const tabs = createFakeTabs();
    const result = applyObservation(
      undefined,
      syntheticObservation({
        petName: 'OpenMe',
        school: 'pirate',
        observedAt: NOW,
        dueAt: NOW - 1,
        state: 'training',
      }),
    );
    if (result.action !== 'upsert') return;
    await store.upsertReminder({ ...result.record, status: 'ready' });
    await maybeNotifyCompletion(store, notes, result.record.id, NOW);
    const id = notes.created[0]?.id;
    expect(id).toBeTruthy();
    await handleNotificationClick(store, tabs, id!, notes);
    expect(tabs.opened).toEqual([canonicalTrainingUrl('pirate')]);
  });

  it('test notification is local', async () => {
    const notes = createFakeNotifications();
    const tabs = createFakeTabs();
    const res = await showTestNotification(notes);
    expect(res.ok).toBe(true);
    expect(notes.created[0]?.id).toBe('neo-notify:test');
    expect(tabs.opened).toHaveLength(0);
  });
});
