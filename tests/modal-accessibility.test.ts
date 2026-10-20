// Modal accessibility — dialog semantics, labels, Escape, focus trap, focus restore.
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

check(session, 'Dialog exposes proper accessibility attributes', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'modal');
  const attrs = await session.eval(`(() => {
    const d = document.querySelector('[role="dialog"]');
    const label = document.getElementById(d.getAttribute('aria-labelledby'));
    return { modal: d.getAttribute('aria-modal'), labelText: label ? label.textContent.trim() : null };
  })()`);
  assert.equal(attrs.modal, 'true');
  assert.equal(attrs.labelText, 'New task');
});

check(session, 'Every form control has an associated label', async () => {
  const ids = ['task-title', 'task-description', 'task-type', 'task-status', 'task-assignee', 'task-due'];
  for (const id of ids) {
    const hasLabel = await session.eval(`!!document.querySelector('label[for="${id}"]')`);
    assert.equal(hasLabel, true, `missing label for #${id}`);
  }
  await session.pressEscape();
});

check(session, 'Escape closes the modal', async () => {
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  await session.pressEscape();
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
});

check(session, 'Tab stays inside the dialog', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'modal');
  for (let i = 0; i < 12; i++) {
    await session.pressTab();
    const info = await session.activeElementInfo();
    assert.equal(info.inDialog, true, `focus escaped the dialog after Tab #${i}: ${JSON.stringify(info)}`);
  }
  await session.pressEscape();
});

check(session, 'Shift+Tab stays inside the dialog', async () => {
  assert.equal(await session.clickButton('+ Task'), true, '+ Task button not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'modal');
  for (let i = 0; i < 12; i++) {
    await session.pressTab(true);
    const info = await session.activeElementInfo();
    assert.equal(info.inDialog, true, `focus escaped the dialog after Shift+Tab #${i}: ${JSON.stringify(info)}`);
  }
  await session.pressEscape();
});

check(session, 'Focus returns to the trigger when the modal closes', async () => {
  // Focus the card first so the restore target is unambiguous, then open it.
  await session.eval(
    `(() => { const a = [...document.querySelectorAll('article[role="button"]')].find(x => x.textContent.includes('Add the task CRUD modal')); a.focus(); return true; })()`
  );
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  await session.pressEscape();
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const info = await session.activeElementInfo();
  assert.equal(info.ariaLabel, 'Edit task "Add the task CRUD modal"', `focus did not return to the card: ${JSON.stringify(info)}`);
});

check(session, 'No console errors during modal accessibility checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
