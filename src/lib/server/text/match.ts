// Shared answer matching for free-text answers (retention recall, word challenges).
// Goal: be fair to humans (typos, short-vs-full forms) WITHOUT becoming so loose that the
// measurement stops meaning anything. Every relaxation here is deliberate and bounded.
//
// Match result is graded so callers can PENALISE a fuzzy match (correct, but not pristine):
//   'exact'  - normalised exact match or an explicit accepted alternate
//   'fuzzy'  - accepted via typo tolerance or short/full form (counts, but caller may dock speed/quality)
//   'none'   - no match

export type MatchKind = 'exact' | 'fuzzy' | 'none';

export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents: café -> cafe
    .replace(/[^a-z0-9\s]/g, ' ')                      // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein edit distance, capped: returns early once it exceeds `max` (cheap).
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1; // whole row already over budget
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

// How many typos to forgive for a word of this length. Short words get NO slack (too easy to
// turn one valid word into another); longer words get one edit.
function allowedEdits(len: number): number {
  if (len >= 8) return 2;
  if (len >= 5) return 1;
  return 0;
}

// Does `given` match `target` as a short/full form? We accept when the shorter string is a
// whole-word subsequence of the longer (e.g. "tarantino" vs "quentin tarantino", "co2" handled
// via accepted-list, "carbon dioxide" vs "co2" via accepted-list). Whole-word only, so "cat"
// does not match "category".
function shortFullMatch(given: string, target: string): boolean {
  const g = given.split(' ').filter(Boolean);
  const t = target.split(' ').filter(Boolean);
  if (g.length === 0 || t.length === 0) return false;
  const [short, long] = g.length <= t.length ? [g, t] : [t, g];
  // require the short form to be a meaningful chunk (>=1 token, each token >=3 chars) and all
  // its tokens present as whole words in the long form, in order.
  if (short.some((w) => w.length < 3)) return false;
  let idx = 0;
  for (const w of short) {
    const found = long.indexOf(w, idx);
    if (found === -1) return false;
    idx = found + 1;
  }
  // only count it if the short form is genuinely shorter (a real abbreviation), not equal length
  return short.length < long.length;
}

/**
 * Match a free-text answer against the canonical answer plus any accepted alternates.
 * Returns the strength of the match so the caller can reward exact and gently penalise fuzzy.
 */
export function matchAnswer(given: string, answer: string, accepted: string[] = []): MatchKind {
  const g = normalize(given);
  if (!g) return 'none';

  const targets = [answer, ...accepted].map(normalize).filter(Boolean);

  // 1) exact (normalised) against answer or any accepted alternate
  if (targets.includes(g)) return 'exact';

  // 2) short/full form (e.g. "tarantino" for "quentin tarantino")
  for (const t of targets) {
    if (shortFullMatch(g, t)) return 'fuzzy';
  }

  // 3) typo tolerance (bounded by word length), per target
  for (const t of targets) {
    const max = allowedEdits(Math.max(g.length, t.length));
    if (max > 0 && editDistance(g, t, max) <= max) return 'fuzzy';
  }

  return 'none';
}
