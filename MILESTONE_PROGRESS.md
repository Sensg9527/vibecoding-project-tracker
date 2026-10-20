# Milestone Progress — Vibecoding Project Tracker

Records only what has been verified. Git operations (commits, tags, pushes) are handled manually by the developer.

## Status overview

| # | Tag | Status | Notes |
|---|---|---|---|
| 1 | `git-linked` | ✅ Tag present locally | Verified 2026-10-20 via `git tag -l`. Portal/webhook delivery not verified here. |
| 2 | `prd-done` | ✅ Work done · tag not observed locally | PRD.md rewritten as FR (19) + NFR (9) requirements doc, zero `<TODO>` markers. Commit `6ea442b` exists. |
| 3 | `design-done` | ✅ Work done · tag not observed locally | DESIGN.md completed; 12 colour tokens + font stacks in `tailwind.config.js`; `npm run build` passed. Commits `82c62bb` / `d137649` exist. |
| 4 | `data-model` | ✅ Implemented · awaiting browser verification | See below. |
| 5 | `crud-modal` | ✅ Implemented · automated browser tests passed | See below. |
| 6 | `tag-style` | ✅ Implemented · automated browser tests passed | See below. |
| 7 | `task-owner` | ✅ Implemented · automated browser tests passed | See below. |
| 8 | `due-tint` | ✅ Implemented · automated browser tests passed | See below. |
| 9 | `context` | ✅ Implemented · automated browser tests passed | See below. |
| 10 | `copy-prompt` | ✅ Implemented · automated browser tests passed | See below. |
| 11 | `anchors` | ✅ Implemented · automated browser tests passed | See below. |
| 12 | `secret-sauce` | ✅ Implemented · automated browser tests passed | See below. |
| 13 | `pitch-ready` | ⬜ Not started | |

## M4 `data-model` — 2026-10-20

**What was built**

- Typed `Task` model in `src/App.tsx`, matching the locked PRD §5 structure including the M9-reserved `context`, `contextTool`, `contextUpdatedAt` fields with safe defaults (`''`, `null`, `null`).
- `TEAM` updated to the three demonstration assignee values: `Solo Developer`, `Demo Reviewer`, `Demo Designer`.
- Four-column Kanban board (To Do, In Progress, Review, Done) built from the existing `STAGES` constant, with a heading + task count per column.
- Four seed tasks (one per stage) about building the tracker itself; seeds only apply when `vibetracker.tasks` has never been stored.
- Status dropdown on each card moves the task between stages; only `status` changes, every other field is preserved.
- Persistence through the existing `useLocalStorage` hook — state saves automatically on every change.
- Styling follows DESIGN.md: `surface-page` background, `surface-card` cards, 1px borders, rounded corners, dashed empty-state with the M3 microcopy.

**Files modified**

- `src/App.tsx` — data model, seeds, board components (`TaskCard`, `BoardColumn`), status handling.
- `MILESTONE_PROGRESS.md` — this file (created).

**Tests performed**

- `npm run typecheck` — see M4 build log (ran together with build).
- `npm run build` — production build result below.

**Known limitations / manual verification still needed**

- Browser testing was not performed (no browser available in this session). Still to verify by hand: four columns render in order; each column count matches; status changes move cards; a refresh preserves changes; no console errors. Existing localStorage data from before M4 will take precedence over the new seed tasks.

**Deliberately not implemented in M4** — M5 modal CRUD, M6 feature/bug colours, M7 handoff, M8 due-tint, M9 context editor, M10 copy-prompt, M11 anchor board, M12 secret sauce, drag-and-drop.

## M5 `crud-modal` — 2026-10-20

**What was built**

- A reusable `TaskModal` dialog used for both create and edit; closed = modal state `null`, create mode = `task: null`, edit mode = the task.
- Visible **"+ Task"** button in the To Do column header (DESIGN.md §5 label).
- Create mode captures title (required, trimmed), description, type, status, assignee, optional due date. Saving generates a unique id (`crypto.randomUUID` with fallback), sets `createdDate` automatically, initialises `context: ''`, `contextTool: null`, `contextUpdatedAt: null`, adds the task to state, persists via the existing `useLocalStorage` hook, closes the modal; the card lands in the column matching its status.
- Edit mode opens from clicking a card (card is `role="button"`, Enter/Space also works) and is pre-filled; saving updates the existing task in place, preserving id, `createdDate` and the M9 `context*` fields. The M4 status dropdown on each card keeps working — its click/keydown events are stopped from bubbling so it never opens the modal.
- Delete: a red "Delete Task" button appears only in edit mode, confirms via the DESIGN.md §5 microcopy ("Delete this task? This can't be undone."), removes the task, persists, closes the modal; column counts update automatically.
- Modal design follows DESIGN.md §4: centred white dialog, dimmed backdrop, rounded corners, clear labels, primary blue action, secondary Cancel, red Delete, visible `focus-visible` rings.
- Closing supported via Cancel, the ✕ button, Escape and backdrop click; body scroll locks while open.
- Accessibility: `role="dialog"` + `aria-modal` + `aria-labelledby`, initial focus on the title field, focus returns to the trigger on close, and a Tab/Shift+Tab focus trap added this session so keyboard focus cannot land on the page behind the dialog.
- No new dependencies, no backend, no changes to the locked `Task` model or design tokens.

**Files modified**

