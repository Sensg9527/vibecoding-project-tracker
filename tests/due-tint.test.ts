// M8 due-tint — urgency classification (pure unit tests, fixed clock) + card
// styling in the browser (due dates computed relative to the execution date,
// so the suite is correct on any day it runs).
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getDueState, type DueState } from '../src/utils/dueDateUtils.ts';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

// ---------------------------------------------------------------- date helpers

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shift(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function task(status: string, dueDate: string | null) {
  return { status, dueDate } as { status: string; dueDate: string | null };
}

// --------------------------------------------------- pure unit tests (fixed clock)

// A fixed "today" — local time, no UTC involvement.
const FIXED_TODAY = new Date(2026, 9, 20); // 2026-10-20

test('getDueState: past dates are overdue, today/tomorrow are warning, 2+ days are safe', () => {
  const cases: Array<[number, DueState]> = [
    [-10, 'overdue'],
    [-1, 'overdue'],
    [0, 'warning'],
    [1, 'warning'],
    [2, 'safe'],
    [15, 'safe'],
  ];
  for (const [days, expected] of cases) {
    const due = iso(shift(FIXED_TODAY, days));
    assert.equal(getDueState(task('todo', due), FIXED_TODAY), expected, `due ${due} (${days} days) should be ${expected}`);
  }
});

test('getDueState: done always wins — even over an overdue date', () => {
  assert.equal(getDueState(task('done', iso(shift(FIXED_TODAY, -30))), FIXED_TODAY), 'neutral');
  assert.equal(getDueState(task('done', iso(FIXED_TODAY)), FIXED_TODAY), 'neutral');
  assert.equal(getDueState(task('done', iso(shift(FIXED_TODAY, 5))), FIXED_TODAY), 'neutral');
  assert.equal(getDueState(task('done', null), FIXED_TODAY), 'neutral');
  assert.equal(getDueState(task('done', ''), FIXED_TODAY), 'neutral');
});

test('getDueState: missing, empty or malformed due dates are none', () => {
  for (const bad of [null, '', 'not-a-date', '2026/10/20', '2026-13-45', '2026-02-30', '20-10-2026']) {
    assert.equal(getDueState(task('todo', bad), FIXED_TODAY), 'none', `dueDate ${JSON.stringify(bad)} should be none`);
  }
});

test('getDueState: day differences stay exact across month boundaries and DST shifts', () => {
  // Month-end rollover (Oct 31 → Nov 1).
  const monthEnd = new Date(2026, 9, 31);
  assert.equal(getDueState(task('todo', iso(shift(monthEnd, 1))), monthEnd), 'warning');
  assert.equal(getDueState(task('todo', iso(shift(monthEnd, 2))), monthEnd), 'safe');
  // Across the UK DST end (2026-10-25): midnight-to-midnight is 25h, still one day.
  const dstDay = new Date(2026, 9, 25);
  assert.equal(getDueState(task('todo', iso(shift(dstDay, 1))), dstDay), 'warning');
  assert.equal(getDueState(task('todo', iso(shift(dstDay, -1))), dstDay), 'overdue');
  // Year rollover.
  const yearEnd = new Date(2026, 11, 31);
  assert.equal(getDueState(task('todo', iso(shift(yearEnd, 1))), yearEnd), 'warning');
});

// ------------------------------------------------------------- browser tests

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

// Board injected with dates relative to the real execution date.
const now = new Date();
const due = (days: number) => iso(shift(now, days));

const makeTask = (
  id: string,
  title: string,
  type: 'feature' | 'bug',
  status: 'todo' | 'done',
  dueDate: string | null
) => ({
  id,
  title,
  description: 'M8 probe task.',
  type,
  status,
  assignee: 'Solo Developer',
  dueDate,
  createdDate: '2026-10-01',
  context: '',
  contextTool: null,
  contextUpdatedAt: null,
});

const M8_TASKS = [
  makeTask('m8-safe', 'Due safe task', 'feature', 'todo', due(5)),
  makeTask('m8-today', 'Due today task', 'feature', 'todo', due(0)),
  makeTask('m8-tomorrow', 'Due tomorrow task', 'bug', 'todo', due(1)),
  makeTask('m8-overdue', 'Due overdue task', 'feature', 'todo', due(-3)),
  makeTask('m8-done-overdue', 'Done overdue task', 'feature', 'done', due(-5)),
  makeTask('m8-done-nodate', 'Done no date task', 'bug', 'done', null),
  makeTask('m8-nodate', 'No date task', 'feature', 'todo', null),
  makeTask('m8-rollover', 'Rollover task', 'feature', 'todo', due(1)),
];

// #DBEAFE / #FEF3C7 / #FEE2E2 / #E5E7EB / #FFFFFF as computed styles report them.
const SAFE_BG = 'rgb(219, 234, 254)';
const WARNING_BG = 'rgb(254, 243, 199)';
const OVERDUE_BG = 'rgb(254, 226, 226)';
const NEUTRAL_BG = 'rgb(229, 231, 235)';
const PLAIN_BG = 'rgb(255, 255, 255)';
const FEATURE_GREEN = 'rgb(22, 163, 74)';
const BUG_RED = 'rgb(220, 38, 38)';

function cardInfoExpr(title: string): string {
  return `(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
    if (!card) return null;
    const chip = card.querySelector('[data-due-chip]');
    const badge = card.querySelector('[data-type-badge]');
    return {
      dueState: card.getAttribute('data-due-state'),
      chip: chip ? chip.textContent.trim().toUpperCase() : null,
      bg: getComputedStyle(card).backgroundColor,
      borderLeft: getComputedStyle(card).borderLeftColor,
      badge: badge ? badge.textContent.trim().toUpperCase() : null,
    };
  })()`;
}

await session.eval(`localStorage.setItem('vibetracker.tasks', ${JSON.stringify(JSON.stringify(M8_TASKS))})`);
await session.reload();

check(session, 'Future due dates get SAFE styling', async () => {
  const info = await session.eval(cardInfoExpr('Due safe task'));
  assert.ok(info, 'card not found');
  assert.equal(info.dueState, 'safe');
  assert.equal(info.chip, 'SAFE');
  assert.equal(info.bg, SAFE_BG);
});

check(session, 'Tasks due today get DUE SOON styling', async () => {
  const info = await session.eval(cardInfoExpr('Due today task'));
  assert.equal(info.dueState, 'warning');
  assert.equal(info.chip, 'DUE SOON');
  assert.equal(info.bg, WARNING_BG);
});

check(session, 'Tasks due tomorrow get DUE SOON styling', async () => {
  const info = await session.eval(cardInfoExpr('Due tomorrow task'));
  assert.equal(info.dueState, 'warning');
  assert.equal(info.chip, 'DUE SOON');
  assert.equal(info.bg, WARNING_BG);
});

check(session, 'Past due dates get OVERDUE styling', async () => {
  const info = await session.eval(cardInfoExpr('Due overdue task'));
  assert.equal(info.dueState, 'overdue');
  assert.equal(info.chip, 'OVERDUE');
  assert.equal(info.bg, OVERDUE_BG);
});

check(session, 'Done tasks always get neutral DONE styling', async () => {
  for (const title of ['Done overdue task', 'Done no date task']) {
    const info = await session.eval(cardInfoExpr(title));
    assert.ok(info, `card "${title}" not found`);
    assert.equal(info.dueState, 'neutral', title);
    assert.equal(info.chip, 'DONE', title);
    assert.equal(info.bg, NEUTRAL_BG, title);
  }
});

check(session, 'Done overrides overdue', async () => {
  const info = await session.eval(cardInfoExpr('Done overdue task'));
  assert.equal(info.chip, 'DONE');
  assert.notEqual(info.chip, 'OVERDUE');
  assert.equal(info.bg, NEUTRAL_BG);
});

check(session, 'Tasks without due dates have no urgency indicator', async () => {
  const info = await session.eval(cardInfoExpr('No date task'));
  assert.equal(info.dueState, 'none');
  assert.equal(info.chip, null, 'no due chip should render');
  assert.equal(info.bg, PLAIN_BG, 'card keeps the plain surface');
});

check(session, 'Editing a due date in the modal updates the styling', async () => {
  assert.equal(await session.clickCard('No date task'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setInputValue('#task-due', due(0)), true, 'due date input not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('No date task')); return c && c.getAttribute('data-due-state') === 'warning'; })()`,
    'card re-styled after due date edit'
  );
  const info = await session.eval(cardInfoExpr('No date task'));
  assert.equal(info.chip, 'DUE SOON');
  assert.equal(info.bg, WARNING_BG);
});

check(session, 'Marking a task Done updates its styling immediately', async () => {
  assert.equal(await session.setCardStatus('Due today task', 'done'), true, 'status select not found');
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Due today task')); return c && c.getAttribute('data-due-state') === 'neutral'; })()`,
    'card neutral after moving to Done'
  );
  const info = await session.eval(cardInfoExpr('Due today task'));
  assert.equal(info.chip, 'DONE');
  assert.equal(info.bg, NEUTRAL_BG);
});

check(session, 'Moving a Done task back to an active status recalculates urgency', async () => {
  assert.equal(await session.setCardStatus('Done overdue task', 'todo'), true, 'status select not found');
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Done overdue task')); return c && c.getAttribute('data-due-state') === 'overdue'; })()`,
    'card overdue after moving back to To Do'
  );
  const info = await session.eval(cardInfoExpr('Done overdue task'));
  assert.equal(info.chip, 'OVERDUE');
  assert.equal(info.bg, OVERDUE_BG);
});

