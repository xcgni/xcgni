import { pg } from '$lib/server/db';

// Record one typed-word outcome: was it accepted via typo tolerance (fuzzy) or clean. Only call
// for answers that were ACCEPTED (exact or fuzzy) - a wrong answer isn't a spelling slip, it's a
// recall miss. Best-effort; never blocks the answer flow.
export async function recordSpelling(userId: string, wasFuzzy: boolean): Promise<void> {
  await pg`
    INSERT INTO user_spelling (user_id, typed_words, typo_words)
    VALUES (${userId}, 1, ${wasFuzzy ? 1 : 0})
    ON CONFLICT (user_id) DO UPDATE SET
      typed_words = user_spelling.typed_words + 1,
      typo_words = user_spelling.typo_words + ${wasFuzzy ? 1 : 0},
      updated_at = now()
  `;
}

export interface SpellingStat {
  typedWords: number;
  typoWords: number;
  accuracyPct: number | null;  // clean / typed, null until enough data
  minWords: number;
}

const SPELLING_MIN = 20; // need a reasonable number of typed words before reporting

export async function userSpelling(userId: string): Promise<SpellingStat> {
  const rows = await pg`SELECT typed_words, typo_words FROM user_spelling WHERE user_id = ${userId}`;
  const r = (rows as { typed_words: number; typo_words: number }[])[0];
  const typed = r?.typed_words ?? 0;
  const typo = r?.typo_words ?? 0;
  const accuracyPct = typed >= SPELLING_MIN ? Math.round(((typed - typo) / typed) * 100) : null;
  return { typedWords: typed, typoWords: typo, accuracyPct, minWords: SPELLING_MIN };
}
