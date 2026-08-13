import {
  createDefaultState,
  type ReminderRecord,
  type Settings,
  type StoredStateV1,
} from '../shared/types.js';
import {
  parseStoredState,
  SchemaVersionError,
  validateSettings,
} from '../shared/validation.js';

export const STORAGE_KEY = 'neoState';

export interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type StoreListener = (state: StoredStateV1) => void;

/**
 * chrome.storage.local adapter with schema validation, safe defaults,
 * and a serialized read-modify-write queue for one worker lifetime.
 */
export class ReminderStore {
  private queue: Promise<unknown> = Promise.resolve();
  private schemaBlocked = false;
  private schemaError: SchemaVersionError | null = null;

  constructor(private readonly storage: StorageArea) {}

  get isSchemaBlocked(): boolean {
    return this.schemaBlocked;
  }

  get lastSchemaError(): SchemaVersionError | null {
    return this.schemaError;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async read(): Promise<StoredStateV1> {
    return this.enqueue(async () => this.readUnlocked());
  }

  private async readUnlocked(): Promise<StoredStateV1> {
    if (this.schemaBlocked && this.schemaError) {
      throw this.schemaError;
    }
    try {
      const raw = await this.storage.get(STORAGE_KEY);
      const blob = raw[STORAGE_KEY];
      return parseStoredState(blob);
    } catch (err) {
      if (err instanceof SchemaVersionError) {
        this.schemaBlocked = true;
        this.schemaError = err;
        console.error('[neopets-reminders]', err.message);
        throw err;
      }
      console.error('[neopets-reminders] storage read failed; using defaults', err);
      return createDefaultState();
    }
  }

  private async writeUnlocked(state: StoredStateV1): Promise<void> {
    if (this.schemaBlocked) {
      throw this.schemaError ?? new SchemaVersionError(-1);
    }
    await this.storage.set({ [STORAGE_KEY]: state });
  }

  async listReminders(): Promise<ReminderRecord[]> {
    const state = await this.read();
    return Object.values(state.reminders);
  }

  async getReminder(id: string): Promise<ReminderRecord | undefined> {
    const state = await this.read();
    return state.reminders[id];
  }

  async getSettings(): Promise<Settings> {
    const state = await this.read();
    return state.settings;
  }

  async upsertReminder(record: ReminderRecord): Promise<StoredStateV1> {
    return this.enqueue(async () => {
      const state = await this.readUnlocked();
      state.reminders[record.id] = record;
      await this.writeUnlocked(state);
      return state;
    });
  }

  async removeReminder(id: string): Promise<{ removed: ReminderRecord | undefined; state: StoredStateV1 }> {
    return this.enqueue(async () => {
      const state = await this.readUnlocked();
      const removed = state.reminders[id];
      if (removed) {
        delete state.reminders[id];
        await this.writeUnlocked(state);
      }
      return { removed, state };
    });
  }

  async updateSettings(partial: Partial<Settings>): Promise<StoredStateV1> {
    return this.enqueue(async () => {
      const state = await this.readUnlocked();
      state.settings = validateSettings({ ...state.settings, ...partial });
      await this.writeUnlocked(state);
      return state;
    });
  }

  async replaceState(mutator: (state: StoredStateV1) => StoredStateV1 | void): Promise<StoredStateV1> {
    return this.enqueue(async () => {
      const state = await this.readUnlocked();
      const next = mutator(state) ?? state;
      await this.writeUnlocked(next);
      return next;
    });
  }

  async mutate(
    mutator: (state: StoredStateV1) => void | Promise<void>,
  ): Promise<StoredStateV1> {
    return this.enqueue(async () => {
      const state = await this.readUnlocked();
      await mutator(state);
      await this.writeUnlocked(state);
      return state;
    });
  }
}

export function chromeStorageAdapter(): StorageArea {
  return {
    async get(keys) {
      return chrome.storage.local.get(keys ?? null) as Promise<Record<string, unknown>>;
    },
    async set(items) {
      await chrome.storage.local.set(items);
    },
  };
}
