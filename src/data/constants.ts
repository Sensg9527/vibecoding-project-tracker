import type { Anchor, TaskStatus } from '../types/task';

// The four columns of the board, in render order.
// Use these IDs everywhere — do not invent new ones.
export const STAGES: Array<{ id: TaskStatus; label: string }> = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Done' },
];

// The three demonstration assignee values from PRD §8.
// They are the only valid values for `Task.assignee`.
export const TEAM: string[] = ['Solo Developer', 'Demo Reviewer', 'Demo Designer'];

// M9 context — the "AI Tool" dropdown options. `''` is the "None" choice;
// the modal stores it as `null` on the model.
export const AI_TOOLS: Array<{ value: string; label: string }> = [
  { value: '', label: 'None' },
  { value: 'Claude', label: 'Claude' },
  { value: 'ChatGPT', label: 'ChatGPT' },
  { value: 'Cursor', label: 'Cursor' },
  { value: 'Lovable', label: 'Lovable' },
  { value: 'Replit', label: 'Replit' },
  { value: 'Other', label: 'Other' },
];

// M11 anchors — the four pinned deliverable slots, in display order.
// `vibetracker.anchors` stores the live copy; these are only the seeds.
export const INITIAL_ANCHORS: Anchor[] = [
  { id: 'presentation', label: 'Presentation', url: null },
  { id: 'demo', label: 'Demo', url: null },
  { id: 'report', label: 'Report', url: null },
  { id: 'documentation', label: 'Documentation', url: null },
];

// M12 secret-sauce — the demonstration login. Deliberately a plain constant:
// this is a demo gate, not real authentication. The password is never written
// to localStorage/sessionStorage — only the session flag below is.
export const DEMO_USERNAME = 'userdemo';
export const DEMO_PASSWORD = 'userdemo';

// M12: sessionStorage key for the demo session flag (tab-scoped — survives a
// refresh, cleared by logout and by closing the tab).
export const DEMO_SESSION_KEY = 'vibetracker.demoSession';