check(session, 'Styling is correct after a page refresh', async () => {
  await session.reload();
  const expectations: Record<string, { state: string; chip: string; bg: string }> = {
    'Due safe task': { state: 'safe', chip: 'SAFE', bg: SAFE_BG },
    'Due overdue task': { state: 'overdue', chip: 'OVERDUE', bg: OVERDUE_BG },
    'Due today task': { state: 'neutral', chip: 'DONE', bg: NEUTRAL_BG }, // moved to Done earlier
    'Done overdue task': { state: 'overdue', chip: 'OVERDUE', bg: OVERDUE_BG }, // moved back to To Do earlier
    'Due tomorrow task': { state: 'warning', chip: 'DUE SOON', bg: WARNING_BG },
  };
  for (const [title, exp] of Object.entries(expectations)) {
    const info = await session.eval(cardInfoExpr(title));
    assert.ok(info, `card "${title}" not found after refresh`);
    assert.equal(info.dueState, exp.state, title);
    assert.equal(info.chip, exp.chip, title);
    assert.equal(info.bg, exp.bg, title);
  }
});

check(session, 'M6 feature/bug stripes remain visible on tinted cards', async () => {
  const feature = await session.eval(cardInfoExpr('Due overdue task'));
  const bug = await session.eval(cardInfoExpr('Due tomorrow task'));
  assert.equal(feature.borderLeft, FEATURE_GREEN, 'feature stripe should stay green on an overdue tint');
  assert.equal(bug.borderLeft, BUG_RED, 'bug stripe should stay red on a warning tint');
  assert.equal(feature.badge, 'FEATURE');
  assert.equal(bug.badge, 'BUG');
});

