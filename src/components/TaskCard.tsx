import type { ReactElement } from 'react';
import { STAGES, TEAM } from '../data/constants';
import type { Task, TaskStatus, TaskType } from '../types/task';
import { getDueState, type DueState } from '../utils/dueDateUtils';
import { initialsOf } from '../utils/taskUtils';

interface TaskCardProps {
  task: Task;
  /** App's "current local date" — passed down so urgency tints re-evaluate on day rollover (M8). */
  today: Date;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssigneeChange: (id: string, assignee: string) => void;
  onOpen: (task: Task) => void;
  /** M10: generate the markdown prompt for this task and copy it. */
  onCopyPrompt: (task: Task) => void;
}

/** M6 tag-style — a small sparkle for features. */
function FeatureIcon(): ReactElement {
  return (
    <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 2l2.47 7.53L22 12l-7.53 2.47L12 22l-2.47-7.53L2 12l7.53-2.47L12 2z" />
    </svg>
  );
}

/** M6 tag-style — a small beetle for bugs. */
function BugIcon(): ReactElement {
  return (
    <svg
      className="h-2.5 w-2.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="7" r="2.5" />
      <path d="M10 4.5 8 2.5" />
      <path d="M14 4.5 16 2.5" />
      <ellipse cx="12" cy="14" rx="4.5" ry="5.5" />
      <path d="M12 9.5v9" />
      <path d="M7.5 12 3.5 11" />
      <path d="M16.5 12l4-1" />
      <path d="M7.5 16.5 3.5 18" />
      <path d="M16.5 16.5l4 1.5" />
    </svg>
  );
}

/**
 * M6 tag-style (DESIGN.md §2): features get a green accent stripe + badge,
 * bugs a red one. Colour is never the only signal — every card also shows
 * a visible FEATURE/BUG label and a distinct icon.
 */
const TYPE_META: Record<TaskType, { label: string; stripe: string; badge: string; Icon: () => ReactElement }> = {
  feature: {
    label: 'Feature',
    stripe: 'border-l-type-feature',
    badge: 'border-type-feature/30 bg-type-feature/10 text-type-feature',
    Icon: FeatureIcon,
  },
  bug: {
    label: 'Bug',
    stripe: 'border-l-type-bug',
    badge: 'border-type-bug/30 bg-type-bug/10 text-type-bug',
    Icon: BugIcon,
  },
};

/**
 * M8 due-tint (DESIGN.md §2): a subtle background tint per urgency state plus
 * a visible label chip, so colour is never the only signal. 'none' (no due
 * date) keeps the plain card with no indicator. The M6 accent stripe and the
 * M7 owner/handoff controls all stay untouched.
 */
const DUE_META: Record<DueState, { label: string; bg: string; chip: string } | null> = {
  safe: { label: 'Safe', bg: 'bg-due-safe', chip: 'border-blue-300 bg-white/80 text-blue-700' },
  warning: { label: 'Due Soon', bg: 'bg-due-warning', chip: 'border-amber-300 bg-white/80 text-amber-700' },
  overdue: { label: 'Overdue', bg: 'bg-due-overdue', chip: 'border-red-300 bg-white/80 text-red-700' },
  neutral: { label: 'Done', bg: 'bg-due-neutral', chip: 'border-slate-300 bg-white/80 text-slate-600' },
  none: null,
};

/**
 * A single task card. Status moves happen through the dropdown (M4);
 * clicking the card (or pressing Enter/Space on it) opens the edit modal (M5).
 * The M6 accent stripe and type badge reflect `task.type`.
 * M7 task-owner adds the avatar + name and the "Hand off to" dropdown —
 * both selects stop propagation so card interactions never open the modal.
 * M8 due-tint adds the urgency background tint + label chip.
 * M10 copy-prompt adds the "Copy as Prompt Context" button (stops propagation
 * like the selects — copying never opens the modal or changes the task).
 */
function TaskCard({ task, today, onStatusChange, onAssigneeChange, onOpen, onCopyPrompt }: TaskCardProps) {
  const handleOpen = () => onOpen(task);
  const meta = TYPE_META[task.type];
  const dueState = getDueState(task, today);
  const dueMeta = DUE_META[dueState];

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Edit task "${task.title}"`}
      data-task-type={task.type}
      data-due-state={dueState}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      className={`cursor-pointer rounded-md border border-slate-200 border-l-4 p-3 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${dueMeta ? dueMeta.bg : 'bg-surface-card'} ${meta.stripe}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text-primary">{task.title}</h3>
        <span className="flex shrink-0 items-center gap-1">
          {dueMeta && (
            <span
              data-due-chip
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none ${dueMeta.chip}`}
            >
              {dueMeta.label}
            </span>
          )}
          <span
            data-type-badge
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none ${meta.badge}`}
          >
            <meta.Icon />
            {meta.label}
          </span>
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{task.description}</p>
      {/* M7 task-owner: who owns the task, visible without opening the modal. */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span data-owner className="flex min-w-0 items-center gap-1.5" title={task.assignee}>
          <span
            data-owner-initials
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-semibold leading-none text-brand-primary"
          >
            {initialsOf(task.assignee)}
          </span>
          <span data-owner-name className="truncate text-xs text-text-primary">{task.assignee}</span>
        </span>
        <select
          data-field="status"
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
      </div>
      {/* M7 task-owner: reassign ownership without opening the modal. */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted">Hand off to</span>
          <select
            data-field="handoff"
            value={task.assignee}
            onChange={(e) => onAssigneeChange(task.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Hand off "${task.title}" to`}
            className="min-w-0 flex-1 rounded border border-slate-300 bg-surface-card px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {TEAM.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        {task.dueDate && (
          <span className="shrink-0 text-xs text-text-muted">Due {task.dueDate}</span>
        )}
      </div>
      {/* M10 copy-prompt: one click turns the task + saved context into a
          reusable markdown prompt. stopPropagation (same pattern as the two
          selects) so copying never opens the modal or changes the task. */}
      <div className="mt-2 border-t border-slate-200/70 pt-2">
        <button
          type="button"
          data-action="copy-prompt"
          onClick={(e) => {
            e.stopPropagation();
            onCopyPrompt(task);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Copy "${task.title}" as prompt context`}
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Copy as Prompt Context
        </button>
      </div>
    </article>
  );
}

export default TaskCard;
