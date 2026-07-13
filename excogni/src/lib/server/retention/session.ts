import { pg } from '$lib/server/db';
import { schedule, isMeasurementDue, retentionMastery, masteryToRating, type CardState } from './index';
import { matchAnswer } from '$lib/server/text/match';
import { recordSpelling } from '$lib/server/stats/spelling';

const MATURITY_DAYS = 7; // interval at which a card is "truly retained"

export interface RetentionCard {
  cardId: string;
  deck: string;
  deckLabel: string;
  prompt: string;
  isNew: boolean;       // first exposure (learning, not measuring)
  wasDue: boolean;      // was a genuine recall test
  answer: string | null; // included only for NEW cards (learning); null for due cards
}

/** Pick the next retention card for a user: a due card if any, else a new card
 *  to learn. Returns null only if the deck is exhausted and nothing is due. */
export async function nextRetentionCard(userId: string, deckFilter?: string[]): Promise<RetentionCard | null> {
  // 1) due cards first (already-learned, now being tested). Due reviews are NEVER
  //    filtered by deck - skipping a due card to honor a theme choice would break
  //    the spaced-repetition schedule. The filter only narrows which NEW cards to learn.
  const due = await pg`
    SELECT c.id, c.deck, c.deck_label, c.prompt, s.interval_days
    FROM user_card_state s
    JOIN retention_cards c ON c.id = s.card_id
    WHERE s.user_id = ${userId} AND c.active AND s.due_at <= now()
    ORDER BY s.due_at ASC
    LIMIT 1
  `;
  if (due[0]) {
    return {
      cardId: due[0].id, deck: due[0].deck, deckLabel: due[0].deck_label,
      prompt: due[0].prompt, isNew: false,
      wasDue: isMeasurementDue(Number(due[0].interval_days)),
      answer: null // hidden - a due card is a real recall test
    };
  }
  // 2) otherwise a new card the user hasn't seen - optionally scoped to chosen decks
  const hasFilter = Array.isArray(deckFilter) && deckFilter.length > 0;
  const fresh = await pg`
    SELECT c.id, c.deck, c.deck_label, c.prompt, c.answer
    FROM retention_cards c
    WHERE c.active AND c.id NOT IN (
      SELECT card_id FROM user_card_state WHERE user_id = ${userId}
    )
    ${hasFilter ? pg`AND c.deck = ANY(${deckFilter})` : pg``}
    ORDER BY random()
    LIMIT 1
  `;
  if (fresh[0]) {
    return {
      cardId: fresh[0].id, deck: fresh[0].deck, deckLabel: fresh[0].deck_label,
      prompt: fresh[0].prompt, isNew: true, wasDue: false,
      answer: fresh[0].answer // shown - this is the learning step
    };
  }
  return null;
}

export interface RetentionGrade {
  correct: boolean;
  fuzzy: boolean;          // matched via typo/short-form (counted, gently penalised)
  answer: string;          // the canonical answer to reveal
  note: string | null;     // optional factoid, surfaced on a miss
  countedAsMeasurement: boolean;
  mastery: number | null;
  rating: number | null;
}

/** Grade a recall attempt. Updates scheduling always (training); updates the
 *  measurement signal only when the card was genuinely due. */
