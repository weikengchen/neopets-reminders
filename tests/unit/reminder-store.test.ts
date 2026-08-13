import { describe, expect, it } from 'vitest';
import { ReminderStore, STORAGE_KEY } from '../../src/background/reminder-store.js';
import { SchemaVersionError } from '../../src/shared/validation.js';
import type { ReminderRecord } from '../../src/shared/types.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';

const sample: ReminderRecord = {
  id: 'training:pirate:rex',
  kind: 'training',
  subject: 'Rex',
  school: 'pirate',
  observedAt: 1000,
  dueAt: 5000,
  status: 'scheduled',
  activityStatus: 'active',
  timerQuality: 'snapshot',
  parserVersion: 1,
  generation: 1,
};

describe('ReminderStore', () => {
  it('upserts and lists', async () => {
    const store = new ReminderStore(createMemoryStorage());
    await store.upsertReminder(sample);
    const list = await store.listReminders();
    expect(list).toHaveLength(1);
    expect(list[0]?.subject).toBe('Rex');
  });

  it('serializes concurrent mutations', async () => {
    const store = new ReminderStore(createMemoryStorage());
    await Promise.all([
      store.upsertReminder({ ...sample, id: 'training:pirate:a', subject: 'A' }),
      store.upsertReminder({ ...sample, id: 'training:pirate:b', subject: 'B' }),
      store.upsertReminder({ ...sample, id: 'training:pirate:c', subject: 'C' }),
    ]);
    const list = await store.listReminders();
    expect(list).toHaveLength(3);
  });

  it('remove deletes record', async () => {
    const store = new ReminderStore(createMemoryStorage());
    await store.upsertReminder(sample);
    await store.removeReminder(sample.id);
    expect(await store.listReminders()).toHaveLength(0);
  });

  it('update settings merges', async () => {
    const store = new ReminderStore(createMemoryStorage());
    await store.updateSettings({ notificationsEnabled: false });
    const s = await store.getSettings();
    expect(s.notificationsEnabled).toBe(false);
    expect(s.trainingEnabled).toBe(true);
  });

  it('refuses newer schema without overwrite', async () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: {
        schemaVersion: 9,
        reminders: { keep: true },
        settings: {},
      },
    });
    const store = new ReminderStore(storage);
    await expect(store.read()).rejects.toBeInstanceOf(SchemaVersionError);
    const raw = await storage.get(STORAGE_KEY);
    expect((raw[STORAGE_KEY] as { schemaVersion: number }).schemaVersion).toBe(9);
  });
});
