import { useState } from 'react';
import BoardColumn from './components/BoardColumn';
import TaskModal from './components/TaskModal';
import { STAGES } from './data/constants';
import { SEED_TASKS } from './data/seedTasks';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { ModalState, Task, TaskFormValues, TaskStatus } from './types/task';
import { localTodayISO, makeId } from './utils/taskUtils';

/**
 * Vibecoding Project Tracker — TypeScript scaffold.
 *
 * Build progress:
 *   - M4  data-model    : ✅ four-column board, status dropdown, seed tasks, localStorage.
 *   - M5  crud-modal    : ✅ "+ Task" create modal, click-to-edit, delete with confirmation.
 *   - M6  tag-style     : ✅ feature vs. bug accent stripes + FEATURE/BUG badges (TaskCard), App split into modules.
 *   - M7  task-owner    : assignee badge + "Hand off to..." dropdown.
 *   - M8  due-tint      : color cards by due date (uses DESIGN.md §2 due-state colors).
 *   - M9  context       : a curated Context briefing field on the modal.
 *   - M10 copy-prompt   : a "Copy as Prompt Context" button that serializes the task + context.
 *   - M11 anchors       : the Anchor Board above the Kanban.
 *   - M12 secret-sauce  : the one open-ended thing that makes your tracker yours.
 *
 * Layout (M6 refactor):
 *   components/ (TaskCard, BoardColumn, TaskModal) · types/task · hooks/useLocalStorage
 *   data/ (constants, seedTasks) · utils/taskUtils
 */

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
