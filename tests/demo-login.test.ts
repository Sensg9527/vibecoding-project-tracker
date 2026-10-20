// M12 secret-sauce — the demo login page. Every check drives the real login
// flow: no demo session → login page; correct userdemo/userdemo credentials
// or "Continue as Demo" → dashboard (the same sessionStorage flag);
// incorrect credentials → generic error, no access; refresh keeps the session;
// logout clears only the flag. Storage isolation between checks is done by
// clearing the sessionStorage flag and re-navigating (never by stubbing the
// production code).
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { BrowserSession, check } from './helpers/cdp-harness.ts';

const session = await BrowserSession.launch();
await session.gotoLogin(); // fresh profile → the login page appears first
after(async () => {
  await session.close();
});

const FLAG = 'vibetracker.demoSession';

/** Remove the session flag and re-navigate so the next check starts logged out. */
const goToLogin = async () => {
  await session.eval(`sessionStorage.removeItem(${JSON.stringify(FLAG)}); true`);
  await session.gotoLogin();
};

const flagValue = () => session.eval(`sessionStorage.getItem(${JSON.stringify(FLAG)})`);
const boardVisible = () => session.eval(`document.querySelectorAll('main section').length`);

check(session, 'The login page appears when no demo session exists', async () => {
  assert.equal(await session.eval(`!!document.querySelector('[data-login-page]')`), true, 'login page must render');
  assert.equal(await boardVisible(), 0, 'the Kanban board must not be visible before login');
  assert.equal(await flagValue(), null, 'no session flag yet');
  assert.equal(await session.eval(`document.title`), 'Vibecoding Project Tracker');
});

check(session, 'The username and password inputs exist with labels', async () => {
  const inputs = await session.eval(`({
    username: !!document.querySelector('input[data-login-username]'),
    password: !!document.querySelector('input[data-login-password]'),
    labels: [...document.querySelectorAll('[data-login-page] label')].map(l => l.textContent.trim()),
  })`);
  assert.equal(inputs.username, true, 'username input missing');
  assert.equal(inputs.password, true, 'password input missing');
  assert.ok(inputs.labels.includes('Username'), 'username label missing');
  assert.ok(inputs.labels.includes('Password'), 'password label missing');
});

check(session, 'The password field masks its input', async () => {
  assert.equal(
    await session.eval(`document.querySelector('input[data-login-password]')?.getAttribute('type')`),
    'password',
    'the password input must use type="password"'
  );
});

check(session, 'Correct userdemo / userdemo credentials allow entry', async () => {
  await session.loginAs('userdemo', 'userdemo');
  await session.waitFor(`document.querySelectorAll('main section').length === 4`, 'board after login');
  assert.equal(await session.eval(`!!document.querySelector('[data-login-page]')`), false, 'login page must be gone');
  assert.equal(await flagValue(), 'demo', 'the session flag must be recorded');
  // Stored data is untouched — the seed tasks render as usual.
  assert.equal(await session.eval(`document.querySelectorAll('article').length`), 4, 'the seed tasks must still be there');
  // The demo password is never persisted anywhere.
  const stored = await session.eval(`(() => {
    const session = [...Array(sessionStorage.length)].map((_, i) => {
      const k = sessionStorage.key(i);
      return [k, sessionStorage.getItem(k)];
    });
    return { session, tasks: localStorage.getItem('vibetracker.tasks') };
  })()`);
  assert.deepEqual(stored.session, [[FLAG, 'demo']], 'sessionStorage must hold only the session flag');
  assert.equal(stored.tasks.includes('userdemo'), false, 'the password must never be stored in localStorage');
});

check(session, 'Incorrect credentials display a clear error', async () => {
  await goToLogin();
  await session.loginAs('userdemo', 'wrongpass');
  await session.waitFor(`!!document.querySelector('[data-login-error]')`, 'login error');
  const error = await session.eval(`({
    text: document.querySelector('[data-login-error]')?.textContent.trim(),
    role: document.querySelector('[data-login-error]')?.getAttribute('role'),
  })`);
  assert.equal(error.text, 'Invalid username or password.', 'one generic message, no field hints');
  assert.equal(error.role, 'alert', 'the error must be announced as an alert');
  assert.equal(await session.eval(`!!document.querySelector('[data-login-page]')`), true, 'must stay on the login page');
  assert.equal(await boardVisible(), 0, 'the dashboard must not appear');
});

check(session, 'Incorrect credentials do not grant access', async () => {
  // Still on the login page from the previous check; try a wrong username too.
  await session.loginAs('not-a-user', 'userdemo');
  await session.waitFor(`!!document.querySelector('[data-login-error]')`, 'login error persists');
  assert.equal(await flagValue(), null, 'no session flag may be recorded');
  assert.equal(await boardVisible(), 0, 'the dashboard must stay hidden');
  assert.equal(await session.eval(`!!document.querySelector('[data-login-page]')`), true);
});

check(session, 'Continue as Demo grants access through the same session mechanism', async () => {
  await session.enterDemo();
  await session.waitFor(`document.querySelectorAll('main section').length === 4`, 'board after Continue as Demo');
  assert.equal(await flagValue(), 'demo', 'Continue as Demo must record the same session flag');
});

