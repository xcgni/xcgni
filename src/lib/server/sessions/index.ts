import { db, pg } from '$lib/server/db';
import {
  practiceSessions, attempts, challenges, userCategoryState, userSettings
} from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { editDistance } from '$lib/server/text/match';
import { computeQualityFlags } from './quality';
import vocabDefinitions from '$lib/data/verbal-definitions.json';
import {
  effectiveElapsedMs, speedClass, scoreAttempt, scoreDeliberate, nextLevel,
  stableLevel, computeRating, confidence, percentError, estimationScore,
  type ScoringConfig, type RecentAttempt
} from '$lib/server/rating';
import { levelBounds, validateAnswer } from '$lib/server/challenges';
import { gradePlan, gradeStepOrder, gradeGridPath } from './planning';
import { METHODOLOGY_VERSION } from '$lib/methodology';

// Mark a still-pending attempt as abandoned when the user leaves the page mid-challenge, so it isn't
// left dangling as 'pending' forever. Best-effort: only touches the user's own pending attempt, never
// overwrites an answered one (avoids a race with a near-simultaneous submit).
export async function abandonAttempt(userId: string, attemptId: string): Promise<void> {
  await pg`
    UPDATE attempts
    SET status = 'abandoned', submitted_at = now()
    WHERE id = ${attemptId} AND user_id = ${userId} AND status = 'pending'
  `;
}
import { categoryPercentile, estimationErrorPool } from '$lib/server/stats';
import { englishDictionary } from '$lib/server/text/dictionary';
import { categoryWordlist } from '$lib/server/text/wordlists';

export const INACTIVITY_MINUTES = 4; // a gap longer than this starts a new session

/** Keep the user's current open practice session alive (refresh last_activity_at) WITHOUT creating
 *  one. Used by the Retention and Reaction endpoints so a module burst mid-mix counts as session
 *  activity - otherwise a burst longer than the inactivity window would silently end the session
 *  and the run page would re-open a new one (re-asking the pre-session questionnaire). Only
 *  refreshes a session that is still within the window; never resurrects a stale one. */
export async function touchUserSession(userId: string): Promise<void> {
  await pg`
    UPDATE practice_sessions SET last_activity_at = now()
    WHERE id = (
      SELECT id FROM practice_sessions
      WHERE user_id = ${userId} AND ended_at IS NULL
        AND last_activity_at > now() - (${INACTIVITY_MINUTES} * interval '1 minute')
      ORDER BY last_activity_at DESC LIMIT 1
    )
  `;
}

/** Returns the user's open session, or creates one. A session is "open" if its
 *  last activity is within the inactivity window and it has not been ended.
 *  `tz` (IANA name) and `tzOffsetMin` are captured client-side and stored on
 *  new sessions for later trend-of-state analysis. */
export async function ensureSession(
  userId: string,
  tz?: string | null,
  tzOffsetMin?: number | null
): Promise<string> {
  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000);
  const rows = await db.select().from(practiceSessions)
    .where(eq(practiceSessions.userId, userId))
    .orderBy(desc(practiceSessions.lastActivityAt))
    .limit(1);
  const last = rows[0];
  if (last && !last.endedAt && last.lastActivityAt > cutoff) {
    return last.id;
  }
  if (last && !last.endedAt) {
    // close the stale session at its last activity time
    await db.update(practiceSessions)
      .set({ endedAt: last.lastActivityAt })
      .where(eq(practiceSessions.id, last.id));
  }
  const [s] = await db.insert(practiceSessions).values({
    userId,
    timezone: tz ?? null,
    tzOffsetMin: typeof tzOffsetMin === 'number' ? tzOffsetMin : null
  }).returning({ id: practiceSessions.id });
  return s.id;
}

export async function touchSession(sessionId: string) {
  await db.update(practiceSessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(practiceSessions.id, sessionId));
}

// Category preferences use a DISABLED list: everything implemented is on by default; the user opts
// specific categories out. This means a newly-added category is automatically in the mix (it's in
// nobody's disabled set) - fixing the old bug where new categories silently defaulted off.
export async function getDisabledCategories(userId: string): Promise<string[]> {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  const v = rows[0]?.disabledCategories;
  return Array.isArray(v) ? (v as string[]) : [];
}

