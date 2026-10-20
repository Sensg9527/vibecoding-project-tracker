import { TEAM } from '../data/constants';
import type { Task } from '../types/task';
import { initialsOf } from '../utils/taskUtils';

interface TeamWorkloadProps {
  tasks: Task[];
}

/**
 * M7 task-owner (optional) — a compact strip above the board showing how many
 * active tasks (everything except Done) each demonstration role is driving.
 * Plain divs on purpose: the board tests count `main section` elements.
 */
function TeamWorkload({ tasks }: TeamWorkloadProps) {
  return (
    <div
      data-workload
      aria-label="Team workload"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-surface-card px-3 py-2 text-xs"
    >
      <span className="mr-1 font-medium text-text-primary">Active tasks</span>
      {TEAM.map((name) => {
        const count = tasks.filter((t) => t.assignee === name && t.status !== 'done').length;
        return (
          <span
            key={name}
            data-workload-item
            data-workload-name={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-surface-page px-2 py-0.5"
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary/10 text-[9px] font-semibold leading-none text-brand-primary"
            >
              {initialsOf(name)}
            </span>
            <span className="text-text-muted">{name}</span>
            <span data-workload-count className="font-semibold text-text-primary">
              {count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default TeamWorkload;