- `src/App.tsx` — `TaskModal`, modal state handling, create/edit/delete handlers, "+ Task" button, focus trap.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 31 modules, ~815 ms).
- Automated browser tests — 16/16 checks passed in headless Edge against the Vite dev server, driven via the Chrome DevTools Protocol (script kept outside the repo in the OS temp dir, not committed):
  1. Board renders with four columns in order.
  2. "+ Task" opens the create modal.
  3. Creating a task adds the card to the correct (To Do) column.
  4. Refresh preserves the created task.
  5. Clicking a card opens the pre-filled edit modal.
  6. Editing the title updates the card.
  7. Refresh preserves the edit.
  8. The M4 card status dropdown moves the task without opening the modal.
  9. Escape closes the modal.
  10. Cancel closes the modal.
  11. The ✕ button closes the modal.
  12. Delete Task removes the card after confirmation (native confirm auto-accepted).
  13. Refresh preserves the deletion.
  14. The Delete Task button does not appear in create mode.
  15. An empty title is rejected with a validation message.
  16. No console errors or exceptions across the whole run.

**Known limitations / manual verification still needed**

- The automated run is headless-only: a quick human pass in a normal browser is still worthwhile for visual polish (spacing, focus ring appearance) — the functional checklist above is covered. Screenshots from the run are in the OS temp dir.
- Backdrop click also closes the modal (standard behaviour, not in the brief's close list).
- Delete confirmation uses `window.confirm` (native browser dialog) — consistent with the DESIGN.md microcopy, no custom confirm UI.

**Deliberately not implemented in M5** — M6 feature/bug colours, M7 handoff, M8 due-tint, M9 context editor, M10 copy-prompt, M11 anchor board, M12 secret sauce, drag-and-drop.

## M6 `tag-style` + refactor + permanent tests — 2026-10-20

**What was built**

- **Feature/bug styling (M6):** `TaskCard` now renders a left accent stripe from DESIGN.md §2 tokens (`type-feature` green `#16A34A` for features, `type-bug` red `#DC2626` for bugs) plus a visible badge — uppercase FEATURE/BUG label with a distinct inline SVG icon (sparkle vs. beetle), no icon library added. Colour is never the only signal. Changing a task's type in the M5 modal re-renders the card immediately; styling persists after refresh.
- **Refactor:** `App.tsx` split from one 616-line file into modules:
  ```
  src/
  ├── App.tsx                     # task + modal state, CRUD handlers, layout
  ├── components/
  │   ├── TaskCard.tsx            # card + M6 type styling
  │   ├── BoardColumn.tsx         # column, counts, empty state, "+ Task"
  │   └── TaskModal.tsx           # create/edit modal, validation, delete, focus trap
  ├── types/task.ts               # Task, Anchor, TaskType, TaskStatus, TaskFormValues, ModalState
  ├── hooks/useLocalStorage.ts    # generic localStorage hook
  ├── data/constants.ts           # STAGES, TEAM
  ├── data/seedTasks.ts           # SEED_TASKS (unchanged values/IDs)
  └── utils/taskUtils.ts          # makeId(), localTodayISO()
  ```
  No circular imports; type-only imports used where appropriate. The locked `Task`/`Anchor` models, status IDs, TEAM values and the `vibetracker.tasks` key are unchanged.
- **Bug fix found by the new tests:** the modal's focus-restore effect captured `document.activeElement` *after* React's `autoFocus` moved focus into the dialog, so closing restored focus to the (unmounted) input instead of the trigger. Fixed by capturing the trigger during render into a ref.
- **Permanent test suite** in project-root `tests/` (Node built-in test runner + Chrome DevTools Protocol against headless Edge — zero new dependencies; the earlier throwaway M5 script's logic was adapted, not lost):
  - `tests/run.mjs` — starts an isolated Vite dev server on :5199, runs all files sequentially, tears down.
  - `tests/helpers/cdp-harness.ts` — browser launch (fresh temp user-data-dir per file ⇒ isolated localStorage, developer data untouched), page helpers, dialog auto-accept, console-error capture, failure screenshots in the OS temp dir only.
  - `tests/kanban-board.test.ts` (6), `tests/task-crud.test.ts` (8), `tests/task-type-styling.test.ts` (8), `tests/persistence.test.ts` (7), `tests/modal-accessibility.test.ts` (6).
  - Run with `npm test` (script added to `package.json`).

**Files modified**

- `src/App.tsx` — slimmed to state + handlers + layout.
- `src/components/TaskCard.tsx`, `src/components/BoardColumn.tsx`, `src/components/TaskModal.tsx` — extracted components; TaskCard gains M6 styling; TaskModal gains the focus-restore fix.
- `src/types/task.ts`, `src/hooks/useLocalStorage.ts`, `src/data/constants.ts`, `src/data/seedTasks.ts`, `src/utils/taskUtils.ts` — new modules.
- `tests/` — new permanent suite (5 test files + harness + orchestrator).
- `package.json` — `"test": "node tests/run.mjs"`.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 38 modules, ~830 ms).
- `npm test` — **35/35 passed**, run twice to confirm repeatability. Coverage: four columns in order; seeds in correct columns; counts (1→0/2 after a move); status change moves cards; create; empty-title validation; no Delete button in create mode; edit pre-fill + save; delete requires confirmation (reject keeps the task, exact DESIGN.md §5 message); delete removes the card; green/red accent stripes and FEATURE/BUG labels with distinct icons; type change in the modal re-styles the card; styling survives refresh; create/edit/status/delete persist across refreshes; pre-existing localStorage data is never overwritten by seeds; an intentionally empty list stays empty; dialog semantics (role/aria-modal/labelledby); labels on all six form controls; Escape closes; Tab and Shift+Tab stay trapped; focus returns to the trigger; zero console errors throughout.

**Known limitations / manual verification still needed**

- Tests run against the Vite dev server (not a production preview build) — the dev-server output is also verified via `npm run build` separately.
- Tests require Edge or Chrome installed (Windows paths + `EDGE_PATH` override). They are excluded from `tsc` (`tsconfig` includes only `src`) and run via Node's native TypeScript type-stripping — noted as a deliberate zero-dependency trade-off.
- A quick human pass in a normal browser is still worthwhile for visual polish of the new badges (spacing, contrast at small sizes).

**Deliberately not implemented in M6** — M7 assignee badges/handoff, M8 due-tint, M9 context editor, M10 copy-prompt, M11 anchor board, M12 secret sauce, drag-and-drop.

## M7 `task-owner` — 2026-10-20

**What was built**

- **Owner on every card:** each `TaskCard` now shows a small circular avatar with the assignee's initials (max two, uppercase — `initialsOf` in `taskUtils`, with a deterministic `?` fallback for missing/blank names) and the assignee's name beside it. The avatar is `aria-hidden` (the adjacent name is the accessible text); no external images or avatar services.
- **"Hand off to" dropdown:** a second select on each card offering only the three `TEAM` values (`Solo Developer`, `Demo Reviewer`, `Demo Designer`). Selecting one updates `task.assignee` immediately, preserves every other field, and persists through the existing `useLocalStorage` hook. Click/keydown events stop propagation (same pattern as the M4 status dropdown) so the dropdown never opens the edit modal, and the native select keeps full keyboard support.
- **Toast confirmation:** reassigning via the dropdown shows "Assigned to {name}." (DESIGN.md §5 microcopy) — `role="status"` + `aria-live="polite"`, `pointer-events-none` so it never blocks interactions, auto-dismiss after 2.5 s, and a 200 ms fade per DESIGN.md §7. Timers are cleared on replacement and app unmount.
- **Modal compatibility (M5 preserved):** the modal's Assignee dropdown is untouched; both interfaces read/write the same task state, so a modal change re-renders the card immediately and reopening the modal shows the card's current owner.
- **Optional workload strip:** `TeamWorkload` — a compact bar above the board listing each demonstration role with its avatar and the number of active tasks (To Do / In Progress / Review; Done excluded). Rendered as plain divs so board structure and tests are unaffected.
- **Favicon fix:** a repeat test run surfaced intermittent `404` noise — browsers auto-request `/favicon.ico`, which did not exist. Added a minimal `public/favicon.svg` (a "V" on `brand-primary`, in the spirit of the DESIGN.md §6 wordmark) plus the `<link rel="icon">` tag; the noise is gone and real browsers get a proper tab icon.

**Files created / modified**

- `src/components/TaskCard.tsx` — owner row (avatar + name), "Hand off to" select, `onAssigneeChange` prop.
- `src/components/BoardColumn.tsx` — passes `onAssigneeChange` through.
- `src/App.tsx` — `handleAssigneeChange` (only `assignee` changes), toast state + 2.5 s auto-dismiss timer with cleanup, renders `TeamWorkload` and `Toast`.
- `src/components/Toast.tsx` — new toast component.
- `src/components/TeamWorkload.tsx` — new workload strip.
- `src/utils/taskUtils.ts` — `initialsOf(name)`.
- `src/index.css` — 200 ms `toast-in` keyframes.
- `index.html` + `public/favicon.svg` — favicon.
- `tests/helpers/cdp-harness.ts` — `setCardStatus` now targets `select[data-field="status"]` (cards have two selects since M7); new `setCardHandoff` helper.
- `tests/task-owner.test.ts` — new (14 tests).
- `tests/run.mjs` — registered `tests/task-owner.test.ts`.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 40 modules, ~960 ms; `dist/` includes `favicon.svg`).
- `npm test` — **49/49 passed**, run twice to confirm repeatability (35 existing + 14 new). New M7 coverage: every card shows its owner (avatar + name); initials are correct (SD/DR/…); missing/unexpected names fall back deterministically (`?`, single letters); handoff offers exactly the three TEAM values; handoff never opens the edit modal; owner changes are immediate on the card; toast appears with the right microcopy, `role="status"`, `aria-live="polite"`, `pointer-events: none`, and auto-dismisses; reassignment changes only `assignee` (all other fields byte-identical in localStorage); reassignment survives refresh; modal assignee change updates the card; reopening the modal shows the current assignee; workload counts match non-Done tasks per role and update after a handoff; zero console errors.

