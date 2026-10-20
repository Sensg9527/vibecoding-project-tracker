import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

/**
 * Vibecoding Project Tracker — starter scaffold (TypeScript).
 *
 * This file is intentionally almost empty. The boilerplate (Vite, React,
 * Tailwind) is configured for you, plus a few shared constants and a
 * localStorage helper. Everything visible on screen, you build.
 *
 * Where to start (build sequence in Phase 3):
 *   - M4  data-model    : render the four columns and the task cards below.
 *   - M5  crud-modal    : add the "+" button modal and the edit-on-click modal.
 *   - M6  tag-style     : feature vs. bug color coding (uses DESIGN.md §2 colors).
 *   - M7  task-owner    : assignee badge + "Hand off to..." dropdown.
 *   - M8  due-tint      : color cards by due date (uses DESIGN.md §2 due-state colors).
 *   - M9  context       : a curated Context briefing field on the modal.
 *   - M10 copy-prompt   : a "Copy as Prompt Context" button that serializes the task + context.
 *   - M11 anchors       : the Anchor Board above the Kanban.
 *   - M12 secret-sauce  : the one open-ended thing that makes your tracker yours.
 *
 * Search the file for `TODO M<n>` to find the right hook for each milestone.
 */

export type TaskType = 'feature' | 'bug';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

/**
 * A single vibecoding task. Mirrors PRD §5 — locked, do not change
 * without team agreement.
 */
export interface Task {
  id: string;                    // uuid or timestamp string
  title: string;
  description: string;
  type: TaskType;                // visual color coding
  status: TaskStatus;
  assignee: string;              // one of the three teammate names from PRD §8
  dueDate: string | null;        // ISO date 'YYYY-MM-DD'
  createdDate: string;           // ISO date 'YYYY-MM-DD'

  // TODO M9 context: add `context`, `contextTool`, `contextUpdatedAt` fields.
}

/** One of four pinned deliverable slots (M11). */
export interface Anchor {
  id: 'presentation' | 'demo' | 'report' | 'documentation';
  label: string;                 // human-readable
  url: string | null;            // the link the team pastes in
}

// The four columns of the board, in render order.
// Use these IDs everywhere — do not invent new ones.
export const STAGES: Array<{ id: TaskStatus; label: string }> = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Done' },
];

// Replace these placeholders with the three names from PRD §8 before M4.
// They become the only valid values for `Task.assignee`.
export const TEAM: string[] = ['Teammate A', 'Teammate B', 'Teammate C'];

/**
 * A tiny localStorage hook — survives reloads, no library needed.
 *
 * Usage:
 *   const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', []);
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private-mode error — silently ignore for hackathon */
    }
  }, [key, value]);

  return [value, setValue];
}

export default function App() {
  // TODO M4 data-model:
  //   const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', [/* 3-4 seed tasks */]);
  //
  // TODO M5 crud-modal:
  //   const [editing, setEditing] = useState<Task | null>(null);
  //
  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage<Anchor[]>('vibetracker.anchors', [...]);

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Vibecoding Project Tracker
          </h1>
          <p className="text-sm text-slate-500">
            {/* Replace this line with your team name from PRD §11. */}
            Team starter
          </p>
        </div>
      </header>

      {/* TODO M11 anchors: render the Anchor Board (Presentation / Demo / Report / Documentation) above the board. */}

      {/*
        TODO M4 data-model:
          Render a Kanban board with the four columns from STAGES.
          Each column should display the tasks whose status matches its id.
          Pre-populate 3-4 mock tasks so the board isn't empty on first load.

        TODO M5 crud-modal:
          Add a "+" button that opens a modal with every Task field.
          Clicking a card should open the same modal in edit mode.
      */}
      <main className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400">
        Build the four-column board here · M4
      </main>
    </div>
  );
}
