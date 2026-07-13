// Tests for spaced-repetition scheduling and honest retention scoring.
import { schedule, isMeasurementDue, retentionMastery, masteryToRating } from '../src/lib/server/retention/index.ts';

let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }

// scheduling grows intervals on success
let s = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
s = schedule(s, 2); ok('rep1 interval = 1', s.intervalDays === 1);
s = schedule(s, 2); ok('rep2 interval = 6', s.intervalDays === 6);
const before = s.intervalDays;
s = schedule(s, 2); ok('rep3 grows by ease', s.intervalDays > before);
ok('reps counted', s.reps === 3);

// forgetting resets and adds a lapse
const f = schedule(s, 0);
ok('forgot resets interval', f.intervalDays === 0);
ok('forgot adds lapse', f.lapses === 1);
ok('forgot reps reset', f.reps === 0);
ok('forgot due soon (~1min)', f.nextDueMs <= 2 * 60 * 1000);

// ease never below floor
let hard = { ease: 1.35, intervalDays: 10, reps: 5, lapses: 0 };
for (let i = 0; i < 5; i++) hard = schedule(hard, 0);
ok('ease floored at 1.3', hard.ease >= 1.3);

// measurement-due threshold
ok('interval 0.5 not a measurement', isMeasurementDue(0.5) === false);
ok('interval 1 is a measurement', isMeasurementDue(1) === true);
ok('interval 6 is a measurement', isMeasurementDue(6) === true);

// mastery honesty: null until enough due reviews
ok('mastery null with few reviews', retentionMastery({ dueReviews: 3, dueHits: 3, matureCards: 1, totalSeen: 5 }) === null);
const m = retentionMastery({ dueReviews: 20, dueHits: 18, matureCards: 10, totalSeen: 20 });
ok('mastery computed with enough', m != null && m > 0.8);
const mLow = retentionMastery({ dueReviews: 20, dueHits: 4, matureCards: 0, totalSeen: 20 });
ok('low recall -> low mastery', mLow != null && mLow < 0.3);

// rating mapping
ok('mastery 0 -> 600', masteryToRating(0) === 600);
ok('mastery 1 -> 1900', masteryToRating(1) === 1900);
ok('mastery 0.5 -> ~1250', Math.abs(masteryToRating(0.5) - 1250) <= 1);


// --- additional edge-case coverage ---
const base = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

// grade 3 (easy) on first rep jumps to 4 days, not 1
ok('grade 3 first rep -> 4 days', schedule(base, 3).intervalDays === 4);
ok('grade 1 first rep -> 1 day', schedule(base, 1).intervalDays === 1);
ok('grade 2 first rep -> 1 day', schedule(base, 2).intervalDays === 1);

// ease moves by grade: easy (3) raises, hard (1) lowers, good (2) ~ steady-ish
const e1 = schedule(base, 1).ease;
const e2 = schedule(base, 2).ease;
const e3 = schedule(base, 3).ease;
ok('easy raises ease above good', e3 > e2);
ok('hard lowers ease below good', e1 < e2);
ok('all eases respect 1.3 floor', e1 >= 1.3 && e2 >= 1.3 && e3 >= 1.3);

// repeated failures can't push ease below the floor
let sf = { ease: 1.4, intervalDays: 10, reps: 5, lapses: 0 };
for (let i = 0; i < 10; i++) sf = schedule(sf, 0);
ok('ease floored after many lapses', sf.ease >= 1.3);
ok('lapses accumulate', sf.lapses === 10);

// third-rep interval grows by ease (multiplicative)
const grown = schedule({ ease: 2.0, intervalDays: 6, reps: 2, lapses: 0 }, 2);
ok('rep3 interval ~ interval*ease', Math.abs(grown.intervalDays - 12) < 0.5);

// isMeasurementDue threshold is configurable
ok('custom threshold respected', isMeasurementDue(2, 3) === false);
ok('custom threshold met', isMeasurementDue(3, 3) === true);

// retentionMastery: boundary at exactly 5 reviews, and zero-guard
ok('exactly 5 reviews now measurable', retentionMastery({ dueReviews: 5, dueHits: 4, matureCards: 2, totalSeen: 5 }) != null);
ok('4 reviews still null', retentionMastery({ dueReviews: 4, dueHits: 4, matureCards: 2, totalSeen: 5 }) === null);
ok('zero totalSeen guarded (no NaN)', retentionMastery({ dueReviews: 5, dueHits: 5, matureCards: 0, totalSeen: 0 }) === null);
ok('perfect recall + full maturity -> 1.0', retentionMastery({ dueReviews: 10, dueHits: 10, matureCards: 8, totalSeen: 8 }) === 1);

// masteryToRating clamps / monotonic
ok('mastery monotonic', masteryToRating(0.6) > masteryToRating(0.4));
ok('rating spans full band', masteryToRating(1) - masteryToRating(0) === 1300);

console.log(failures === 0 ? '\nALL RETENTION TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
