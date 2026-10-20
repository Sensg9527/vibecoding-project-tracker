import { useEffect, useRef, useState } from 'react';
import BoardColumn from './components/BoardColumn';
import TaskModal from './components/TaskModal';
import TeamWorkload from './components/TeamWorkload';
import Toast from './components/Toast';
import { STAGES } from './data/constants';
import { SEED_TASKS } from './data/seedTasks';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { ModalState, Task, TaskFormValues, TaskStatus } from './types/task';
import { sameLocalDay } from './utils/dueDateUtils';
import { localTodayISO, makeId } from './utils/taskUtils';

/**
 * Vibecoding Project Tracker — TypeScript scaffold.
 *
 * Build progress:
 *   - M4  data-model    : ✅ four-column board, status dropdown, seed tasks, localStorage.
 *   - M5  crud-modal    : ✅ "+ Task" create modal, click-to-edit, delete with confirmation.
 *   - M6  tag-style     : ✅ feature vs. bug accent stripes + FEATURE/BUG badges (TaskCard), App split into modules.
 *   - M7  task-owner    : ✅ avatar + name on every card, "Hand off to" dropdown, toast, workload strip.
 *   - M8  due-tint      : ✅ urgency tints + labels by due date (utils/dueDateUtils).
 *   - M9  context       : ✅ AI Context section on the modal (markdown, AI Tool, auto timestamp).
 *   - M10 copy-prompt   : a "Copy as Prompt Context" button that serializes the task + context.
 *   - M11 anchors       : the Anchor Board above the Kanban.
 *   - M12 secret-sauce  : the one open-ended thing that makes your tracker yours.
 *
 * Layout (M6 refactor):
 *   components/ (TaskCard, BoardColumn, TaskModal, Toast, TeamWorkload) · types/task
 *   hooks/useLocalStorage · data/ (constants, seedTasks) · utils/ (taskUtils, dueDateUtils)
 */

export default function App() {
  // Seed data only applies when nothing is stored yet (see useLocalStorage).
  const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', SEED_TASKS);

  // M5 crud-modal: null = closed, task null = create mode, task set = edit mode.
  const [modal, setModal] = useState<ModalState | null>(null);

  // M7 task-owner: transient toast ("Assigned to {name}."). The `key` re-mounts
  // the node so the 200 ms fade replays; the timer auto-dismisses after ~2.5 s.
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (text: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ text, key: Date.now() });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  };
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  // M8 due-tint: keep "today" fresh so urgency tints follow the calendar while
  // the app stays open — a light 60 s check plus a re-check when the tab gets
  // focus/visible again (e.g. after a laptop sleeps past midnight). The state
  // only changes when the local calendar day actually changed.
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const refreshToday = () => {
      const now = new Date();
      setToday((prev) => (sameLocalDay(prev, now) ? prev : now));
    };
    const timer = window.setInterval(refreshToday, 60_000);
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, []);

  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage<Anchor[]>('vibetracker.anchors', [...]);

  /** Change a task's status; every other field is preserved. localStorage saves automatically. */
  const handleStatusChange = (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  /** M7: reassign ownership from the card's "Hand off to" dropdown — only `assignee` changes. */
  const handleAssigneeChange = (id: string, assignee: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, assignee } : t)));
    showToast(`Assigned to ${assignee}.`);
  };

  /**
   * M5/M9: save a create/edit — builds the model fields on create, preserves
   * id + createdDate on edit. M9: `contextUpdatedAt` is set automatically
   * whenever `context` or `contextTool` changed, and left untouched when only
   * unrelated fields (title, status, …) changed.
   */
  const handleSaveTask = (values: TaskFormValues) => {
    if (modal?.task) {
      const id = modal.task.id;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...values,
                contextUpdatedAt:
                  values.context !== t.context || values.contextTool !== t.contextTool
                    ? new Date().toISOString()
                    : t.contextUpdatedAt,
              }
            : t
        )
      );
    } else {
      const hasContext = values.context.trim() !== '' || values.contextTool !== null;
      const task: Task = {
        id: makeId(),
        createdDate: localTodayISO(),
        ...values,
        contextUpdatedAt: hasContext ? new Date().toISOString() : null,
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

      {/* M7 task-owner (optional): active-task counts per demo role. */}
      <TeamWorkload tasks={tasks} />

      <main className="grid grid-cols-4 items-start gap-4">
        {STAGES.map((stage) => (
          <BoardColumn
            key={stage.id}
            stage={stage}
            tasks={tasks.filter((t) => t.status === stage.id)}
            today={today}
            onStatusChange={handleStatusChange}
            onAssigneeChange={handleAssigneeChange}
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

      {toast && <Toast key={toast.key} text={toast.text} />}
    </div>
  );
}
