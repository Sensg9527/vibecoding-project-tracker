// Explicit .ts extension: the file is also imported from Node's native
// type-stripping test runner, which (unlike Vite) does not resolve bare paths.
import { INITIAL_ANCHORS } from '../data/constants.ts';
import type { Anchor } from '../types/task';

/**
 * M11 anchors — validate a URL the user typed into a slot's editor.
 * Returns null when the URL is acceptable, or a human-readable reason.
 *
 * Only http/https survive: `javascript:`, `data:`, `file:`, `mailto:` and
 * any other protocol are rejected, and so is anything the URL parser cannot
 * parse. The user's input is stored verbatim (after a trim), so query
 * parameters and fragments are preserved.
 */
export function validateAnchorUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 'Please enter a URL.';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "That doesn't look like a valid URL — include the full address, e.g. https://example.com.";
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http:// and https:// links are allowed.';
  }
  return null;
}

/**
 * M11 anchors — repair whatever JSON was found under `vibetracker.anchors`.
 * Guarantees the four locked slots exist (missing ones are re-seeded from
 * INITIAL_ANCHORS with `url: null`), drops unknown slot ids, falls back to
 * the default label when a stored one is missing/blank, and keeps only
 * stored URLs that pass `validateAnchorUrl` — so hand-edited storage can
 * never put a `javascript:` link on the page. Valid stored data still wins
 * over the seeds.
 */
export function normalizeAnchors(stored: unknown): Anchor[] {
  const defaults = new Map<string, Anchor>(INITIAL_ANCHORS.map((a) => [a.id, a]));
  const kept = new Map<string, Anchor>();
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (item === null || typeof item !== 'object') continue;
      const raw = item as Record<string, unknown>;
      const id = raw.id;
      const def = typeof id === 'string' ? defaults.get(id) : undefined;
      if (!def) continue; // unknown slot ids are dropped
      const label = raw.label;
      const url = raw.url;
      kept.set(def.id, {
        id: def.id,
        label: typeof label === 'string' && label.trim() !== '' ? label : def.label,
        url: typeof url === 'string' && validateAnchorUrl(url) === null ? url.trim() : null,
      });
    }
  }
  return INITIAL_ANCHORS.map((def) => kept.get(def.id) ?? { ...def });
}
