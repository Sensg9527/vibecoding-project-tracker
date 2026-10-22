// M12 full-card drag: a completed drag must never open the edit modal.
//
// Browsers normally suppress the click that follows a native drag, but some
// paths (and synthetic test events) can still deliver one. A cross-column
// move REMOUNTS the card component under its new column, so per-component
// state would be lost exactly when it is needed — this module-level guard
// survives remounts without needing any re-render: the card records the
// drag end and ignores clicks that arrive within the guard window.
//
// The timestamps are injectable so the window is unit-testable without a
// real clock (same pattern as dueDateUtils).
let lastDragEndAt = 0;

/** How long a click is ignored after a drag ends. */
export const DRAG_CLICK_GUARD_MS = 250;

/** Record that a drag just ended (call from the card's dragend handler). */
export function recordDragEnd(now: number = Date.now()): void {
  lastDragEndAt = now;
}

/** True when a click arriving right now would be a trailing click of a drag. */
export function isClickSuppressed(now: number = Date.now()): boolean {
  return now - lastDragEndAt < DRAG_CLICK_GUARD_MS;
}