**Known limitations / manual verification still needed**

- As with the M4 status dropdown, headless CDP cannot reliably click native `<select>` popups, so both card selects are driven via the native value setter + `change` event in tests — the same proven pattern. A quick human pass on the handoff dropdown's visual layout (avatar contrast, label spacing) is still worthwhile.
- Toast auto-dismiss is verified functionally (appears, disappears within ~2.5 s); the exact fade is a visual detail.

**Deliberately not implemented in M7** — M8 due-tint, M9 context editor, M10 copy-prompt, M11 anchor board, M12 secret sauce, drag-and-drop.

## M8 `due-tint` — 2026-10-20

**What was built**

- **Date classification module:** `src/utils/dueDateUtils.ts` with `getDueState(task, today?)` returning `safe | warning | overdue | neutral | none`. Rules, in priority order: (1) `status === 'done'` → `neutral`; (2) `dueDate` null/empty/malformed → `none`; (3) due before today → `overdue`; (4) due today or tomorrow → `warning`; (5) due in 2+ days → `safe`. This is the explicit date-only interpretation of the slide's "less than 24 h / more than 2 days" thresholds. `YYYY-MM-DD` is parsed as a **local-midnight** date (never UTC), day differences are computed between local midnights with `Math.round` absorbing the 23/25-hour DST days, and impossible dates (`2026-13-45`, `2026-02-30`) are rejected as `none`. No new fields on the locked `Task` model.
- **Card styling (TaskCard):** the DESIGN.md §2 tokens tint the whole card background (`bg-due-safe` #DBEAFE, `bg-due-warning` #FEF3C7, `bg-due-overdue` #FEE2E2, `bg-due-neutral` #E5E7EB) plus a small uppercase label chip (**SAFE / DUE SOON / OVERDUE / DONE**) so colour is never the only signal. Tasks without a due date keep the plain white card with no indicator. The M6 green/red accent stripe, type badge, titles, descriptions, M7 owner avatars, handoff/status dropdowns and due date text all remain visible and functional.
- **Automatic updates:** urgency recomputes on every render, so due-date edits in the M5 modal, status changes, Done moves (both directions), and page refreshes all restyle immediately. For the "app stays open past midnight" case, App keeps a `today` state refreshed by a lightweight 60 s interval plus a re-check on window `focus`/`visibilitychange` (with a same-day guard so nothing re-renders unless the local calendar day actually changed); the timer and listeners are cleaned up on unmount.

**Files created / modified**

- `src/utils/dueDateUtils.ts` — new: `DueState`, `getDueState`, `dayDifference`, `sameLocalDay`.
- `src/components/TaskCard.tsx` — urgency tint + label chip, `data-due-state` attribute, new `today` prop.
- `src/components/BoardColumn.tsx` — passes `today` through.
- `src/App.tsx` — `today` state + 60 s/focus/visibility refresh effect (M8 comment updated).
- `tests/helpers/cdp-harness.ts` — new `setInputValue` helper (React-controlled date input).
- `tests/due-tint.test.ts` — new (4 pure unit tests + 15 browser tests).
- `tests/run.mjs` — registered `tests/due-tint.test.ts`.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 41 modules, ~1.5 s).
- `npm test` — **68/68 passed, run twice** (49 existing + 19 new). New coverage:
  - *Unit (fixed clock, independent of the execution date):* past/today/tomorrow/2+/15-day classification; done overrides overdue/no-date; null/empty/malformed (`not-a-date`, `2026/13/45`-style, wrong separators) → `none`; day differences stay exact across month-end, year-end and the 2026-10-25 UK DST transition.
  - *Browser (due dates computed relative to the real execution date):* SAFE for future dates, DUE SOON for today and tomorrow, OVERDUE for past dates, neutral DONE for both done cards, done-overrides-overdue, no indicator on date-less cards (plain white), editing the due date in the modal restyles, status→Done restyles immediately, Done→active recalculates, refresh preserves all styling, M6 stripes stay green/red on tinted cards with FEATURE/BUG badges intact, M7 owner/handoff/toast still work on tinted cards, and the day-rollover test: a page-side fake `Date` advanced 2 days + the app's focus re-check flips "due tomorrow" to OVERDUE and back after restoring the real clock.
  - Zero console errors across the whole suite.

