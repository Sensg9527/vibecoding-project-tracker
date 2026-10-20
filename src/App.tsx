import { useEffect, useRef, useState } from 'react';
import AnchorBoard from './components/AnchorBoard';
import BoardColumn from './components/BoardColumn';
import ManualCopyDialog from './components/ManualCopyDialog';
import TaskModal from './components/TaskModal';
import TeamWorkload from './components/TeamWorkload';
import Toast from './components/Toast';
import { INITIAL_ANCHORS, STAGES } from './data/constants';
import { SEED_TASKS } from './data/seedTasks';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Anchor, ModalState, Task, TaskFormValues, TaskStatus } from './types/task';
import { normalizeAnchors } from './utils/anchorUtils';
import { copyTextToClipboard } from './utils/clipboardUtils';
import { sameLocalDay } from './utils/dueDateUtils';
import { formatTaskAsPrompt } from './utils/promptUtils';
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
 *   - M10 copy-prompt   : ✅ "Copy as Prompt Context" button + markdown serialization + clipboard.
 *   - M11 anchors       : ✅ the Deliverable Anchor Board (Presentation / Demo / Report / Documentation).
 *   - M12 secret-sauce  : the one open-ended thing that makes your tracker yours.
 *
 * Layout (M6 refactor):
 *   components/ (TaskCard, BoardColumn, TaskModal, AnchorBoard, Toast, TeamWorkload) · types/task
 *   hooks/useLocalStorage · data/ (constants, seedTasks) · utils/ (taskUtils, dueDateUtils, anchorUtils)
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

  // M11 anchors — the four deliverable slots, persisted under their own key
  // (stored data wins over the seeds). normalizeAnchors repairs incomplete or
  // hand-edited payloads so exactly the four locked slots always render and
  // unsafe stored URLs can never become clickable links.
  const [storedAnchors, setAnchors] = useLocalStorage<Anchor[]>('vibetracker.anchors', INITIAL_ANCHORS);
  const anchors = normalizeAnchors(storedAnchors);

  /** M11: save/overwrite one slot's URL — every other slot is untouched. */
  const handleAnchorSave = (id: Anchor['id'], url: string) => {
    setAnchors((prev) => normalizeAnchors(prev).map((a) => (a.id === id ? { ...a, url } : a)));
  };

  /** M11: clear one slot's URL (url → null); the slot itself stays pinned. */
  const handleAnchorRemove = (id: Anchor['id']) => {
    setAnchors((prev) => normalizeAnchors(prev).map((a) => (a.id === id ? { ...a, url: null } : a)));
  };

  // M10 copy-prompt: fallback dialog state — shown only when both clipboard
  // methods failed, so the markdown can still be copied by hand.
  const [manualCopy, setManualCopy] = useState<{ text: string } | null>(null);

  /**
   * M10: serialize the task into a markdown prompt and copy it. The task is
   * never modified. Success/failure toasts reuse the M7 Toast; a total
   * clipboard failure also opens the manual-copy dialog.
   */
  const handleCopyPrompt = async (task: Task) => {
    const markdown = formatTaskAsPrompt(task);
    const copied = await copyTextToClipboard(markdown);
    if (copied) {
      showToast('Context copied — ready to paste.');
    } else {
      showToast("Couldn't copy automatically. Select the text to copy manually.");
      setManualCopy({ text: markdown });
    }
  };

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

      {/* M11 anchors — the deliverable links pinned above the board. */}
      <AnchorBoard anchors={anchors} onSave={handleAnchorSave} onRemove={handleAnchorRemove} />

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
            onCopyPrompt={handleCopyPrompt}
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

      {manualCopy && <ManualCopyDialog text={manualCopy.text} onClose={() => setManualCopy(null)} />}

      {toast && <Toast key={toast.key} text={toast.text} />}
    </div>
  );
}
