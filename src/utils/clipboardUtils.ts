/**
 * M10 copy-prompt — clipboard writing with a legacy fallback.
 * Returns true only when a copying method genuinely succeeded, so callers
 * never claim a copy that did not happen.
 */

/**
 * Writes `text` to the clipboard: the modern async Clipboard API first, then
 * the hidden-textarea + `document.execCommand('copy')` fallback where
 * supported. Rejects/permission errors from the first path fall through to
 * the second; only a real success from either returns true.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // NotAllowedError, insecure context, etc. — try the legacy path.
  }
  return legacyCopy(text);
}

/**
 * The pre-async fallback: a temporary off-screen textarea selected and copied
 * via `execCommand`. The temp node is always removed, the previous focus is
 * restored and the previous text selection is put back, so the attempt leaves
 * the page untouched. The execCommand result is checked — never assumed.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);

  // Remember focus + selection so the attempt leaves the page untouched.
  const active = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);

  if (selection && range) {
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    selection?.removeAllRanges();
  }
  active?.focus();
  return ok;
}