check(session, 'The login state survives a refresh within the same tab session', async () => {
  await session.reload(); // sessionStorage persists across reloads in the same tab
  assert.equal(await session.eval(`document.querySelectorAll('main section').length`), 4, 'board must still render after refresh');
  assert.equal(await flagValue(), 'demo', 'the flag must survive the refresh');
  assert.equal(await session.eval(`!!document.querySelector('[data-login-page]')`), false);
});

check(session, 'Logout returns to the login screen', async () => {
  assert.equal(await session.eval(`!!document.querySelector('button[data-action="logout"]')`), true, 'Log out button missing');
  await session.eval(`document.querySelector('button[data-action="logout"]').click(); true`);
  await session.waitFor(`!!document.querySelector('[data-login-page]')`, 'login page after logout');
  assert.equal(await flagValue(), null, 'logout must clear the session flag');
  assert.equal(await boardVisible(), 0, 'the board must be hidden after logout');
});

check(session, 'Logout clears only the demo session flag — tasks and anchors are untouched', async () => {
  // Seed custom data while logged out, then log in and back out again.
  const customTasks = [
    {
      id: 'm12-preserved-task',
      title: 'Demo login preserved task',
      description: 'Must survive the whole login/logout cycle.',
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
  const customAnchors = [
    { id: 'presentation', label: 'Presentation', url: 'https://slides.example.com/deck' },
    { id: 'demo', label: 'Demo', url: null },
    { id: 'report', label: 'Report', url: null },
    { id: 'documentation', label: 'Documentation', url: null },
  ];
  await session.eval(
    `localStorage.setItem('vibetracker.tasks', ${JSON.stringify(JSON.stringify(customTasks))});` +
      `localStorage.setItem('vibetracker.anchors', ${JSON.stringify(JSON.stringify(customAnchors))}); true`
  );
  // Re-navigate so the app mounts fresh and reads the seeded storage
  // (useLocalStorage only reads localStorage once, at mount).
  await session.gotoLogin();
  await session.enterDemo();
  const tasksAfterLogin = await session.eval(`localStorage.getItem('vibetracker.tasks')`);
  const anchorsAfterLogin = await session.eval(`localStorage.getItem('vibetracker.anchors')`);
  assert.equal(tasksAfterLogin, JSON.stringify(customTasks), 'login must not alter stored tasks');
  assert.equal(anchorsAfterLogin, JSON.stringify(customAnchors), 'login must not alter stored anchors');
  assert.equal(await session.cardExists('Demo login preserved task'), true, 'the stored task must render after login');

  await session.eval(`document.querySelector('button[data-action="logout"]').click(); true`);
  await session.waitFor(`!!document.querySelector('[data-login-page]')`, 'login page after logout');
  assert.equal(await session.eval(`localStorage.getItem('vibetracker.tasks')`), tasksAfterLogin, 'logout must not remove tasks');
  assert.equal(await session.eval(`localStorage.getItem('vibetracker.anchors')`), anchorsAfterLogin, 'logout must not remove anchors');
  assert.equal(await flagValue(), null, 'only the session flag may be cleared');
});

check(session, 'Demo credentials are visibly provided to assessors', async () => {
  const credentials = await session.eval(`(() => {
    const el = document.querySelector('[data-demo-credentials]');
    return {
      text: el?.textContent ?? '',
      username: document.querySelector('[data-demo-username]')?.textContent ?? null,
      password: document.querySelector('[data-demo-password]')?.textContent ?? null,
    };
  })()`);
  assert.ok(credentials.text.includes('Demo access:'), 'the demo access line must be shown');
  assert.equal((credentials.text.match(/userdemo/g) ?? []).length, 2, 'both credentials must be shown');
  assert.equal(credentials.username, 'userdemo');
  assert.equal(credentials.password, 'userdemo');
});

check(session, 'Keyboard navigation and form submission work', async () => {
  // Focus starts on the username input, Tab walks to password, then Sign In.
  await session.waitFor(`document.activeElement?.id === 'login-username'`, 'username focused');
  await session.pressTab();
  await session.waitFor(`document.activeElement?.id === 'login-password'`, 'password focused after Tab');
  await session.pressTab();
  await session.waitFor(
    `document.activeElement?.getAttribute('data-action') === 'sign-in'`,
    'Sign In focused after Tab'
  );
  // Fill the form and submit with a real Enter keypress on the password field
  // (the browser's implicit form submission — the exact user flow).
  await session.setInputValue('[data-login-username]', 'userdemo');
  await session.setInputValue('[data-login-password]', 'userdemo');
  await session.focusElement('#login-password');
  await session.pressEnter();
  await session.waitFor(`document.querySelectorAll('main section').length === 4`, 'board after Enter submission');
  assert.equal(await flagValue(), 'demo');
});

check(session, 'No runtime console errors occur during the demo-login checks', async () => {
  await session.settle();
  session.assertNoConsoleErrors();
});
