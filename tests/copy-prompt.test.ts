// M10 copy-prompt — the markdown formatter (pure, unit-tested in Node) and
// the "Copy as Prompt Context" card button in the browser. Clipboard paths
// are exercised by stubbing navigator.clipboard.writeText / document.execCommand
// on the page (headless browsers have no reliable real clipboard), so success,
// fallback and total-failure flows are all deterministic.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { SEED_TASKS } from '../src/data/seedTasks.ts';
import { formatTaskAsPrompt } from '../src/utils/promptUtils.ts';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

// --------------------------------------------------------- pure formatter tests

function makeTask(overrides: Partial<typeof sample> = {}): typeof sample {
  return {
    id: 'probe-1',
    title: 'Implement Kanban Board',
    description: 'Build a four-column Kanban board with task persistence.',
    type: 'feature',
    status: 'in-progress',
    assignee: 'Solo Developer',
    dueDate: '2026-10-22',
    createdDate: '2026-10-20',
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
    ...overrides,
  };
}

const sample = makeTask();

test('formatTaskAsPrompt includes the title and description', () => {
  const out = formatTaskAsPrompt(sample);
  assert.ok(out.includes('# Task: Implement Kanban Board'), 'output must lead with the task title');
  assert.ok(
    out.includes('Build a four-column Kanban board with task persistence.'),
    'output must include the description'
  );
});

test('formatTaskAsPrompt renders human-readable type and status labels', () => {
  const out = formatTaskAsPrompt(makeTask({ type: 'bug', status: 'done' }));
  assert.ok(out.includes('- Type: Bug'), 'type must be human-readable');
  assert.ok(out.includes('- Status: Done'), 'status must be human-readable');
  assert.ok(!out.includes('- Type: bug'), 'raw type ids must not leak through');
});

test('formatTaskAsPrompt includes assignee and created date', () => {
  const out = formatTaskAsPrompt(sample);
  assert.ok(out.includes('- Assignee: Solo Developer'));
  assert.ok(out.includes('- Created Date: 2026-10-20'));
});

test('formatTaskAsPrompt formats due dates correctly', () => {
  const out = formatTaskAsPrompt(sample);
  assert.ok(out.includes('- Due Date: 2026-10-22'));
});

test('formatTaskAsPrompt renders "Not set" for missing due dates', () => {
  const out = formatTaskAsPrompt(makeTask({ dueDate: null }));
  assert.ok(out.includes('- Due Date: Not set'), 'a null due date must read "Not set"');
});

test('formatTaskAsPrompt includes the AI tool only when selected', () => {
  const withTool = formatTaskAsPrompt(makeTask({ contextTool: 'ChatGPT' }));
  assert.ok(withTool.includes('- AI Tool: ChatGPT'));
  const withoutTool = formatTaskAsPrompt(makeTask({ contextTool: null }));
  assert.ok(!withoutTool.includes('AI Tool'), 'no AI Tool line when the tool is null');
});

test('formatTaskAsPrompt includes the context timestamp when available', () => {
  // Built from a local 14:30 clock so the expected string is timezone-proof:
  // toISOString() → UTC, and the formatter converts back to the same local time.
  const local = new Date(2026, 9, 20, 14, 30);
  const out = formatTaskAsPrompt(makeTask({ contextUpdatedAt: local.toISOString() }));
  assert.ok(out.includes('- Context Last Updated: 20 Oct 2026, 14:30'));
  const withoutTs = formatTaskAsPrompt(makeTask({ contextUpdatedAt: null }));
  assert.ok(!withoutTs.includes('Context Last Updated'), 'no timestamp line when null');
});

test('formatTaskAsPrompt preserves multiline Markdown context exactly', () => {
  const markdown = [
    '### Previous Decisions',
    '- Use React and TypeScript.',
    '',
    '```ts',
    'const x = 1;',
    '```',
    '',
    '### Next Steps',
    '- Verify persistence after refresh.',
  ].join('\n');
  const out = formatTaskAsPrompt(makeTask({ context: markdown }));
  const aiContextIdx = out.indexOf('## AI Context');
  assert.ok(aiContextIdx !== -1, 'AI Context section must exist');
  const section = out.slice(aiContextIdx);
  assert.ok(section.includes(markdown), 'the saved context must appear verbatim (blank lines and fences included)');
  assert.ok(!section.includes('No additional AI context saved.'));
});

test('formatTaskAsPrompt handles tasks without context gracefully', () => {
  const out = formatTaskAsPrompt(makeTask({ context: '', contextTool: null, contextUpdatedAt: null }));
  assert.ok(out.includes('No additional AI context saved.'), 'missing context gets the placeholder');
  assert.ok(out.startsWith('# Task: '), 'output must still lead with the title');
  for (const heading of ['## Task Details', '## Description', '## AI Context']) {
    assert.ok(out.includes(heading), `output must keep the "${heading}" section`);
  }
});

