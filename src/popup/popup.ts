/**
 * Popup UI — typed runtime messages only. No direct Neopets access.
 */
import type { PopupRequest, PopupResponse } from '../shared/messages.js';
import { formatCountdownPrecise } from '../shared/countdown.js';
import {
  KIND_LABELS,
  SCHOOL_LABELS,
  type ReminderRecord,
  type Settings,
} from '../shared/types.js';
import { canonicalUrlForKind } from '../shared/url-allowlist.js';

const banner = document.getElementById('banner') as HTMLParagraphElement;
const statusBanner = document.getElementById(
  'status-banner',
) as HTMLParagraphElement;
const trainingEnabled = document.getElementById(
  'training-enabled',
) as HTMLInputElement;
const notificationsEnabled = document.getElementById(
  'notifications-enabled',
) as HTMLInputElement;
const testBtn = document.getElementById('test-notification') as HTMLButtonElement;
const supportList = document.getElementById('support-list') as HTMLUListElement;
const readyList = document.getElementById('ready-list') as HTMLUListElement;
const upcomingList = document.getElementById('upcoming-list') as HTMLUListElement;
const otherList = document.getElementById('other-list') as HTMLUListElement;
const readyEmpty = document.getElementById('ready-empty') as HTMLParagraphElement;
const upcomingEmpty = document.getElementById(
  'upcoming-empty',
) as HTMLParagraphElement;
const otherEmpty = document.getElementById('other-empty') as HTMLParagraphElement;
const otherSection = document.getElementById(
  'other-heading',
)?.closest('section') as HTMLElement | null;
const globalEmpty = document.getElementById('global-empty') as HTMLParagraphElement;

let reminders: ReminderRecord[] = [];
let settings: Settings = {
  trainingEnabled: true,
  notificationsEnabled: true,
};
let clockSkew = 0;

function localNow(): number {
  return Date.now() + clockSkew;
}

function showBanner(text: string | null): void {
  if (!text) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }
  statusBanner.hidden = true;
  statusBanner.textContent = '';
  banner.hidden = false;
  banner.textContent = text;
}

function showStatus(text: string | null): void {
  if (!text) {
    statusBanner.hidden = true;
    statusBanner.textContent = '';
    return;
  }
  banner.hidden = true;
  banner.textContent = '';
  statusBanner.hidden = false;
  statusBanner.textContent = text;
}

function send<T extends PopupResponse>(msg: PopupRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: PopupResponse) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}

/** Primary title: pet only for training; battle name for hospital; activity for others. */
function cardTitle(r: ReminderRecord): string {
  if (r.kind === 'training') return r.subject;
  if (r.kind === 'hospital') {
    return r.contextLabel?.trim() || r.subject || KIND_LABELS.hospital;
  }
  if (r.kind === 'grave-danger') return KIND_LABELS['grave-danger'];
  if (r.kind === 'healing-springs') return KIND_LABELS['healing-springs'];
  if (r.kind === 'coltzan') return KIND_LABELS.coltzan;
  if (r.kind === 'expellibox') return KIND_LABELS.expellibox;
  return r.subject;
}

/** One short secondary line; omit noise. */
function cardMeta(r: ReminderRecord): string | null {
  if (r.kind === 'training' && r.school) {
    return SCHOOL_LABELS[r.school];
  }
  if (r.kind === 'hospital') {
    return KIND_LABELS.hospital;
  }
  return null;
}

function upcomingCountdown(r: ReminderRecord, t: number): string {
  const clock = formatCountdownPrecise(r.dueAt, t);
  if (clock === 'Ready now') return clock;
  if (r.kind === 'healing-springs' || r.activityStatus === 'cooldown') {
    return clock;
  }
  return clock;
}

function readyPhrase(r: ReminderRecord): string {
  if (r.timerQuality === 'estimate') return 'Possibly ready';
  return 'Ready now';
}

