// M12 drag & drop — cross-column dragging and same-column reordering.
// Pure unit tests cover the `vibetracker.taskOrder` utilities; browser tests
// drive the real HTML5 drag handlers with synthetic DragEvents (dragstart →
// dragover → drop → dragend on one shared DataTransfer — the same bubbling
// events a real drag produces; headless browsers have no real drag loop),
// starting from either the grip handle or the card body (M12 full-card
// dragging), plus genuine (trusted) CDP mouse clicks for the click-vs-drag
// behaviour and the interactive controls.
// Every browser check re-seeds a controlled 5-task fixture (Review empty),
// so the checks stay independent of each other.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Task } from '../src/types/task.ts';
import {
  insertTaskOrder,
  normalizeTaskOrder,
  sortTasksForColumn,
  taskOrderForCreate,
  taskOrderForDelete,
} from '../src/utils/taskOrderUtils.ts';
import { isClickSuppressed, recordDragEnd } from '../src/utils/dragGuard.ts';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

// --------------------------------------------------- pure unit tests (ordering utils)

function mkTask(id: string): Task {
  return {
    id,
    title: id,
    description: '',
    type: 'feature',
    status: 'todo',
    assignee: 'Solo Developer',
    dueDate: null,
    createdDate: '2026-10-01',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  };
}

test('insertTaskOrder inserts before a target id', () => {
  assert.deepEqual(insertTaskOrder(['a', 'b', 'c'], 'x', 'b'), ['a', 'x', 'b', 'c']);
});

test('insertTaskOrder appends when the target is null or unknown', () => {
  assert.deepEqual(insertTaskOrder(['a', 'b'], 'x', null), ['a', 'b', 'x']);
  assert.deepEqual(insertTaskOrder(['a', 'b'], 'x', 'missing'), ['a', 'b', 'x']);
});