test('formatTaskAsPrompt never mutates the task object', () => {
  const frozen = makeTask({ context: '### Decisions\n- freeze test' });
  // Deep-freeze so any mutation would throw in strict mode.
  (function deepFreeze(o: object) {
    Object.freeze(o);
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') deepFreeze(v);
    }
  })(frozen);
  const before = JSON.stringify(frozen);
  const out = formatTaskAsPrompt(frozen);
  assert.ok(out.length > 0);
  assert.equal(JSON.stringify(frozen), before, 'the formatter must not change the task');
});

// ------------------------------------------------------------------ browser tests

const session = await BrowserSession.launch();
await session.nav();
after(async () => {
  await session.close();
});

// The seed card every clipboard test uses (todo, feature, no context saved).
const PROBE_TITLE = 'Add the task CRUD modal';
const expectedMarkdown = formatTaskAsPrompt(SEED_TASKS.find((t) => t.id === 'seed-crud-modal')!);

/** Stub navigator.clipboard.writeText to capture the copied text (success path). */
const stubClipboardSuccessExpr = `(() => {
  window.__origClipboard = navigator.clipboard;
  window.__origClipboardWrite = navigator.clipboard ? navigator.clipboard.writeText : null;
  window.__copiedTexts = [];
  const stub = { writeText: (t) => { window.__copiedTexts.push(t); return Promise.resolve(); } };
  try {
    Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
  } catch {
    navigator.clipboard = stub;
  }
  return true;
})()`;

/** Restore the real clipboard (and any execCommand stub). */
const restoreClipboardExpr = `(() => {
  window.__origExecCommand != null && (document.execCommand = window.__origExecCommand);
  if (window.__origClipboard !== undefined) {
    try {
      Object.defineProperty(navigator, 'clipboard', { value: window.__origClipboard, configurable: true });
    } catch { /* non-configurable in this build */ }
  } else {
    try { delete navigator.clipboard; } catch { /* ignore */ }
  }
  return true;
})()`;

check(session, 'Every task card shows the Copy as Prompt Context button', async () => {
  const buttons = await session.eval(`[...document.querySelectorAll('article')].map(a => {
    const b = a.querySelector('button[data-action="copy-prompt"]');
    return b ? b.textContent.trim() : null;
  })`);
  assert.equal(buttons.length, 4, 'four seed cards expected');
  for (const label of buttons) {
    assert.equal(label, 'Copy as Prompt Context', 'every card must show the button with the exact label');
  }
});

check(session, 'Copying does not open the edit modal and does not modify localStorage', async () => {
  const storedBefore = await session.eval(`localStorage.getItem('vibetracker.tasks')`);
  await session.eval(stubClipboardSuccessExpr);
  try {
    assert.equal(await session.clickCopyButton(PROBE_TITLE), true, 'copy button not found');
    await session.waitFor(
      `document.querySelector('[data-toast]')?.textContent.trim() === 'Context copied — ready to paste.'`,
      'success toast'
    );
    assert.equal(await session.dialogOpen(), false, 'copying must not open the edit modal');
    const storedAfter = await session.eval(`localStorage.getItem('vibetracker.tasks')`);
    assert.equal(storedAfter, storedBefore, 'copying must never modify stored tasks');
    // The card itself must be untouched (status + assignee + column).
    assert.equal(await session.cardInColumn(PROBE_TITLE, 'To Do'), true, 'task must stay in To Do');
    const owner = await session.eval(
      `[...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(PROBE_TITLE)})).querySelector('[data-owner-name]').textContent`
    );
    assert.equal(owner, 'Solo Developer', 'copying must not change the assignee');
  } finally {
    await session.eval(restoreClipboardExpr);
  }
});

check(session, 'The clipboard receives the expected Markdown', async () => {
  await session.eval(stubClipboardSuccessExpr);
  try {
    assert.equal(await session.clickCopyButton(PROBE_TITLE), true, 'copy button not found');
    await session.waitFor(`window.__copiedTexts?.length === 1`, 'clipboard write');
    const copied = await session.eval(`window.__copiedTexts[0]`);
    assert.equal(copied, expectedMarkdown, 'clipboard must receive exactly the formatted markdown');
  } finally {
    await session.eval(restoreClipboardExpr);
  }
});

check(session, 'A successful copy displays the correct toast', async () => {
  await session.eval(stubClipboardSuccessExpr);
  try {
    assert.equal(await session.clickCopyButton(PROBE_TITLE), true, 'copy button not found');
    await session.waitFor(
      `document.querySelector('[data-toast]')?.textContent.trim() === 'Context copied — ready to paste.'`,
      'success toast'
    );
    const toast = await session.eval(`(() => {
      const t = document.querySelector('[data-toast]');
      return { role: t.getAttribute('role'), ariaLive: t.getAttribute('aria-live'), pointerEvents: getComputedStyle(t).pointerEvents };
    })()`);
    assert.equal(toast.role, 'status');
    assert.equal(toast.ariaLive, 'polite');
    assert.equal(toast.pointerEvents, 'none', 'the toast must not block interactions');
    // Auto-dismisses like every other toast.
    await session.waitFor(`!document.querySelector('[data-toast]')`, 'toast auto-dismissed', 5000);
  } finally {
    await session.eval(restoreClipboardExpr);
  }
});

