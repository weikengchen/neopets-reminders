import type { AlarmInfo, AlarmsApi } from '../../src/background/alarm-reconciler.js';
import type {
  NotificationsApi,
  TabsApi,
} from '../../src/background/notifications.js';

export function createFakeAlarms(): AlarmsApi & {
  alarms: Map<string, AlarmInfo>;
} {
  const alarms = new Map<string, AlarmInfo>();
  return {
    alarms,
    async getAll() {
      return [...alarms.values()];
    },
    async create(name, info) {
      alarms.set(name, { name, scheduledTime: info.when });
    },
    async clear(name) {
      return alarms.delete(name);
    },
  };
}

export function createFakeNotifications(): NotificationsApi & {
  created: { id: string; options: unknown }[];
  cleared: string[];
  failNext?: boolean;
} {
  const api = {
    created: [] as { id: string; options: unknown }[],
    cleared: [] as string[],
    failNext: false,
    async create(id: string, options: unknown) {
      if (api.failNext) {
        api.failNext = false;
        throw new Error('Notification permission denied');
      }
      // replace existing with same id
      api.created = api.created.filter((c) => c.id !== id);
      api.created.push({ id, options });
      return id;
    },
    async clear(id: string) {
      api.cleared.push(id);
      api.created = api.created.filter((c) => c.id !== id);
      return true;
    },
  };
  return api;
}

export function createFakeTabs(): TabsApi & { opened: string[] } {
  const opened: string[] = [];
  return {
    opened,
    async create(props) {
      opened.push(props.url);
      return { id: opened.length };
    },
  };
}