check(session, 'M7 owner display and handoff keep working on tinted cards', async () => {
  const owner = await session.eval(`(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Due safe task'));
    if (!card) return null;
    return {
      name: card.querySelector('[data-owner-name]')?.textContent ?? null,
      initials: card.querySelector('[data-owner-initials]')?.textContent ?? null,
      handoffOptions: [...card.querySelector('select[data-field="handoff"]').options].map(o => o.value),
    };
  })()`);
  assert.equal(owner.name, 'Solo Developer');
  assert.equal(owner.initials, 'SD');
  assert.deepEqual(owner.handoffOptions, ['Solo Developer', 'Demo Reviewer', 'Demo Designer']);
  assert.equal(await session.setCardHandoff('Due safe task', 'Demo Reviewer'), true, 'handoff select not found');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.trim() === 'Assigned to Demo Reviewer.'`,
    'handoff toast'
  );
  const info = await session.eval(ownerInfoExpr('Due safe task'));
  assert.equal(info.name, 'Demo Reviewer');
});

check(session, 'Urgency updates automatically when the local calendar date changes', async () => {
  // 'Rollover task' is due tomorrow → DUE SOON with the real clock.
  let info = await session.eval(cardInfoExpr('Rollover task'));
  assert.equal(info.dueState, 'warning', 'precondition: due tomorrow is warning');

  // Fake clock: advance 2 days so "tomorrow" becomes "yesterday". The app
  // re-checks the date on window focus (and every 60 s) — the focus hook is
  // the same refresh path the timer uses, so the test doesn't wait a minute.
  await session.eval(`(() => {
    window.__RealDate = Date;
    const offset = 2 * 86400000;
    const Fake = class extends window.__RealDate {
      constructor(...args) {
        if (args.length === 0) super(window.__RealDate.now() + offset);
        else super(...args);
      }
      static now() { return window.__RealDate.now() + offset; }
    };
    window.Date = Fake;
    window.dispatchEvent(new Event('focus'));
    return true;
  })()`);
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Rollover task')); return c && c.getAttribute('data-due-state') === 'overdue'; })()`,
    'card overdue after the fake day rollover'
  );

  // Restore the real clock; the app re-checks and returns to DUE SOON.
  await session.eval(`window.Date = window.__RealDate; window.dispatchEvent(new Event('focus')); true`);
  await session.waitFor(
    `(() => { const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Rollover task')); return c && c.getAttribute('data-due-state') === 'warning'; })()`,
    'card warning again after the clock restore'
  );
  info = await session.eval(cardInfoExpr('Rollover task'));
  assert.equal(info.chip, 'DUE SOON');
});

check(session, 'No console errors during due-tint checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});

// Small local helper for the M7-owner assertion above.
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