test('insertTaskOrder moves an existing id to the new position', () => {
  assert.deepEqual(insertTaskOrder(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(insertTaskOrder(['a', 'b', 'c'], 'a', null), ['b', 'c', 'a']);
});

test('insertTaskOrder returns the SAME array for no-op drops', () => {
  const order = ['a', 'b', 'c'];
  assert.equal(insertTaskOrder(order, 'b', 'b'), order, 'dropping on itself must not change the order');
  assert.equal(insertTaskOrder(order, 'a', 'b'), order, 'dropping above the next card is the same position');
});

test('sortTasksForColumn orders by the list and keeps unordered tasks at the bottom', () => {
  const tasks = [mkTask('a'), mkTask('b'), mkTask('c'), mkTask('d')];
  assert.deepEqual(
    sortTasksForColumn(tasks, ['c', 'a']).map((t) => t.id),
    ['c', 'a', 'b', 'd'],
    'ordered ids first, then the rest in their original (stable) order'
  );
});

test('sortTasksForColumn leaves the array order untouched for an empty order list', () => {
  const tasks = [mkTask('a'), mkTask('b'), mkTask('c')];
  assert.deepEqual(sortTasksForColumn(tasks, []).map((t) => t.id), ['a', 'b', 'c']);
});

test('sortTasksForColumn ignores order entries that do not match any task', () => {
  const tasks = [mkTask('a'), mkTask('b')];
  assert.deepEqual(sortTasksForColumn(tasks, ['ghost', 'b', 'a']).map((t) => t.id), ['b', 'a']);
});

test('taskOrderForCreate puts new tasks first (top of their column)', () => {
  assert.deepEqual(taskOrderForCreate(['a', 'b'], 'new'), ['new', 'a', 'b']);
});

test('taskOrderForDelete prunes the deleted id', () => {
  assert.deepEqual(taskOrderForDelete(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(taskOrderForDelete(['a'], 'missing'), ['a']);
});

test('normalizeTaskOrder repairs hand-edited storage', () => {
  assert.deepEqual(normalizeTaskOrder(null), []);
  assert.deepEqual(normalizeTaskOrder('garbage'), []);
  assert.deepEqual(normalizeTaskOrder({ nope: true }), []);
  assert.deepEqual(normalizeTaskOrder(['a', 42, 'b', null]), ['a', 'b']);
});

test('dragGuard swallows a click arriving right after a drag end', () => {
  recordDragEnd(1000);
  assert.equal(isClickSuppressed(1000), true, 'the click at the drag end itself is suppressed');
  assert.equal(isClickSuppressed(1100), true, 'inside the guard window the click is suppressed');
  assert.equal(isClickSuppressed(1249), true, 'the last instant of the window is still suppressed');
});

test('dragGuard lets a click through once the window has passed', () => {
  recordDragEnd(1000);
  assert.equal(isClickSuppressed(1250), false, 'exactly at the window edge the click goes through');
  assert.equal(isClickSuppressed(9000), false, 'long after the drag the click opens the modal as usual');
});

// ------------------------------------------------------------- browser tests

const session = await BrowserSession.launch();
await session.nav(); // enters through the M12 demo login (Continue as Demo)
after(async () => {
  await session.close();
});

// Five tasks: To Do [t1, t2], In Progress [t3, t4], Review empty, Done [t5].
// t1 carries AI context + a timestamp so field preservation is checkable.
const FIXTURE: Task[] = [
  {
    id: 't1',
    title: 'Alpha task',
    description: 'First todo.',
    type: 'feature',
    status: 'todo',
    assignee: 'Solo Developer',
    dueDate: null,
    createdDate: '2026-10-01',
    context: '# Notes\nKeep this context.',
    contextTool: 'Claude',
    contextUpdatedAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 't2',
    title: 'Beta task',
    description: 'Second todo.',
    type: 'bug',
    status: 'todo',
    assignee: 'Demo Reviewer',
    dueDate: null,
    createdDate: '2026-10-02',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
  {
    id: 't3',
    title: 'Gamma task',
    description: 'First in progress.',
    type: 'feature',
    status: 'in-progress',
    assignee: 'Demo Designer',
    dueDate: null,
    createdDate: '2026-10-03',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
  {
    id: 't4',
    title: 'Delta task',
    description: 'Second in progress.',
    type: 'feature',
    status: 'in-progress',
    assignee: 'Solo Developer',
    dueDate: null,
    createdDate: '2026-10-04',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
  {
    id: 't5',
    title: 'Epsilon task',
    description: 'The only done task.',
    type: 'feature',
    status: 'done',
    assignee: 'Solo Developer',
    dueDate: null,
    createdDate: '2026-10-05',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  },
];

const ORDER = ['t1', 't2', 't3', 't4', 't5'];

/** Seed the fixture (tasks + order) and reload, so every check starts from a known board. */
const loadFixture = async (order: string[] | null = ORDER) => {
  await session.eval(
    `localStorage.setItem('vibetracker.tasks', ${JSON.stringify(JSON.stringify(FIXTURE))});` +
      `localStorage.setItem('vibetracker.taskOrder', ${JSON.stringify(JSON.stringify(order))}); true`
  );
  await session.reload();
};

const columnIds = (label: string) =>
  session.eval(
    `[...document.querySelectorAll('section[aria-label=${JSON.stringify(label + ' column')}] article')].map(a => a.getAttribute('data-task-id'))`
  );

const columnTitles = (label: string) =>
  session.eval(
    `[...document.querySelectorAll('section[aria-label=${JSON.stringify(label + ' column')}] article')].map(a => a.querySelector('h3')?.textContent ?? '')`
  );

const storedOrder = () => session.eval(`JSON.parse(localStorage.getItem('vibetracker.taskOrder') ?? '[]')`);

const storedTask = (id: string) =>
  session.eval(`JSON.parse(localStorage.getItem('vibetracker.tasks') ?? '[]').find(t => t.id === ${JSON.stringify(id)})`);

const storageRaw = () =>
  session.eval(`({ tasks: localStorage.getItem('vibetracker.tasks'), order: localStorage.getItem('vibetracker.taskOrder') })`);

check(session, 'Every card is fully draggable and keeps its grip handle', async () => {
  await loadFixture();
  const cards = await session.eval(`(() => {
    const cards = [...document.querySelectorAll('article')];
    return {
      cards: cards.length,
      draggable: cards.filter(a => a.getAttribute('draggable') === 'true').length,
      handles: cards.filter(a => !!a.querySelector('[data-drag-handle]')).length,
    };
  })()`);
  assert.equal(cards.cards, 5, 'the fixture must render five cards');
  assert.equal(cards.draggable, 5, 'the WHOLE card must be draggable (M12 improvement), not just the grip');
  assert.equal(cards.handles, 5, 'every card keeps its six-dot grip as the visual affordance');
});

check(session, 'Dragging To Do → In Progress updates the task status', async () => {
  await loadFixture();
  assert.equal(await session.dragTask('Alpha task', 'In Progress', 'end'), true, 'drag helper must run');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  assert.deepEqual(await columnIds('In Progress'), ['t3', 't4', 't1'], 'the dropped task lands at the bottom');
  assert.equal((await storedTask('t1')).status, 'in-progress', 'the stored status must change');
  assert.deepEqual(await storedOrder(), ['t2', 't3', 't4', 't5', 't1'], 'the order list must move the id to the end');
  // The move is announced through the existing toast (role="status").
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.includes('Moved "Alpha task" to In Progress.')`,
    'move toast'
  );
});

check(session, 'Dragging from the card body works (cross-column)', async () => {
  await loadFixture();
  assert.equal(await session.dragTask('Alpha task', 'In Progress', 'end', 'body'), true, 'body-drag helper must run');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  assert.deepEqual(await columnIds('In Progress'), ['t3', 't4', 't1'], 'the body-dragged task lands at the bottom');
  assert.equal((await storedTask('t1')).status, 'in-progress', 'the stored status must change');
  assert.deepEqual(await storedOrder(), ['t2', 't3', 't4', 't5', 't1'], 'the order list must move the id to the end');
});

check(session, 'Dragging from the six-dot grip still works', async () => {
  await loadFixture();
  assert.equal(await session.dragTask('Alpha task', 'In Progress', 'end', 'handle'), true, 'handle-drag helper must run');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  assert.equal((await storedTask('t1')).status, 'in-progress', 'the grip must keep working as a drag origin');
});

check(session, 'A normal click on the card opens the edit modal (body and grip)', async () => {
  await loadFixture();
  // A genuine (trusted) mouse click on the card body — no movement — opens the modal.
  assert.equal(await session.mouseClickCard('Alpha task', 'body'), true, 'genuine body click must land');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal from a body click');
  await session.pressEscape();
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  // Same for the six-dot grip: it is part of the card now.
  assert.equal(await session.mouseClickCard('Alpha task', 'handle'), true, 'genuine grip click must land');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal from a grip click');
  await session.pressEscape();
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed again');
});

check(session, 'A completed drag never opens the modal — not even via a trailing click', async () => {
  await loadFixture();
  // One page script runs the whole drag AND a click immediately after the
  // dragend (no CDP roundtrips in between), so the click lands well inside
  // the card's post-drag click-guard window.
  await session.eval(`(async () => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Alpha task'));
    const sourceEl = card.querySelector('h3');
    const targetEl = document.querySelector('section[aria-label="In Progress column"]');
    const dt = new DataTransfer();
    const fire = (el, type, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y ?? 0 }));
    fire(sourceEl, 'dragstart', 0);
    await new Promise(r => setTimeout(r, 30));
    const y = targetEl.getBoundingClientRect().bottom - 2;
    fire(targetEl, 'dragover', y);
    await new Promise(r => setTimeout(r, 30));
    fire(targetEl, 'drop', y);
    await new Promise(r => setTimeout(r, 30));
    fire(sourceEl, 'dragend', 0);
    // The card node has moved columns by now — re-query it before clicking.
    [...document.querySelectorAll('article')].find(a => a.textContent.includes('Alpha task')).click();
    return true;
  })()`);
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  assert.equal(await session.dialogOpen(), false, 'neither the drag nor the trailing click may open the modal');
  // Once the guard window expires, a genuine click opens the modal as usual.
  await session.eval(`new Promise(r => setTimeout(r, 400))`);
  assert.equal(await session.mouseClickCard('Alpha task', 'body'), true, 'later genuine click must land');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'a later click must open the modal again');
});

check(session, 'Drags starting on the selects or copy button are cancelled', async () => {
  await loadFixture();
  const before = await storageRaw();
  for (const control of ['status', 'handoff', 'copy'] as const) {
    assert.equal(
      await session.attemptDragFromControl('Alpha task', control, 'In Progress'),
      true,
      `${control} drag attempt must run`
    );
  }
  await session.settle();
  assert.deepEqual(await storageRaw(), before, 'control-origin drags must not write anything');
  assert.deepEqual(await columnIds('To Do'), ['t1', 't2'], 'the board must be unchanged');
  assert.deepEqual(await columnIds('In Progress'), ['t3', 't4']);
  assert.equal(await session.dialogOpen(), false, 'control-origin drags must not open the modal');
});

check(session, 'Genuine mouse clicks keep the selects and copy button working', async () => {
  await loadFixture();
  // Stub the clipboard (headless has no reliable real one) and click the
  // copy button with a genuine mouse click.
  await session.eval(`(() => {
    const stub = { writeText: () => Promise.resolve() };
    try {
      Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
    } catch {
      navigator.clipboard = stub;
    }
    return true;
  })()`);
  assert.equal(await session.mouseClickCard('Beta task', 'copy'), true, 'genuine copy click must land');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.includes('Context copied — ready to paste.')`,
    'copy toast'
  );
  assert.equal(await session.dialogOpen(), false, 'copying must not open the modal');
  // A genuine click on the status select must not open the modal or change
  // the value (the click just opens the native dropdown, closed with Escape).
  assert.equal(await session.mouseClickCard('Beta task', 'status'), true, 'genuine status-select click must land');
  await session.settle();
  assert.equal(await session.dialogOpen(), false, 'clicking a select must not open the modal');
  await session.pressEscape(); // close the native dropdown popup
  await session.settle();
  assert.equal((await storedTask('t2')).status, 'todo', 'a plain click on the select must not change the status');
  // Same for the handoff select.
  assert.equal(await session.mouseClickCard('Beta task', 'handoff'), true, 'genuine handoff-select click must land');
  await session.settle();
  assert.equal(await session.dialogOpen(), false, 'clicking the handoff select must not open the modal');
  await session.pressEscape();
  await session.settle();
  assert.equal((await storedTask('t2')).assignee, 'Demo Reviewer', 'a plain click must not reassign the task');
});

check(session, 'Same-column reordering works from the card body too', async () => {
  await loadFixture();
  assert.deepEqual(await columnIds('To Do'), ['t1', 't2'], 'fixture order sanity');
  assert.equal(await session.dragTask('Alpha task', 'Beta task', 'below', 'body'), true, 'body-drag reorder must run');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="To Do column"] article')].map(a => a.getAttribute('data-task-id')).join(',') === 't2,t1'`,
    'To Do reordered to t2, t1'
  );
  assert.deepEqual(await storedOrder(), ['t2', 't3', 't4', 't5', 't1'], 'the stored order must reflect the reorder');
});

check(session, 'Body-dragged status and order persist after a refresh', async () => {
  await loadFixture();
  await session.dragTask('Beta task', 'Done', 'end', 'body');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Done column"] article')].some(a => a.textContent.includes('Beta task'))`,
    'Beta task in Done'
  );
  await session.reload();
  assert.equal(
    await session.cardInColumn('Beta task', 'Done'),
    true,
    'the body-dragged card must still be in Done after refresh'
  );
  assert.equal((await storedTask('t2')).status, 'done');
  assert.deepEqual(await storedOrder(), ['t1', 't3', 't4', 't5', 't2'], 'the body-drag order must survive the refresh');
});

