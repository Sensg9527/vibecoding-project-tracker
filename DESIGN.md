# Vibecoding Project Tracker — Design

**Status:** Completed — all six sections filled in, colour tokens live in `tailwind.config.js` · ready to tag `design-done`.

**Why this file exists.** This tracker is your tool. It should look like *your* tool — not a generic Kanban with default Tailwind blue. Twenty minutes of design decisions here will be visible on every screen for the next six weeks of Module 5.

**Who owns this.** The solo developer (Person B's slot in the team template), in the same window as the PRD review. By the time M4 (`data-model`) starts, this file is filled in and the colors are already in `tailwind.config.js`.

---

## 1. Mood / vibe

A calm, modern productivity workspace that makes tasks, ownership and deadlines immediately understandable without visual clutter.

References that capture the vibe:

- [Linear](https://linear.app) — sparse, focused board layouts; refined borders and typography that keep density readable.
- [Trello](https://trello.com) — instantly scannable cards and columns; movement affordances that never feel heavy.
- [Notion](https://www.notion.com) — calm neutral surfaces and consistent spacing that let content breathe.

Anti-references — what we are explicitly **not** trying to look like:

- Cluttered enterprise dashboards, excessive gradients, heavy shadows, unnecessary animations, and overly dense interfaces.

## 2. Color palette

These are the colors the build milestones will reference. Once chosen, paste the hex values into `tailwind.config.js` so the rest of the team can use Tailwind utility classes (e.g. `bg-brand-primary`, `border-due-warning`).

### Brand

| Token | Hex | Where it shows up |
|---|---|---|
| `brand-primary` | `#2563EB` | Header, "+" button, focus rings |
| `brand-accent` | `#0D9488` | Highlights, hover states, links |
| `surface-page` | `#F8FAFC` | Page background |
| `surface-card` | `#FFFFFF` | Card background |
| `text-primary` | `#0F172A` | Body text |
| `text-muted` | `#64748B` | Captions, dates, counts |

### Task type (M6 `tag-style`)

| Token | Hex | When used |
|---|---|---|
| `type-feature` | `#16A34A` | Cards tagged `feature` (accent stripe + icon) |
| `type-bug` | `#DC2626` | Cards tagged `bug` (accent stripe + icon) |

### Due-date states (M8 `due-tint`)

| Token | Hex | When used |
|---|---|---|
| `due-safe` | `#DBEAFE` | More than 2 days out |
| `due-warning` | `#FEF3C7` | Less than 24 hours |
| `due-overdue` | `#FEE2E2` | Past due |
| `due-neutral` | `#E5E7EB` | Done (overrides date) |

Due-state backgrounds are light tints; pair them with dark foreground text (`text-primary`) to keep the tint legible.

## 3. Typography

| Role | Font | Why |
|---|---|---|
| Heading | Inter, sans-serif | Readable, modern, and suitable for concise dashboard headings. |
| Body | Inter, sans-serif | Consistent, clear, and comfortable for task descriptions. |
| Monospace (tags, badges, code) | ui-monospace / system monospace | Distinguishes prompts, tags, and technical content. |

Suggested sizes (override only if the design demands it):

- Page title: 24 px / semibold
- Section header: 16 px / semibold uppercase
- Card title: 14 px / medium
- Body: 14 px / regular
- Caption: 12 px / regular muted

## 4. Component principles

One short sentence per element. These set the tone for the build phase — the task modal and the Anchor Board should both feel like they came from this doc.

- **Cards:** White surfaces, subtle 1px borders, rounded corners, and minimal shadows.
- **Buttons:** Solid primary colour for main actions; understated secondary actions; visible keyboard focus.
- **Modal:** Centred dialog with clear labels, a dimmed backdrop, and distinct Save/Cancel actions.
- **Empty states:** Dashed borders and friendly guidance, without unnecessary illustrations.
- **Drag affordance (if used):** Use a status dropdown as the default movement mechanism; drag-and-drop is not required.

## 5. Voice / microcopy

Three lines of microcopy that capture the tone of the product. Keep it short — these are the words a stressed user reads at 11pm.

| Where | Text |
|---|---|
| "+" button label | "+ Task" |
| Empty column placeholder | "Nothing here yet — add a task to get started." |
| Toast after "Copy as Prompt Context" | "Context copied — ready to paste." |
| Confirm-delete message | "Delete this task? This can't be undone." |
| Handoff toast (M7 `task-owner`) | "Assigned to {name}." |

## 6. Logo / wordmark

The tracker probably doesn't need a logo, but it does need a name and a wordmark style.

- **Product name:** Vibecoding Project Tracker
- **Wordmark style:** Simple text-only wordmark using the heading font in brand-primary. No custom logo or external image asset.

## 7. Out of scope (this hackathon)

To keep design tight, the following are explicitly not part of `design-done`:

- A dark mode toggle. Pick one mode and ship it.
- Multiple themes. One brand, applied consistently.
- Animations beyond a 200 ms fade on toast notifications.
- A custom icon set. Use [Lucide icons](https://lucide.dev) via Tailwind classes if you need any.

---

*DESIGN.md version: hackathon-starter v1 · completed for M3*

..