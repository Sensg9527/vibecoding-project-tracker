interface ToastProps {
  text: string;
}

/**
 * M7 task-owner — a small, non-blocking confirmation toast.
 * role="status" + aria-live="polite" announce it to screen readers;
 * pointer-events-none keeps it from ever blocking clicks behind it.
 * The 200 ms fade comes from DESIGN.md §7 (`animate-toast-in` in index.css).
 * App owns the auto-dismiss timer.
 */
function Toast({ text }: ToastProps) {
  return (
    <div
      data-toast
      role="status"
      aria-live="polite"
      className="animate-toast-in pointer-events-none fixed bottom-6 right-6 z-50 rounded-md border border-slate-200 bg-surface-card px-4 py-2 text-sm text-text-primary shadow-lg"
    >
      {text}
    </div>
  );
}

export default Toast;