check(session, 'Dragging Done → To Do works (any direction)', async () => {
  await loadFixture();
  assert.equal(await session.dragTask('Epsilon task', 'To Do', 'end'), true);
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="To Do column"] article')].some(a => a.textContent.includes('Epsilon task'))`,
    'Epsilon task in To Do'
  );
  assert.equal((await storedTask('t5')).status, 'todo', 'a backwards move must update the status');
});

check(session, 'Dragging into an empty column works', async () => {
  await loadFixture();
  assert.deepEqual(await columnIds('Review'), [], 'Review must start empty');
  assert.equal(await session.dragTask('Alpha task', 'Review', 'end'), true);
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Review column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in Review'
  );
  assert.deepEqual(await columnIds('Review'), ['t1'], 'the task lands alone in the empty column');
  assert.equal((await storedTask('t1')).status, 'review');
});

check(session, 'Cross-column changes persist after a refresh', async () => {
  await loadFixture();
  await session.dragTask('Alpha task', 'Done', 'end');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Done column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in Done'
  );
  await session.reload();
  assert.equal(
    await session.cardInColumn('Alpha task', 'Done'),
    true,
    'the moved card must still be in Done after refresh'
  );
  assert.equal((await storedTask('t1')).status, 'done');
});

check(session, 'A drag changes only the status — every other field is preserved', async () => {
  await loadFixture();
  const before = await storedTask('t1');
  await session.dragTask('Alpha task', 'In Progress', 'end');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  const after = await storedTask('t1');
  assert.equal(after.status, 'in-progress');
  assert.deepEqual(
    {
      id: after.id,
      title: after.title,
      description: after.description,
      type: after.type,
      assignee: after.assignee,
      dueDate: after.dueDate,
      createdDate: after.createdDate,
      context: after.context,
      contextTool: after.contextTool,
      contextUpdatedAt: after.contextUpdatedAt,
    },
    {
      id: before.id,
      title: before.title,
      description: before.description,
      type: before.type,
      assignee: before.assignee,
      dueDate: before.dueDate,
      createdDate: before.createdDate,
      context: before.context,
      contextTool: before.contextTool,
      contextUpdatedAt: before.contextUpdatedAt,
    },
    'title, description, type, assignee, dates and AI context must survive a drag byte-identically'
  );
});

