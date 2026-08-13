import type { StorageArea } from '../../src/background/reminder-store.js';

export function createMemoryStorage(
  initial: Record<string, unknown> = {},
): StorageArea {
  const data = { ...initial };
  return {
    async get(keys) {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) {
        if (k in data) out[k] = data[k];
      }
      return out;
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
}
