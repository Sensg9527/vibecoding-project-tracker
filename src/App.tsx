import { useEffect, useRef, useState, type DragEvent } from 'react';
import AnchorBoard from './components/AnchorBoard';
import BoardColumn, { type DropSlot } from './components/BoardColumn';
import LoginPage from './components/LoginPage';
import ManualCopyDialog from './components/ManualCopyDialog';
import ProjectHealth from './components/ProjectHealth';
import TaskModal from './components/TaskModal';
import TeamWorkload from './components/TeamWorkload';
import Toast from './components/Toast';
import { DEMO_SESSION_KEY, INITIAL_ANCHORS, STAGES, TASK_ORDER_KEY } from './data/constants';
import { SEED_TASKS } from './data/seedTasks';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Anchor, ModalState, Task, TaskFormValues, TaskStatus } from './types/task';
import { normalizeAnchors } from './utils/anchorUtils';
import { copyTextToClipboard } from './utils/clipboardUtils';
import { recordDragEnd } from './utils/dragGuard';
import { sameLocalDay } from './utils/dueDateUtils';
import { formatTaskAsPrompt } from './utils/promptUtils';
import {
  insertTaskOrder,
  normalizeTaskOrder,
  sortTasksForColumn,
  taskOrderForCreate,
  taskOrderForDelete,
} from './utils/taskOrderUtils';
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
 *   - M12 secret-sauce  : ✅ Project Health dashboard (live, collapsible stats) + demo login (userdemo/userdemo, Continue as Demo).
 *   - M12 drag-and-drop : ✅ drag cards between columns + reorder within columns by dragging anywhere on the card (grip is the visual affordance), ordered by `vibetracker.taskOrder`.
 *
 * Layout (M6 refactor):
 *   components/ (TaskCard, BoardColumn, TaskModal, AnchorBoard, LoginPage, ProjectHealth, Toast, TeamWorkload) · types/task
 *   hooks/useLocalStorage · data/ (constants, seedTasks) · utils/ (taskUtils, dueDateUtils, anchorUtils, projectHealthUtils)
 */