check(session, 'Same-column reordering works (drag below another card)', async () => {
  await loadFixture();
  assert.deepEqual(await columnIds('To Do'), ['t1', 't2'], 'fixture order sanity');
  assert.equal(await session.dragTask('Alpha task', 'Beta task', 'below'), true);
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="To Do column"] article')].map(a => a.getAttribute('data-task-id')).join(',') === 't2,t1'`,
    'To Do reordered to t2, t1'
  );
  assert.deepEqual(await storedOrder(), ['t2', 't3', 't4', 't5', 't1'], 'the stored order must reflect the reorder');
  assert.equal((await storedTask('t1')).status, 'todo', 'reordering must not change the status');
});

check(session, 'Reordered positions persist after a refresh', async () => {
  await loadFixture();
  await session.dragTask('Alpha task', 'Beta task', 'below');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="To Do column"] article')].map(a => a.getAttribute('data-task-id')).join(',') === 't2,t1'`,
    'To Do reordered'
  );
  await session.reload();
  assert.deepEqual(await columnIds('To Do'), ['t2', 't1'], 'the reorder must survive the refresh');
  assert.deepEqual(await storedOrder(), ['t2', 't3', 't4', 't5', 't1']);
});

check(session, 'Cross-column insertion lands between the targeted cards', async () => {
  await loadFixture();
  assert.equal(await session.dragTask('Alpha task', 'Delta task', 'above'), true);
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].map(a => a.getAttribute('data-task-id')).join(',') === 't3,t1,t4'`,
    'Alpha inserted between Gamma and Delta'
  );
  assert.deepEqual(await storedOrder(), ['t2', 't3', 't1', 't4', 't5']);
});

check(session, 'Newly created tasks get a predictable position — newest at the top', async () => {
  await loadFixture();
  const create = async (title: string) => {
    assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
    await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
    await session.focusElement('#task-title');
    await session.insertText(title);
    assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
    await session.waitFor(
      `[...document.querySelectorAll('article')].some(a => a.textContent.includes(${JSON.stringify(title)}))`,
      `card ${title}`
    );
  };
  await create('ZZ newest');
  await create('YY newer');
  const titles = await columnTitles('To Do');
  assert.deepEqual(titles, ['YY newer', 'ZZ newest', 'Alpha task', 'Beta task'], 'newest first, above the existing cards');
  const order = await storedOrder();
  assert.equal(order.length, 7, 'both new ids must be recorded');
  assert.deepEqual(order.slice(2), ORDER, 'the existing ids keep their relative order');
  assert.equal(order[0] === order[1], false, 'the two new ids must be distinct');
  assert.equal(ORDER.includes(order[0]) || ORDER.includes(order[1]), false, 'the new ids must be fresh');
});

check(session, 'The status dropdown still works and does not reorder cards', async () => {
  await loadFixture();
  assert.equal(await session.setCardStatus('Beta task', 'review'), true, 'the card status dropdown must still work');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Review column"] article')].some(a => a.textContent.includes('Beta task'))`,
    'Beta task in Review'
  );
  assert.equal((await storedTask('t2')).status, 'review');
  assert.deepEqual(await storedOrder(), ORDER, 'a dropdown move must leave the stored order untouched');
});