**Known limitations / manual verification still needed**

- The 60 s interval is the production rollover mechanism; the test exercises the same refresh path via the window-focus hook (documented in the test) instead of waiting a minute — both call the identical `refreshToday` function.
- The fake-clock test stubs `Date` only long enough to observe the flip, then restores it; this is a standard isolated-clock technique, not a change to the app.
- Visual contrast of the tint + chips is functional (computed styles asserted); a quick human pass is still worthwhile for taste (e.g. chip saturation at 10 px).

**Deliberately not implemented in M8** — M9 context editor, M10 copy-prompt, M11 anchor board, M12 secret sauce, drag-and-drop.

## M9 `context` — 2026-10-20

**What was built**

- **AI Context section on the modal:** the M5 create/edit dialog gains a clearly labelled **AI Context** section (heading + top border divider) with a multiline **Context (Markdown)** textarea (monospace, resizable, 7 rows) and an **AI Tool** dropdown. Placeholder guidance mentions notes, prompts, decisions, errors and next steps, and that Markdown works (headings, lists, code fences). No editor library — a plain textarea preserves Markdown syntax.
- **AI Tool dropdown:** exactly `None, Claude, ChatGPT, Cursor, Lovable, Replit, Other` (`AI_TOOLS` in `src/data/constants.ts`). `None` is stored as `null` on the model; the other values are stored as their literal strings.
- **Persistence:** `context` is saved verbatim — line breaks, blank lines and code fences byte-for-byte (no trimming, unlike `description`). Reopening a task pre-fills both the textarea and the dropdown; everything survives refresh through the existing `useLocalStorage` hook. Legacy (pre-M9) tasks with `''`/`null`/`null` open with an empty textarea, `None`, and "No context saved yet." — and unrelated edits never invent a timestamp for them.
- **Automatic `contextUpdatedAt`:** computed in `App.handleSaveTask`, never typed by the user. On edit, the timestamp is refreshed only when `context` or `contextTool` changed vs. the stored task — title/status/assignee/due edits leave it untouched. On create, a task with no context text and no tool keeps `null`; any context or tool sets `new Date().toISOString()`. Opening without saving never writes anything, so the timestamp is preserved.
- **Last-updated hint:** inside the AI Context section, a subtle `text-xs text-text-muted` line shows `Context last updated: 20 Oct 2026, 14:30` (stored ISO rendered in the user's local timezone via `formatLocalTimestamp` in `taskUtils` — manual month names, locale-independent) or `No context saved yet.` when the timestamp is null.
- **M4–M8 preserved:** no changes to the card, board, status/handoff selects, toast, due tints, focus trap or any existing modal field; the two new controls are automatically part of the existing Tab focus trap (the trap selector already includes `textarea` and `select`).

**Files created / modified**

- `src/components/TaskModal.tsx` — AI Context section, `context`/`contextTool` state, pre-fill, hint.
- `src/App.tsx` — `handleSaveTask` computes `contextUpdatedAt` (change detection on edit; null unless context/tool present on create); M9 header comment.
- `src/types/task.ts` — `TaskFormValues` gains `context` + `contextTool` (the locked `Task` model is unchanged — its M9 fields were already reserved).
- `src/data/constants.ts` — `AI_TOOLS` (None + six tools).
- `src/utils/taskUtils.ts` — `formatLocalTimestamp(iso)`.
- `tests/helpers/cdp-harness.ts` — new `setTextareaValue` helper (React-controlled `<textarea>` via native setter + input/change events).
- `tests/task-context.test.ts` — new (2 pure unit tests + 15 browser tests).
- `tests/run.mjs` — registered `tests/task-context.test.ts`.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 41 modules, ~945 ms).
- `npm test` — **85/85 passed, run twice to confirm repeatability** (68 existing + 17 new; the first run caught a bug in the new smoke test's own assertion — the FEATURE/BUG badge text is uppercased by CSS, so `textContent` needs `.toUpperCase()`, exactly as the M6 tests already do — the app itself was fine). New coverage:
  - *Unit:* `formatLocalTimestamp` renders `'20 Oct 2026, 14:30'` from a local 14:30 clock; null/empty/malformed input returns null.
  - *Browser:* the create modal has an AI Context section (heading, `Context (Markdown)` label, textarea, guidance placeholder, "No context saved yet." hint); the AI Tool dropdown offers exactly None/Claude/ChatGPT/Cursor/Lovable/Replit/Other in order; creating a task with multiline markdown + Claude saves the context byte-for-byte, the tool, and a valid "now" ISO timestamp; reopening pre-fills context, tool and a locally formatted last-updated hint; opening without saving preserves the timestamp; editing context preserves multiline Markdown exactly (blank lines + code fences); context and tool survive a refresh; tool changes persist and re-pre-fill; `None` stores `null`; context changes refresh `contextUpdatedAt`; tool changes refresh it; title-only edits leave it untouched; a new task with no context/tool keeps `null` and shows "No context saved yet."; legacy seed tasks stay compatible and unrelated edits never create a timestamp; M4 status moves, M6 BUG badge, M8 due state/chip and M7 handoff + toast still work; zero console errors.

**Known limitations / manual verification still needed**

- As with the other React-controlled fields, the textarea and tool select are driven in tests via the native setter + event trick (documented in the test header) — a quick human pass on the AI Context section's visual layout is still worthwhile.
- The timestamp comparison tests use `notEqual` plus a monotonicity check; two saves within the same millisecond are theoretically possible but never occur across real CDP round-trips.
- The last-updated hint shows the *saved* timestamp; while the modal is open with unsaved context edits it still shows the previous save (by design — the timestamp only changes on save).

**Deliberately not implemented in M9** — M10 "Copy as Prompt Context" button, M11 anchor board, M12 secret sauce, drag-and-drop.

## M10 `copy-prompt` — 2026-10-20

**What was built**

- **Markdown formatter (`src/utils/promptUtils.ts`):** pure `formatTaskAsPrompt(task)` serialises a task into a structured Markdown prompt: `# Task: <title>`, a `## Task Details` list (Type / Status as human-readable labels — Feature/Bug, To Do/In Progress/Review/Done — Assignee, Due Date with **"Not set"** for null, Created Date, `AI Tool` only when selected, `Context Last Updated` in local time only when a timestamp exists), `## Description` (verbatim), and `## AI Context` with the saved context **byte-for-byte** (headings, lists, blank lines, code fences — never rewritten/trimmed/summarised) or **"No additional AI context saved."** when empty. Never mutates the task (verified against a deep-frozen object).
- **Copy button on every card:** a full-width, understated `Copy as Prompt Context` button (DESIGN.md §4 secondary-action styling) at the bottom of each `TaskCard`, separated by a hairline. Click and keydown events stop propagation (the M4/M7 pattern), so copying never opens the edit modal and never touches status/assignee. Fully keyboard-accessible (native button, visible focus ring, descriptive `aria-label`).
- **Clipboard (`src/utils/clipboardUtils.ts`):** `copyTextToClipboard(text)` tries the modern `navigator.clipboard.writeText` first; on unavailability, rejection or permission errors it falls back to a hidden off-screen textarea + `document.execCommand('copy')` — checking execCommand's actual boolean result, removing the temp node, and restoring the previous focus and text selection. Returns true only on a genuine success.
- **Total-failure fallback:** when both methods fail, a `ManualCopyDialog` (dialog semantics, Escape/backdrop/✕/Close, body scroll lock, focus restore) presents the generated Markdown in a read-only, pre-selected textarea so the user can copy it manually. The success toast is never shown in this case.
- **Toasts (M7 component reused):** success → "Context copied — ready to paste." (DESIGN.md §5 microcopy); failure → "Couldn't copy automatically. Select the text to copy manually." Both keep `role="status"`/`aria-live="polite"`, `pointer-events-none` and the 2.5 s auto-dismiss, and coexist with handoff toasts through the same replace-on-new-toast behaviour.
- **M4–M9 preserved:** the button is an addition only; badges, owner row, handoff/status selects, due tints, modal and M9 context editor are untouched.

**Files created / modified**

- `src/utils/promptUtils.ts` — new: `formatTaskAsPrompt`.
- `src/utils/clipboardUtils.ts` — new: `copyTextToClipboard` + `legacyCopy` fallback.
- `src/components/ManualCopyDialog.tsx` — new: manual-copy fallback dialog.
- `src/components/TaskCard.tsx` — copy button row, `onCopyPrompt` prop.
- `src/components/BoardColumn.tsx` — passes `onCopyPrompt` through.
- `src/App.tsx` — `handleCopyPrompt` (format → copy → toast/dialog), `manualCopy` state, renders `ManualCopyDialog`, M10 header comment.
- `tests/helpers/cdp-harness.ts` — new `clickCopyButton` helper.
- `tests/copy-prompt.test.ts` — new (10 pure formatter tests + 9 browser tests).
- `tests/run.mjs` — registered `tests/copy-prompt.test.ts`.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 44 modules, ~1.0 s).
- `npm test` — **104/104 passed, run twice to confirm repeatability** (85 existing + 19 new). New coverage:
  - *Formatter (pure, Node):* title + description included; human-readable type/status (no raw ids); assignee + created date; due date formatting; "Not set" for null due dates; AI Tool line only when selected; `Context Last Updated` in local time when present (timezone-proof construction via a local-midnight clock) and absent when null; multiline markdown context preserved exactly inside `## AI Context`; no-context tasks get the placeholder and keep the full section structure; a deep-frozen task stays byte-identical.
  - *Browser:* the button appears on all four cards with the exact label; copying never opens the modal and leaves localStorage byte-identical (task stays in its column with its assignee); the stubbed clipboard receives exactly the expected markdown (compared against `formatTaskAsPrompt(SEED_TASKS…)`); the success toast shows the right microcopy with role/aria-live/pointer-events and auto-dismisses; a rejected `writeText` falls through to `execCommand('copy')` which copies the full markdown with the temp textarea removed afterwards; when both methods fail the failure toast appears and the manual-copy dialog exposes the full markdown in a read-only textarea and closes cleanly; the button is focusable and Enter/Space keydowns on it never open the modal; M4 status moves, M7 handoff + toast, M6/M8 badges and tints, and the M5 modal with the M9 AI Context section all still work; zero console errors.

