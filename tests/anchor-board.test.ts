// M11 anchors — the Deliverable Anchor Board. Pure unit tests cover the URL
// validator and the storage normaliser; browser tests drive the four slots
// through the inline editor (add/edit/save/cancel/remove), persistence across
// refreshes, and regression smoke checks for M4–M10. Anchor slots are plain
// divs, so the `article`-based task selectors in older suites keep working.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { normalizeAnchors, validateAnchorUrl } from '../src/utils/anchorUtils.ts';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

// ------------------------------------------------------------ pure unit tests

test('validateAnchorUrl accepts valid http and https URLs', () => {
  assert.equal(validateAnchorUrl('https://example.com'), null);
  assert.equal(validateAnchorUrl('http://example.com'), null);
  assert.equal(
    validateAnchorUrl('https://sub.example.co.uk/path/page.html?utm_source=hack&v=2#section-2'),
    null
  );
});

test('validateAnchorUrl rejects unsafe protocols', () => {
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html,<h1>hi</h1>',
    'vbscript:msgbox(1)',
    'file:///C:/Windows/System32/calc.exe',
    'mailto:test@example.com',
    'ftp://example.com/file',
  ]) {
    assert.notEqual(validateAnchorUrl(bad), null, `${bad} must be rejected`);
  }
});

test('validateAnchorUrl rejects malformed input', () => {
  for (const bad of ['', '   ', 'not a url', 'example.com', 'https://']) {
    assert.notEqual(validateAnchorUrl(bad), null, `${JSON.stringify(bad)} must be rejected`);
  }
});

test('normalizeAnchors returns the four seeded slots for missing or malformed storage', () => {
  for (const bad of [null, undefined, 'nope', {}, 42]) {
    const out = normalizeAnchors(bad);
    assert.deepEqual(out.map((a) => a.id), ['presentation', 'demo', 'report', 'documentation']);
    assert.deepEqual(out.map((a) => a.label), ['Presentation', 'Demo', 'Report', 'Documentation']);
    assert.ok(out.every((a) => a.url === null), 'every slot must come back empty');
  }
});

test('normalizeAnchors fills missing slots and keeps valid stored data', () => {
  const out = normalizeAnchors([
    { id: 'presentation', label: 'Slides', url: 'https://slides.example.com/?v=2#deck' },
  ]);
  assert.equal(out.length, 4);
  assert.equal(out[0].label, 'Slides', 'a stored label wins over the default');
  assert.equal(out[0].url, 'https://slides.example.com/?v=2#deck');
  assert.ok(out.slice(1).every((a) => a.url === null), 'missing slots must come back empty');
  assert.equal(out[1].label, 'Demo');
});

test('normalizeAnchors drops unknown slots and unsafe or malformed stored URLs', () => {
  const out = normalizeAnchors([
    { id: 'presentation', url: 'javascript:alert(1)' },
    { id: 'demo', url: 'https://demo.example.com/live' },
    { id: 'unknown-slot', label: 'Wat', url: 'https://evil.example.com' },
    { id: 'report', url: 42 },
    { id: 'documentation', url: '   ' },
    { label: null },
  ]);
  assert.equal(out.length, 4, 'unknown slots must not survive');
  assert.equal(out[0].url, null, 'unsafe stored URLs must never become links');
  assert.equal(out[1].url, 'https://demo.example.com/live', 'valid stored URLs are preserved');
  assert.equal(out[2].url, null, 'non-string urls must be dropped');
  assert.equal(out[3].url, null, 'blank urls must be dropped');
  assert.ok(out.every((a) => typeof a.label === 'string' && a.label !== ''));
});

// -------------------------------------------------------------- browser tests

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

const SLOT_IDS = ['presentation', 'demo', 'report', 'documentation'];

/** Clear both storage keys and reload, so every check starts from the seeds. */
const resetState = async () => {
  await session.eval(
    `localStorage.removeItem('vibetracker.anchors'); localStorage.removeItem('vibetracker.tasks'); true`
  );
  await session.reload();
};

const readSlotsExpr = `[...document.querySelectorAll('[data-anchor-slot]')].map(s => ({
  id: s.getAttribute('data-anchor-id'),
  label: s.querySelector('h3')?.textContent?.trim() ?? null,
  href: s.querySelector('a[data-anchor-link]')?.getAttribute('href') ?? null,
  hasEmpty: !!s.querySelector('[data-anchor-empty]'),
  hasAdd: !!s.querySelector('button[data-action="add-link"]'),
  hasEdit: !!s.querySelector('button[data-action="edit-link"]'),
  hasRemove: !!s.querySelector('button[data-action="remove-link"]'),
  hasIcon: !!s.querySelector('svg'),
}))`;

