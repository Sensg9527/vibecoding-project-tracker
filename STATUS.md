# Project Status — quick context recovery

**Last updated:** 2026-10-20 (end of M9 `context`)
**Purpose:** read this first after a context compaction or fresh session. Details live in `MILESTONE_PROGRESS.md`; requirements in `PRD.md`; visual rules in `DESIGN.md`.

## What this project is

Vibecoding Project Tracker — an individual UXD Vibecoding Hackathon 2026 project. A single-page Kanban board (React + TypeScript + Vite + Tailwind CSS) for tracking vibecoding tasks, with client-side localStorage persistence. Later milestones add AI prompt-context features (M9/M10) and an Anchor Board (M11).

## Workflow conventions (important)

- The user feeds **one milestone prompt at a time** and stops after each. Do not start the next milestone unprompted.
- **Never run git operations** (add/commit/tag/push/branch). The user handles all git manually.
- Locked things — do not change without being told: the `Task`/`Anchor` data model, the four status IDs, the three `TEAM` values, the `vibetracker.tasks` localStorage key, DESIGN.md colour tokens, PRD.
- After each milestone: run `npm run typecheck`, `npm run build`, `npm test`; update `MILESTONE_PROGRESS.md` (and this file); report honestly what was and wasn't verified.
- Deadline pressure: milestones are time-boxed; keep changes scoped to the current milestone.

## Milestone state

| # | Tag | Status |
|---|---|---|
| 1–3 | `git-linked`, `prd-done`, `design-done` | ✅ done (before M4) |
| 4 | `data-model` | ✅ board, seeds, status dropdown, localStorage |
| 5 | `crud-modal` | ✅ create/edit/delete modal, focus trap |
| 6 | `tag-style` | ✅ feature/bug stripes + labels, code split into modules, permanent test suite |
| 7 | `task-owner` | ✅ avatar + name on cards, "Hand off to" dropdown, toast, workload strip |
| 8 | `due-tint` | ✅ urgency tints + SAFE/DUE SOON/OVERDUE/DONE chips (dueDateUtils) |
| 9 | `context` | ✅ AI Context section on modal: Markdown textarea + AI Tool dropdown + auto `contextUpdatedAt` + last-updated hint |
| 10 | `copy-prompt` | ⬜ **next**: "Copy as Prompt Context" → serialised markdown to clipboard |
| 11 | `anchors` | ⬜ Anchor Board above Kanban (Presentation/Demo/Report/Documentation) |
| 12 | `secret-sauce` | ⬜ open-ended |
| 13 | `pitch-ready` | ⬜ |

## Codebase layout (post-M6 refactor)

- `src/App.tsx` — task + modal state, CRUD handlers, handoff + toast (M7), "today" clock for M8 tints, M9 `contextUpdatedAt` computation in `handleSaveTask`, layout (slim).
- `src/components/` — `TaskCard.tsx` (M6 type styling, M7 owner + handoff, M8 due tints/chips), `BoardColumn.tsx`, `TaskModal.tsx` (M9 AI Context section), `Toast.tsx` (M7), `TeamWorkload.tsx` (M7, optional).
- `src/types/task.ts` — `Task`, `Anchor`, `TaskType`, `TaskStatus`, `TaskFormValues` (M9: + `context`, `contextTool`), `ModalState`. The locked `Task` model is unchanged.
- `src/hooks/useLocalStorage.ts` — generic hook; stored value wins over seeds.
- `src/data/` — `constants.ts` (STAGES, TEAM, `AI_TOOLS` M9), `seedTasks.ts`.
- `src/utils/taskUtils.ts` — `makeId()`, `localTodayISO()`, `initialsOf()` (M7), `formatLocalTimestamp()` (M9); `src/utils/dueDateUtils.ts` — `getDueState()` etc. (M8).
- `tests/` — permanent browser test suite (see below).

## Testing

- `npm test` → `tests/run.mjs`: starts an isolated Vite dev server on **:5199**, then Node's built-in test runner (`node --test`, sequential) over the 8 `tests/*.test.ts` files. **85 tests, all passing** as of M9, run twice.
- Tests drive **headless Edge/Chrome via CDP** (`tests/helpers/cdp-harness.ts`, Node built-ins only, no test framework dependency). Fresh temp browser profile per file ⇒ isolated localStorage; your real browser data is never touched. Requires Edge/Chrome installed (`EDGE_PATH` overridable).
- Tests run via Node type-stripping — no TS parameter properties/enums in `tests/` (strip-only mode). `tsc` includes only `src`, so tests aren't typechecked (deliberate).
- Quirks learned (do not re-litigate):
  - Headless CDP can't reliably activate buttons via synthesised Enter/mouse events; use scripted `el.click()` (fine when dialogs are auto-accepted) or stub `window.confirm` on the page to test the rejection path.
  - Harness auto-accepts `window.confirm` (delete confirmation) by default.
  - React `autoFocus` moves focus before effects run — the modal captures its focus-restore trigger during render (a bug the M6 tests caught; don't "simplify" it back).
  - Cards have **two selects** since M7 — `setCardStatus` targets `select[data-field="status"]`, `setCardHandoff` targets `select[data-field="handoff"]`; don't go back to "first select in article".
  - A favicon exists now (`public/favicon.svg`) — removing it re-introduces intermittent `/favicon.ico` 404 console noise in tests.
  - M8 date logic lives in `src/utils/dueDateUtils.ts` and is unit-tested with a fixed clock directly in Node (the file mixes `test()` and browser `check()`); browser due-date tests compute dates relative to the execution date so they never rot.
  - M8 day-rollover is tested with a page-side fake `Date` + the app's **window-focus re-check** (same refresh function as the 60 s timer, so the test doesn't wait a minute). Don't remove the focus/visibilitychange listeners in App.
  - React-controlled `<input type="date">` is set via `setInputValue` (native setter + `input`/`change` events) — same trick family as the selects.
  - M9: React-controlled `<textarea>` is set via `setTextareaValue` (HTMLTextAreaElement prototype setter + `input`/`change`); multiline markdown is compared byte-for-byte in localStorage. The AI Tool select is driven with the existing `setSelect` (`''` = None, stored as `null`).
  - M9 timestamp tests read `contextUpdatedAt` from localStorage and compare with `formatLocalTimestamp` computed in Node (same machine ⇒ same timezone) — never assert absolute clock values.
  - Badge/chip text is uppercased by CSS — page-side expressions must call `.toUpperCase()` on `textContent` (first M9 run caught this in its own smoke test; the app was fine).

## Known limitations / pending manual checks

- Automated tests are headless; a quick human pass in a normal browser for visual polish is still worthwhile (badge contrast/spacing).
- Dev server from earlier sessions may still be running on :5173 (manual browser checks); tests use :5199.

## Next action

Wait for the user's M10 (`copy-prompt`) prompt — a "Copy as Prompt Context" button that serialises the task + M9 context to markdown and copies it to the clipboard (DESIGN.md §5 toast: "Context copied — ready to paste."). Do not implement the M11 Anchor Board yet. Update this file's "Last updated" + milestone table after each milestone.
