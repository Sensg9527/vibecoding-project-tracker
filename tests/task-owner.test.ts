// M7 task-owner — avatar + name on every card, "Hand off to" dropdown, toast, workload strip.
// Notes: like the M4 status dropdown, the handoff select is driven through the native
// value setter + change event (headless CDP cannot reliably click native select popups);
// stopPropagation is the same pattern already covered by the status-dropdown tests.
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

const TEAM = ['Solo Developer', 'Demo Reviewer', 'Demo Designer'];

/** Owner display info for one card, found by title. */
function ownerInfoExpr(title: string): string {
  return `(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
    if (!card) return null;
    return {
      name: card.querySelector('[data-owner-name]')?.textContent ?? null,
      initials: card.querySelector('[data-owner-initials]')?.textContent ?? null,
    };
  })()`;
}

check(session, 'Every task card displays its owner', async () => {
  const all = await session.eval(
    `[...document.querySelectorAll('article')].map(a => ({
      title: a.querySelector('h3')?.textContent ?? '',
      hasName: !!a.querySelector('[data-owner-name]'),
      hasInitials: !!a.querySelector('[data-owner-initials]'),
    }))`
  );
  assert.equal(all.length, 4, 'four seed cards expected');
  for (const card of all) {
    assert.equal(card.hasName, true, `card "${card.title}" is missing the owner name`);
    assert.equal(card.hasInitials, true, `card "${card.title}" is missing the owner avatar`);
  }
  const expected: Record<string, string> = {
    'Add the task CRUD modal': 'Solo Developer',
    'Bug: cards ignore the design tokens': 'Solo Developer',
    'Design system (DESIGN.md + tokens)': 'Demo Reviewer',
    'Complete the PRD review': 'Solo Developer',
  };
  for (const [title, name] of Object.entries(expected)) {
    const info = await session.eval(ownerInfoExpr(title));
    assert.ok(info, `card "${title}" not found`);
    assert.equal(info.name, name, `owner of "${title}" should be ${name}`);
  }
});

check(session, 'Owner initials are correct', async () => {
  const expected: Record<string, string> = {
    'Add the task CRUD modal': 'SD',
    'Bug: cards ignore the design tokens': 'SD',
    'Design system (DESIGN.md + tokens)': 'DR',
    'Complete the PRD review': 'SD',
  };
  for (const [title, initials] of Object.entries(expected)) {
    const info = await session.eval(ownerInfoExpr(title));
    assert.ok(info, `card "${title}" not found`);
    assert.equal(info.initials, initials, `avatar of "${title}" should read ${initials}`);
  }
});

check(session, 'The handoff dropdown offers only the three TEAM values', async () => {
  const options = await session.eval(
    `[...document.querySelectorAll('article')].map(a =>
      [...a.querySelector('select[data-field="handoff"]').options].map(o => o.value))`
  );
  assert.equal(options.length, 4, 'four cards expected');
  for (const list of options) {
    assert.deepEqual(list, TEAM, 'handoff options must be exactly the three TEAM values in order');
  }
});

check(session, 'The handoff dropdown does not open the edit modal', async () => {
  assert.equal(await session.setCardHandoff('Add the task CRUD modal', 'Demo Reviewer'), true, 'handoff select not found');
  await session.settle();
  assert.equal(await session.dialogOpen(), false, 'using the handoff dropdown must not open the edit modal');
});

check(session, 'Changing owner via the handoff dropdown updates the card immediately', async () => {
  assert.equal(await session.setCardHandoff('Add the task CRUD modal', 'Demo Designer'), true, 'handoff select not found');
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Add the task CRUD modal')); return c && c.querySelector('[data-owner-name]').textContent === 'Demo Designer'; })()`,
    'card owner name updated'
  );
  const info = await session.eval(ownerInfoExpr('Add the task CRUD modal'));
  assert.equal(info.name, 'Demo Designer');
  assert.equal(info.initials, 'DD');
});