// The effective ENABLED set = all implemented/active categories minus the user's disabled ones.
export async function getEnabledCategories(userId: string): Promise<string[]> {
  const allImplemented = (await pg`SELECT slug FROM categories WHERE implemented AND active`)
    .map((r: { slug: string }) => r.slug as string);
  const disabled = new Set(await getDisabledCategories(userId));
  return allImplemented.filter((s) => !disabled.has(s));
}

// Persist preferences from a chosen ENABLED set by storing its complement (the disabled set), so the
// "new categories default on" property holds. Only real implemented slugs are considered.
export async function setEnabledCategories(userId: string, enabledSlugs: string[]) {
  const allImplemented = (await pg`SELECT slug FROM categories WHERE implemented AND active`)
    .map((r: { slug: string }) => r.slug as string);
  const enabled = new Set(enabledSlugs.filter((s) => allImplemented.includes(s)));
  const disabled = allImplemented.filter((s) => !enabled.has(s));
  await pg`
    INSERT INTO user_settings (user_id, disabled_categories, updated_at)
    VALUES (${userId}, ${JSON.stringify(disabled)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE
      SET disabled_categories = EXCLUDED.disabled_categories, updated_at = now()
  `;
}

// Exclude a single category "from now on" (used by the in-challenge opt-out). Because an empty
// enabled-list means "all enabled", we must first expand to the full implemented set, then remove
// the one - otherwise removing from [] would wrongly persist as "all" again. Returns the new
// enabled list so the caller can confirm.
export async function excludeCategory(userId: string, slug: string): Promise<string[]> {
  // add to the disabled set (idempotent), then return the new effective enabled set
  const disabled = new Set(await getDisabledCategories(userId));
  disabled.add(slug);
  await pg`
    INSERT INTO user_settings (user_id, disabled_categories, updated_at)
    VALUES (${userId}, ${JSON.stringify([...disabled])}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE
      SET disabled_categories = EXCLUDED.disabled_categories, updated_at = now()
  `;
  return getEnabledCategories(userId);
}

export async function hasSeenIntro(userId: string): Promise<boolean> {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return rows[0]?.seenIntro ?? false;
}

export async function markIntroSeen(userId: string) {
  await pg`
    INSERT INTO user_settings (user_id, seen_intro, updated_at)
    VALUES (${userId}, true, now())
    ON CONFLICT (user_id) DO UPDATE
      SET seen_intro = true, updated_at = now()
  `;
}

export async function getCategoryState(userId: string, categorySlug: string) {
  const rows = await db.select().from(userCategoryState)
    .where(and(eq(userCategoryState.userId, userId), eq(userCategoryState.categorySlug, categorySlug)))
    .limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db.insert(userCategoryState)
    .values({ userId, categorySlug })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const again = await db.select().from(userCategoryState)
    .where(and(eq(userCategoryState.userId, userId), eq(userCategoryState.categorySlug, categorySlug)))
    .limit(1);
  return again[0];
}

export interface SubmitResult {
  correct: boolean;
  correctAnswer: string;
  score: number;
  speed: 'fast' | 'normal' | 'slow';
  level: number;
  nextLevel: number;
  rating: {
    value: number;
    before: number;
    delta: number;
    percentile: number | null;
    poolSize: number;
    status: 'ok' | 'calibrating';
    confidence: 'low' | 'medium' | 'high';
    provisional: boolean;
    attempts: number;
  };
  leveledUp: boolean;
  newRecordRating: boolean;
  peakRating: number;
  maxLevel: number;
  fluencyValidCount: number | null;
  fluencyWords: { w: string; ok: boolean; fuzzy: boolean }[] | null;
  vocab?: { prompt: { word: string; definition: string } | null; answer: { word: string; definition: string } | null } | null;
}

/**
 * The core measurement loop, server-side:
 * validate answer → integrity-clamp timing → score → ladder step →
 * stable level → rating → percentile → persist everything.
 */