const readStoredAnchors = () => session.eval(`JSON.parse(localStorage.getItem('vibetracker.anchors') ?? 'null')`);

check(session, 'The Anchor Board renders exactly four slots with the correct labels and order, above the Kanban', async () => {
  await resetState();
  const slots = await session.eval(readSlotsExpr);
  assert.deepEqual(slots.map((s) => s.id), SLOT_IDS, 'exactly the four locked slot ids, in order');
  assert.deepEqual(slots.map((s) => s.label), ['Presentation', 'Demo', 'Report', 'Documentation']);
  assert.ok(slots.every((s) => s.hasIcon), 'every slot must show its icon');
  const beforeMain = await session.eval(
    `!!(document.querySelector('[data-anchor-board]').compareDocumentPosition(document.querySelector('main')) & Node.DOCUMENT_POSITION_FOLLOWING)`
  );
  assert.equal(beforeMain, true, 'the Anchor Board must sit above the Kanban board');
});

check(session, 'Empty anchors show the empty state and an Add Link button', async () => {
  await resetState();
  const slots = await session.eval(readSlotsExpr);
  assert.equal(slots.length, 4);
  for (const s of slots) {
    assert.equal(s.hasEmpty, true, `${s.id} must show the empty state`);
    assert.equal(s.hasAdd, true, `${s.id} must offer Add Link`);
    assert.equal(s.href, null, `${s.id} must have no link yet`);
    assert.equal(s.hasEdit, false, `${s.id} must not offer Edit Link while empty`);
    assert.equal(s.hasRemove, false, `${s.id} must not offer Remove Link while empty`);
  }
});

check(session, 'A valid URL can be saved into a slot and shows as a clickable link', async () => {
  await resetState();
  const url = 'https://slides.example.com/deck?theme=dark#section-2';
  assert.equal(await session.clickAnchorAction('presentation', 'add-link'), true, 'Add Link not found');
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'inline editor');
  assert.equal(await session.eval(`document.querySelector('input[data-anchor-input]').value`), '', 'add mode starts empty');
  assert.equal(await session.setInputValue('input[data-anchor-input]', url), true);
  assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true, 'Save Link not found');
  await session.waitFor(
    `document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')?.getAttribute('href') === ${JSON.stringify(url)}`,
    'saved link'
  );
  // Editor closed; empty state gone; edit/remove controls now visible.
  assert.equal(await session.eval(`!!document.querySelector('input[data-anchor-input]')`), false);
  const slot = (await session.eval(readSlotsExpr)).find((s) => s.id === 'presentation');
  assert.equal(slot.hasEdit, true, 'Edit Link must appear once a URL exists');
  assert.equal(slot.hasRemove, true, 'Remove Link must appear once a URL exists');
  assert.equal(slot.hasEmpty, false);
  // Persisted under the anchors key.
  const stored = await readStoredAnchors();
  assert.equal(stored.find((a) => a.id === 'presentation').url, url);
  // Saving must not navigate away from the dashboard.
  assert.equal(await session.eval(`document.title`), 'Vibecoding Project Tracker');
  assert.equal(await session.eval(`document.querySelectorAll('main section').length`), 4, 'the board must stay rendered');
});

