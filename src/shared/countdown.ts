/**
 * Minute-level friendly countdown (legacy / coarse UI).
 */
export function formatCountdown(dueAt: number, now: number): string {
  if (dueAt <= now) return 'Ready now';

  const remainingMs = dueAt - now;
  const totalMinutes = Math.ceil(remainingMs / 60_000);

  if (totalMinutes < 1) return 'Ready now';

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}

/**
 * Second-precise countdown that ticks down (floor remaining).
 * Examples: `4:33:10`, `12:05`, `0:09`
 */
export function formatCountdownPrecise(dueAt: number, now: number): string {
  if (dueAt <= now) return 'Ready now';

  let totalSec = Math.floor((dueAt - now) / 1000);
  if (totalSec < 0) totalSec = 0;

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) {
    return `${days}d ${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

export function formatObservedAt(observedAt: number, locale?: string): string {
  try {
    return new Date(observedAt).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return new Date(observedAt).toISOString();
  }
}
