import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type SyntheticEvent } from 'react';

/**
 * Vibecoding Project Tracker — TypeScript scaffold.
 *
 * Build progress:
 *   - M4  data-model    : ✅ four-column board, status dropdown, seed tasks, localStorage.
 *   - M5  crud-modal    : ✅ "+ Task" create modal, click-to-edit, delete with confirmation.
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

/** A collision-safe unique id for new tasks; falls back if crypto.randomUUID is unavailable. */
function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Today's date as a local-time ISO string, e.g. '2026-10-20'. */
function localTodayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
}

/**
 * A single task card. Status moves happen through the dropdown (M4);
 * clicking the card (or pressing Enter/Space on it) opens the edit modal (M5).
 */
function TaskCard({ task, onStatusChange, onOpen }: TaskCardProps) {
  const handleOpen = () => onOpen(task);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Edit task "${task.title}"`}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      className="cursor-pointer rounded-md border border-slate-200 bg-surface-card p-3 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      <h3 className="text-sm font-medium text-text-primary">{task.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{task.description}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
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
  onOpenTask: (task: Task) => void;
  /** Only the To Do column gets the "+ Task" button (M5). */
  onAddTask?: () => void;
}

/** One Kanban column: heading, optional "+ Task" button, task count, and the matching cards. */
function BoardColumn({ stage, tasks, onStatusChange, onOpenTask, onAddTask }: BoardColumnProps) {
  return (
    <section aria-label={`${stage.label} column`} className="flex min-h-64 flex-col">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold uppercase tracking-wide text-text-primary">
          {stage.label}
        </h2>
        <div className="flex items-center gap-2">
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="rounded bg-brand-primary px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              + Task
            </button>
          )}
          <span
            aria-label={`${tasks.length} tasks`}
            className="rounded-full border border-slate-200 bg-surface-card px-2 py-0.5 text-xs text-text-muted"
          >
            {tasks.length}
          </span>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-slate-300 p-3 text-center text-xs text-text-muted">
            Nothing here yet — add a task to get started.
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onOpen={onOpenTask} />
          ))
        )}
      </div>
    </section>
  );
}

/** The values the task modal collects. Model fields (id, createdDate, context*) are handled by App. */
interface TaskFormValues {
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  assignee: string;
  dueDate: string | null;
}

/** Modal state: closed (null), create mode (task null + initialStatus), or edit mode (task set). */
interface ModalState {
  task: Task | null;
  initialStatus: TaskStatus;
}

interface TaskModalProps {
  task: Task | null; // null = create mode
  initialStatus: TaskStatus;
  onSave: (values: TaskFormValues) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * The M5 create/edit modal (DESIGN.md §4: centred dialog, dimmed backdrop,
 * distinct Save/Cancel). Closes via Cancel, the ✕ icon, Escape or backdrop click.
 */
function TaskModal({ task, initialStatus, onSave, onDelete, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [type, setType] = useState<TaskType>(task?.type ?? 'feature');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus);
  const [assignee, setAssignee] = useState(task?.assignee ?? TEAM[0]);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes; body scroll locks while open; focus returns to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);

  // Tab / Shift+Tab cycle inside the dialog so keyboard focus never lands on the page behind it.
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, []);

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a task title.');
      return;
    }
    onSave({
      title: trimmedTitle,
      description: description.trim(),
      type,
      status,
      assignee,
      dueDate: dueDate || null,
    });
  };

  const handleDelete = () => {
    // DESIGN.md §5 microcopy.
    if (task && window.confirm("Delete this task? This can't be undone.")) {
      onDelete(task.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="task-modal-title" className="text-lg font-semibold text-text-primary">
            {task ? 'Edit task' : 'New task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 leading-none text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1 block text-xs font-medium text-text-primary">
              Title <span className="text-type-bug" aria-hidden="true">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Polish the demo script"
              className="w-full rounded border border-slate-300 bg-surface-card px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-type-bug">{error}</p>
            )}
          </div>

          <div>
            <label htmlFor="task-description" className="mb-1 block text-xs font-medium text-text-primary">
              Description
            </label>
            <textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to happen?"
              className="w-full resize-y rounded border border-slate-300 bg-surface-card px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-type" className="mb-1 block text-xs font-medium text-text-primary">Type</label>
              <select
                id="task-type"
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full rounded border border-slate-300 bg-surface-card px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-status" className="mb-1 block text-xs font-medium text-text-primary">Status</label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded border border-slate-300 bg-surface-card px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-assignee" className="mb-1 block text-xs font-medium text-text-primary">Assignee</label>
              <select
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded border border-slate-300 bg-surface-card px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {TEAM.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-due" className="mb-1 block text-xs font-medium text-text-primary">
                Due date <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-slate-300 bg-surface-card px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          {task ? (
            <p className="text-xs text-text-muted">Created {task.createdDate}</p>
          ) : (
            <p className="text-xs text-text-muted">Created date is set automatically.</p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            {task ? (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded bg-type-bug px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-type-bug focus-visible:ring-offset-2"
              >
                Delete Task
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                {task ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // Seed data only applies when nothing is stored yet (see useLocalStorage).
  const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', SEED_TASKS);

  // M5 crud-modal: null = closed, task null = create mode, task set = edit mode.
  const [modal, setModal] = useState<ModalState | null>(null);

  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage<Anchor[]>('vibetracker.anchors', [...]);

  /** Change a task's status; every other field is preserved. localStorage saves automatically. */
  const handleStatusChange = (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  /** M5: save a create/edit — builds the model fields on create, preserves id + createdDate on edit. */
  const handleSaveTask = (values: TaskFormValues) => {
    if (modal?.task) {
      const id = modal.task.id;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...values } : t)));
    } else {
      const task: Task = {
        id: makeId(),
        createdDate: localTodayISO(),
        ...values,
        // M9 context fields — safe defaults until the context editor lands.
        context: '',
        contextTool: null,
        contextUpdatedAt: null,
      };
      setTasks((prev) => [...prev, task]);
    }
    setModal(null);
  };

  /** M5: remove a task; the confirmation happens inside the modal (DESIGN.md §5 microcopy). */
  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setModal(null);
  };

  const handleOpenTask = (task: Task) => setModal({ task, initialStatus: task.status });
  const handleAddTask = () => setModal({ task: null, initialStatus: 'todo' });

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
        {/* The "+ Task" button lives in the To Do column header (M5). */}
      </header>

      {/* TODO M11 anchors: render the Anchor Board (Presentation / Demo / Report / Documentation) above the board. */}

      <main className="grid grid-cols-4 items-start gap-4">
        {STAGES.map((stage) => (
          <BoardColumn
            key={stage.id}
            stage={stage}
            tasks={tasks.filter((t) => t.status === stage.id)}
            onStatusChange={handleStatusChange}
            onOpenTask={handleOpenTask}
            onAddTask={stage.id === 'todo' ? handleAddTask : undefined}
          />
        ))}
      </main>

      {modal && (
        <TaskModal
          task={modal.task}
          initialStatus={modal.initialStatus}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
