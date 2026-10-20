// M9 task-context — the AI Context section on the modal: a Markdown textarea,
// an AI Tool dropdown, automatic `contextUpdatedAt` timestamps and persistence.
// Unit tests cover the timestamp formatter with a fixed clock; the browser
// checks drive the real modal. Multiline context is set through the native
// textarea value setter + input/change events (the same trick family as the
// M7/M8 controls — headless CDP cannot type reliably into React-controlled
// fields), and line breaks are preserved byte-for-byte.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';
import { formatLocalTimestamp } from '../src/utils/taskUtils.ts';

// ---------------------------------------------------- pure unit tests (fixed clock)

test('formatLocalTimestamp renders the local-time hint format', () => {
  const local = new Date(2026, 9, 20, 14, 30); // local 14:30, 2026-10-20
  assert.equal(formatLocalTimestamp(local.toISOString()), '20 Oct 2026, 14:30');
});

test('formatLocalTimestamp handles null and malformed input', () => {
  assert.equal(formatLocalTimestamp(null), null);
  assert.equal(formatLocalTimestamp(''), null);
  assert.equal(formatLocalTimestamp('not-a-date'), null);
});

// ---------------------------------------------------------------- browser tests

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

const TOOL_VALUES = ['', 'Claude', 'ChatGPT', 'Cursor', 'Lovable', 'Replit', 'Other'];
const TOOL_LABELS = ['None', 'Claude', 'ChatGPT', 'Cursor', 'Lovable', 'Replit', 'Other'];

const MARKDOWN_ONE = [
  '## Notes',
  '- first bullet',
  '- second bullet',
  '',
  '```ts',
  'const x = 1;',
  '```',
].join('\n');

const MARKDOWN_TWO = [
  '# Session notes',
  '',
  '- decision A',
  '- decision B',
  '',
  '## Errors',
  '',
  '```bash',
  'npm test',
  '```',
  '',
  'Next step: implement M10.',
].join('\n');

/** Read one stored task from localStorage by title. */
function storedByTitle(title: string): string {
  return `JSON.parse(localStorage.getItem('vibetracker.tasks')).find(t => t.title === ${JSON.stringify(title)})`;
}

/** The AI Context section state inside the open modal. */
const modalContextExpr = `(() => {
  const section = document.querySelector('[data-context-section]');
  if (!section) return null;
  return {
    context: document.getElementById('task-context').value,
    tool: document.getElementById('task-context-tool').value,
    hint: section.querySelector('[data-context-updated]').textContent.trim(),
  };
})()`;

check(session, 'The create modal has an AI Context section with a Markdown textarea', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  const info = await session.eval(`(() => {
    const section = document.querySelector('[data-context-section]');
    const label = document.querySelector('label[for="task-context"]');
    const ta = document.getElementById('task-context');
    return {
      hasSection: !!section,
      heading: section ? section.querySelector('h3')?.textContent.trim() : null,
      label: label ? label.textContent.trim() : null,
      isTextarea: ta ? ta.tagName.toLowerCase() : null,
      placeholder: ta ? ta.getAttribute('placeholder') : null,
      hint: section ? section.querySelector('[data-context-updated]')?.textContent.trim() : null,
    };
  })()`);
  assert.equal(info.hasSection, true, 'AI Context section missing');
  assert.equal(info.heading, 'AI Context');
  assert.equal(info.label, 'Context (Markdown)');
  assert.equal(info.isTextarea, 'textarea', 'the context field must be a multiline textarea');
  for (const word of ['notes', 'prompts', 'decisions', 'errors', 'next steps']) {
    assert.ok(info.placeholder.toLowerCase().includes(word), `placeholder should mention "${word}"`);
  }
  assert.equal(info.hint, 'No context saved yet.');
  await session.pressEscape();
});

check(session, 'The AI Tool dropdown offers exactly the permitted options', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  const options = await session.eval(
    `[...document.getElementById('task-context-tool').options].map(o => ({ value: o.value, label: o.textContent.trim() }))`
  );
  assert.deepEqual(options.map((o) => o.value), TOOL_VALUES, 'tool values must be exactly None + the six tools');
  assert.deepEqual(options.map((o) => o.label), TOOL_LABELS, 'tool labels must match');
  await session.pressEscape();
});

