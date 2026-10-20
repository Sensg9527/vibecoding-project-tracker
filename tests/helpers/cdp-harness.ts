// Browser harness for the permanent test suite (tests/).
//
// Drives a headless Edge/Chrome through the Chrome DevTools Protocol using
// only Node built-ins (global fetch/WebSocket). Every session launches its
// own browser with a temp user-data-dir, so tests run against isolated
// storage and never touch the developer's real localStorage. Profiles and
// failure screenshots live in the OS temp dir, never in the repo.
//
// The dev server is expected to run at TEST_URL (tests/run.mjs starts it).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';

export const APP_URL = process.env.TEST_URL ?? 'http://localhost:5199';

const BOARD_READY =
  `document.title === 'Vibecoding Project Tracker' && document.querySelectorAll('main section').length === 4`;

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

const BROWSER_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter((p): p is string => !!p);

function findBrowser(): string {
  for (const p of BROWSER_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Edge/Chrome executable found — set EDGE_PATH.');
}

export class BrowserSession {
  private ws!: WebSocket;
  private msgId = 0;
  private pending = new Map<number, Pending>();
  private consoleErrors: string[] = [];
  private closed = false;
  private child: ChildProcess;
  private profileDir: string;
  private shotsDir: string;
  private port: number;

  constructor(child: ChildProcess, profileDir: string, shotsDir: string, port: number) {
    this.child = child;
    this.profileDir = profileDir;
    this.shotsDir = shotsDir;
    this.port = port;
  }

  static async launch(): Promise<BrowserSession> {
    const exe = findBrowser();
    const profileDir = mkdtempSync(join(tmpdir(), 'vibetracker-tests-profile-'));
    const shotsDir = mkdtempSync(join(tmpdir(), 'vibetracker-tests-shots-'));
    const port = 20000 + Math.floor(Math.random() * 20000);
    const child = spawn(
      exe,
      [
        '--headless=new',
        '--disable-gpu',
        `--remote-debugging-port=${port}`,
        '--remote-allow-origins=*',
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
      ],
      { stdio: 'ignore' }
    );
    // Best-effort cleanup if the test process dies unexpectedly.
    process.on('exit', () => {
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          child.kill('SIGKILL');
        }
      } catch {
        /* already gone */
      }
    });
    const session = new BrowserSession(child, profileDir, shotsDir, port);
    await session.connect();
    return session;
  }

  private async connect(): Promise<void> {
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        const targets = (await res.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
        target = targets.find((t) => t.type === 'page');
        if (target) break;
      } catch {
        /* browser not up yet */
      }
      await sleep(500);
    }
    if (!target) throw new Error('Headless browser did not expose a CDP page target');
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('CDP websocket connection failed'));
    });
    this.ws.onmessage = (ev) => this.handleMessage(JSON.parse(String(ev.data)));
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Log.enable');
  }

  private handleMessage(msg: any): void {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      if (msg.params.type === 'error' || msg.params.type === 'warning') {
        this.consoleErrors.push(
          `console.${msg.params.type}: ${msg.params.args.map((a: any) => a.value ?? a.description ?? '').join(' ')}`
        );
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      this.consoleErrors.push(
        `exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`
      );
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      this.consoleErrors.push(`log.error: ${msg.params.entry.text}`);
    } else if (msg.method === 'Page.javascriptDialogOpening') {
      // Auto-accept window.confirm (the delete confirmation). The rejection
      // path is tested by stubbing window.confirm on the page instead — see
      // task-crud.test.ts.
      this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  }

  private send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP call timed out: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (v: unknown) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // --- generic page plumbing ----------------------------------------------------

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(
        'evaluate failed: ' + (res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
      );
    }
    return res.result.value;
  }

  async waitFor(expression: string, label: string, timeoutMs = 20000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        if (await this.eval(expression)) return;
      } catch {
        /* page mid-navigation — retry */
      }
      await sleep(250);
    }
    throw new Error(`Timed out waiting for: ${label}`);
  }

  async nav(): Promise<void> {
    await this.send('Page.navigate', { url: APP_URL });
    await this.waitFor(BOARD_READY, 'board render', 30000);
  }

  async reload(): Promise<void> {
    await this.send('Page.reload', { ignoreCache: true });
    await this.waitFor(BOARD_READY, 'board after reload');
  }

  async screenshot(name: string): Promise<string> {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const file = join(this.shotsDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data as string, 'base64'));
    return file;
  }

  async settle(): Promise<void> {
    await sleep(500);
  }

  assertNoConsoleErrors(): void {
    if (this.consoleErrors.length > 0) {
      throw new Error('Browser console errors:\n' + this.consoleErrors.join('\n'));
    }
  }

  // --- interactions ----------------------------------------------------------------

  async clickButton(label: string): Promise<boolean> {
    return this.eval(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`
    );
  }

  async clickCard(title: string): Promise<boolean> {
    return this.eval(
      `(() => { const a = [...document.querySelectorAll('article[role="button"]')].find(x => x.textContent.includes(${JSON.stringify(title)})); if (!a) return false; a.click(); return true; })()`
    );
  }

  async focusElement(selector: string): Promise<void> {
    await this.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  }

  async insertText(text: string): Promise<void> {
    await this.send('Input.insertText', { text });
  }

  async pressEscape(): Promise<void> {
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  }

  async pressTab(shift = false): Promise<void> {
    const modifiers = shift ? 8 : 0;
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  }

  async pressCtrlA(): Promise<void> {
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
  }

  /** M8: set a React-controlled <input> (e.g. type="date") through the native setter + input/change events. */
  async setInputValue(selector: string, value: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`
    );
  }

  /** M9: set a React-controlled <textarea> through the native setter + input/change events (line breaks preserved). */
  async setTextareaValue(selector: string, value: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`
    );
  }

  /** Set a React-controlled <select> through its native value setter + change event. */
  async setSelect(selector: string, value: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`
    );
  }

  /** Same trick for the status dropdown on a specific card (M7 added a second card select). */
  async setCardStatus(title: string, status: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
        if (!card) return false;
        const sel = card.querySelector('select[data-field="status"]');
        if (!sel) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        set.call(sel, ${JSON.stringify(status)});
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`
    );
  }

  /** M10: the "Copy as Prompt Context" button on a specific card (scripted click — the standard pattern). */
  async clickCopyButton(title: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
        if (!card) return false;
        const b = card.querySelector('button[data-action="copy-prompt"]');
        if (!b) return false;
        b.click();
        return true;
      })()`
    );
  }

  /** M11: a button inside one anchor slot (add-link | edit-link | save-link | cancel-link | remove-link). */
  async clickAnchorAction(slotId: string, action: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const slot = document.querySelector('[data-anchor-slot][data-anchor-id=${JSON.stringify(slotId)}]');
        if (!slot) return false;
        const b = slot.querySelector('button[data-action=${JSON.stringify(action)}]');
        if (!b) return false;
        b.click();
        return true;
      })()`
    );
  }

  /** M7: the "Hand off to" dropdown on a specific card. */
  async setCardHandoff(title: string, assignee: string): Promise<boolean> {
    return this.eval(
      `(() => {
        const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes(${JSON.stringify(title)}));
        if (!card) return false;
        const sel = card.querySelector('select[data-field="handoff"]');
        if (!sel) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        set.call(sel, ${JSON.stringify(assignee)});
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`
    );
  }

  // --- assertions helpers -----------------------------------------------------------

  cardExists(title: string): Promise<boolean> {
    return this.eval(
      `[...document.querySelectorAll('article')].some(a => a.textContent.includes(${JSON.stringify(title)}))`
    );
  }

  cardInColumn(title: string, column: string): Promise<boolean> {
    return this.eval(
      `[...document.querySelectorAll('section[aria-label=${JSON.stringify(column + ' column')}] article')].some(a => a.textContent.includes(${JSON.stringify(title)}))`
    );
  }

  async dialogOpen(): Promise<boolean> {
    return this.eval(`!!document.querySelector('[role="dialog"]')`);
  }

  async activeElementInfo(): Promise<{ tag: string; ariaLabel: string | null; text: string; inDialog: boolean }> {
    return this.eval(`(() => {
      const el = document.activeElement;
      return {
        tag: el ? el.tagName.toLowerCase() : 'none',
        ariaLabel: el ? (el.getAttribute('aria-label') ?? null) : null,
        text: el ? (el.textContent ?? '').trim().slice(0, 60) : '',
        inDialog: !!el && !!el.closest('[role="dialog"]'),
      };
    })()`);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.send('Browser.close');
    } catch {
      /* browser already gone */
    }
    await sleep(300);
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(this.child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        this.child.kill('SIGKILL');
      }
    } catch {
      /* already gone */
    }
    try {
      rmSync(this.profileDir, { recursive: true, force: true });
    } catch {
      /* locked file — OS temp will clean up */
    }
  }
}

/** node:test wrapper that captures a screenshot into the session's temp dir on failure. */
export function check(session: BrowserSession, name: string, fn: () => Promise<void>): void {
  test(name, async () => {
    try {
      await fn();
    } catch (err) {
      let shot = '';
      try {
        shot = await session.screenshot(name.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
      } catch {
        /* screenshot failed — report original error only */
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(shot ? `${msg}\n[screenshot: ${shot}]` : msg);
    }
  });
}