check(session, 'A clipboard failure falls back to execCommand copy', async () => {
  await session.eval(`(() => {
    window.__origClipboard = navigator.clipboard;
    window.__origExecCommand = document.execCommand;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('NotAllowedError: permission denied')) },
      configurable: true,
    });
    // Record what the fallback tried to copy from the temp textarea.
    document.execCommand = (cmd) => {
      if (cmd === 'copy') { window.__execCopied = document.activeElement?.value ?? null; return true; }
      return false;
    };
    return true;
  })()`);
  try {
    assert.equal(await session.clickCopyButton(PROBE_TITLE), true, 'copy button not found');
    await session.waitFor(
      `document.querySelector('[data-toast]')?.textContent.trim() === 'Context copied — ready to paste.'`,
      'success toast via the fallback'
    );
    const fallbackCopied = await session.eval(`window.__execCopied`);
    assert.equal(fallbackCopied, expectedMarkdown, 'the fallback must copy the full markdown');
    assert.equal(await session.eval(`!!document.querySelector('[data-manual-copy]')`), false, 'no manual dialog when the fallback succeeded');
    // The temp textarea must not linger in the DOM.
    assert.equal(await session.eval(`document.body.querySelectorAll('textarea[aria-hidden="true"]').length`), 0, 'temp textarea must be removed');
  } finally {
    await session.eval(restoreClipboardExpr);
  }
});

check(session, 'When both copying methods fail, the markdown is available to copy manually', async () => {
  await session.eval(`(() => {
    window.__origClipboard = navigator.clipboard;
    window.__origExecCommand = document.execCommand;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('NotAllowedError: permission denied')) },
      configurable: true,
    });
    document.execCommand = () => false;
    return true;
  })()`);
  try {
    assert.equal(await session.clickCopyButton(PROBE_TITLE), true, 'copy button not found');
    await session.waitFor(
      `document.querySelector('[data-toast]')?.textContent.trim() === "Couldn't copy automatically. Select the text to copy manually."`,
      'failure toast'
    );
    await session.waitFor(`!!document.querySelector('[data-manual-copy]')`, 'manual-copy dialog');
    const dialog = await session.eval(`(() => {
      const d = document.querySelector('[data-manual-copy]');
      const ta = d.querySelector('textarea');
      return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), text: ta.value, readOnly: ta.readOnly };
    })()`);
    assert.equal(dialog.role, 'dialog');
    assert.equal(dialog.modal, 'true');
    assert.equal(dialog.text, expectedMarkdown, 'the dialog must expose the full generated markdown');
    assert.equal(dialog.readOnly, true, 'the textarea must be selectable, not editable');
    // Close via the Close button.
    assert.equal(await session.clickButton('Close'), true, 'Close button not found');
    await session.waitFor(`!document.querySelector('[data-manual-copy]')`, 'dialog closed');
  } finally {
    await session.eval(restoreClipboardExpr);
  }
});

check(session, 'The copy button is keyboard-accessible and Enter/Space on it never opens the modal', async () => {
  await session.eval(stubClipboardSuccessExpr);
  try {
    const result = await session.eval(`(() => {
      const b = document.querySelector('button[data-action="copy-prompt"]');
      b.focus();
      for (const key of ['Enter', ' ']) {
        b.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }
      return document.activeElement === b;
    })()`);
    assert.equal(result, true, 'the button must be focusable');
    await session.settle();
    assert.equal(await session.dialogOpen(), false, 'Enter/Space on the copy button must not open the edit modal');
  } finally {
    await session.eval(restoreClipboardExpr);
  }
});

check(session, 'Previous task interactions keep working after copy-prompt', async () => {
  // M4 status dropdown.
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
  // M5 modal still opens with the M9 AI Context section pre-filled.
  assert.equal(await session.clickCard(PROBE_TITLE), true, 'card not found');
  await session.waitFor(`!!document.querySelector('[role="dialog"]')`, 'edit modal');
  const modal = await session.eval(`(() => ({
    context: document.getElementById('task-context').value,
    tool: document.getElementById('task-context-tool').value,
  }))()`);
  assert.equal(modal.context, '', 'AI Context must still be part of the modal');
  assert.equal(modal.tool, '', 'AI Tool must default to None');
  await session.pressEscape();
});

check(session, 'No console errors during copy-prompt checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
