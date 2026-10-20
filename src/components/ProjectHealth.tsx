import { useState } from 'react';
import type { Task } from '../types/task';
import { calculateProjectHealth } from '../utils/projectHealthUtils';

interface ProjectHealthProps {
  tasks: Task[];
  /** App's "current local date" (M8 clock) so overdue counts follow day rollover. */
  today: Date;
}

/**
 * M12 secret-sauce — the Project Health Dashboard: a compact, collapsible
 * live summary (total / completed / completion % / overdue / active bugs +
 * an overall completion bar) computed from the actual task list. Rendered
 * between the Deliverable Anchor Board and the workload strip; collapsing
 * hides only the statistics panel. Cards are plain divs (same rule as
 * TeamWorkload — the board tests count `article` elements as task cards),
 * styled per DESIGN.md §4: white surfaces, subtle borders, rounded corners,
 * brand-primary accents, and red `type-bug` indicators for overdue/bugs so
 * the numbers are never colour-only (each value also has a visible label).
 */
function ProjectHealth({ tasks, today }: ProjectHealthProps) {
  const [open, setOpen] = useState(true);
  const stats = calculateProjectHealth(tasks, today);

  const STAT_CARDS: Array<{ key: string; label: string; value: string; valueClass: string }> = [
    { key: 'total', label: 'Total Tasks', value: String(stats.total), valueClass: 'text-text-primary' },
    { key: 'completed', label: 'Completed Tasks', value: String(stats.completed), valueClass: 'text-type-feature' },
    { key: 'percentage', label: 'Completion Percentage', value: `${stats.completionPercentage}%`, valueClass: 'text-brand-primary' },
    { key: 'overdue', label: 'Overdue Tasks', value: String(stats.overdue), valueClass: 'text-type-bug' },
    { key: 'bugs', label: 'Active Bugs', value: String(stats.activeBugs), valueClass: 'text-type-bug' },
  ];

  return (
    <section data-project-health aria-label="Project health" className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold uppercase tracking-wide text-text-primary">
          Project Health
        </h2>
        <button
          type="button"
          data-health-toggle
          aria-expanded={open}
          aria-controls="project-health-panel"
          onClick={() => setOpen((o) => !o)}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {open ? 'Hide Project Health' : 'Show Project Health'}
        </button>
      </div>

      {open && (
        <div id="project-health-panel" className="rounded-md border border-slate-200 bg-surface-card p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {STAT_CARDS.map((card) => (
              <div
                key={card.key}
                data-health-stat={card.key}
                className="rounded-md border border-slate-200 bg-surface-page px-3 py-2"
              >
                <p className="text-[10px] uppercase tracking-wide text-text-muted">{card.label}</p>
                <p data-health-value className={`mt-0.5 text-xl font-semibold ${card.valueClass}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
          {/* Overall completion — the bar width derives from the percentage and
              the number is repeated as text so it is never conveyed by width alone. */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-text-primary">Overall completion</span>
              <span data-health-percent className="font-semibold text-brand-primary">
                {stats.completionPercentage}%
              </span>
            </div>
            <div
              data-health-progress
              role="progressbar"
              aria-label="Overall completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.completionPercentage}
              className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            >
              <div
                data-health-progress-fill
                className="h-full rounded-full bg-brand-primary"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProjectHealth;