**Known limitations / manual verification still needed**

- Headless browsers have no reliable real clipboard, so the tests stub `navigator.clipboard.writeText` / `document.execCommand` on the page (documented in the test header) — the real-clipboard path is the exact code a user's browser runs, but a quick human pass with a real Ctrl+V is still worthwhile.
- The `execCommand` fallback is deprecated but still present in current Edge/Chrome; if a future browser removes it, the failure path simply degrades to the manual-copy dialog, which the tests already cover.
- `promptUtils.ts` imports `taskUtils.ts` with an explicit `.ts` extension (required by Node's native type-stripping runner; permitted by `allowImportingTsExtensions` + Vite) — worth noting for future util modules that get imported from tests.

**Deliberately not implemented in M10** — M11 Anchor Board (Presentation/Demo/Report/Documentation slots), M12 secret sauce, drag-and-drop.

## M11 `anchors` — 2026-10-20

**What was built**

- **Deliverable Anchor Board** (`src/components/AnchorBoard.tsx`): a compact section above the Kanban (directly under the header, above the workload strip) with exactly four pinned slots — **Presentation, Demo, Report, Documentation** — using the locked `Anchor` interface (id/label/url) unchanged. Each slot is a white card (DESIGN.md §4: subtle 1px border, rounded corners, brand-primary accents) showing a small inline SVG icon (monitor / play / file / book — no icon library, DESIGN.md §7), the deliverable label, and either the saved link or a dashed empty state ("No link yet.") with an **Add Link** button. Slots with a URL show **Edit Link** and **Remove Link**.
- **Inline editor:** Add/Edit opens a lightweight per-slot inline editor (input + Save Link/Cancel, Enter submits) instead of a modal, so the four slots always stay visible. Editing pre-fills the existing URL; Cancel closes without modifying anything. A `<label>` (sr-only) is associated with the input; errors render as `role="alert"`.
- **URL validation** (`src/utils/anchorUtils.ts`, pure): `validateAnchorUrl` accepts only valid `http:`/`https:` URLs — `javascript:`, `data:`, `vbscript:`, `file:`, `mailto:`, `ftp:` and any unparseable input are rejected with a clear message ("Only http:// and https:// links are allowed." / "That doesn't look like a valid URL — include the full address, e.g. https://example.com."). The user's input is stored verbatim (after a trim) so **query parameters and fragments are preserved**; the editor stays open on rejection and nothing is written.
- **Opening links:** saved URLs are real `<a href>` links with `target="_blank"` + `rel="noopener noreferrer"`, `title` = full URL, and CSS truncation for long URLs (the href/text always keep the full destination). Saving never navigates away from the dashboard.
- **Persistence:** `useLocalStorage<Anchor[]>('vibetracker.anchors', INITIAL_ANCHORS)` (`INITIAL_ANCHORS` in `src/data/constants.ts`) — stored data wins over the seeds, `vibetracker.tasks` is never touched. Editing one anchor never modifies another; removing a link sets `url` to `null` while the slot stays. **Incomplete stored data is handled safely:** `normalizeAnchors` (pure, unit-tested) re-seeds missing slots, drops unknown ids, falls back to default labels, and keeps only stored URLs that pass validation — a hand-edited `javascript:` URL can never become a clickable link.
- **M4–M10 preserved:** no changes to the Kanban, modal, badges, owner/handoff, due tints, AI Context, copy-prompt or the `Task`/`Anchor` models. Anchor slots are plain `div`s (not `article`s) so the existing `article`-based task selectors in the test suite keep working.

**Files created / modified**

- `src/components/AnchorBoard.tsx` — new: four slots, inline editor, icons, add/edit/save/cancel/remove.
- `src/utils/anchorUtils.ts` — new: `validateAnchorUrl` + `normalizeAnchors` (pure, Node-unit-tested; imports `./constants.ts` with an explicit `.ts` extension per the M10 rule).
- `src/data/constants.ts` — `INITIAL_ANCHORS` (the four seed slots).
- `src/App.tsx` — `vibetracker.anchors` state (normalised on render and on every write), `handleAnchorSave` / `handleAnchorRemove`, renders `AnchorBoard`; M11 header comment.
- `tests/helpers/cdp-harness.ts` — new `clickAnchorAction(slotId, action)` helper.
- `tests/anchor-board.test.ts` — new (6 pure unit tests + 16 browser tests).
- `tests/run.mjs` — registered `tests/anchor-board.test.ts`.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 46 modules, ~1.4 s).
- `npm test` — **126/126 passed, run twice to confirm repeatability** (104 existing + 22 new). New coverage:
  - *Unit (pure Node):* `validateAnchorUrl` accepts http/https (query strings + fragments included) and rejects `javascript:`/`data:`/`vbscript:`/`file:`/`mailto:`/`ftp:` plus malformed input (`''`, whitespace, `not a url`, scheme-less, bare `https://`); `normalizeAnchors` returns the four seeded slots for null/undefined/string/object/number storage, fills missing slots while keeping valid stored labels + URLs, and drops unknown slots, unsafe stored URLs, non-string and blank urls.
  - *Browser:* exactly four slots render with the correct labels and order, above the Kanban (`compareDocumentPosition` vs `main`), each with an icon; empty anchors show the empty state + Add Link and no link/edit/remove controls; a valid URL saves into its slot (editor closes, link appears, storage updated, dashboard stays rendered); saving one anchor never modifies another (localStorage checked per slot); saved links have the exact `href`, `target="_blank"`, `rel="noopener noreferrer"` and full-URL title/text; an existing URL edits with the editor pre-filled; Cancel preserves the existing URL and leaves empty slots empty (storage byte-identical); Remove Link clears only that slot (empty state returns, all four slots stay, `url: null` stored); URLs persist after refresh; empty URLs persist after refresh; `javascript:` gets the exact http/https-only message with `role="alert"` and malformed inputs keep the editor open and store nothing, while a valid URL then saves cleanly; query parameters and fragments are preserved byte-for-byte in the href and in storage; add/edit/remove leave `vibetracker.tasks` byte-identical; a hand-edited storage payload (blank label, `javascript:` URL, unknown slot id) renders safely after reload with defaults and only the valid URL surviving; M4 status moves, M7 handoff + toast, M6/M8 badges + tints, the M5 modal with the M9 AI Context section and M10 copy buttons all still work; zero console errors.

