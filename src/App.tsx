import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

/**
 * Vibecoding Project Tracker — TypeScript scaffold.
 *
 * Build progress:
 *   - M4  data-model    : ✅ four-column board, status dropdown, seed tasks, localStorage.
 *   - M5  crud-modal    : add the "+" button modal and the edit-on-click modal.
 *   - M6  tag-style     : feature vs. bug color coding (uses DESIGN.md §2 colors).
 *   - M7  task-owner    : assignee badge + "Hand off to..." dropdown.
 *   - M8  due-tint      : color cards by due date (uses DESIGN.md §2 due-state colors).
 *   - M9  context       : a curated Context briefing field on the modal.
 *   - M10 copy-prompt   : a "Copy as Prompt Context" button that serializes the task + context.
 *   - M11 anchors       : the Anchor Board above the Kanban.
 *   - M12 secret-sauce  : the one open-ended thing that makes your tracker yours.
 */

export type TaskType = 'feature' | 'bug';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

/**
 * A single vibecoding task. Mirrors PRD §5 — locked, do not change
 * without team agreement. The `context*` fields are reserved for M9
 * and carry safe defaults until then.
 */
export interface Task {
  id: string;                    // uuid or timestamp string
  title: string;
  description: string;
  type: TaskType;                // visual color coding (M6)
  status: TaskStatus;
  assignee: string;              // one of the three TEAM values
  dueDate: string | null;        // ISO date 'YYYY-MM-DD'
  createdDate: string;           // ISO date 'YYYY-MM-DD'

  // M9 context — curated briefing for the next AI / reviewer.
  context: string;
  contextTool: string | null;    // 'Claude' | 'ChatGPT' | 'Cursor' | 'Lovable' | 'Replit' | 'Other'
  contextUpdatedAt: string | null; // ISO timestamp set automatically on save
}

/** One of four pinned deliverable slots. TODO M11 anchors. */
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

// The three demonstration assignee values from PRD §8.
// They are the only valid values for `Task.assignee`.
export const TEAM: string[] = ['Solo Developer', 'Demo Reviewer', 'Demo Designer'];

/**
 * A tiny localStorage hook — survives reloads, no library needed.
 *
 * Usage:
 *   const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', []);
 *
 * The stored value always wins over `initialValue`, so seed data is only
 * used when nothing has been saved yet.
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

// Four realistic demo tasks — one per stage — used only on the very first
// load. Once tasks exist in localStorage, they are never re-inserted.
const SEED_TASKS: Task[] = [
  {
    id: 'seed-prd-review',
    title: 'Complete the PRD review',
    description: 'Fill in the project identity and milestone ownership in PRD.md.',
    type: 'feature',
    status: 'done',
    assignee: 'Solo Developer',
    dueDate: null,
    createdDate: '2026-10-18',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
  {
    id: 'seed-design-tokens',
    title: 'Design system (DESIGN.md + tokens)',
    description: 'Pick palette, typography and microcopy, then paste the tokens into tailwind.config.js.',
    type: 'feature',
    status: 'review',
    assignee: 'Demo Reviewer',
    dueDate: '2026-10-20',
    createdDate: '2026-10-19',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
  {
    id: 'seed-token-bug',
    title: 'Bug: cards ignore the design tokens',
    description: 'Card colours fall back to default slate instead of the M3 tokens.',
    type: 'bug',
    status: 'in-progress',
    assignee: 'Solo Developer',
    dueDate: '2026-10-21',
    createdDate: '2026-10-20',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
  {
    id: 'seed-crud-modal',
    title: 'Add the task CRUD modal',
    description: 'Create, edit and delete tasks through a modal and persist to localStorage.',
    type: 'feature',
    status: 'todo',
    assignee: 'Solo Developer',
    dueDate: '2026-10-22',
    createdDate: '2026-10-20',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
];

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

/** A single task card. Status moves happen through the dropdown (M4); the modal opens here in M5. */
function TaskCard({ task, onStatusChange }: TaskCardProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-surface-card p-3 hover:shadow-sm">
      <h3 className="text-sm font-medium text-text-primary">{task.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{task.description}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          aria-label={`Status of "${task.title}"`}
          className="rounded border border-slate-300 bg-surface-card px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          {STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>{stage.label}</option>
          ))}
        </select>
        {task.dueDate && (
          <span className="text-xs text-text-muted">Due {task.dueDate}</span>
        )}
      </div>
    </article>
  );
}

interface BoardColumnProps {
  stage: (typeof STAGES)[number];
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
}

/** One Kanban column: heading, task count, and the cards whose status matches. */
function BoardColumn({ stage, tasks, onStatusChange }: BoardColumnProps) {
  return (
    <section aria-label={`${stage.label} column`} className="flex min-h-64 flex-col">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold uppercase tracking-wide text-text-primary">
          {stage.label}
        </h2>
        <span
          aria-label={`${tasks.length} tasks`}
          className="rounded-full border border-slate-200 bg-surface-card px-2 py-0.5 text-xs text-text-muted"
        >
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-slate-300 p-3 text-center text-xs text-text-muted">
            Nothing here yet — add a task to get started.
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </section>
  );
}

export default function App() {
  // Seed data only applies when nothing is stored yet (see useLocalStorage).
  const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', SEED_TASKS);

  // TODO M5 crud-modal:
  //   const [editing, setEditing] = useState<Task | null>(null);

  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage<Anchor[]>('vibetracker.anchors', [...]);

  /** Change a task's status; every other field is preserved. localStorage saves automatically. */
  const handleStatusChange = (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  return (
    <div className="min-h-screen bg-surface-page p-6 text-text-primary">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Vibecoding Project Tracker
          </h1>
          <p className="text-sm text-text-muted">
            Track tasks, preserve AI context, and keep projects moving.
          </p>
        </div>
        {/* TODO M5 crud-modal: the "+ Task" button lives here. */}
      </header>

      {/* TODO M11 anchors: render the Anchor Board (Presentation / Demo / Report / Documentation) above the board. */}

      <main className="grid grid-cols-4 items-start gap-4">
        {STAGES.map((stage) => (
          <BoardColumn
            key={stage.id}
            stage={stage}
            tasks={tasks.filter((t) => t.status === stage.id)}
            onStatusChange={handleStatusChange}
          />
        ))}
      </main>
    </div>
  );
}
