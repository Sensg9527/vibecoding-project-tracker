// Task create / edit / delete through the modal (M5 behaviour, re-verified after the M6 refactor).
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

const TITLE = 'CRUD probe task';

check(session, 'Creating a task adds it to the To Do column', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  await session.focusElement('#task-title');
  await session.insertText(TITLE);
  await session.focusElement('#task-description');
  await session.insertText('Created by task-crud.test.ts.');
  assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes(${JSON.stringify(TITLE)}))`,
    'new card on board'
  );
  assert.equal(await session.cardInColumn(TITLE, 'To Do'), true);
});

check(session, 'An empty title is rejected with a validation message', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
  await session.waitFor(`!!document.querySelector('[role="alert"]')`, 'validation message');
  const message = await session.eval(`document.querySelector('[role="alert"]').textContent.trim()`);
  assert.equal(message, 'Please enter a task title.');
  assert.equal(await session.dialogOpen(), true, 'modal should stay open on invalid submit');
  await session.pressEscape();
});

check(session, 'Create mode has no Delete Task button', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  const hasDelete = await session.eval(
    `[...document.querySelectorAll('[role="dialog"] button')].some(b => b.textContent.trim() === 'Delete Task')`
  );
  assert.equal(hasDelete, false);
  await session.pressEscape();
});

check(session, 'Editing a task pre-fills the form and saves updates', async () => {
  assert.equal(await session.clickCard(TITLE), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const heading = await session.eval(`document.getElementById('task-modal-title').textContent.trim()`);
  assert.equal(heading, 'Edit task');
  const prefill = await session.eval(`document.getElementById('task-title').value`);
  assert.equal(prefill, TITLE);
  await session.focusElement('#task-title');
  await session.pressCtrlA();
  await session.insertText('CRUD probe edited');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes('CRUD probe edited'))`,
    'edited card'
  );
  assert.equal(await session.cardExists(TITLE), false, 'old title should be gone');
});

check(session, 'Deleting requires confirmation — rejecting keeps the task', async () => {
  // Stub window.confirm to return false, so we can observe the confirmation
  // call without the real native dialog blocking the page thread.
  await session.eval(
    `window.__origConfirm = window.confirm; window.__confirmCalls = []; window.confirm = (m) => { window.__confirmCalls.push(m); return false; };`
  );
  try {
    assert.equal(await session.clickCard('CRUD probe edited'), true, 'card not found');
    await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
    assert.equal(await session.clickButton('Delete Task'), true, 'Delete Task button not found');
    await sleepMs(300);
    const calls = await session.eval(`window.__confirmCalls`);
    assert.deepEqual(calls, ["Delete this task? This can't be undone."], 'confirm should be called once with the DESIGN.md §5 message');
    assert.equal(await session.cardExists('CRUD probe edited'), true, 'task should survive a rejected delete');
    assert.equal(await session.dialogOpen(), true, 'modal should stay open after a rejected delete');
  } finally {
    await session.eval(`window.confirm = window.__origConfirm;`);
  }
  await session.pressEscape();
});

check(session, 'Deleting with confirmation removes the task', async () => {
  // Real window.confirm this time — the harness auto-accepts it.
  assert.equal(await session.clickCard('CRUD probe edited'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.clickButton('Delete Task'), true, 'Delete Task button not found');
  await session.waitFor(
    `![...document.querySelectorAll('article')].some(a => a.textContent.includes('CRUD probe edited'))`,
    'card removed'
  );
  assert.equal(await session.dialogOpen(), false, 'modal should close after delete');
});

check(session, 'No console errors during CRUD flow', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});

// Small local sleep helper (avoids importing timers in each test body).
function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
