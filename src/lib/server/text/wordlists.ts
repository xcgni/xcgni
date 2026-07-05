import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Categorized semantic wordlists for retrieval/semantic fluency (WORDLISTS-PLAN.md).
 * One file per listKey at challenge-bank/wordlists/<key>.en.txt - repo-owned, offline,
 * one lowercase entry per line. Loaded lazily PER KEY into a cached Set.
 *
 * Same fail-open posture as the letter dictionary (v0.64.27): a missing or unreadable
 * file returns null and validation falls back to the item's baked accept-list - a
 * narrower validator is better than a dead practice page. The test suites exercise
 * both the loaded and the fallback path.
 *
 * Plural/variant expansion happens HERE at load time, not in the files: each entry
 * also accepts its naive plural (+s, +es, y->ies; last token for multi-word entries).
 * Generous by design - fluency asks "did you produce the word", not "did you inflect
 * it the way our file happens to".
 */
const cache = new Map<string, Set<string> | null>();

const KEY_RE = /^[a-z][a-z0-9_]*$/;

function pluralVariants(entry: string): string[] {
  const tokens = entry.split(' ');
  const last = tokens[tokens.length - 1];
  const heads = tokens.slice(0, -1).join(' ');
  const withHead = (w: string) => (heads ? `${heads} ${w}` : w);
  const out: string[] = [];
  if (last.length < 3) return out;
  if (last.endsWith('y') && !/[aeiou]y$/.test(last)) {
    out.push(withHead(last.slice(0, -1) + 'ies'));
  } else if (/(s|x|z|ch|sh)$/.test(last)) {
    out.push(withHead(last + 'es'));
  } else if (!last.endsWith('s')) {
    out.push(withHead(last + 's'));
  }
  return out;
}

export function categoryWordlist(listKey: string): Set<string> | null {
  if (!KEY_RE.test(listKey)) return null; // never let a key shape a path
  if (cache.has(listKey)) return cache.get(listKey) ?? null;
  let set: Set<string> | null = null;
  try {
    const path = join(process.cwd(), 'challenge-bank', 'wordlists', `${listKey}.en.txt`);
    const lines = readFileSync(path, 'utf8').split('\n');
    set = new Set<string>();
    for (const raw of lines) {
      const w = raw.trim().toLowerCase();
      if (!w || w.startsWith('#')) continue;
      set.add(w);
      for (const v of pluralVariants(w)) set.add(v);
    }
    if (set.size === 0) set = null; // an empty file is a broken file: fail open
  } catch {
    set = null;
  }
  cache.set(listKey, set);
  return set;
}

/** Test hook: clear the cache so suites can exercise both paths. */
export function _resetWordlistCache(): void {
  cache.clear();
}
