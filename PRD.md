# Vibecoding Project Tracker — Product Requirements Document

**Status:** Milestone 2 revision — Functional and Non-Functional Requirements only (`prd-done`).

Individual hackathon project: a single-page Kanban board for vibecoding tasks that preserves the AI prompt context behind each task. Stack: React + TypeScript (Vite) + Tailwind CSS, with client-side persistence via localStorage. Requirements below are derived from the hackathon milestones (M4–M12) and the locked `Task` / `Anchor` data model.

## 1. Functional Requirements

**MVP** = required in the demo-ready product. The only non-MVP item is FR-19 (M12 Secret Sauce), which is open-ended by design.

| ID | Requirement | MVP | Milestone |
|---|---|---|---|
| FR-01 | The app renders a Kanban board with exactly four columns, in the order **To Do, In Progress, Review, Done**, using the fixed stage IDs `todo`, `in-progress`, `review`, `done`. | Yes | M4 |
| FR-02 | Each task is displayed as a card in the column matching its current status. On first load the board shows 3–4 seed tasks, so it is never empty. | Yes | M4 |
| FR-03 | The user can change a task's status, and the card moves to the corresponding column immediately. | Yes | M4 |
| FR-04 | Each task stores exactly these fields: `id`, `title`, `description`, `type` (`feature` or `bug`), `status`, `assignee`, `dueDate` (nullable, ISO `YYYY-MM-DD`), `createdDate` (ISO `YYYY-MM-DD`). | Yes | M4 |
| FR-05 | The user can create a task through a modal that captures title, description, type, assignee and optional due date; the new card appears on the board. | Yes | M5 |
| FR-06 | The user can edit every field of an existing task through the same modal; saving updates the card on the board. | Yes | M5 |
| FR-07 | The user can delete a task after an explicit confirmation step; the card is removed from the board. | Yes | M5 |
| FR-08 | Tasks and anchors persist in browser localStorage and survive a full page refresh without data loss. | Yes | M5 |
| FR-09 | Feature and bug tasks are visually distinguishable: cards use distinct color tokens per type (accent stripe and icon). | Yes | M6 |
| FR-10 | Every card displays its assignee as a badge. | Yes | M7 |
| FR-11 | The user can reassign a task via a "Hand off to..." dropdown. Selectable values are exactly the three demonstration roles: `Solo Developer`, `Demo Reviewer`, `Demo Designer`. | Yes | M7 |
| FR-12 | Card colors automatically reflect due-date urgency: done tasks are neutral; otherwise **safe** when more than 2 days out, **warning** when less than 24 hours out, **overdue** when past the due date. | Yes | M8 |
| FR-13 | The task modal provides a Context field that accepts Markdown-formatted text (the curated briefing for the next AI session or reviewer). | Yes | M9 |
| FR-14 | Saving the context records a `contextUpdatedAt` ISO timestamp automatically; every save refreshes the timestamp. | Yes | M9 |
| FR-15 | The modal offers an optional AI tool selector with exactly the values `Claude`, `ChatGPT`, `Cursor`, `Lovable`, `Replit`, `Other`. | Yes | M9 |
| FR-16 | A "Copy as Prompt Context" action serializes the task fields plus the context into a formatted Markdown block and copies it to the clipboard. | Yes | M10 |
| FR-17 | A Deliverable Anchor Board pinned above the Kanban displays exactly four slots: **Presentation, Demo, Report, Documentation**. | Yes | M11 |
| FR-18 | Each anchor slot allows adding, editing and saving a link; saved links persist in localStorage. | Yes | M11 |
| FR-19 | **Secret Sauce:** an open-ended enhancement chosen by the developer in M12. Must be visible in the demo and must not break any other requirement. To be defined — no functionality is specified now. | No | M12 |

## 2. Non-Functional Requirements

| ID | Requirement | MVP | Verification |
|---|---|---|---|
| NFR-01 | **Usability** — A new user can add a task, edit it and move it between columns without instructions. Primary actions ("+", "Copy as Prompt Context", "Hand off to...") use plain-language labels in a single visible area. | Yes | Manual walkthrough: complete the primary flow (add → move → copy) in under 2 minutes. |
| NFR-02 | **Performance** — All interactions (opening the modal, moving a task, copying the prompt) respond within 200 ms on a board of up to 50 tasks, with no full-page reloads. | Yes | Manual timing check during the demo with the seed dataset. |
| NFR-03 | **Persistence** — Task and anchor data survives page refreshes and browser restarts via localStorage; no backend involved. | Yes | Refresh and fully restart the browser; verify the board state is unchanged. |
| NFR-04 | **Compatibility** — The app runs correctly in current desktop versions of Chrome, Edge and Firefox. | Yes | Manual smoke test in each browser: board renders and CRUD works. |
| NFR-05 | **Reliability** — Normal editing, moving and deleting must never lose or corrupt stored data; localStorage is written on every state change. | Yes | Manual CRUD session followed by a reload integrity check. |
| NFR-06 | **Accessibility** — Body text meets WCAG AA contrast (≥ 4.5:1); every form control has an associated label; the board and modal are keyboard-operable. | Yes | Contrast check of the design tokens + manual keyboard navigation. |
| NFR-07 | **Maintainability** — The UI is composed of reusable React components (e.g. Column, TaskCard, TaskModal, AnchorBoard); colors are applied only through the Tailwind design tokens in `tailwind.config.js`. | Yes | Code review against the component list and token usage. |
| NFR-08 | **Deployability** — The production build completes without errors and the app deploys to Vercel at a public URL that loads without console errors. | Yes | Successful `npm run build` + deployed URL loads cleanly. |
| NFR-09 | **Simplicity** — No backend, authentication or runtime dependency beyond React, Vite and Tailwind CSS (plus the TypeScript dev toolchain); all data stays client-side. | Yes | `package.json` review. |