check(session, 'Dragging does not open the task modal and cleans up drag visuals', async () => {
  await loadFixture();
  await session.dragTask('Alpha task', 'In Progress', 'end');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  assert.equal(await session.dialogOpen(), false, 'a drag must never open the edit modal');
  const leftovers = await session.eval(`({
    indicators: document.querySelectorAll('[data-drop-indicator]').length,
    highlighted: document.querySelectorAll('main section[class*="ring-"]').length,
  })`);
  assert.deepEqual(leftovers, { indicators: 0, highlighted: 0 }, 'drop indicator and column highlight must clear after the drag');
});

check(session, 'Copy and handoff controls still work after a drag', async () => {
  await loadFixture();
  await session.dragTask('Alpha task', 'In Progress', 'end');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="In Progress column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in In Progress'
  );
  // Stub the clipboard (headless has no reliable real one) and copy Beta task.
  await session.eval(`(() => {
    window.__origClipboard = navigator.clipboard;
    const stub = { writeText: () => Promise.resolve() };
    try {
      Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
    } catch {
      navigator.clipboard = stub;
    }
    return true;
  })()`);
  assert.equal(await session.clickCopyButton('Beta task'), true, 'the copy button must still work');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.includes('Context copied — ready to paste.')`,
    'copy toast'
  );
  assert.equal(await session.setCardHandoff('Beta task', 'Demo Designer'), true, 'the handoff dropdown must still work');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.includes('Assigned to Demo Designer.')`,
    'handoff toast'
  );
  assert.equal((await storedTask('t2')).assignee, 'Demo Designer');
});

