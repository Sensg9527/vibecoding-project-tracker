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
| 6–13 | — | ⬜ Not started | |

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
