import { Fragment, useRef, type DragEvent } from 'react';
import { STAGES } from '../data/constants';
import type { Task, TaskStatus } from '../types/task';
import TaskCard from './TaskCard';

/** M12 drag & drop — the column + insertion slot a drag is currently targeting. */
export interface DropSlot {
  status: TaskStatus;
  /** Card id to insert before, or null = bottom of the column. */
  beforeId: string | null;
}

interface BoardColumnProps {
  stage: (typeof STAGES)[number];
  tasks: Task[];
  /** Current local date for M8 urgency tints. */
  today: Date;
  /** M12 drag & drop: the id of the card being dragged, if any. */
  draggingId: string | null;
  /** M12 drag & drop: the slot currently highlighted in this column (null when not targeted). */
  dropSlot: DropSlot | null;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssigneeChange: (id: string, assignee: string) => void;
  onOpenTask: (task: Task) => void;
  onCopyPrompt: (task: Task) => void;
  onDragStart: (task: Task, e: DragEvent<HTMLElement>) => void;
  onDragOver: (status: TaskStatus, beforeId: string | null) => void;
  onDrop: (status: TaskStatus, e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragLeave: (status: TaskStatus, e: DragEvent<HTMLElement>) => void;
  /** Only the To Do column gets the "+ Task" button (M5). */
  onAddTask?: () => void;
}

/**
 * One Kanban column: heading, optional "+ Task" button, task count, and the
 * matching cards. M12 drag & drop: the whole column is a drop target —
 * dragover computes the insertion slot from the pointer Y position against
 * the card midpoints, the slot renders as a brand-primary insertion line,
 * and drop bubbles up to App, which updates the task's status and the
 * `vibetracker.taskOrder` list.
 */
function BoardColumn({ stage, tasks, today, draggingId, dropSlot, onStatusChange, onAssigneeChange, onOpenTask, onCopyPrompt, onDragStart, onDragOver, onDrop, onDragEnd, onDragLeave, onAddTask }: BoardColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);

  /** The slot targeted in THIS column: a card id to insert before, null for the bottom, undefined when untouched. */
  const slotBeforeId: string | null | undefined =
    dropSlot !== null && dropSlot.status === stage.id ? dropSlot.beforeId : undefined;

  /** M12: the first card whose vertical midpoint sits below the pointer — null = bottom of the column. */
  const computeBeforeId = (clientY: number): string | null => {
    const list = listRef.current;
    if (!list) return null;
    for (const card of list.querySelectorAll<HTMLElement>('article')) {
      const id = card.getAttribute('data-task-id');
      if (!id || id === draggingId) continue; // the dragged card's own slot never counts
      const rect = card.getBoundingClientRect();
      if (rect.top + rect.height / 2 > clientY) return id;
    }
    return null;
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(stage.id, computeBeforeId(e.clientY));
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    onDrop(stage.id, e);
  };

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    // Clear only when the pointer actually left the column — dragleave also
    // fires when moving between the column's own children.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    onDragLeave(stage.id, e);
  };

  return (
    <section
      aria-label={`${stage.label} column`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
      className={`flex min-h-64 flex-col ${slotBeforeId !== undefined ? 'rounded-md ring-2 ring-brand-primary' : ''}`}
    >
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
      <div ref={listRef} className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-slate-300 p-3 text-center text-xs text-text-muted">
            Nothing here yet — add a task to get started.
          </p>
        ) : (
          tasks.map((task) => (
            <Fragment key={task.id}>
              {slotBeforeId === task.id && (
                <div data-drop-indicator aria-hidden="true" className="my-1 h-1 rounded-full bg-brand-primary" />
              )}
              <TaskCard
                key={task.id}
                task={task}
                today={today}
                isDragging={draggingId === task.id}
                onStatusChange={onStatusChange}
                onAssigneeChange={onAssigneeChange}
                onOpen={onOpenTask}
                onCopyPrompt={onCopyPrompt}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </Fragment>
          ))
        )}
        {slotBeforeId === null && (
          <div data-drop-indicator aria-hidden="true" className="my-1 h-1 rounded-full bg-brand-primary" />
        )}
      </div>
    </section>
  );
}

export default BoardColumn;
