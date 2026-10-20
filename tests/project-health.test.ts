// M12 secret-sauce — Project Health Dashboard. Pure unit tests cover
// calculateProjectHealth with a fixed clock; browser tests drive the live
// dashboard (counts, percentage, progress bar, collapse/expand, live updates
// after create/delete/status/type/due-date changes, refresh persistence) and
// smoke-check that Kanban + anchor functionality still work alongside it.
// Each browser check re-seeds a controlled 5-task fixture so the checks stay
// independent of each other.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { calculateProjectHealth } from '../src/utils/projectHealthUtils.ts';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

// ---------------------------------------------------------------- date helpers

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shift(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

type ProbeTask = {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'bug';
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assignee: string;
  dueDate: string | null;
  createdDate: string;
  context: string;
  contextTool: string | null;
  contextUpdatedAt: string | null;
};

function mk(id: string, type: 'feature' | 'bug', status: ProbeTask['status'], dueDate: string | null): ProbeTask {
  return {
    id,
    title: id,
    description: 'M12 health probe task.',
    type,
    status,
    assignee: 'Solo Developer',
    dueDate,
    createdDate: '2026-10-01',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  };
}

// --------------------------------------------------- pure unit tests (fixed clock)

// A fixed "today" — local time, no UTC involvement.
const FIXED_TODAY = new Date(2026, 9, 20); // 2026-10-20

test('calculateProjectHealth counts total, completed, percentage, overdue and active bugs', () => {
  const tasks = [
    mk('a', 'feature', 'done', null),
    mk('b', 'feature', 'todo', iso(shift(FIXED_TODAY, 5))),
    mk('c', 'bug', 'in-progress', iso(shift(FIXED_TODAY, 1))),
    mk('d', 'feature', 'in-progress', iso(shift(FIXED_TODAY, -2))),
  ];
  const stats = calculateProjectHealth(tasks, FIXED_TODAY);
  assert.equal(stats.total, 4);
  assert.equal(stats.completed, 1);
  assert.equal(stats.completionPercentage, 25);
  assert.equal(stats.overdue, 1);
  assert.equal(stats.activeBugs, 1);
});

test('calculateProjectHealth handles an empty task list without dividing by zero', () => {
  assert.deepEqual(calculateProjectHealth([], FIXED_TODAY), {
    total: 0,
    completed: 0,
    completionPercentage: 0,
    overdue: 0,
    activeBugs: 0,
  });
});

test('completion percentage rounds to the nearest whole percent', () => {
  const oneOfThree = [mk('a', 'feature', 'done', null), mk('b', 'feature', 'todo', null), mk('c', 'feature', 'todo', null)];
  assert.equal(calculateProjectHealth(oneOfThree, FIXED_TODAY).completionPercentage, 33); // 1/3 ≈ 33.3
  const oneOfEight = Array.from({ length: 8 }, (_, i) => mk(`t${i}`, 'feature', i === 0 ? 'done' : 'todo', null));
  assert.equal(calculateProjectHealth(oneOfEight, FIXED_TODAY).completionPercentage, 13); // 12.5 → 13
});

test('overdue never counts Done tasks, even with a past due date', () => {
  const tasks = [
    mk('a', 'feature', 'done', iso(shift(FIXED_TODAY, -30))),
    mk('b', 'feature', 'todo', iso(shift(FIXED_TODAY, -2))),
  ];
  assert.equal(calculateProjectHealth(tasks, FIXED_TODAY).overdue, 1);
});

test('active bugs never count Done bug tasks', () => {
  const tasks = [
    mk('a', 'bug', 'done', null),
    mk('b', 'bug', 'review', iso(shift(FIXED_TODAY, 3))),
    mk('c', 'feature', 'in-progress', null),
  ];
  assert.equal(calculateProjectHealth(tasks, FIXED_TODAY).activeBugs, 1);
});

test('overdue follows the supplied today — a day rollover changes the count', () => {
  const task = mk('a', 'feature', 'todo', iso(shift(FIXED_TODAY, 1))); // due tomorrow
  assert.equal(calculateProjectHealth([task], FIXED_TODAY).overdue, 0);
  assert.equal(calculateProjectHealth([task], shift(FIXED_TODAY, 2)).overdue, 1);
});

// ------------------------------------------------------------- browser tests

const session = await BrowserSession.launch();
await session.nav(); // enters through the M12 demo login (Continue as Demo)
after(async () => {
  await session.close();
});

// Fixture with dates relative to the real execution date so the suite never
// rots: 5 tasks → total 5, completed 2 (40% — the Done feature and the Done
// bug), overdue 1, active bugs 1.
const now = new Date();
const due = (days: number) => iso(shift(now, days));

const HEALTH_FIXTURE = [
  mk('PH done feature', 'feature', 'done', due(-5)), // Done overrides the past date
  mk('PH active feature', 'feature', 'todo', due(5)),
  mk('PH overdue feature', 'feature', 'in-progress', due(-2)),
  mk('PH active bug', 'bug', 'in-progress', due(1)),
  mk('PH done bug', 'bug', 'done', null),
];

/** Seed the fixture and reload, so every check starts from a known board. */
const loadFixture = async () => {
  await session.eval(`localStorage.setItem('vibetracker.tasks', ${JSON.stringify(JSON.stringify(HEALTH_FIXTURE))})`);
  await session.reload();
};

const readStatsExpr = `(() => {
  const out = {};
  for (const el of document.querySelectorAll('[data-health-stat]')) {
    out[el.getAttribute('data-health-stat')] = el.querySelector('[data-health-value]')?.textContent?.trim() ?? null;
  }
  out.percent = document.querySelector('[data-health-percent]')?.textContent?.trim() ?? null;
  out.barNow = document.querySelector('[data-health-progress]')?.getAttribute('aria-valuenow') ?? null;
  out.barMin = document.querySelector('[data-health-progress]')?.getAttribute('aria-valuemin') ?? null;
  out.barMax = document.querySelector('[data-health-progress]')?.getAttribute('aria-valuemax') ?? null;
  out.barFill = document.querySelector('[data-health-progress-fill]')?.style.width ?? null;
  out.cards = document.querySelectorAll('[data-health-stat]').length;
  return out;
})()`;

const readStats = () => session.eval(readStatsExpr);

check(session, 'The dashboard shows the correct total task count, between the anchors and the Kanban', async () => {
  await loadFixture();
  const stats = await readStats();
  assert.equal(stats.total, '5', 'total tasks must be 5');
  assert.equal(stats.cards, 5, 'all five stat cards must render');
  // Layout: Anchor Board → Project Health → Kanban board.
  const order = await session.eval(`(() => {
    const health = document.querySelector('[data-project-health]');
    const anchors = document.querySelector('[data-anchor-board]');
    const main = document.querySelector('main');
    return {
      afterAnchors: !!(anchors.compareDocumentPosition(health) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeMain: !!(health.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  })()`);
  assert.equal(order.afterAnchors, true, 'Project Health must sit below the Deliverable Anchor Board');
  assert.equal(order.beforeMain, true, 'Project Health must sit above the Kanban board');
});

check(session, 'The dashboard shows the correct completed task count', async () => {
  await loadFixture();
  const stats = await readStats();
  assert.equal(stats.completed, '2');
});

check(session, 'The dashboard shows the correct completion percentage', async () => {
  await loadFixture();
  const stats = await readStats();
  assert.equal(stats.percentage, '40%');
  assert.equal(stats.percent, '40%', 'the percentage must be visible as text, not only as a bar');
});

check(session, 'An empty board shows 0% and zero counts', async () => {
  await session.eval(`localStorage.setItem('vibetracker.tasks', '[]')`);
  await session.reload();
  const stats = await readStats();
  assert.equal(stats.total, '0');
  assert.equal(stats.completed, '0');
  assert.equal(stats.percentage, '0%');
  assert.equal(stats.overdue, '0');
  assert.equal(stats.bugs, '0');
  assert.equal(stats.percent, '0%');
  assert.equal(stats.barNow, '0');
});

check(session, 'The overdue count excludes Done tasks', async () => {
  await loadFixture();
  // The fixture has a Done task whose due date is 5 days in the past — it must
  // not count, so overdue is 1 (the in-progress task due 2 days ago), not 2.
  const stats = await readStats();
  assert.equal(stats.overdue, '1');
});

check(session, 'The active-bug count excludes Done bugs', async () => {
  await loadFixture();
  const stats = await readStats();
  assert.equal(stats.bugs, '1', 'only the in-progress bug counts; the Done bug must not');
});

check(session, 'Creating a task updates the statistics immediately', async () => {
  await loadFixture();
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  await session.focusElement('#task-title');
  await session.insertText('PH new task');
  assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes('PH new task'))`,
    'new card'
  );
  const stats = await readStats();
  assert.equal(stats.total, '6');
  assert.equal(stats.completed, '2');
  assert.equal(stats.percentage, '33%', '2/6 rounds to 33%');
});

check(session, 'Deleting a task updates the statistics immediately', async () => {
  await loadFixture();
  assert.equal(await session.clickCard('PH done feature'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.clickButton('Delete Task'), true, 'Delete Task button not found');
  await session.waitFor(
    `![...document.querySelectorAll('article')].some(a => a.textContent.includes('PH done feature'))`,
    'card removed'
  );
  const stats = await readStats();
  assert.equal(stats.total, '4');
  assert.equal(stats.completed, '1', 'the other Done task (the Done bug) must remain');
  assert.equal(stats.percentage, '25%');
  assert.equal(stats.overdue, '1', 'deleting the Done task must not change the overdue count');
});

check(session, 'Changing a task status updates the statistics immediately', async () => {
  await loadFixture();
  assert.equal(await session.setCardStatus('PH active feature', 'done'), true, 'status select not found');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Done column"] article')].some(a => a.textContent.includes('PH active feature'))`,
    'card in Done'
  );
  const stats = await readStats();
  assert.equal(stats.completed, '3');
  assert.equal(stats.percentage, '60%');
  assert.equal(stats.total, '5');
  assert.equal(stats.overdue, '1');
  assert.equal(stats.bugs, '1');
});