check(session, 'Creating a task with context saves the markdown and an automatic timestamp', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  await session.focusElement('#task-title');
  await session.insertText('Context probe task');
  assert.equal(await session.setTextareaValue('#task-context', MARKDOWN_ONE), true, 'context textarea not found');
  assert.equal(await session.setSelect('#task-context-tool', 'Claude'), true, 'AI tool select not found');
  assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes('Context probe task'))`,
    'new card on board'
  );
  const stored = await session.eval(storedByTitle('Context probe task'));
  assert.ok(stored, 'created task missing from localStorage');
  assert.equal(stored.context, MARKDOWN_ONE, 'markdown must be saved byte-for-byte');
  assert.equal(stored.contextTool, 'Claude');
  assert.ok(stored.contextUpdatedAt, 'contextUpdatedAt must be set automatically');
  const ts = new Date(stored.contextUpdatedAt);
  assert.ok(!Number.isNaN(ts.getTime()), 'contextUpdatedAt must be a valid ISO 8601 timestamp');
  assert.ok(Math.abs(Date.now() - ts.getTime()) < 60_000, 'contextUpdatedAt must be "now"');
});

check(session, 'Reopening a task pre-fills its context and shows the last-updated hint', async () => {
  const before = await session.eval(storedByTitle('Context probe task'));
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const modal = await session.eval(modalContextExpr);
  assert.equal(modal.context, MARKDOWN_ONE, 'saved markdown must pre-fill the textarea');
  assert.equal(modal.tool, 'Claude', 'saved AI tool must pre-fill the dropdown');
  assert.equal(
    modal.hint,
    `Context last updated: ${formatLocalTimestamp(before.contextUpdatedAt)}`,
    'hint must show the stored timestamp in local time'
  );
  await session.pressEscape();
  // Opening without saving must not touch the timestamp.
  const after = await session.eval(storedByTitle('Context probe task'));
  assert.equal(after.contextUpdatedAt, before.contextUpdatedAt, 'opening without saving must preserve the timestamp');
});

check(session, 'Editing context preserves multiline Markdown', async () => {
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setTextareaValue('#task-context', MARKDOWN_TWO), true, 'context textarea not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed after save');
  const stored = await session.eval(storedByTitle('Context probe task'));
  assert.equal(
    stored.context,
    MARKDOWN_TWO,
    'the new multiline markdown must be saved exactly (blank lines and code fences included)'
  );
});

check(session, 'Context and AI tool survive a page refresh', async () => {
  await session.reload();
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found after refresh');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const modal = await session.eval(modalContextExpr);
  assert.equal(modal.context, MARKDOWN_TWO, 'markdown must survive the refresh');
  assert.equal(modal.tool, 'Claude', 'AI tool must survive the refresh');
  await session.pressEscape();
});

check(session, 'The AI Tool selection persists correctly', async () => {
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setSelect('#task-context-tool', 'Cursor'), true, 'AI tool select not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const stored = await session.eval(storedByTitle('Context probe task'));
  assert.equal(stored.contextTool, 'Cursor', 'the tool must be persisted');
  assert.equal(stored.context, MARKDOWN_TWO, 'saving the tool alone must keep the context');
  // Reopen to confirm the dropdown reflects the persisted value.
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.eval(`document.getElementById('task-context-tool').value`), 'Cursor');
  await session.pressEscape();
});

check(session, 'Selecting None stores null', async () => {
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setSelect('#task-context-tool', ''), true, 'AI tool select not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const stored = await session.eval(storedByTitle('Context probe task'));
  assert.equal(stored.contextTool, null, 'None must be stored as null');
  assert.equal(stored.context, MARKDOWN_TWO, 'saving the tool alone must keep the context');
});

check(session, 'Context changes update contextUpdatedAt', async () => {
  const before = await session.eval(storedByTitle('Context probe task'));
  const markdownThree = MARKDOWN_TWO + '\n\n- late addition';
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setTextareaValue('#task-context', markdownThree), true, 'context textarea not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const after = await session.eval(storedByTitle('Context probe task'));
  assert.equal(after.context, markdownThree, 'the edited context must be saved');
  assert.ok(after.contextUpdatedAt, 'timestamp must be set');
  assert.notEqual(after.contextUpdatedAt, before.contextUpdatedAt, 'the timestamp must change when the context changes');
  assert.ok(
    new Date(after.contextUpdatedAt) >= new Date(before.contextUpdatedAt),
    'the new timestamp must not go backwards'
  );
});

check(session, 'Changing the AI tool updates the timestamp', async () => {
  const before = await session.eval(storedByTitle('Context probe task'));
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setSelect('#task-context-tool', 'Replit'), true, 'AI tool select not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const after = await session.eval(storedByTitle('Context probe task'));
  assert.equal(after.contextTool, 'Replit');
  assert.ok(after.contextUpdatedAt, 'timestamp must be set');
  assert.notEqual(after.contextUpdatedAt, before.contextUpdatedAt, 'the timestamp must change when the tool changes');
  assert.ok(
    new Date(after.contextUpdatedAt) >= new Date(before.contextUpdatedAt),
    'the new timestamp must not go backwards'
  );
});

check(session, 'Changing only unrelated task fields does not update the timestamp', async () => {
  const before = await session.eval(storedByTitle('Context probe task'));
  assert.equal(await session.clickCard('Context probe task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  await session.focusElement('#task-title');
  await session.pressCtrlA();
  await session.insertText('Context probe renamed');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const after = await session.eval(storedByTitle('Context probe renamed'));
  assert.ok(after, 'renamed task missing from localStorage');
  assert.equal(after.title, 'Context probe renamed');
  assert.equal(after.contextUpdatedAt, before.contextUpdatedAt, 'a title-only edit must keep the timestamp untouched');
  assert.equal(after.context, before.context, 'a title-only edit must keep the context untouched');
  assert.equal(after.contextTool, before.contextTool, 'a title-only edit must keep the tool untouched');
});

check(session, 'A new task with no context keeps the timestamp null', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  await session.focusElement('#task-title');
  await session.insertText('Bare context task');
  assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes('Bare context task'))`,
    'new card on board'
  );
  const stored = await session.eval(storedByTitle('Bare context task'));
  assert.equal(stored.context, '');
  assert.equal(stored.contextTool, null);
  assert.equal(stored.contextUpdatedAt, null, 'no context and no tool ⇒ no timestamp');
  // Its modal must show the "never saved" hint.
  assert.equal(await session.clickCard('Bare context task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const modal = await session.eval(modalContextExpr);
  assert.equal(modal.hint, 'No context saved yet.');
  await session.pressEscape();
});