check(session, 'Saving one anchor never modifies another', async () => {
  await resetState();
  const first = 'https://slides.example.com/';
  assert.equal(await session.clickAnchorAction('presentation', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor 1');
  await session.setInputValue('input[data-anchor-input]', first);
  assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')`, 'link 1');

  const second = 'https://docs.example.com/setup';
  assert.equal(await session.clickAnchorAction('documentation', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor 2');
  await session.setInputValue('input[data-anchor-input]', second);
  assert.equal(await session.clickAnchorAction('documentation', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="documentation"] a[data-anchor-link]')`, 'link 2');

  const stored = await readStoredAnchors();
  assert.equal(stored.find((a) => a.id === 'presentation').url, first, 'presentation must keep its URL');
  assert.equal(stored.find((a) => a.id === 'documentation').url, second);
  assert.equal(stored.find((a) => a.id === 'demo').url, null, 'demo must stay empty');
  assert.equal(stored.find((a) => a.id === 'report').url, null, 'report must stay empty');
});

check(session, 'Saved links open safely in a new tab', async () => {
  await resetState();
  const url = 'https://demo.example.com/live?q=1';
  assert.equal(await session.clickAnchorAction('demo', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', url);
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'link');
  const link = await session.eval(`(() => {
    const a = document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]');
    return { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), title: a.getAttribute('title'), text: a.textContent };
  })()`);
  assert.equal(link.href, url, 'the full destination URL must be preserved');
  assert.equal(link.target, '_blank', 'saved links must open in a new tab');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.title, url);
  assert.equal(link.text, url, 'the URL text must be the full URL (truncated visually only)');
});

check(session, 'An existing URL can be edited (pre-filled) and saved', async () => {
  await resetState();
  const original = 'https://demo.example.com/old';
  const updated = 'https://demo.example.com/v2/final?rev=9#top';
  assert.equal(await session.clickAnchorAction('demo', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', original);
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'link');

  assert.equal(await session.clickAnchorAction('demo', 'edit-link'), true, 'Edit Link not found');
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'edit editor');
  assert.equal(await session.eval(`document.querySelector('input[data-anchor-input]').value`), original, 'the editor must pre-fill the existing URL');
  await session.setInputValue('input[data-anchor-input]', updated);
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true);
  await session.waitFor(
    `document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')?.getAttribute('href') === ${JSON.stringify(updated)}`,
    'updated link'
  );
  const stored = await readStoredAnchors();
  assert.equal(stored.find((a) => a.id === 'demo').url, updated);
});

check(session, 'Cancel preserves the existing URL and empty slots stay empty', async () => {
  await resetState();
  const url = 'https://demo.example.com/keep';
  assert.equal(await session.clickAnchorAction('demo', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', url);
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'link');
  const storedBefore = await session.eval(`localStorage.getItem('vibetracker.anchors')`);

  // Open the editor, change the draft, then cancel.
  assert.equal(await session.clickAnchorAction('demo', 'edit-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'edit editor');
  await session.setInputValue('input[data-anchor-input]', 'https://demo.example.com/discarded');
  assert.equal(await session.clickAnchorAction('demo', 'cancel-link'), true, 'Cancel not found');
  await session.waitFor(`!document.querySelector('input[data-anchor-input]')`, 'editor closed');
  assert.equal(
    await session.eval(`document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')?.getAttribute('href')`),
    url,
    'cancel must keep the saved URL'
  );
  assert.equal(await session.eval(`localStorage.getItem('vibetracker.anchors')`), storedBefore, 'cancel must not touch storage');

  // Cancel on an empty slot leaves it empty.
  assert.equal(await session.clickAnchorAction('report', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', 'https://report.example.com/draft');
  assert.equal(await session.clickAnchorAction('report', 'cancel-link'), true);
  await session.waitFor(`!document.querySelector('input[data-anchor-input]')`, 'editor closed');
  assert.equal(await session.eval(`!!document.querySelector('[data-anchor-id="report"] a[data-anchor-link]')`), false);
  assert.equal((await readStoredAnchors()).find((a) => a.id === 'report').url, null);
});

check(session, 'Removing a URL clears only that slot (the slot itself stays)', async () => {
  await resetState();
  const demoUrl = 'https://demo.example.com/live';
  const reportUrl = 'https://report.example.com/final';
  for (const [slot, url] of [['demo', demoUrl], ['report', reportUrl]]) {
    assert.equal(await session.clickAnchorAction(slot, 'add-link'), true);
    await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, `editor for ${slot}`);
    await session.setInputValue('input[data-anchor-input]', url);
    assert.equal(await session.clickAnchorAction(slot, 'save-link'), true);
    await session.waitFor(`!!document.querySelector('[data-anchor-id="${slot}"] a[data-anchor-link]')`, `link for ${slot}`);
  }

  assert.equal(await session.clickAnchorAction('demo', 'remove-link'), true, 'Remove Link not found');
  await session.waitFor(`!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'demo link removed');
  const slots = await session.eval(readSlotsExpr);
  const demo = slots.find((s) => s.id === 'demo');
  assert.equal(demo.hasEmpty, true, 'the demo slot must return to its empty state');
  assert.equal(demo.hasAdd, true, 'Add Link must come back');
  assert.equal(slots.length, 4, 'all four slots must still render');
  const stored = await readStoredAnchors();
  assert.equal(stored.find((a) => a.id === 'demo').url, null, 'removal stores null');
  assert.equal(stored.find((a) => a.id === 'report').url, reportUrl, 'the report slot must be untouched');
});

check(session, 'Saved URLs persist after a refresh', async () => {
  await resetState();
  const urls = {
    presentation: 'https://slides.example.com/deck?theme=dark#s2',
    report: 'https://report.example.com/final.pdf',
  };
  for (const [slot, url] of Object.entries(urls)) {
    assert.equal(await session.clickAnchorAction(slot, 'add-link'), true);
    await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, `editor for ${slot}`);
    await session.setInputValue('input[data-anchor-input]', url);
    assert.equal(await session.clickAnchorAction(slot, 'save-link'), true);
    await session.waitFor(`!!document.querySelector('[data-anchor-id="${slot}"] a[data-anchor-link]')`, `link for ${slot}`);
  }
  await session.reload();
  const slots = await session.eval(readSlotsExpr);
  assert.equal(slots.find((s) => s.id === 'presentation').href, urls.presentation);
  assert.equal(slots.find((s) => s.id === 'report').href, urls.report);
  assert.equal(slots.find((s) => s.id === 'demo').href, null, 'untouched slots must stay empty');
  const stored = await readStoredAnchors();
  assert.equal(stored.find((a) => a.id === 'presentation').url, urls.presentation);
});

check(session, 'Empty URLs stay empty after a refresh', async () => {
  await resetState();
  // Save, then remove, so the slot's stored url is explicitly null.
  assert.equal(await session.clickAnchorAction('demo', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', 'https://demo.example.com/temp');
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'link');
  assert.equal(await session.clickAnchorAction('demo', 'remove-link'), true);
  await session.waitFor(`!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'link removed');
  await session.reload();
  const demo = (await session.eval(readSlotsExpr)).find((s) => s.id === 'demo');
  assert.equal(demo.href, null, 'the demo URL must stay empty after refresh');
  assert.equal(demo.hasEmpty, true);
  assert.equal(demo.hasAdd, true);
  assert.equal((await readStoredAnchors()).find((a) => a.id === 'demo').url, null);
});

check(session, 'Invalid and unsafe URLs are rejected with a clear validation message', async () => {
  await resetState();
  const storedBefore = await session.eval(`localStorage.getItem('vibetracker.anchors')`);
  assert.equal(await session.clickAnchorAction('presentation', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');

  // Unsafe protocol first — must get the http/https-only message.
  await session.setInputValue('input[data-anchor-input]', 'javascript:alert(1)');
  assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true);
  await session.waitFor(
    `document.querySelector('[data-anchor-error]')?.textContent.trim() === 'Only http:// and https:// links are allowed.'`,
    'unsafe-protocol message'
  );
  const role = await session.eval(`document.querySelector('[data-anchor-error]').getAttribute('role')`);
  assert.equal(role, 'alert', 'the validation message must be announced to assistive tech');

  // Malformed input — every attempt keeps the editor open and stores nothing.
  for (const bad of ['data:text/html,<h1>x</h1>', 'not a url', 'example.com', 'https://']) {
    await session.setInputValue('input[data-anchor-input]', bad);
    assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true);
    await session.waitFor(
      `document.querySelector('[data-anchor-error]')?.textContent.trim().length > 0`,
      `error for ${bad}`
    );
  }
  assert.equal(await session.eval(`!!document.querySelector('input[data-anchor-input]')`), true, 'the editor must stay open after rejected saves');
  assert.equal(await session.eval(`!!document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')`), false, 'no link may appear for rejected input');
  assert.equal(await session.eval(`localStorage.getItem('vibetracker.anchors')`), storedBefore, 'rejected saves must never touch storage');

  // A valid URL then saves cleanly and clears the error.
  await session.setInputValue('input[data-anchor-input]', 'https://slides.example.com/ok');
  assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')`, 'valid link after rejections');
  assert.equal(await session.eval(`!!document.querySelector('[data-anchor-error]')`), false);
});

check(session, 'Query parameters and fragments are preserved exactly', async () => {
  await resetState();
  const url = 'https://demo.example.com/path/deck.html?utm_source=hack&v=2&ref=home#discussion';
  assert.equal(await session.clickAnchorAction('demo', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', url);
  assert.equal(await session.clickAnchorAction('demo', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]')`, 'link');
  assert.equal(
    await session.eval(`document.querySelector('[data-anchor-id="demo"] a[data-anchor-link]').getAttribute('href')`),
    url,
    'the href attribute must keep the query string and fragment byte-for-byte'
  );
  const stored = await readStoredAnchors();
  assert.equal(stored.find((a) => a.id === 'demo').url, url, 'storage must keep the full URL');
});

check(session, 'Anchor operations never modify existing task data', async () => {
  await resetState();
  const tasksBefore = await session.eval(`localStorage.getItem('vibetracker.tasks')`);
  // Exercise add, edit and remove across the presentation slot.
  assert.equal(await session.clickAnchorAction('presentation', 'add-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'editor');
  await session.setInputValue('input[data-anchor-input]', 'https://slides.example.com/deck');
  assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true);
  await session.waitFor(`!!document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')`, 'link');
  assert.equal(await session.clickAnchorAction('presentation', 'edit-link'), true);
  await session.waitFor(`!!document.querySelector('input[data-anchor-input]')`, 'edit editor');
  await session.setInputValue('input[data-anchor-input]', 'https://slides.example.com/deck-v2');
  assert.equal(await session.clickAnchorAction('presentation', 'save-link'), true);
  await session.waitFor(
    `document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')?.getAttribute('href') === 'https://slides.example.com/deck-v2'`,
    'edited link'
  );
  assert.equal(await session.clickAnchorAction('presentation', 'remove-link'), true);
  await session.waitFor(`!document.querySelector('[data-anchor-id="presentation"] a[data-anchor-link]')`, 'removed link');
  assert.equal(await session.eval(`localStorage.getItem('vibetracker.tasks')`), tasksBefore, 'task storage must stay byte-identical');
  // Both keys coexist.
  assert.notEqual(await session.eval(`localStorage.getItem('vibetracker.anchors')`), null);
});

check(session, 'Incomplete or unsafe stored anchor data is handled safely', async () => {
  await resetState();
  await session.eval(`localStorage.setItem('vibetracker.anchors', JSON.stringify([
    { id: 'presentation', label: '', url: 'javascript:alert(1)' },
    { id: 'demo', url: 'https://demo.example.com/live?q=1#start' },
    { id: 'unknown-slot', label: 'Wat', url: 'https://evil.example.com' },
  ])); true`);
  await session.reload();
  const slots = await session.eval(readSlotsExpr);
  assert.deepEqual(slots.map((s) => s.id), SLOT_IDS, 'exactly the four locked slots must render');
  assert.deepEqual(
    slots.map((s) => s.label),
    ['Presentation', 'Demo', 'Report', 'Documentation'],
    'blank stored labels must fall back to the defaults'
  );
  assert.equal(slots.find((s) => s.id === 'presentation').href, null, 'an unsafe stored URL must never become a link');
  assert.equal(
    slots.find((s) => s.id === 'demo').href,
    'https://demo.example.com/live?q=1#start',
    'a valid stored URL takes precedence over the seeds'
  );
  assert.equal(slots.find((s) => s.id === 'report').href, null);
  assert.equal(slots.find((s) => s.id === 'documentation').href, null);
});

check(session, 'Existing M4–M10 features still work alongside the Anchor Board', async () => {
  await resetState();
  // M4 status dropdown still moves cards.
  assert.equal(await session.setCardStatus('Complete the PRD review', 'todo'), true, 'status select not found');
  assert.equal(await session.cardInColumn('Complete the PRD review', 'To Do'), true, 'card should move to To Do');
  assert.equal(await session.setCardStatus('Complete the PRD review', 'done'), true, 'status select not found');
  // M7 handoff + toast.
  assert.equal(await session.setCardHandoff('Bug: cards ignore the design tokens', 'Demo Reviewer'), true, 'handoff select not found');
  await session.waitFor(
    `document.querySelector('[data-toast]')?.textContent.trim() === 'Assigned to Demo Reviewer.'`,
    'handoff toast'
  );
  // M6 + M8 card styling still present.
  const styles = await session.eval(`(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('Bug: cards ignore the design tokens'));
    return {
      type: card.getAttribute('data-task-type'),
      badge: card.querySelector('[data-type-badge]')?.textContent.trim().toUpperCase(),
      dueState: card.getAttribute('data-due-state'),
      chip: card.querySelector('[data-due-chip]')?.textContent.trim().toUpperCase() ?? null,
    };
  })()`);
  assert.equal(styles.type, 'bug');
  assert.equal(styles.badge, 'BUG');
  assert.ok(['safe', 'warning', 'overdue'].includes(styles.dueState), `unexpected due state: ${styles.dueState}`);
  assert.ok(['SAFE', 'DUE SOON', 'OVERDUE'].includes(styles.chip), `unexpected due chip: ${styles.chip}`);
  // M5 modal still opens with the M9 AI Context section.
  assert.equal(await session.clickCard('Add the task CRUD modal'), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  assert.equal(await session.eval(`!!document.querySelector('[data-context-section]')`), true, 'AI Context section must still be there');
  await session.pressEscape();
  // M10 copy button still on every card.
  assert.equal(await session.eval(`document.querySelectorAll('article button[data-action="copy-prompt"]').length`), 4);
});

check(session, 'No console errors during anchor-board checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
