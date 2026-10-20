import { useEffect, useRef } from 'react';

interface ManualCopyDialogProps {
  /** The generated Markdown the user needs to copy by hand. */
  text: string;
  onClose: () => void;
}

/**
 * M10 copy-prompt fallback — shown only when both clipboard methods failed,
 * so the user can still select the markdown and copy it manually. Follows
 * the TaskModal patterns: dialog semantics, Escape/backdrop/✕ close, body
 * scroll lock, focus restored to the trigger on close.
 */
function ManualCopyDialog({ text, onClose }: ManualCopyDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Captured during render (same M6 lesson as TaskModal): effects run after
  // autoFocus-like focus moves, so the restore target must be grabbed first.
  const previousFocusRef = useRef<HTMLElement | null>(null);
  if (previousFocusRef.current === null) {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Select everything so a single Ctrl/Cmd+C copies the whole prompt.
    const ta = textareaRef.current;
    ta?.focus();
    ta?.select();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-copy-title"
        data-manual-copy
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="manual-copy-title" className="text-lg font-semibold text-text-primary">
            Copy prompt manually
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 leading-none text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Automatic copy isn&apos;t available here — select the text and copy it yourself.
        </p>
        <textarea
          ref={textareaRef}
          readOnly
          rows={14}
          value={text}
          aria-label="Generated prompt context"
          className="w-full rounded border border-slate-300 bg-surface-page px-2.5 py-1.5 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManualCopyDialog;
