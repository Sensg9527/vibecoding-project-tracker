import { STAGES } from '../data/constants';
import type { Task, TaskStatus } from '../types/task';
import TaskCard from './TaskCard';

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

export default BoardColumn;
