// Kanban board behaviour — columns, placement, counts, status moves.
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

check(session, 'Four columns render in the correct order', async () => {
  const cols = await session.eval(
    `[...document.querySelectorAll('main section')].map(s => s.getAttribute('aria-label'))`
  );
  assert.deepEqual(cols, ['To Do column', 'In Progress column', 'Review column', 'Done column']);
});

check(session, 'Seed tasks appear in their assigned columns', async () => {
  assert.equal(await session.cardInColumn('Add the task CRUD modal', 'To Do'), true);
  assert.equal(await session.cardInColumn('Bug: cards ignore the design tokens', 'In Progress'), true);
  assert.equal(await session.cardInColumn('Design system (DESIGN.md + tokens)', 'Review'), true);
  assert.equal(await session.cardInColumn('Complete the PRD review', 'Done'), true);
});

check(session, 'Column counts match the seed data (1 each)', async () => {
  const counts = await session.eval(
    `[...document.querySelectorAll('section[aria-label$="column"]')].map(s => s.querySelector('[aria-label$="tasks"]').getAttribute('aria-label'))`
  );
  assert.deepEqual(counts, ['1 tasks', '1 tasks', '1 tasks', '1 tasks']);
});

check(session, 'A status change moves the task to the new column', async () => {
  assert.equal(await session.setCardStatus('Add the task CRUD modal', 'review'), true);
  await session.waitFor(`${
    `[...document.querySelectorAll('section[aria-label="Review column"] article')].some(a => a.textContent.includes('Add the task CRUD modal'))`
  }`, 'task moved to Review');
});

check(session, 'Column counts update after the move', async () => {
  const counts = await session.eval(
    `[...document.querySelectorAll('section[aria-label$="column"]')].map(s => s.querySelector('[aria-label$="tasks"]').getAttribute('aria-label'))`
  );
  assert.deepEqual(counts, ['0 tasks', '1 tasks', '2 tasks', '1 tasks']);
});

check(session, 'No console errors during board interaction', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