**Known limitations / manual verification still needed**

- The tests drive the editor input with the native setter + input/change trick (same proven pattern as the other React-controlled fields); clicking the actual saved link in headless would open a real tab, so the target/rel/href attributes are asserted instead. A quick human pass on the anchor board's visual layout (icon contrast, truncation width) and a real click on a saved link are still worthwhile.
- Labels can be customised in stored data (normalise keeps them); the UI itself always shows the four locked labels because the seeds carry them.

**Deliberately not implemented in M11** — M12 secret sauce (PRD FR-19, open-ended), M13 pitch readiness, drag-and-drop.

## M12 `secret-sauce` — 2026-10-20

**What was built**

- **Project Health Dashboard** (`src/components/ProjectHealth.tsx`): a compact, collapsible live summary rendered between the Deliverable Anchor Board and the workload strip (above the Kanban). Five stat cards — **Total Tasks, Completed Tasks, Completion Percentage, Overdue Tasks, Active Bugs** — plus an **Overall completion progress bar** whose fill width derives from the percentage. Numbers are always shown as text too (never conveyed by the bar alone). Colour follows DESIGN.md §2: brand-primary for completion, `type-bug` red for overdue/active-bug values, white cards with subtle borders and rounded corners, no chart library. Expanded by default; the toggle button ("Hide Project Health" / "Show Project Health", `aria-expanded` + `aria-controls`) hides only the statistics panel — the Anchor Board, workload strip and Kanban stay visible.
- **Reusable statistics logic** (`src/utils/projectHealthUtils.ts`): pure `calculateProjectHealth(tasks, today?)` returning `{ total, completed, completionPercentage, overdue, activeBugs }`. Completion is `completed / total` rounded to the nearest whole percent; an empty board yields 0% (no division by zero). Overdue reuses M8's `getDueState` verbatim (no duplicated urgency rules), so Done tasks are excluded automatically; active bugs are `type === 'bug' && status !== 'done'`. No Task-model changes; no second store — the dashboard derives from the same `tasks` state and App's M8 `today` clock, so create/delete/status/type/due-date changes and day rollover all update it immediately.
- **Demo Login Page** (`src/components/LoginPage.tsx`): a centred white card (DESIGN.md §4/§6) with the brand-primary wordmark, "Welcome back" heading, explanatory subtitle, Username + Password inputs (`type="password"`), a Sign In button and the assessor-access block: **"Demo access: userdemo / userdemo"** plus a **Continue as Demo** button that opens the dashboard through the same session mechanism. Wrong credentials show one generic error ("Invalid username or password." — never revealing which field) with `role="alert"` and keep the dashboard hidden. A disclaimer states this is a demonstration login that does not protect stored data.
- **Session handling (App):** the `vibetracker.demoSession` flag lives in **sessionStorage** (tab-scoped — survives a refresh, cleared by logout/tab close). The demo password is never stored anywhere; only the flag is written. Before a session exists the login page replaces the dashboard (all hooks still run, so stored tasks/anchors load underneath and are never reset or reseeded). A **Log out** button in the dashboard header clears only the flag and returns to the login screen; tasks and anchors are byte-untouched.
- **M4–M11 preserved:** the Kanban, CRUD modal, type styling, owner/handoff/toast, due tints, AI Context, copy-prompt and the Anchor Board are unchanged; locked `Task`/`Anchor` models untouched; `vibetracker.tasks` and `vibetracker.anchors` untouched.

