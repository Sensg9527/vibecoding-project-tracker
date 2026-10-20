import { useState, type FormEvent, type ReactElement } from 'react';
import type { Anchor } from '../types/task';
import { validateAnchorUrl } from '../utils/anchorUtils';

interface AnchorBoardProps {
  anchors: Anchor[];
  /** M11: persist one slot's URL (already validated by the editor). */
  onSave: (id: Anchor['id'], url: string) => void;
  /** M11: clear one slot's URL (url → null); the slot itself always stays. */
  onRemove: (id: Anchor['id']) => void;
}

// M11 anchors — four small inline SVG icons (no icon library, DESIGN.md §7),
// each rendered inside a brand-primary tinted square next to its label.

function PresentationIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function DemoIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
    </svg>
  );
}

function ReportIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function DocumentationIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

const SLOT_ICONS: Record<Anchor['id'], () => ReactElement> = {
  presentation: PresentationIcon,
  demo: DemoIcon,
  report: ReportIcon,
  documentation: DocumentationIcon,
};

/** The inline editor state for the one slot currently being edited. */
interface EditorState {
  id: Anchor['id'];
  draft: string;
  error: string;
}

/**
 * M11 anchors — the Deliverable Anchor Board: four pinned slots
 * (Presentation / Demo / Report / Documentation) shown above the Kanban,
 * each with a lightweight inline editor for its URL.
 *
 * Slots are plain divs on purpose: the board tests count `article` elements
 * as task cards (same reason TeamWorkload uses divs). White cards, subtle
 * borders, rounded corners and brand-primary accents per DESIGN.md §2/§4.
 */
function AnchorBoard({ anchors, onSave, onRemove }: AnchorBoardProps) {
  const [editing, setEditing] = useState<EditorState | null>(null);

  const startEdit = (anchor: Anchor) => {
    // Pre-fill with the saved URL on edit; empty on add.
    setEditing({ id: anchor.id, draft: anchor.url ?? '', error: '' });
  };

  const handleSave = () => {
    if (!editing) return;
    const error = validateAnchorUrl(editing.draft);
    if (error) {
      setEditing({ ...editing, error });
      return;
    }
    onSave(editing.id, editing.draft.trim());
    setEditing(null);
  };

  return (
    <section data-anchor-board aria-label="Deliverable anchors" className="mb-6">
      <h2 className="mb-2 text-base font-semibold uppercase tracking-wide text-text-primary">
        Deliverable Anchors
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {anchors.map((anchor) => {
          const Icon = SLOT_ICONS[anchor.id];
          const isEditing = editing?.id === anchor.id;
          return (
            <div
              key={anchor.id}
              data-anchor-slot
              data-anchor-id={anchor.id}
              className="flex flex-col rounded-md border border-slate-200 bg-surface-card p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary/10 text-brand-primary"
                >
                  <Icon />
                </span>
                <h3 className="truncate text-sm font-medium text-text-primary">{anchor.label}</h3>
              </div>

              {isEditing ? (
                <form
                  className="mt-2 space-y-2"
                  onSubmit={(e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    handleSave();
                  }}
                >
                  <label htmlFor={`anchor-url-${anchor.id}`} className="sr-only">
                    Link for {anchor.label}
                  </label>
                  <input
                    id={`anchor-url-${anchor.id}`}
                    data-anchor-input
                    type="text"
                    value={editing.draft}
                    autoFocus
                    onChange={(e) => setEditing({ ...editing, draft: e.target.value, error: '' })}
                    placeholder="https://example.com/demo"
                    className="w-full rounded border border-slate-300 bg-surface-card px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {editing.error && (
                    <p data-anchor-error role="alert" className="text-xs text-type-bug">
                      {editing.error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-action="save-link"
                      onClick={handleSave}
                      className="rounded bg-brand-primary px-2 py-1 text-xs font-medium text-white hover:bg-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      Save Link
                    </button>
                    <button
                      type="button"
                      data-action="cancel-link"
                      onClick={() => setEditing(null)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : anchor.url ? (
                <div className="mt-2">
                  {/* The full URL is always preserved; CSS truncates only the display. */}
                  <a
                    data-anchor-link
                    href={anchor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={anchor.url}
                    className="block truncate rounded text-xs text-brand-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    {anchor.url}
                  </a>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      data-action="edit-link"
                      onClick={() => startEdit(anchor)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      Edit Link
                    </button>
                    <button
                      type="button"
                      data-action="remove-link"
                      onClick={() => onRemove(anchor.id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-text-muted hover:border-type-bug/40 hover:text-type-bug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      Remove Link
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-1 flex-col">
                  <p
                    data-anchor-empty
                    className="flex-1 rounded-md border-2 border-dashed border-slate-300 p-2 text-center text-xs text-text-muted"
                  >
                    No link yet.
                  </p>
                  <button
                    type="button"
                    data-action="add-link"
                    onClick={() => startEdit(anchor)}
                    className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    Add Link
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default AnchorBoard;