check(session, 'Editing a task type updates the active-bug count', async () => {
  await loadFixture();
  assert.equal(await session.clickCard('PH active feature'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setSelect('#task-type', 'bug'), true, 'type select not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const stats = await readStats();
  assert.equal(stats.bugs, '2', 'the converted feature must now count as an active bug');
});

check(session, 'Editing a due date updates the overdue count', async () => {
  await loadFixture();
  assert.equal(await session.clickCard('PH active feature'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setInputValue('#task-due', due(-1)), true, 'due date input not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const stats = await readStats();
  assert.equal(stats.overdue, '2', 'the re-dated task must now count as overdue');
  assert.equal(stats.bugs, '1', 'the due-date edit must not change the bug count');
});

check(session, 'Statistics remain correct after a refresh', async () => {
  await loadFixture();
  const before = await readStats();
  await session.reload();
  const after = await readStats();
  assert.deepEqual(after, before, 'the dashboard must recompute the same numbers from stored tasks');
});

check(session, 'The progress bar reflects the completion percentage', async () => {
  await loadFixture();
  let stats = await readStats();
  assert.equal(stats.barNow, '40', 'aria-valuenow must match the percentage');
  assert.equal(stats.barMin, '0');
  assert.equal(stats.barMax, '100');
  assert.equal(stats.barFill, '40%', 'the fill width must derive from the percentage');
  // Move a third task to Done → 60%: the bar must follow immediately.
  assert.equal(await session.setCardStatus('PH active feature', 'done'), true, 'status select not found');
  await session.waitFor(`document.querySelector('[data-health-progress]')?.getAttribute('aria-valuenow') === '60'`, 'bar at 60%');
  stats = await readStats();
  assert.equal(stats.barNow, '60');
  assert.equal(stats.barFill, '60%');
  assert.equal(stats.percent, '60%');
  assert.equal(stats.percentage, '60%');
});

check(session, 'Collapsing and expanding the dashboard hides only the statistics', async () => {
  await loadFixture();
  // Expanded by default.
  assert.equal(await session.eval(`!!document.querySelector('#project-health-panel')`), true, 'panel must start expanded');
  assert.equal(
    await session.eval(`document.querySelector('[data-health-toggle]')?.textContent.trim()`),
    'Hide Project Health'
  );
  assert.equal(
    await session.eval(`document.querySelector('[data-health-toggle]')?.getAttribute('aria-expanded')`),
    'true'
  );
  // Collapse.
  await session.eval(`document.querySelector('[data-health-toggle]').click(); true`);
  await session.waitFor(`!document.querySelector('#project-health-panel')`, 'panel hidden');
  assert.equal(
    await session.eval(`document.querySelector('[data-health-toggle]')?.textContent.trim()`),
    'Show Project Health'
  );
  assert.equal(
    await session.eval(`document.querySelector('[data-health-toggle]')?.getAttribute('aria-expanded')`),
    'false'
  );
  const rest = await session.eval(`({
    columns: document.querySelectorAll('main section').length,
    anchors: document.querySelectorAll('[data-anchor-slot]').length,
    cards: document.querySelectorAll('article').length,
  })`);
  assert.equal(rest.columns, 4, 'the Kanban board must stay visible while collapsed');
  assert.equal(rest.anchors, 4, 'the Deliverable Anchor Board must stay visible while collapsed');
  assert.equal(rest.cards, 5, 'the task cards must stay visible while collapsed');
  // Expand again.
  await session.eval(`document.querySelector('[data-health-toggle]').click(); true`);
  await session.waitFor(`!!document.querySelector('#project-health-panel')`, 'panel visible again');
  const stats = await readStats();
  assert.equal(stats.total, '5', 'the stats must be intact after re-expanding');
});

check(session, 'Existing Kanban and anchor functionality still work alongside the dashboard', async () => {
  await loadFixture();
  // M4 status move still works.
  assert.equal(await session.setCardStatus('PH active feature', 'in-progress'), true, 'status select not found');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('PH active feature'))`,
    'card in In Progress'
  );
  // M11 anchor add/save still works and never touches the task list.
  const tasksAfterMove = await session.eval(`localStorage.getItem('vibetracker.tasks')`);
  assert.equal(await session.clickAnchorAction('demo', 'add-link'), true, 'Add Link button not found');
  assert.equal(await session.setInputValue('[data-anchor-input]', 'https://demo.example.com/m12'), true, 'anchor input not found');
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true, 'Save Link button not found');
  await session.waitFor(
    `document.querySelector('[data-anchor-slot][data-anchor-id="demo"] a[data-anchor-link]')?.getAttribute('href') === 'https://demo.example.com/m12'`,
    'saved anchor link'
  );
  assert.equal(
    await session.eval(`localStorage.getItem('vibetracker.tasks')`),
    tasksAfterMove,
    'anchor edits must not modify the task list'
  );
  // M10 copy buttons still render on every card.
  assert.equal(
    await session.eval(`document.querySelectorAll('article button[data-action="copy-prompt"]').length`),
    5,
    'every card must keep its copy-prompt button'
  );
});

check(session, 'No console errors during project-health checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
