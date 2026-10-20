import type { Task } from '../types/task';
// Explicit .ts extension: the file is also imported from Node's native
// type-stripping test runner, which (unlike Vite) does not resolve bare paths.
import { formatLocalTimestamp } from './taskUtils.ts';

// Human-readable labels for the locked model values (mirror STAGES/TYPE_META).
const TYPE_LABELS: Record<Task['type'], string> = { feature: 'Feature', bug: 'Bug' };
const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
};

/**
 * M10 copy-prompt — serialises a task plus its saved AI context into a
 * reusable Markdown prompt for pasting into an AI coding assistant.
 *
 * Pure: only reads `task`, never mutates it. The saved context is embedded
 * verbatim — headings, lists, blank lines and code fences included — never
 * rewritten, trimmed or summarised.
 */
export function formatTaskAsPrompt(task: Task): string {
  const lines: string[] = [
    `# Task: ${task.title}`,
    '',
    '## Task Details',
    '',
    `- Type: ${TYPE_LABELS[task.type]}`,
    `- Status: ${STATUS_LABELS[task.status]}`,
    `- Assignee: ${task.assignee}`,
    `- Due Date: ${task.dueDate ?? 'Not set'}`,
    `- Created Date: ${task.createdDate}`,
  ];
  if (task.contextTool) {
    lines.push(`- AI Tool: ${task.contextTool}`);
  }
  const updated = formatLocalTimestamp(task.contextUpdatedAt);
  if (updated) {
    lines.push(`- Context Last Updated: ${updated}`);
  }
  lines.push('', '## Description', '', task.description, '', '## AI Context', '');
  lines.push(task.context.trim() === '' ? 'No additional AI context saved.' : task.context);
  return lines.join('\n') + '\n';
}
