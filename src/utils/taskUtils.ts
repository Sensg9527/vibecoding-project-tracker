/** A collision-safe unique id for new tasks; falls back if crypto.randomUUID is unavailable. */
export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Today's date as a local-time ISO string, e.g. '2026-10-20'. */
export function localTodayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * M7 task-owner — up to two uppercase initials for the assignee avatar,
 * e.g. 'Solo Developer' → 'SD'. Missing/blank names get a deterministic '?'.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
