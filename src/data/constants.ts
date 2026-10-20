import type { TaskStatus } from '../types/task';

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