function renderSupport(): void {
  supportList.replaceChildren();
  const rows: [string, string][] = [
    ['Mystery Training', canonicalUrlForKind('training', 'mystery')],
    ['Pirate Training', canonicalUrlForKind('training', 'pirate')],
    ['Hospital Volunteer', canonicalUrlForKind('hospital')],
    ['Grave Danger', canonicalUrlForKind('grave-danger')],
    ['Healing Springs', canonicalUrlForKind('healing-springs')],
    ["Coltzan's Shrine", canonicalUrlForKind('coltzan')],
    ['Expellibox', canonicalUrlForKind('expellibox')],
  ];
  for (const [label, url] of rows) {
    const li = document.createElement('li');
    li.className = 'support-item';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'btn support-btn';
    open.textContent = label;
    open.addEventListener('click', () => {
      void send({ type: 'OPEN_URL', url }).then((res) => {
        if (res.type === 'ERROR') showBanner(res.message);
      });
    });
    li.append(open);
    supportList.appendChild(li);
  }
}

function renderLists(): void {
  const t = localNow();

  const ready = reminders
    .filter(
      (r) =>
        (r.activityStatus === 'ready' ||
          r.status === 'ready' ||
          (r.dueAt <= t && r.timerQuality !== 'none')) &&
        r.activityStatus !== 'available' &&
        r.activityStatus !== 'unsupported' &&
        r.activityStatus !== 'unknown',
    )
    .sort((a, b) => a.dueAt - b.dueAt);

  const upcoming = reminders
    .filter(
      (r) =>
        r.status === 'scheduled' &&
        r.dueAt > t &&
        (r.activityStatus === 'active' || r.activityStatus === 'cooldown'),
    )
    .sort((a, b) => a.dueAt - b.dueAt);

  // Hide sparse "other" noise by default (unsupported etc.)
  const other = reminders
    .filter(
      (r) =>
        (r.activityStatus === 'available' && r.kind === 'healing-springs') ||
        r.activityStatus === 'unknown',
    )
    .sort((a, b) => b.observedAt - a.observedAt);

  readyList.replaceChildren();
  upcomingList.replaceChildren();
  otherList.replaceChildren();

  for (const r of ready) readyList.appendChild(renderCard(r, t, 'ready'));
  for (const r of upcoming) upcomingList.appendChild(renderCard(r, t, 'upcoming'));
  for (const r of other) otherList.appendChild(renderCard(r, t, 'other'));

  readyEmpty.hidden = ready.length > 0;
  upcomingEmpty.hidden = upcoming.length > 0;
  otherEmpty.hidden = other.length > 0;
  if (otherSection) otherSection.hidden = other.length === 0;
  globalEmpty.hidden = reminders.length > 0;
}

function renderCard(
  record: ReminderRecord,
  t: number,
  mode: 'ready' | 'upcoming' | 'other',
): HTMLLIElement {
  const li = document.createElement('li');
  const isReadyish = mode === 'ready' || record.dueAt <= t;
  li.className = `reminder-card${isReadyish ? ' ready' : ''}`;
  li.dataset.id = record.id;

  const top = document.createElement('div');
  top.className = 'card-top';

  const textCol = document.createElement('div');
  textCol.className = 'card-top-text';

  const title = document.createElement('p');
  title.className = 'pet';
  title.textContent = cardTitle(record);

  const metaText = cardMeta(record);
  const meta = document.createElement('p');
  meta.className = 'meta';
  if (metaText) {
    meta.textContent = metaText;
  } else {
    meta.hidden = true;
  }

  textCol.append(title);
  if (!meta.hidden) textCol.append(meta);

  const actions = document.createElement('div');
  actions.className = 'icon-actions';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'icon-btn';
  openBtn.title = 'Open';
  openBtn.setAttribute('aria-label', 'Open');
  openBtn.textContent = '↗';
  openBtn.addEventListener('click', () => {
    void send({ type: 'OPEN_REMINDER', id: record.id }).then((res) => {
      if (res.type === 'ERROR') showBanner(res.message);
    });
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'icon-btn danger';
  removeBtn.title = 'Remove';
  removeBtn.setAttribute('aria-label', 'Remove');
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    void send({ type: 'REMOVE_REMINDER', id: record.id }).then(async (res) => {
      if (res.type === 'ERROR') {
        showBanner(res.message);
        return;
      }
      await loadState();
    });
  });

  actions.append(openBtn, removeBtn);
  top.append(textCol, actions);

  const status = document.createElement('p');
  status.className = 'status-text countdown';
  if (mode === 'upcoming') {
    status.textContent = upcomingCountdown(record, t);
  } else if (mode === 'ready') {
    status.textContent = readyPhrase(record);
  } else if (record.activityStatus === 'available') {
    status.textContent = 'Available';
  } else {
    status.textContent = 'Unknown';
  }
  status.setAttribute('aria-label', status.textContent);
  status.dataset.dueAt = String(record.dueAt);
  status.dataset.mode = mode;

  li.append(top, status);
  return li;
}