export default function App() {
  // M12 secret-sauce: the demo session flag lives in sessionStorage (tab-scoped
  // — it survives a refresh but not a closed tab). Only the flag is stored,
  // never the demo password. null = show the login page.
  const [demoSession, setDemoSession] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(DEMO_SESSION_KEY);
    } catch {
      return null;
    }
  });

  /** M12: record the demo session (Sign In or Continue as Demo both land here). */
  const handleDemoLogin = () => {
    try {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, 'demo');
    } catch {
      /* private-mode storage error — the in-memory state still grants this tab */
    }
    setDemoSession('demo');
  };

  /** M12: end the session — clears only the flag; tasks and anchors are untouched. */
  const handleLogout = () => {
    try {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* ignore */
    }
    setDemoSession(null);
  };

  // Seed data only applies when nothing is stored yet (see useLocalStorage).
  const [tasks, setTasks] = useLocalStorage<Task[]>('vibetracker.tasks', SEED_TASKS);

  // M12 drag-and-drop: per-column card ordering, kept in its own key so the
  // locked `Task` model stays untouched. Holds task ids; tasks missing from
  // the list keep their array order at the bottom of their column.
  const [storedTaskOrder, setTaskOrder] = useLocalStorage<string[]>(TASK_ORDER_KEY, []);
  const taskOrder = normalizeTaskOrder(storedTaskOrder);

  // M12 drag-and-drop: transient drag state — which card is being dragged
  // (dimmed) and which column/slot is the current drop target (highlighted
  // column + insertion line). Never persisted.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<DropSlot | null>(null);

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

  // M12 drag-and-drop handlers. The dragged card records its id in the
  // dataTransfer (readable at drop time); dragover on a column reports the
  // computed insertion slot; drop applies the status change and rewrites the
  // order list; dragend (or dragleave) clears the transient highlights.

  const handleDragStart = (task: Task, e: DragEvent<HTMLElement>) => {
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (status: TaskStatus, beforeId: string | null) => {
    // dragover fires continuously — bail out unless the slot actually changed.
    setDropSlot((prev) =>
      prev !== null && prev.status === status && prev.beforeId === beforeId ? prev : { status, beforeId }
    );
  };

  const handleTaskDrop = (status: TaskStatus, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || draggingId;
    const beforeId = dropSlot !== null && dropSlot.status === status ? dropSlot.beforeId : null;
    setDraggingId(null);
    setDropSlot(null);
    if (!id) return; // invalid/cancelled drag — change nothing
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    // Full-card drag: a completed drop is a drag gesture — record it so any
    // trailing click is swallowed and never opens the edit modal. Recorded
    // HERE (not in dragend) because a cross-column move remounts the card,
    // and the browser can fire dragend on a node React has already detached.
    recordDragEnd();
    const statusChanged = task.status !== status;
    if (statusChanged) {
      // Same update path as the status dropdown — only `status` changes; every
      // other field (AI context, timestamps, …) is preserved.
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    }
    const nextOrder = insertTaskOrder(taskOrder, id, beforeId);
    if (nextOrder !== taskOrder) setTaskOrder(nextOrder); // no-op drops skip the storage write
    if (statusChanged || nextOrder !== taskOrder) {
      const label = STAGES.find((s) => s.id === status)?.label ?? status;
      showToast(statusChanged ? `Moved "${task.title}" to ${label}.` : `Reordered "${task.title}".`);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropSlot(null);
    // Covers drags that end without a drop (Escape / dragged back to start):
    // swallow the trailing click too.
    recordDragEnd();
  };

  const handleDragLeave = (status: TaskStatus, e: DragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropSlot((prev) => (prev !== null && prev.status === status ? null : prev));
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
      // M12 drag-and-drop: new tasks get a consistent initial position —
      // the top of their column.
      setTaskOrder((prev) => taskOrderForCreate(normalizeTaskOrder(prev), task.id));
    }
    setModal(null);
  };

  /** M5: remove a task; the confirmation happens inside the modal (DESIGN.md §5 microcopy). */
  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // M12 drag-and-drop: prune the id from the order list too.
    setTaskOrder((prev) => taskOrderForDelete(normalizeTaskOrder(prev), id));
    setModal(null);
  };

  const handleOpenTask = (task: Task) => setModal({ task, initialStatus: task.status });
  const handleAddTask = () => setModal({ task: null, initialStatus: 'todo' });

  // M12: before a demo session exists the login page replaces the dashboard.
  // All hooks above already ran, so tasks/anchors keep loading underneath —
  // logging in never resets or reseeds stored data.
  if (demoSession === null) {
    return <LoginPage onLogin={handleDemoLogin} />;
  }

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
        {/* M12: end the demo session without touching any task/anchor data.
            (The "+ Task" button lives in the To Do column header, M5.) */}
        <button
          type="button"
          data-action="logout"
          onClick={handleLogout}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Log out
        </button>
      </header>

      {/* M11 anchors — the deliverable links pinned above the board. */}
      <AnchorBoard anchors={anchors} onSave={handleAnchorSave} onRemove={handleAnchorRemove} />

      {/* M12 secret-sauce: the live, collapsible Project Health dashboard —
          computed from the same task state, so every CRUD/status/type/due
          change updates it immediately. */}
      <ProjectHealth tasks={tasks} today={today} />

      {/* M7 task-owner (optional): active-task counts per demo role. */}
      <TeamWorkload tasks={tasks} />

      <main className="grid grid-cols-4 items-start gap-4">
        {STAGES.map((stage) => (
          <BoardColumn
            key={stage.id}
            stage={stage}
            tasks={sortTasksForColumn(tasks.filter((t) => t.status === stage.id), taskOrder)}
            today={today}
            draggingId={draggingId}
            dropSlot={dropSlot}
            onStatusChange={handleStatusChange}
            onAssigneeChange={handleAssigneeChange}
            onOpenTask={handleOpenTask}
            onCopyPrompt={handleCopyPrompt}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleTaskDrop}
            onDragEnd={handleDragEnd}
            onDragLeave={handleDragLeave}
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
