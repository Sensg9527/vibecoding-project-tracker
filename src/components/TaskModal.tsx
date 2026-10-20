import { useState, useEffect, useRef, type SyntheticEvent } from 'react';
import { AI_TOOLS, STAGES, TEAM } from '../data/constants';
import type { Task, TaskFormValues, TaskStatus, TaskType } from '../types/task';
import { formatLocalTimestamp } from '../utils/taskUtils';

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
  // M9 context — pre-filled from the stored task on edit, empty on create.
  const [context, setContext] = useState(task?.context ?? '');
  const [contextTool, setContextTool] = useState<string | null>(task?.contextTool ?? null);
  const [error, setError] = useState('');
  // M9: the last-updated hint reflects the *saved* timestamp (App sets it on save).
  const contextUpdatedLabel = task ? formatLocalTimestamp(task.contextUpdatedAt) : null;
  const dialogRef = useRef<HTMLDivElement>(null);
  // The element focused when the modal opened, restored on close. Captured
  // during render: autoFocus moves focus into the dialog before effects run,
  // so an effect would capture the dialog's own input instead of the trigger.
  const previousFocusRef = useRef<HTMLElement | null>(null);
  if (previousFocusRef.current === null) {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
  }

  // Escape closes; body scroll locks while open; focus returns to the trigger on close.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
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
      // M9: context is saved verbatim — line breaks included (no trim).
      context,
      contextTool,
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

          {/* M9 context — curated markdown briefing to hand to the next AI session. */}
          <div data-context-section className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-text-primary">AI Context</h3>
            <div>
              <label htmlFor="task-context" className="mb-1 block text-xs font-medium text-text-primary">
                Context (Markdown)
              </label>
              <textarea
                id="task-context"
                rows={7}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={
                  'Include notes, prompts, decisions, errors and next steps for the next session.\n' +
                  'Markdown works — e.g. ## Heading, - lists and ```code blocks```.'
                }
                className="w-full resize-y rounded border border-slate-300 bg-surface-card px-2.5 py-1.5 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label htmlFor="task-context-tool" className="mb-1 block text-xs font-medium text-text-primary">AI Tool</label>
              <select
                id="task-context-tool"
                value={contextTool ?? ''}
                onChange={(e) => setContextTool(e.target.value || null)}
                className="w-full rounded border border-slate-300 bg-surface-card px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {AI_TOOLS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <p data-context-updated className="text-xs text-text-muted">
              {contextUpdatedLabel
                ? `Context last updated: ${contextUpdatedLabel}`
                : 'No context saved yet.'}
            </p>
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

export default TaskModal;
