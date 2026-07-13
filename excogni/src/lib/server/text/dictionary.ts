import { readFileSync } from 'node:fs';

/**
 * English dictionary for letter-fluency validation (~275k inflected words via the `word-list`
 * package, SCOWL-derived). Loaded lazily, ONCE, into a Set. Deliberately fail-open: if the
 * package is missing (tests without node_modules, or a broken install), callers receive null
 * and fall back to the structural heuristics - a worse validator is better than a dead one.
 */
let dict: Set<string> | null | undefined; // undefined = not tried, null = unavailable

export async function englishDictionary(): Promise<Set<string> | null> {
  if (dict !== undefined) return dict;
  try {
    const mod = await import('word-list');
    const path = (mod as { default: string }).default;
    const words = readFileSync(path, 'utf8').split('\n');
    dict = new Set(words.filter((w) => w.length >= 2));
  } catch {
    dict = null;
  }
  return dict;
}