export async function submitAttempt(
  userId: string,
  attemptId: string,
  givenAnswer: string,
  clientElapsedMs: number | null,
  inputMethod: string | null = null,
  micro: { firstInputMs?: number | null; editsCount?: number | null; firstAnswerChanged?: boolean | null; wordTimes?: number[] | null } = {}
): Promise<SubmitResult | { error: string }> {
  const rows = await db.select().from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
    .limit(1);
  const attempt = rows[0];
  if (!attempt) return { error: 'attempt not found' };
  if (attempt.status !== 'pending') return { error: 'attempt already answered' };

  const chRows = await db.select().from(challenges).where(eq(challenges.id, attempt.challengeId)).limit(1);
  const challenge = chRows[0];
  if (!challenge) return { error: 'challenge missing' };

  const cfg = challenge.scoringConfig as ScoringConfig & { displayMs?: number };
  const now = new Date();
  // memory_recall challenges show a stimulus first; that display time is not
  // response time, so it's excluded from the server-observed bound
  const displayMs = cfg.displayMs ?? 0;
  const serverElapsed = Math.max(now.getTime() - attempt.servedAt.getTime() - displayMs, 0);
  const effective = effectiveElapsedMs({ clientElapsedMs, serverElapsedMs: serverElapsed });

  const ad0 = challenge.answerData as { scoringMode?: string };
  const isEstimation = (cfg as { scoringMode?: string }).scoringMode === 'error_rank';
  const isFluency = ad0.scoringMode === 'fluency_count';
  const isPlanning = ad0.scoringMode === 'deliberate' || challenge.rendererType === 'planning_sequence';
  // experimental-tier challenges still record the attempt (data collection) but do NOT move the
  // user's official rating - they're a proving ground until a method graduates to canonical.
  const isExperimental = (challenge as { tier?: string }).tier === 'experimental';
  const ad = challenge.answerData as {
    trueValue?: number; correctAnswer?: number | string;
    acceptList?: string[]; constraint?: string;
  };

  let correct: boolean;
  // Fluency-list short/full matcher (see usage below). Pure and conservative by design.
  function shortFullFluency(word: string, acceptSet: Set<string>): boolean {
    const gTokens = word.split(' ').filter(Boolean);
    if (gTokens.length > 1) {
      // multi-word input: match if any entry is an in-order whole-word subset of it, or it of an entry
      for (const a of acceptSet) {
        const aTokens = a.split(' ').filter(Boolean);
        const [short, long] = gTokens.length <= aTokens.length ? [gTokens, aTokens] : [aTokens, gTokens];
        if (short.length >= long.length) continue;
        if (short.some((t) => t.length < 3)) continue;
        let idx = 0; let okAll = true;
        for (const t of short) { const f = long.indexOf(t, idx); if (f === -1) { okAll = false; break; } idx = f + 1; }
        if (okAll) return true;
      }
      return false;
    }
    // single-word input: only the LAST token of a multi-word entry, and only if it's substantial
    if (word.length < 4) return false;
    for (const a of acceptSet) {
      const aTokens = a.split(' ').filter(Boolean);
      if (aTokens.length > 1 && aTokens[aTokens.length - 1] === word) return true;
    }
    return false;
  }

  let score: number;
  let estError: number | null = null;
  let fluencyValidCount = 0;
  // Per-word verdicts for fluency, so the run feedback can SHOW which words counted and which
  // didn't (typo tolerance and rule-matching exist but were invisible at answer time).
  let fluencyWords: { w: string; ok: boolean; fuzzy: boolean }[] | null = null;

  if (isFluency && (Array.isArray(ad.acceptList) || typeof ad.constraint === 'string')) {
    // answer is a JSON array (or newline/comma list) of produced items.
    const accept = new Set((ad.acceptList ?? []).map((a) => a.trim().toLowerCase()));
    // Semantic fluency: union in the repo-owned categorized wordlist for this item's listKey
    // (v0.65.0, WORDLISTS-PLAN.md). The baked accept-list always still counts; the wordlist
    // widens it. Fail-open: with no file, the baked list alone remains the validator. The
    // downstream short/full matcher and typo tolerance operate on the widened set unchanged.
    const listKey = (challenge.promptData as { listKey?: string })?.listKey;
    if (typeof listKey === 'string') {
      const wl = categoryWordlist(listKey);
      if (wl) for (const e of wl) accept.add(e);
    }
    const constraint = typeof ad.constraint === 'string' ? ad.constraint.trim().toLowerCase() : '';

    // Phonemic fluency ("words starting with SP", "words ending in ING") is validated by RULE,
    // not by an accept-list - no finite list can enumerate every valid word, and crediting only
    // ~30 hand-listed words wrongly marks valid answers (sport/spain/spin) as mistakes. We detect
    // whether the constraint is a PREFIX or SUFFIX from the instruction, and accept any plausible
    // word that fits, of ANY part of speech. The accept-list remains only a fallback for the rare
    // SEMANTIC fluency item that has no letter constraint.
    const instr = ((challenge.promptData as { instruction?: string })?.instruction ?? '').toLowerCase();
    const isSuffix = /\bend(s|ing)?\b|ending\b/.test(instr);
    const isRuleFluency = constraint.length >= 1; // any letter/letters constraint = rule-based

    let produced: string[] = [];
    try {
      const parsed = JSON.parse(givenAnswer);
      if (Array.isArray(parsed)) produced = parsed.map((x) => String(x));
    } catch {
      produced = givenAnswer.split(/[,\n]/);
    }
    const seen = new Set<string>();
    fluencyWords = [];
    for (const raw of produced) {
      const w = raw.trim().toLowerCase();
      if (!w || seen.has(w)) continue;
      seen.add(w);
      const plausibleWord = w.length >= 2 && /^[a-z][a-z'-]*$/.test(w);
      // Structural sanity for rule-based (letter) fluency - tester-found: "hshshsher" and
      // "nznznzer" sailed through on the suffix alone. A real word needs a vowel and doesn't
      // stutter: no character or bigram repeated 3+ times in a row. Heuristics can't catch
      // every invention (nothing short of full dictionaries can) - the honesty note by the
      // input carries the rest.
      const structurallySane =
        /[aeiouy]/.test(w) && !/(.)\1\1/.test(w) && !/(..)\1\1/.test(w);
      let ok = false;
      let fuzzy = false;
      if (isRuleFluency && plausibleWord) {
        // Constraint first; then the ENGLISH DICTIONARY (~275k inflected words) is the truth
        // when available - "shuguosuo" has vowels and doesn't stutter, only a dictionary kills
        // it. Fail-open: with no dictionary (tests, broken install) the structural heuristics
        // remain the validator. The item's own accept-list always counts.
        const fitsRule = isSuffix ? w.endsWith(constraint) : w.startsWith(constraint);
        if (fitsRule) {
          const dict = await englishDictionary();
          ok = dict ? (dict.has(w) || accept.has(w)) : structurallySane;
        }
      } else if (accept.has(w)) {
        ok = true;
      } else if (shortFullFluency(w, accept)) {
        // short/full equivalence: "johann sebastian bach" counts when the list has "bach", and
        // "bach" counts when the list has "johann sebastian bach". Multi-word input uses full
        // in-order whole-word containment; single-word input only matches an entry's LAST token
        // (surname / head-noun convention, >=4 chars) so a generic leading adjective ("red")
        // can't score via "red mullet".
        ok = true;
        fuzzy = true;
      } else if (w.length >= 5 && [...accept].some((a) => a.length >= 5 && editDistance(w, a, 1) <= 1)) {
        // typo tolerance: a near-miss of a known item still counts (the person knew the word,
        // just mistyped). Length-gated and 1-edit only, so it can't turn a wrong word into a
        // listed one. Letter fluency already accepts by rule, so this only applies to categories.
        ok = true;
        fuzzy = true;
      }
      if (ok) fluencyValidCount += 1;
      fluencyWords.push({ w, ok, fuzzy });
    }
    // map count to [0,1] with a soft curve: ~12+ valid is excellent at most levels
    score = Math.round(Math.min(1, fluencyValidCount / 12) * 1000) / 1000;
    correct = fluencyValidCount >= 3; // a floor of productivity for ladder movement
  } else if (isEstimation && typeof ad.trueValue === 'number') {
    // single error axis, ranked against others' error on this same challenge
    const guess = Number(givenAnswer.trim().replace(',', '.'));
    if (!Number.isFinite(guess)) {
      estError = 1; // unparseable guess = max error
    } else {
      estError = percentError(guess, ad.trueValue);
    }
    const pool = await estimationErrorPool(challenge.id, userId);
    score = estimationScore(estError, pool);
    // "correct" for ladder purposes: beat the median (or, cold-start, within 15%)
    correct = pool.length >= 5
      ? score >= 0.5
      : estError <= 0.15;
  } else if (isPlanning) {
    // strategic planning: replay the typed sequence; speed is irrelevant, quality (optimality) is
    // what scores. Thinking slowly is free here by design. Three kinds share the philosophy:
    // number paths and grid paths replay-and-score-efficiency; step ordering is all-or-nothing
    // (a procedure is either in a workable order or it is not).
    const spec = challenge.answerData as {
      start?: number; target?: number; allowed?: string[]; optimalMoves?: number;
      correctOrder?: string; rows?: string[];
    };
    if (typeof spec.correctOrder === 'string') {
      const res = gradeStepOrder(givenAnswer, { correctOrder: spec.correctOrder });
      correct = res.correct;
      score = scoreDeliberate(res.correct, { moves: spec.correctOrder.length, optimalMoves: spec.correctOrder.length });
    } else if (Array.isArray(spec.rows)) {
      const res = gradeGridPath(givenAnswer, { rows: spec.rows });
      correct = res.correct;
      score = scoreDeliberate(res.correct, { moves: res.moves, optimalMoves: spec.optimalMoves });
    } else if (typeof spec.start === 'number' && typeof spec.target === 'number' && Array.isArray(spec.allowed)) {
      const res = gradePlan(givenAnswer, { start: spec.start, target: spec.target, allowed: spec.allowed });
      correct = res.correct;
      score = scoreDeliberate(res.correct, { moves: res.moves, optimalMoves: spec.optimalMoves });
    } else {
      correct = false;
      score = 0;
    }
  } else {
    correct = validateAnswer(challenge.answerData, givenAnswer);
    score = scoreAttempt(correct, effective, cfg);
  }

  const speed = speedClass(effective, cfg);

  // was the previous answered attempt in this category wrong? (consecutive-failure rule)
  const prev = await pg`
    SELECT correct FROM attempts
    WHERE user_id = ${userId} AND category_slug = ${attempt.categorySlug}
      AND status = 'answered'
    ORDER BY submitted_at DESC LIMIT 1
  `;
  const previousWasWrong = prev[0] ? prev[0].correct === false : false;

  // --- context tags for trend-of-state analysis ---
  // Use the session's stored offset to derive local time; never wall-clock storage.
  const sess = await pg`
    SELECT tz_offset_min,
           (SELECT count(*)::int FROM attempts a2
            WHERE a2.session_id = ${attempt.sessionId} AND a2.status = 'answered') AS answered_so_far
    FROM practice_sessions WHERE id = ${attempt.sessionId}
  `;
  const offsetMin: number | null = sess[0]?.tz_offset_min ?? null;
  let localHour: number | null = null;
  let localDow: number | null = null;
  let localMonth: number | null = null;
  let localDay: number | null = null;
  let localWeek: number | null = null;
  let localYear: number | null = null;
  if (offsetMin != null) {
    // getTimezoneOffset-style: minutes to ADD to UTC to get local = -offset.
    // We store the JS offset (UTC - local in min) as tzOffsetMin, so local = utc - offsetMin.
    const localMs = now.getTime() - offsetMin * 60 * 1000;
    const ld = new Date(localMs);
    localHour = ld.getUTCHours();
    localDow = ld.getUTCDay();
    localMonth = ld.getUTCMonth() + 1; // 1..12
    localDay = ld.getUTCDate();
    localYear = ld.getUTCFullYear();
    // ISO-ish week number (UTC-based on the already-localized instant)
    const dayNum = (ld.getUTCDay() + 6) % 7; // Mon=0
    const thursday = new Date(ld);
    thursday.setUTCDate(ld.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    localWeek = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  }
  const sessionPosition = (sess[0]?.answered_so_far ?? 0) + 1;

  // First-exposure: has this user ever answered this challenge TYPE before? Their first attempt at
  // a new task is confounded by learning the task itself, so we flag it (never discard it).
  const priorSameType = await pg`
    SELECT 1 FROM attempts a
    JOIN challenges c ON c.id = a.challenge_id
    WHERE a.user_id = ${userId} AND a.status = 'answered'
      AND c.challenge_type = ${challenge.challengeType} AND a.id <> ${attemptId}
    LIMIT 1
  `;
  const isFirstExposure = priorSameType.length === 0;

  const qualityFlags = computeQualityFlags({
    effectiveMs: effective,
    clientElapsedMs: clientElapsedMs ?? null,
    serverElapsedMs: serverElapsed,
    expectedMedianMs: challenge.observedMedianMs ?? null,
    isFirstExposure
  });

  await db.update(attempts).set({
    status: 'answered',
    submittedAt: now,
    clientElapsedMs: clientElapsedMs ?? null,
    serverElapsedMs: serverElapsed,
    effectiveMs: effective,
    answer: givenAnswer.slice(0, 100),
    correct,
    score,
    speedClass: speed,
    estError,
    localHour,
    localDow,
    localMonth,
    localDay,
    localWeek,
    localYear,
    sessionPosition,
    qualityFlags,
    inputMethod: inputMethod ?? null,
    // Phase A micro-signals: hesitation, edit trace, per-word fluency timing (see data-resolution plan)
    firstInputMs: Number.isFinite(micro.firstInputMs as number) ? Math.max(0, Math.round(micro.firstInputMs as number)) : null,
    editsCount: Number.isFinite(micro.editsCount as number) ? Math.max(0, Math.round(micro.editsCount as number)) : null,
    firstAnswerChanged: typeof micro.firstAnswerChanged === 'boolean' ? micro.firstAnswerChanged : null,
    wordTimes: Array.isArray(micro.wordTimes) && micro.wordTimes.length > 0 && micro.wordTimes.length <= 200
      ? micro.wordTimes.map((t) => Math.max(0, Math.round(Number(t) || 0)))
      : null,
    methodologyVersion: METHODOLOGY_VERSION
  }).where(eq(attempts.id, attemptId));

  // update observed median (EMA approximation, documented as such)
  const newObserved = challenge.observedMedianMs
    ? Math.round(challenge.observedMedianMs * 0.9 + effective * 0.1)
    : effective;
  await db.update(challenges)
    .set({ observedMedianMs: newObserved })
    .where(eq(challenges.id, challenge.id));

  // ladder
  const bounds = await levelBounds(attempt.categorySlug);
  const state = await getCategoryState(userId, attempt.categorySlug);
  const ratingBefore = state.rating;
  const next = nextLevel({
    currentLevel: state.currentLevel,
    correct, speed, previousWasWrong,
    minLevel: bounds.min, maxLevel: bounds.max
  });

  // recent window for stable level + rating
  const recentRows = await pg`
    SELECT level, correct, score FROM attempts
    WHERE user_id = ${userId} AND category_slug = ${attempt.categorySlug} AND status = 'answered'
    ORDER BY submitted_at DESC LIMIT 40
  `;
  const recent: RecentAttempt[] = recentRows.map((r: { level: number; correct: boolean; score: number }) => ({
    level: r.level, correct: r.correct, score: r.score
  }));
  const stable = stableLevel(recent, next);
  const rating = computeRating(stable, recent);

  // personal records: peak rating and max level, with dates
  const prevPeak = state.peakRating ?? 0;
  const newPeak = Math.max(prevPeak, rating);
  const peakAt = rating > prevPeak ? now : (state.peakRatingAt ?? (rating === newPeak ? now : null));
  const prevMax = state.maxLevel ?? 0;
  const newMax = Math.max(prevMax, next);
  const maxAt = next > prevMax ? now : (state.maxLevelAt ?? (next === newMax ? now : null));

  // level-up signal: did current_level advance this answer? (drives the confirm flow)
  const leveledUp = next > state.currentLevel;
  const newRecordRating = rating > prevPeak && prevPeak > 0;

  const newAttemptsCount = state.attemptsCount + 1;
  if (!isExperimental) {
    await db.update(userCategoryState).set({
      currentLevel: next,
      stableLevel: stable,
      rating,
      attemptsCount: newAttemptsCount,
      correctCount: state.correctCount + (correct ? 1 : 0),
      peakRating: newPeak,
      peakRatingAt: peakAt,
      maxLevel: newMax,
      maxLevelAt: maxAt,
      updatedAt: now
    }).where(and(
      eq(userCategoryState.userId, userId),
      eq(userCategoryState.categorySlug, attempt.categorySlug)
    ));

    // record rating snapshot on the attempt and append to history (for trends/deltas)
    await db.update(attempts)
      .set({ ratingBefore, ratingAfter: rating })
      .where(eq(attempts.id, attemptId));
    await pg`
      INSERT INTO rating_history (user_id, category_slug, rating, attempt_id, recorded_at, methodology_version)
      VALUES (${userId}, ${attempt.categorySlug}, ${rating}, ${attemptId}, ${now}, ${METHODOLOGY_VERSION})
    `;
    // BASELINE capture: freeze the rating at the calibrating (10th) attempt, forever. Write-once:
    // ON CONFLICT DO NOTHING means the first crossing wins and nothing ever rewrites history.
    if (newAttemptsCount >= 10) {
      await pg`
        INSERT INTO user_category_baseline (user_id, category_slug, rating, attempts_count)
        VALUES (${userId}, ${attempt.categorySlug}, ${rating}, ${newAttemptsCount})
        ON CONFLICT (user_id, category_slug) DO NOTHING
      `;
    }
  }

  await touchSession(attempt.sessionId);

  const pr = await categoryPercentile(attempt.categorySlug, rating);
  const answerData = challenge.answerData as {
    correctAnswer?: number | string; trueValue?: number; start?: number; target?: number;
    optimalMoves?: number; acceptedAnswers?: unknown[]; acceptList?: unknown[]
  };
  const promptData = challenge.promptData as { options?: unknown[] };
  // surface a human-friendly correct answer per renderer. The goal: the user should ALWAYS see what
  // the right answer was on a miss - "Incorrect" with nothing to learn is useless.
  let correctAnswerDisplay: string;
  if (isPlanning) {
    // planning puzzles have many valid solutions; don't reveal one. Show the goal + the best length,
    // which is the useful, non-spoiling feedback (and rewards finding a shorter path next time).
    // Step ordering is the exception: it has ONE workable order, so revealing it teaches.
    if (typeof (answerData as { correctOrder?: string }).correctOrder === 'string') {
      const co = (answerData as { correctOrder: string }).correctOrder;
      correctAnswerDisplay = `workable order: ${co.split('').join(', ')}`;
    } else if (Array.isArray((answerData as { rows?: string[] }).rows)) {
      correctAnswerDisplay = answerData.optimalMoves != null
        ? `reach T - can be done in ${answerData.optimalMoves} move${answerData.optimalMoves === 1 ? '' : 's'}`
        : 'reach T';
    } else {
      correctAnswerDisplay = answerData.optimalMoves != null
        ? `reach ${answerData.target} - can be done in ${answerData.optimalMoves} step${answerData.optimalMoves === 1 ? '' : 's'}`
        : `reach ${answerData.target}`;
    }
  } else if (isEstimation && typeof answerData.trueValue === 'number') {
    correctAnswerDisplay = `actual: ${answerData.trueValue}${estError != null ? ` (you were ${Math.round(estError * 100)}% off)` : ''}`;
  } else if (promptData.options && Array.isArray(promptData.options)) {
    // multiple choice: show the actual TEXT of the correct option when options are text. When the
    // options are visual (shape/grid objects, e.g. spatial/visual tasks), there's no text to show -
    // fall back to the 1-based option number ("option 3"), which is meaningful since the user saw the
    // numbered choices. Never stringify an object (that yields "[object Object]").
    const idx = Number(answerData.correctAnswer ?? -1);
    const opt = promptData.options[idx];
    if (typeof opt === 'string' && opt !== '') {
      correctAnswerDisplay = opt;
    } else if (idx >= 0) {
      correctAnswerDisplay = `option ${idx + 1}`;
    } else {
      correctAnswerDisplay = '';
    }
  } else {
    // open-answer types: prefer the canonical correctAnswer; fall back to the first accepted answer
    // or accept-list entry, so the field is never left blank when an answer genuinely exists.
    const primary = answerData.correctAnswer;
    if (primary != null && String(primary) !== '') {
      correctAnswerDisplay = String(primary);
    } else if (Array.isArray(answerData.acceptedAnswers) && answerData.acceptedAnswers.length > 0) {
      correctAnswerDisplay = String(answerData.acceptedAnswers[0]);
    } else if (Array.isArray(answerData.acceptList) && answerData.acceptList.length > 0) {
      // fluency-style: there's no single answer, but show a couple of examples of valid answers
      correctAnswerDisplay = `e.g. ${answerData.acceptList.slice(0, 3).map(String).join(', ')}`;
    } else {
      correctAnswerDisplay = '';
    }
  }

  return {
    correct,
    correctAnswer: correctAnswerDisplay,
    score,
    speed,
    level: attempt.level,
    nextLevel: next,
    rating: {
      value: rating,
      before: ratingBefore,
      delta: rating - ratingBefore,
      percentile: pr.percentile,
      poolSize: pr.poolSize,
      status: pr.status,
      confidence: confidence(newAttemptsCount),
      provisional: confidence(newAttemptsCount) === 'low',
      attempts: newAttemptsCount
    },
    leveledUp,
    newRecordRating,
    peakRating: newPeak,
    maxLevel: newMax,
    fluencyValidCount: isFluency ? fluencyValidCount : null,
    fluencyWords: isFluency ? fluencyWords : null,
    vocab: !correct ? vocabFor(challenge) : null
  };
}

// On a missed synonym/antonym, surface the definitions of the prompt word and the correct answer
// so the user actually learns both - turning the test into vocabulary cultivation. Returns null
// for anything that isn't a synonym/antonym with known words.
function vocabFor(challenge: { category?: string; challengeType?: string; promptData?: unknown; answerData?: unknown }) {
  const type = challenge.challengeType;
  if (challenge.category !== 'verbal_reasoning') return null;
  if (type !== 'synonym' && type !== 'antonym' && type !== 'analogy') return null;
  const pd = challenge.promptData as { instruction?: string; prompt?: string; options?: unknown[] } | undefined;
  const ad = challenge.answerData as { correctAnswer?: number } | undefined;
  if (!pd) return null;
  const defs = vocabDefinitions as Record<string, string>;

  // the correct answer word (always worth defining)
  let answerWord: string | null = null;
  if (Array.isArray(pd.options) && typeof ad?.correctAnswer === 'number') {
    const opt = pd.options[ad.correctAnswer];
    if (typeof opt === 'string') answerWord = opt.toLowerCase();
  }

  // the "prompt" word to pair it with:
  //  - synonym/antonym: the target in "Synonym of BIG"
  //  - analogy ("HOT : COLD :: UP : ?"): the third term (UP), whose relationship to the answer
  //    mirrors the example pair - so defining UP + the answer teaches the pair.
  let promptWord: string | null = null;
  const text = `${pd.instruction ?? ''} ${pd.prompt ?? ''}`;
  const ofMatch = text.match(/of\s+([A-Za-z]+)/i);
  if (ofMatch) {
    promptWord = ofMatch[1].toLowerCase();
  } else {
    // analogy: take the capitalised word just before the trailing "?" (the third term)
    const an = text.match(/([A-Za-z]+)\s*:\s*\?/);
    if (an) promptWord = an[1].toLowerCase();
  }

  const entry = (w: string | null) => {
    if (!w) return null;
    return defs[w] ? { word: w, definition: defs[w] } : null;
  };
  const prompt = entry(promptWord);
  const answer = entry(answerWord);
  if (!prompt && !answer) return null;
  return { prompt, answer };
}