/** Tick only countdown text nodes — avoids full list rebuild flicker. */
function tickCountdowns(): void {
  const t = localNow();
  let needsFull = false;
  for (const el of document.querySelectorAll<HTMLElement>('.countdown[data-due-at]')) {
    const dueAt = Number(el.dataset.dueAt);
    const mode = el.dataset.mode;
    if (!Number.isFinite(dueAt) || mode !== 'upcoming') continue;
    if (dueAt <= t) {
      needsFull = true;
      continue;
    }
    el.textContent = formatCountdownPrecise(dueAt, t);
    el.setAttribute('aria-label', el.textContent);
  }
  if (needsFull) renderLists();
}

async function loadState(): Promise<void> {
  try {
    const res = await send<PopupResponse>({ type: 'GET_STATE' });
    if (res.type === 'ERROR') {
      showBanner(res.message);
      return;
    }
    if (res.type !== 'STATE') {
      showBanner('Unexpected response from extension.');
      return;
    }
    if (res.error) showBanner(res.error);
    else showBanner(null);

    reminders = res.reminders;
    settings = res.settings;
    clockSkew = res.now - Date.now();

    trainingEnabled.checked = settings.trainingEnabled;
    notificationsEnabled.checked = settings.notificationsEnabled;
    renderLists();
  } catch (err) {
    showBanner(err instanceof Error ? err.message : 'Failed to load state');
  }
}

trainingEnabled.addEventListener('change', () => {
  void send({
    type: 'UPDATE_SETTINGS',
    settings: { trainingEnabled: trainingEnabled.checked },
  }).then(async (res) => {
    if (res.type === 'ERROR') showBanner(res.message);
    await loadState();
  });
});

notificationsEnabled.addEventListener('change', () => {
  void send({
    type: 'UPDATE_SETTINGS',
    settings: { notificationsEnabled: notificationsEnabled.checked },
  }).then(async (res) => {
    if (res.type === 'ERROR') showBanner(res.message);
    await loadState();
  });
});

testBtn.addEventListener('click', () => {
  testBtn.disabled = true;
  void send({ type: 'TEST_NOTIFICATION' })
    .then((res) => {
      if (res.type === 'ERROR') {
        showBanner(res.message);
        return;
      }
      showStatus(
        'Test notification sent. If nothing appears, allow Chrome notifications in system settings.',
      );
    })
    .catch((err: unknown) => {
      showBanner(err instanceof Error ? err.message : 'Test notification failed');
    })
    .finally(() => {
      testBtn.disabled = false;
    });
});

renderSupport();
void loadState();
const refreshTimer = setInterval(() => {
  if (reminders.length) tickCountdowns();
}, 1000);

window.addEventListener('unload', () => {
  clearInterval(refreshTimer);
});