check(session, 'Legacy tasks without context stay compatible with the new modal', async () => {
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'seed card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const modal = await session.eval(modalContextExpr);
  assert.equal(modal.context, '', 'legacy tasks must open with an empty context textarea');
  assert.equal(modal.tool, '', 'legacy tasks must show None');
  assert.equal(modal.hint, 'No context saved yet.');
  // Save an unrelated change — the legacy context fields must stay untouched.
  await session.focusElement('#task-title');
  await session.pressCtrlA();
  await session.insertText('Legacy seed task touched');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const stored = await session.eval(
    `JSON.parse(localStorage.getItem('vibetracker.tasks')).find(t => t.id === 'seed-crud-modal')`
  );
  assert.equal(stored.context, '');
  assert.equal(stored.contextTool, null);
  assert.equal(stored.contextUpdatedAt, null, 'unrelated edits must not create a timestamp on legacy tasks');
});

check(session, 'Earlier milestones keep working: board, status, styles, owner, due tint', async () => {
  // M4 board + status dropdown.
  assert.equal(await session.setCardStatus('Complete the PRD review', 'todo'), true, 'status select not found');
  assert.equal(await session.cardInColumn('Complete the PRD review', 'To Do'), true, 'card should move to To Do');
  assert.equal(await session.setCardStatus('Complete the PRD review', 'done'), true, 'status select not found');
  // M6 type styling.
  const m6 = await session.eval(`(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Bug: cards ignore the design tokens'));
    if (!card) return null;
    return { type: card.getAttribute('data-task-type'), badge: card.querySelector('[data-type-badge]')?.textContent.trim().toUpperCase() };
  })()`);
  assert.equal(m6.type, 'bug');
  assert.equal(m6.badge, 'BUG');
  // M8 due tint — execution-date independent: a dated active task carries
  // some urgency state + chip (which one depends on today's date).
  const m8 = await session.eval(`(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Bug: cards ignore the design tokens'));
    return {
      state: card.getAttribute('data-due-state'),
      chip: card.querySelector('[data-due-chip]')?.textContent.trim().toUpperCase() ?? null,
    };
  })()`);
  assert.ok(['safe', 'warning', 'overdue'].includes(m8.state), `unexpected due state: ${m8.state}`);
  assert.ok(['SAFE', 'DUE SOON', 'OVERDUE'].includes(m8.chip), `unexpected due chip: ${m8.chip}`);
  // M7 owner + handoff toast.
  assert.equal(await session.setCardHandoff('Bug: cards ignore the design tokens', 'Demo Reviewer'), true, 'handoff select not found');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.trim() === 'Assigned to Demo Reviewer.'`,
    'handoff toast'
  );
});

check(session, 'No console errors during context checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