export async function gradeRetention(userId: string, cardId: string, given: string, elapsedMs: number): Promise<RetentionGrade> {
  const cardRows = await pg`SELECT id, answer, accepted, note FROM retention_cards WHERE id = ${cardId} AND active`;
  const card = cardRows[0];
  if (!card) throw new Error('card not found');

  const accepted: string[] = Array.isArray(card.accepted) ? card.accepted : [];
  const match = matchAnswer(given, card.answer, accepted);
  const correct = match !== 'none';

  // load or initialize state
  const stateRows = await pg`
    SELECT ease, interval_days, reps, lapses, due_reviews, due_hits
    FROM user_card_state WHERE user_id = ${userId} AND card_id = ${cardId}
  `;
  const existing = stateRows[0];
  const wasDue = existing ? isMeasurementDue(Number(existing.interval_days)) : false;

  const state: CardState = existing
    ? { ease: Number(existing.ease), intervalDays: Number(existing.interval_days), reps: existing.reps, lapses: existing.lapses }
    : { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

  // grade quality: wrong=0; correct fast=3, normal=2, slow=1. A FUZZY match (typo or short/full
  // form) counts as correct but is gently penalised - capped at 2, never the fast-3 bonus, since
  // it wasn't a clean recall.
  let grade: 0 | 1 | 2 | 3 = !correct ? 0 : elapsedMs < 3000 ? 3 : elapsedMs < 8000 ? 2 : 1;
  if (match === 'fuzzy' && grade === 3) grade = 2;
  const next = schedule(state, grade);
  const dueAt = new Date(Date.now() + next.nextDueMs);

  // measurement signal only counts when the card was genuinely due
  const countedAsMeasurement = wasDue;
  const dueReviewsInc = countedAsMeasurement ? 1 : 0;
  const dueHitsInc = countedAsMeasurement && correct ? 1 : 0;

  await pg`
    INSERT INTO user_card_state
      (user_id, card_id, ease, interval_days, reps, lapses, due_at, last_seen_at, due_reviews, due_hits)
    VALUES (${userId}, ${cardId}, ${next.ease}, ${next.intervalDays}, ${next.reps}, ${next.lapses},
            ${dueAt}, now(), ${dueReviewsInc}, ${dueHitsInc})
    ON CONFLICT (user_id, card_id) DO UPDATE SET
      ease = ${next.ease}, interval_days = ${next.intervalDays}, reps = ${next.reps},
      lapses = ${next.lapses}, due_at = ${dueAt}, last_seen_at = now(),
      due_reviews = user_card_state.due_reviews + ${dueReviewsInc},
      due_hits = user_card_state.due_hits + ${dueHitsInc}
  `;

  // recompute mastery + rating across all of the user's retention cards
  const agg = await pg`
    SELECT
      coalesce(sum(due_reviews),0)::int AS due_reviews,
      coalesce(sum(due_hits),0)::int AS due_hits,
      count(*)::int AS total_seen,
      count(*) FILTER (WHERE interval_days >= ${MATURITY_DAYS})::int AS mature
    FROM user_card_state WHERE user_id = ${userId}
  `;
  const a = agg[0];
  const mastery = retentionMastery({
    dueReviews: a.due_reviews, dueHits: a.due_hits, matureCards: a.mature, totalSeen: a.total_seen
  });
  const rating = mastery != null ? masteryToRating(mastery) : null;

  // persist into user_category_state under the 'retention' slug so records/radar work
  if (rating != null) {
    await pg`
      INSERT INTO user_category_state
        (user_id, category_slug, current_level, stable_level, rating, attempts_count, correct_count,
         peak_rating, peak_rating_at, updated_at)
      VALUES (${userId}, 'retention', 1, 1, ${rating}, ${a.due_reviews}, ${a.due_hits},
              ${rating}, now(), now())
      ON CONFLICT (user_id, category_slug) DO UPDATE SET
        rating = ${rating},
        attempts_count = ${a.due_reviews},
        correct_count = ${a.due_hits},
        peak_rating = greatest(coalesce(user_category_state.peak_rating, 0), ${rating}),
        peak_rating_at = CASE WHEN ${rating} > coalesce(user_category_state.peak_rating, 0)
                              THEN now() ELSE user_category_state.peak_rating_at END,
        updated_at = now()
    `;
    // BASELINE capture at retention's calibration point (3 due reviews - see RETENTION_CALIBRATE).
    // Write-once, first crossing wins.
    if (a.due_reviews >= 3) {
      await pg`
        INSERT INTO user_category_baseline (user_id, category_slug, rating, attempts_count)
        VALUES (${userId}, 'retention', ${rating}, ${a.due_reviews})
        ON CONFLICT (user_id, category_slug) DO NOTHING
      `;
    }
  }

  // Record spelling outcome for accepted answers (exact or fuzzy) - feeds the spelling-accuracy
  // trait. A wrong answer is a recall miss, not a spelling slip, so only count when correct.
  if (correct) {
    recordSpelling(userId, match === 'fuzzy').catch(() => {});
  }

  return {
    correct,
    fuzzy: match === 'fuzzy',
    answer: card.answer,
    note: !correct ? (card.note ?? null) : null, // factoid surfaced only when missed
    countedAsMeasurement,
    mastery,
    rating
  };
}

/** Counts for the retention UI: due now, learning, mature, mastery. */
export async function retentionStatus(userId: string) {
  const rows = await pg`
    SELECT
      count(*) FILTER (WHERE due_at <= now())::int AS due_now,
      count(*)::int AS seen,
      count(*) FILTER (WHERE interval_days >= ${MATURITY_DAYS})::int AS mature,
      coalesce(sum(due_reviews),0)::int AS due_reviews,
      coalesce(sum(due_hits),0)::int AS due_hits
    FROM user_card_state WHERE user_id = ${userId}
  `;
  const total = await pg`SELECT count(*)::int AS n FROM retention_cards WHERE active`;
  const r = rows[0];
  const mastery = retentionMastery({
    dueReviews: r.due_reviews, dueHits: r.due_hits, matureCards: r.mature, totalSeen: r.seen
  });
  return {
    dueNow: r.due_now, seen: r.seen, mature: r.mature, totalCards: total[0]?.n ?? 0,
    dueReviews: r.due_reviews, mastery
  };
}
