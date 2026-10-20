// M6 tag-style — feature vs. bug visual differentiation.
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

// #16A34A / #DC2626 as the browser reports them in computed styles.
const FEATURE_GREEN = 'rgb(22, 163, 74)';
const BUG_RED = 'rgb(220, 38, 38)';

function borderColorExpr(title: string): string {
  return `(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
    return card ? getComputedStyle(card).borderLeftColor : null;
  })()`;
}

function badgeInfoExpr(title: string): string {
  return `(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
    const badge = card ? card.querySelector('[data-type-badge]') : null;
    if (!badge) return null;
    const svg = badge.querySelector('svg');
    return {
      text: badge.textContent.trim().toUpperCase(),
      hasIcon: !!svg,
      iconMarkup: svg ? svg.outerHTML : '',
    };
  })()`;
}

check(session, 'Feature cards have a green accent stripe', async () => {
  const color = await session.eval(borderColorExpr('Add the task CRUD modal'));
  assert.equal(color, FEATURE_GREEN);
});

check(session, 'Feature cards show a visible FEATURE label', async () => {
  const badge = await session.eval(badgeInfoExpr('Add the task CRUD modal'));
  assert.ok(badge, 'no type badge found');
  assert.equal(badge.text, 'FEATURE');
  assert.equal(badge.hasIcon, true, 'feature badge should include an icon');
});

check(session, 'Bug cards have a red accent stripe', async () => {
  const color = await session.eval(borderColorExpr('Bug: cards ignore the design tokens'));
  assert.equal(color, BUG_RED);
});

check(session, 'Bug cards show a visible BUG label', async () => {
  const badge = await session.eval(badgeInfoExpr('Bug: cards ignore the design tokens'));
  assert.ok(badge, 'no type badge found');
  assert.equal(badge.text, 'BUG');
  assert.equal(badge.hasIcon, true, 'bug badge should include an icon');
});

check(session, 'Feature and bug badges use distinguishable icons', async () => {
  const feature = await session.eval(badgeInfoExpr('Add the task CRUD modal'));
  const bug = await session.eval(badgeInfoExpr('Bug: cards ignore the design tokens'));
  assert.notEqual(feature.iconMarkup, bug.iconMarkup, 'feature and bug icons should differ');
});

check(session, 'Changing a task type in the modal updates its styling', async () => {
  // Flip the seed feature card to a bug via the M5 edit modal.
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.setSelect('#task-type', 'bug'), true, 'type select not found');
  assert.equal(await session.clickButton('Save Changes'), true, 'Save Changes button not found');
  await session.waitFor(`!document.querySelector('[role="dialog"]')`, 'modal closed');
  const color = await session.eval(borderColorExpr('Add the task CRUD modal'));
  assert.equal(color, BUG_RED, 'card should now have the red bug stripe');
  const badge = await session.eval(badgeInfoExpr('Add the task CRUD modal'));
  assert.equal(badge.text, 'BUG', 'badge should now read BUG');
});

check(session, 'Type styling survives a page refresh', async () => {
  await session.reload();
  const color = await session.eval(borderColorExpr('Add the task CRUD modal'));
  assert.equal(color, BUG_RED);
  const badge = await session.eval(badgeInfoExpr('Add the task CRUD modal'));
  assert.equal(badge.text, 'BUG');
});

check(session, 'No console errors during type-styling checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