check(session, 'A confirmation toast appears after reassignment and auto-dismisses', async () => {
  // Let any toast from the previous test expire first.
  await session.waitFor(`!document.querySelector('[data-toast]')`, 'previous toast cleared', 4000);
  assert.equal(await session.setCardHandoff('Add the task CRUD modal', 'Demo Reviewer'), true, 'handoff select not found');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.trim() === 'Assigned to Demo Reviewer.'`,
    'toast with the new assignee name'
  );
  const toastInfo = await session.eval(`(() => {
    const t = document.querySelector('[data-toast]');
    return {
      role: t.getAttribute('role'),
      ariaLive: t.getAttribute('aria-live'),
      pointerEvents: getComputedStyle(t).pointerEvents,
    };
  })()`);
  assert.equal(toastInfo.role, 'status', 'toast should use role="status"');
  assert.equal(toastInfo.ariaLive, 'polite', 'toast should be aria-live="polite"');
  assert.equal(toastInfo.pointerEvents, 'none', 'toast must not block interactions behind it');
  // Auto-dismiss after ~2.5 s.
  await session.waitFor(`!document.querySelector('[data-toast]')`, 'toast auto-dismissed', 5000);
});

check(session, 'Reassignment preserves all unrelated task fields', async () => {
  const readStored = `JSON.parse(localStorage.getItem('vibetracker.tasks')).find(t => t.id === 'seed-crud-modal')`;
  const before = await session.eval(readStored);
  assert.equal(await session.setCardHandoff('Add the task CRUD modal', 'Demo Designer'), true, 'handoff select not found');
  await session.waitFor(
    `JSON.parse(localStorage.getItem('vibetracker.tasks')).find(t => t.id === 'seed-crud-modal')?.assignee === 'Demo Designer'`,
    'assignee persisted to localStorage'
  );
  const after = await session.eval(readStored);
  const { assignee: _before, ...beforeRest } = before;
  const { assignee: _after, ...afterRest } = after;
  assert.deepEqual(afterRest, beforeRest, 'only the assignee may change');
  assert.notEqual(after.assignee, before.assignee, 'the assignee itself should change');
});

check(session, 'Reassignment persists after a page refresh', async () => {
  await session.reload();
  const info = await session.eval(ownerInfoExpr('Add the task CRUD modal'));
  assert.ok(info, 'card not found after refresh');
  assert.equal(info.name, 'Demo Designer', 'owner should survive the refresh');
  assert.equal(info.initials, 'DD');
});

check(session, 'Changing the assignee in the modal updates the card', async () => {
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setSelect('#task-assignee', 'Demo Reviewer'), true, 'assignee select not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Add the task CRUD modal')); return c && c.querySelector('[data-owner-name]').textContent === 'Demo Reviewer'; })()`,
    'card owner updated from the modal'
  );
});

check(session, 'Reopening the modal displays the current assignee', async () => {
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const value = await session.eval(`document.getElementById('task-assignee').value`);
  assert.equal(value, 'Demo Reviewer', 'modal should reflect the card owner');
  await session.pressEscape();
});

check(session, 'Missing or unexpected assignee names get a deterministic fallback', async () => {
  const custom = [
    {
      id: 'custom-empty-owner',
      title: 'Empty owner task',
      description: '',
      type: 'feature',
      status: 'todo',
      assignee: '',
      dueDate: null,
      createdDate: '2026-10-01',
      context: '',
      contextTool: null,
      contextUpdatedAt: null,
    },
    {
      id: 'custom-weird-owner',
      title: 'Weird owner task',
      description: '',
      type: 'bug',
      status: 'todo',
      assignee: 'W',
      dueDate: null,
      createdDate: '2026-10-01',
      context: '',
      contextTool: null,
      contextUpdatedAt: null,
    },
  ];
  await session.eval(`localStorage.setItem('vibetracker.tasks', ${JSON.stringify(JSON.stringify(custom))})`);
  await session.reload();
  const empty = await session.eval(ownerInfoExpr('Empty owner task'));
  const weird = await session.eval(ownerInfoExpr('Weird owner task'));
  assert.ok(empty, 'empty-owner card not found');
  assert.ok(weird, 'weird-owner card not found');
  assert.equal(empty.initials, '?', 'a missing assignee should fall back to "?"');
  assert.equal(weird.initials, 'W', 'a single-letter name should show its own initial');
  // Restore the seed board for the remaining tests.
  await session.eval(`localStorage.removeItem('vibetracker.tasks')`);
  await session.reload();
  assert.equal(await session.cardExists('Add the task CRUD modal'), true, 'seed board should be restored');
});

/** In-page: expected active counts (from localStorage, Done excluded) vs. displayed counts. */
function workloadExpr(): string {
  return `(() => {
    const stored = JSON.parse(localStorage.getItem('vibetracker.tasks'));
    const displayed = {};
    for (const it of document.querySelectorAll('[data-workload-item]')) {
      displayed[it.getAttribute('data-workload-name')] =
        Number(it.querySelector('[data-workload-count]').textContent.trim());
    }
    const expected = {};
    for (const t of stored) {
      if (t.status === 'done') continue;
      expected[t.assignee] = (expected[t.assignee] ?? 0) + 1;
    }
    return { displayed, expected, storedCount: stored.length };
  })()`;
}

check(session, 'The workload strip shows active (non-Done) counts per role', async () => {
  const { displayed, expected } = await session.eval(workloadExpr());
  assert.deepEqual(Object.keys(displayed), TEAM, 'workload strip should list the three roles in order');
  const expectedForTeam: Record<string, number> = {};
  for (const name of TEAM) expectedForTeam[name] = expected[name] ?? 0;
  assert.deepEqual(displayed, expectedForTeam, 'displayed counts must match non-Done tasks per role');
});

check(session, 'Workload counts update after a handoff', async () => {
  assert.equal(await session.setCardHandoff('Add the task CRUD modal', 'Demo Designer'), true, 'handoff select not found');
  await session.waitFor(
    `document.querySelector('[data-workload-item][data-workload-name="Demo Designer"] [data-workload-count]').textContent.trim() === '1'`,
    'workload count for Demo Designer updated'
  );
  const { displayed, expected } = await session.eval(workloadExpr());
  const expectedForTeam: Record<string, number> = {};
  for (const name of TEAM) expectedForTeam[name] = expected[name] ?? 0;
  assert.deepEqual(displayed, expectedForTeam, 'displayed counts must reflect the reassignment');
});

check(session, 'No console errors during owner checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