check(session, 'Project Health statistics and column counts update after a drag', async () => {
  await loadFixture();
  assert.equal(await session.dragTask('Alpha task', 'Done', 'end'), true);
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Done column"] article')].some(a => a.textContent.includes('Alpha task'))`,
    'Alpha task in Done'
  );
  const stats = await session.eval(`({
    completed: document.querySelector('[data-health-stat="completed"] [data-health-value]')?.textContent?.trim(),
    percent: document.querySelector('[data-health-percent]')?.textContent?.trim(),
    counts: [...document.querySelectorAll('section[aria-label$="column"]')].map(s => s.querySelector('[aria-label$="tasks"]')?.getAttribute('aria-label')),
  })`);
  assert.equal(stats.completed, '2', 'the completed count must rise from 1 to 2');
  assert.equal(stats.percent, '40%', 'the completion percentage must rise from 20% to 40%');
  assert.deepEqual(stats.counts, ['1 tasks', '2 tasks', '0 tasks', '2 tasks'], 'column counts must follow the move');
});

check(session, 'Cancelled and invalid drags leave persistence untouched', async () => {
  await loadFixture();
  const before = await storageRaw();
  assert.equal(await session.cancelDrag('Alpha task'), true, 'cancel helper must run');
  assert.deepEqual(await storageRaw(), before, 'a cancelled drag must not write anything');
  // An invalid drop: no dragstart ever recorded the id, and the DataTransfer
  // carries nothing — the handler must ignore it.
  await session.eval(`(() => {
    const section = document.querySelector('section[aria-label="In Progress column"]');
    const dt = new DataTransfer();
    const y = section.getBoundingClientRect().bottom - 2;
    section.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }));
    section.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }));
    return true;
  })()`);
  await session.settle();
  assert.deepEqual(await storageRaw(), before, 'an invalid drop must not write anything');
  assert.deepEqual(await columnIds('To Do'), ['t1', 't2'], 'the board must be unchanged');
});

check(session, 'Tasks without ordering info remain visible at the bottom of their column', async () => {
  await loadFixture(['t2']); // only Beta has ordering info
  assert.deepEqual(await columnIds('To Do'), ['t2', 't1'], 'unordered tasks render after the ordered ones');
  assert.deepEqual(await columnIds('In Progress'), ['t3', 't4'], 'fully unordered columns keep their array order');
  assert.deepEqual(await columnIds('Done'), ['t5']);
  // Hand-edited garbage in the order key must not break the board.
  await session.eval(`localStorage.setItem('vibetracker.taskOrder', '"not-an-array"')`);
  await session.reload();
  assert.deepEqual(await columnIds('To Do'), ['t1', 't2'], 'garbage order storage falls back to the array order');
});

check(session, 'No runtime console errors during drag interactions', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