**Files created / modified**

- `src/components/ProjectHealth.tsx` — new: collapsible dashboard, stat cards, progress bar.
- `src/utils/projectHealthUtils.ts` — new: pure `calculateProjectHealth` (imports `./dueDateUtils.ts` with an explicit `.ts` extension per the M10 rule).
- `src/components/LoginPage.tsx` — new: demo login form, credentials display, Continue as Demo.
- `src/data/constants.ts` — `DEMO_USERNAME`, `DEMO_PASSWORD`, `DEMO_SESSION_KEY`.
- `src/App.tsx` — demo session state + `handleDemoLogin`/`handleLogout`, conditional login-page render, Log out button in the header, renders `ProjectHealth`; M12 header comment.
- `tests/helpers/cdp-harness.ts` — `nav()` now enters through the real "Continue as Demo" login before waiting for the board (no existing test rewritten); new `gotoLogin()`, `enterDemo()`, `loginAs(user, pass)`, `pressEnter()`.
- `tests/project-health.test.ts` — new (6 pure unit tests + 16 browser tests).
- `tests/demo-login.test.ts` — new (14 browser tests).
- `tests/run.mjs` — registered both new test files.
- `MILESTONE_PROGRESS.md` — this file.

**Tests performed**

- `npm run typecheck` — passed, no errors.
- `npm run build` — passed (Vite 5.4.21, 49 modules, ~0.9 s).
- `npm test` — **161/161 passed, run twice to confirm repeatability** (126 existing + 35 new). New coverage:
  - *Project Health unit (pure Node, fixed clock):* totals/completion/percentage/overdue/active-bug counts; empty list → all zeros with 0%; rounding to the nearest whole percent (1/3 → 33, 1/8 → 13); Done tasks never count as overdue even with past due dates; Done bugs never count as active bugs; overdue follows the supplied `today` (day rollover changes the count).
  - *Project Health browser (controlled 5-task fixture with dates relative to the execution day):* total = 5 with all five cards, positioned below the Anchor Board and above the Kanban (`compareDocumentPosition`); completed = 2; percentage = 40% shown both in the card and as text beside the bar; empty board shows 0%/zero counts; overdue excludes the Done task with a past due date; active bugs exclude the Done bug; creating a task updates immediately (6 total, 33%); deleting updates immediately (4 total, 25%); a status change updates immediately (3 done, 60%); editing a task type in the modal raises the active-bug count to 2; editing a due date raises overdue to 2; stats survive a refresh byte-identically; the progress bar's `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/fill width track the percentage (40% → 60% after a status move, no reload); collapse hides only the stats (Kanban/anchors/cards all stay, `aria-expanded` + label flip correctly) and re-expanding keeps the numbers; a status move + anchor add/save + copy buttons all still work alongside the dashboard (anchor edits leave `vibetracker.tasks` byte-identical); zero console errors.
  - *Demo login browser:* the login page renders when no session exists (no board, no flag); username/password inputs exist with labels; the password input is `type="password"`; `userdemo`/`userdemo` opens the board and records only the session flag (sessionStorage holds exactly `[['vibetracker.demoSession','demo']]`, no password in localStorage); wrong password shows exactly "Invalid username or password." with `role="alert"` and grants nothing (flag null, board hidden); a wrong username likewise grants nothing; Continue as Demo opens the board through the same flag; the session survives a refresh in the same tab; Log out returns to the login screen and clears the flag; a login/logout cycle leaves seeded custom tasks and anchors byte-identical in localStorage (the one test-logic fix during development: seeding storage on an already-mounted app requires a re-navigation, because `useLocalStorage` reads only at mount); the demo credentials line shows both `userdemo` values; focus starts on the username, Tab walks username → password → Sign In, and a real Enter keypress on the password field submits the form (trusted CDP key events — the implicit-submission path a real user takes); zero runtime console errors.
- Regression: all existing M4–M11 files now pass through the login in `nav()`, so the 126 pre-existing tests re-ran green twice against the login-gated app.

**Known limitations / manual verification still needed**

- The login is a demonstration gate, not security — the credentials are printed on the page by design (assessor access). It deliberately does not protect the stored project data.
- Automated checks are headless; a quick human pass on the login screen and the health dashboard's visual layout (card grid at narrow widths, progress-bar colour) is still worthwhile, as is a real browser tab close/open to watch the sessionStorage flag drop.
- `loginAs` submits via `requestSubmit()` (the same browser submit path as Enter); the Enter-key test uses trusted CDP key events and passed in both runs.

**Deliberately not implemented in M12** — M13 pitch readiness, drag-and-drop, real authentication/backend.
