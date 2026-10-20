// localStorage persistence — CRUD + status survive reloads; seeds never overwrite real data.
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

const TITLE = 'Persistence probe task';

check(session, 'A created task survives a refresh', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'create modal');
  await session.focusElement('#task-title');
  await session.insertText(TITLE);
  assert.equal(await session.clickButton('Create Task'), true, 'Create Task button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes(${JSON.stringify(TITLE)}))`,
    'new card'
  );
  await session.reload();
  assert.equal(await session.cardExists(TITLE), true, 'task missing after refresh');
});

check(session, 'An edit survives a refresh', async () => {
  assert.equal(await session.clickCard(TITLE), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  await session.focusElement('#task-title');
  await session.pressCtrlA();
  await session.insertText('Persistence probe edited');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(
    `[...document.querySelectorAll('article')].some(a => a.textContent.includes('Persistence probe edited'))`,
    'edited card'
  );
  await session.reload();
  assert.equal(await session.cardExists('Persistence probe edited'), true, 'edit lost after refresh');
});

check(session, 'A status change survives a refresh', async () => {
  assert.equal(await session.setCardStatus('Persistence probe edited', 'review'), true, 'dropdown not found');
  await session.waitFor(
    `[...document.querySelectorAll('section[aria-label="Review column"] article')].some(a => a.textContent.includes('Persistence probe edited'))`,
    'card in Review'
  );
  await session.reload();
  assert.equal(await session.cardInColumn('Persistence probe edited', 'Review'), true, 'status change lost after refresh');
});

check(session, 'A deletion survives a refresh', async () => {
  assert.equal(await session.clickCard('Persistence probe edited'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.clickButton('Delete Task'), true, 'Delete Task button not found');
  await session.waitFor(
    `![...document.querySelectorAll('article')].some(a => a.textContent.includes('Persistence probe edited'))`,
    'card removed'
  );
  await session.reload();
  assert.equal(await session.cardExists('Persistence probe edited'), false, 'deleted task reappeared after refresh');
});

check(session, 'Pre-existing localStorage data is not overwritten by seed tasks', async () => {
  const custom = [
    {
      id: 'custom-existing-task',
      title: 'My pre-existing task',
      description: 'Stored before the app ever seeded.',
      type: 'feature',
      status: 'in-progress',
      assignee: 'Demo Reviewer',
      dueDate: null,
      createdDate: '2026-10-01',
      context: '',
      contextTool: null,
      contextUpdatedAt: null,
    },
  ];
  await session.eval(`localStorage.setItem('vibetracker.tasks', ${JSON.stringify(JSON.stringify(custom))})`);
  await session.reload();
  assert.equal(await session.cardExists('My pre-existing task'), true, 'custom task should still be present');
  assert.equal(await session.cardExists('Add the task CRUD modal'), false, 'seed tasks must not be re-inserted over stored data');
  const cardCount = await session.eval(`document.querySelectorAll('article').length`);
  assert.equal(cardCount, 1, 'the board should show only the stored task');
});

check(session, 'An intentionally empty task list stays empty', async () => {
  await session.eval(`localStorage.setItem('vibetracker.tasks', '[]')`);
  await session.reload();
  const cardCount = await session.eval(`document.querySelectorAll('article').length`);
  assert.equal(cardCount, 0, 'no cards should render');
  const emptyMessages = await session.eval(
    `[...document.querySelectorAll('p')].filter(p => p.textContent.includes('Nothing here yet')).length`
  );
  assert.equal(emptyMessages, 4, 'all four columns should show the empty state');
});

check(session, 'No console errors during persistence checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
