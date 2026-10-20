/**
 * Shared task types — the locked PRD §5 data model plus the small UI types
 * the modal and App pass around. Do not change `Task` / `Anchor` without
 * team agreement.
 */

export type TaskType = 'feature' | 'bug';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

/**
 * A single vibecoding task. Mirrors PRD §5 — locked, do not change
 * without team agreement. The `context*` fields are reserved for M9
 * and carry safe defaults until then.
 */
export interface Task {
  id: string;                    // uuid or timestamp string
  title: string;
  description: string;
  type: TaskType;                // visual color coding (M6)
  status: TaskStatus;
  assignee: string;              // one of the three TEAM values
  dueDate: string | null;        // ISO date 'YYYY-MM-DD'
  createdDate: string;           // ISO date 'YYYY-MM-DD'

  // M9 context — curated markdown briefing for the next AI / reviewer.
  context: string;
  contextTool: string | null;    // 'Claude' | 'ChatGPT' | 'Cursor' | 'Lovable' | 'Replit' | 'Other'
  contextUpdatedAt: string | null; // ISO timestamp, set automatically by App on save
}

/** One of four pinned deliverable slots. TODO M11 anchors. */
export interface Anchor {
  id: 'presentation' | 'demo' | 'report' | 'documentation';
  label: string;                 // human-readable
  url: string | null;            // the link the team pastes in
}

/**
 * The values the task modal collects. Model fields (id, createdDate) are
 * handled by App; `context*` are collected here and `contextUpdatedAt` is
 * computed by App on save (M9).
 */
export interface TaskFormValues {
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  assignee: string;
  dueDate: string | null;
  context: string;
  contextTool: string | null;
}

/** Modal state: closed (null), create mode (task null + initialStatus), or edit mode (task set). */
export interface ModalState {
  task: Task | null;
  initialStatus: TaskStatus;
}
