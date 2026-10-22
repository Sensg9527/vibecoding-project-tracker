// Test orchestrator — `npm test`.
//
// Starts the Vite dev server on :5199 (isolated from any dev server the
// developer has running on :5173), then runs the browser test suite with
// Node's built-in test runner. Test files run sequentially because each
// launches its own headless browser with isolated storage.
//
// Run with:  npm test   (or: npm run test)
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const URL = `http://localhost:${PORT}`;

// Keep in sync when adding test files.
const TEST_FILES = [
  'tests/kanban-board.test.ts',
  'tests/task-crud.test.ts',
  'tests/task-type-styling.test.ts',
  'tests/persistence.test.ts',
  'tests/modal-accessibility.test.ts',
  'tests/task-owner.test.ts',
  'tests/due-tint.test.ts',
  'tests/task-context.test.ts',
  'tests/copy-prompt.test.ts',
  'tests/anchor-board.test.ts',
  'tests/project-health.test.ts',
  'tests/demo-login.test.ts',
  'tests/drag-drop.test.ts',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`Dev server did not come up on ${URL} (is the port busy?)`);
}

function killTree(child) {
  if (process.platform === 'win32') {
    return spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  }
  child.kill('SIGTERM');
  return null;
}

const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let serverStderr = '';
server.stderr.on('data', (d) => {
  serverStderr += d;
});

let testCode = 1;
try {
  await waitForServer(30000);
  console.log(`[run] dev server up on ${URL}`);
  const tests = spawn(process.execPath, ['--test', '--test-concurrency=1', ...TEST_FILES], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TEST_URL: URL },
  });
  testCode = await new Promise((resolve) => tests.on('exit', resolve));
  if (testCode !== 0 && serverStderr) {
    console.error('[run] dev server stderr:\n' + serverStderr);
  }
} catch (err) {
  console.error('[run] setup failed:', err.message);
  if (serverStderr) console.error('[run] dev server stderr:\n' + serverStderr);
} finally {
  const killer = killTree(server);
  if (killer) await new Promise((resolve) => killer.on('exit', resolve));
}

process.exit(testCode ?? 1);
