/**
 * Category-fluency matching (v1.3.2), extracted pure so it can be unit-tested.
 *
 * The bug this fixes (user-found, screenshot: english / englisg / englsh all credited):
 * validity was deduplicated on the RAW typed string, but fuzzy and short/full matches
 * resolve to a canonical list entry - and nothing recorded which entry was consumed. One
 * word plus its typos scored as many answers. Now every accepted word consumes its
 * CANONICAL entry (plural-folded), and a later word resolving to the same entry is marked
 * a duplicate: shown, but not counted.
 *
 * Plural folding: "dog" and "dogs" are one concept even when both appear as list entries
 * (the wordlists deliberately enumerate plural variants for ACCEPTANCE - that widening
 * must not double-COUNT). The fold is a dedup key only, never a validity test, so its
 * crudeness ("glasses" -> "glasse") is harmless: both sides fold identically.
 */

export type FluencyVerdict = { ok: boolean; fuzzy: boolean; dup: boolean };

export function foldPlural(x: string): string {
  if (x.length > 4 && x.endsWith('es')) return x.slice(0, -2);
  if (x.length > 3 && x.endsWith('s')) return x.slice(0, -1);
  return x;
}

// Local bounded edit distance - deliberately NOT imported from $lib/server/text/match so
// this module stays dependency-free and directly loadable by the bare-node test suites
// (the $lib alias only exists inside the SvelteKit build). Mirrors that implementation.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

/** short/full equivalence; returns the MATCHED ENTRY (so it can be consumed), or null. */
export function shortFullMatch(word: string, acceptSet: Set<string>): string | null {
  const gTokens = word.split(' ').filter(Boolean);
  if (gTokens.length > 1) {
    for (const a of acceptSet) {
      const aTokens = a.split(' ').filter(Boolean);
      const [short, long] = gTokens.length <= aTokens.length ? [gTokens, aTokens] : [aTokens, gTokens];
      if (short.length >= long.length) continue;
      if (short.some((t) => t.length < 3)) continue;
      let idx = 0;
      let okAll = true;
      for (const t of short) {
        const f = long.indexOf(t, idx);
        if (f === -1) { okAll = false; break; }
        idx = f + 1;
      }
      if (okAll) return a;
    }
    return null;
  }
  if (word.length < 4) return null;
  for (const a of acceptSet) {
    const aTokens = a.split(' ').filter(Boolean);
    if (aTokens.length > 1 && aTokens[aTokens.length - 1] === word) return a;
  }
  return null;
}

/**
 * Judge one produced word against the accept set, CONSUMING the canonical entry it
 * resolves to. `usedCanon` is the caller-held set of already-consumed canonical keys.
 */
export function judgeCategoryWord(
  w: string,
  accept: Set<string>,
  usedCanon: Set<string>
): FluencyVerdict {
  // exact
  if (accept.has(w)) {
    const canon = foldPlural(w);
    if (usedCanon.has(canon)) return { ok: false, fuzzy: false, dup: true };
    usedCanon.add(canon);
    return { ok: true, fuzzy: false, dup: false };
  }
  // short/full equivalence
  const sf = shortFullMatch(w, accept);
  if (sf) {
    const canon = foldPlural(sf);
    if (usedCanon.has(canon)) return { ok: false, fuzzy: true, dup: true };
    usedCanon.add(canon);
    return { ok: true, fuzzy: true, dup: false };
  }
  // typo tolerance: 1 edit, length-gated - and now it consumes the entry it matched
  if (w.length >= 5) {
    for (const a of accept) {
      if (a.length >= 5 && editDistance(w, a, 1) <= 1) {
        const canon = foldPlural(a);
        if (usedCanon.has(canon)) return { ok: false, fuzzy: true, dup: true };
        usedCanon.add(canon);
        return { ok: true, fuzzy: true, dup: false };
      }
    }
  }
  return { ok: false, fuzzy: false, dup: false };
}
