import type { Task } from '../types/task';

/**
 * M12 drag & drop — per-column card ordering, kept OUT of the locked `Task`
 * model. A single global id list (`vibetracker.taskOrder`) defines every
 * column's order: each column renders its tasks sorted by their index in the
 * list, and tasks missing from the list keep their relative array order at
 * the bottom. All functions are pure so Node can unit-test them directly.
 */

/**
 * Insert `id` before `beforeId` (null/unknown = append at the end). Returns
 * the SAME array reference when the position is unchanged, so callers can
 * skip storage writes for no-op drops.
 */
export function insertTaskOrder(order: string[], id: string, beforeId: string | null): string[] {
  if (beforeId === id) return order; // dropped on itself — no change
  const next = order.filter((x) => x !== id);
  const idx = beforeId !== null ? next.indexOf(beforeId) : -1;
  if (idx === -1) {
    next.push(id);
  } else {
    next.splice(idx, 0, id);
  }
  const unchanged = next.length === order.length && next.every((v, i) => v === order[i]);
  return unchanged ? order : next;
}

/** Sort one column's tasks by their position in `order`; unordered tasks stay last. */
export function sortTasksForColumn(tasks: Task[], order: string[]): Task[] {
  const index = new Map(order.map((id, i) => [id, i]));
  return [...tasks].sort((a, b) => {
    const ia = index.get(a.id);
    const ib = index.get(b.id);
    if (ia === undefined && ib === undefined) return 0; // stable — array order kept
    if (ia === undefined) return 1;
    if (ib === undefined) return -1;
    return ia - ib;
  });
}

/** M12: new tasks get a consistent initial position — the top of their column. */
export function taskOrderForCreate(order: string[], id: string): string[] {
  return [id, ...order];
}

/** M12: deleting a task prunes its id so the stored list never grows stale ids. */
export function taskOrderForDelete(order: string[], id: string): string[] {
  return order.filter((x) => x !== id);
}

/** Repair hand-edited storage: keep only string ids, fall back to an empty list. */
export function normalizeTaskOrder(stored: unknown): string[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter((x): x is string => typeof x === 'string');
}
