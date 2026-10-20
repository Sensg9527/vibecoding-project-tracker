import type { Task } from '../types/task';
// Explicit .ts extension: the file is also imported from Node's native
// type-stripping test runner, which (unlike Vite) does not resolve bare paths.
import { getDueState } from './dueDateUtils.ts';

/** The five numbers the Project Health dashboard shows. */
export interface ProjectHealthStats {
  total: number;
  completed: number;
  /** Rounded to the nearest whole percentage; 0 for an empty board (no ÷ 0). */
  completionPercentage: number;
  overdue: number;
  activeBugs: number;
}

/**
 * M12 secret-sauce — derive the project health numbers from the live task
 * list. Pure and deterministic (callers pass `today`); `overdue` reuses M8's
 * `getDueState` so the urgency rules are never duplicated here — a Done task
 * is 'neutral' even with a past due date, so Done tasks are excluded
 * automatically. `activeBugs` counts bug-type tasks that are not Done.
 */
export function calculateProjectHealth(tasks: Task[], today: Date = new Date()): ProjectHealthStats {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'done').length;
  const overdue = tasks.filter((t) => getDueState(t, today) === 'overdue').length;
  const activeBugs = tasks.filter((t) => t.type === 'bug' && t.status !== 'done').length;
  return {
    total,
    completed,
    completionPercentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    overdue,
    activeBugs,
  };
}
