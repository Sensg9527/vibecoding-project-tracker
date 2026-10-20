import type { Task } from '../types/task';

/**
 * M8 due-tint — due-date urgency classification (DESIGN.md §2 tokens).
 * Pure logic kept out of the JSX so it can be unit-tested with a fixed clock.
 */

/** The five urgency states a card can be in. */
export type DueState = 'safe' | 'warning' | 'overdue' | 'neutral' | 'none';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse 'YYYY-MM-DD' as a LOCAL-midnight Date, or null when malformed.
 * Never parsed as UTC — date-only values compared in the user's timezone.
 */
function parseLocalDate(iso: string): Date | null {
  const m = DATE_RE.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  // The Date constructor silently rolls over impossible dates (2026-13-45) — reject those.
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Whole days from `a`'s local midnight to `b`'s local midnight.
 * Math.round absorbs the 23/25-hour days around DST transitions.
 */
export function dayDifference(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - aMid.getTime()) / 86_400_000);
}

/** True when both dates fall on the same local calendar day (App's re-render guard). */
export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * M8 due-tint — classify a task's urgency. Rules, in priority order:
 *   1. status === 'done'      → neutral   (Done overrides every due date)
 *   2. dueDate null/empty/malformed → none (no urgency indicator)
 *   3. due date before today  → overdue
 *   4. due today or tomorrow  → warning   (DUE SOON)
 *   5. due in 2+ days         → safe
 * `dueDate` is date-only, so it is compared against `today`'s LOCAL calendar
 * date (the "less than 24 hours" slide wording is interpreted as "due today
 * or tomorrow" to keep the thresholds deterministic for a date-only model).
 */
export function getDueState(
  task: Pick<Task, 'status' | 'dueDate'>,
  today: Date = new Date()
): DueState {
  if (task.status === 'done') return 'neutral';
  if (!task.dueDate) return 'none';
  const due = parseLocalDate(task.dueDate);
  if (due === null) return 'none';
  const diff = dayDifference(today, due);
  if (diff < 0) return 'overdue';
  if (diff <= 1) return 'warning';
  return 'safe';
}
