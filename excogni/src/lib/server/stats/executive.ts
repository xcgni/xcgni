import { pg } from '$lib/server/db';

// Construct-valid executive scores. Raw accuracy on these tasks conflates the
// executive component with general speed/ability. The DIFFERENCE scores isolate
// the construct:
//   inhibition  -> interference = incongruent_RT - congruent_RT  (the Stroop effect)
//   switching   -> switch cost  = switch_RT      - repeat_RT
// Computed per user from tagged attempts; correct trials only; effective ms.

export interface DerivedScore {
  available: boolean;
  interferenceMs?: number | null; // inhibition
  switchCostMs?: number | null;   // switching
  baselineMs?: number | null;     // the "easy" condition mean
  conditionMs?: number | null;    // the "hard" condition mean
  nBaseline?: number;
  nCondition?: number;
  note?: string;
}

const MIN_PER_CONDITION = 8;

/** Stroop interference: mean effective ms on incongruent minus congruent,
 *  correct trials only. Positive = the expected interference effect. */
export async function inhibitionInterference(userId: string): Promise<DerivedScore> {
  const rows = await pg`
    SELECT c.challenge_type AS cond, a.effective_ms AS ms
    FROM attempts a JOIN challenges c ON c.id = a.challenge_id
    WHERE a.user_id = ${userId} AND a.status = 'answered' AND a.correct = true
      AND c.category_slug = 'inhibition'
      AND a.effective_ms IS NOT NULL
  `;
  const cong: number[] = [], incong: number[] = [];
  for (const r of rows as { cond: string; ms: number }[]) {
    if (r.cond === 'congruent') cong.push(r.ms);
    else if (r.cond === 'incongruent') incong.push(r.ms);
  }
  if (cong.length < MIN_PER_CONDITION || incong.length < MIN_PER_CONDITION) {
    return { available: false, note: 'Need more trials in both conditions to isolate interference.' };
  }
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const base = Math.round(mean(cong));
  const hard = Math.round(mean(incong));
  return {
    available: true,
    interferenceMs: hard - base,
    baselineMs: base, conditionMs: hard,
    nBaseline: cong.length, nCondition: incong.length
  };
}

/** Switch cost: mean effective ms on switch trials minus repeat trials. We infer
 *  switch vs repeat from whether the rule changed from the previous switching
 *  attempt in the same session (ordered by served_at). */
export async function switchingCost(userId: string): Promise<DerivedScore> {
  const rows = await pg`
    SELECT a.session_id, a.served_at, c.challenge_type AS rule, a.effective_ms AS ms, a.correct
    FROM attempts a JOIN challenges c ON c.id = a.challenge_id
    WHERE a.user_id = ${userId} AND a.status = 'answered'
      AND c.category_slug = 'task_switching' AND a.effective_ms IS NOT NULL
    ORDER BY a.session_id, a.served_at
  `;
  const repeat: number[] = [], swit: number[] = [];
  let prevRule: string | null = null;
  let prevSession: string | null = null;
  for (const r of rows as { session_id: string; rule: string; ms: number; correct: boolean }[]) {
    if (r.session_id !== prevSession) { prevRule = null; prevSession = r.session_id; }
    if (prevRule !== null && r.correct) {
      if (r.rule === prevRule) repeat.push(r.ms);
      else swit.push(r.ms);
    }
    prevRule = r.rule;
  }
  if (repeat.length < MIN_PER_CONDITION || swit.length < MIN_PER_CONDITION) {
    return { available: false, note: 'Need more consecutive trials to estimate switch cost.' };
  }
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const base = Math.round(mean(repeat));
  const hard = Math.round(mean(swit));
  return {
    available: true,
    switchCostMs: hard - base,
    baselineMs: base, conditionMs: hard,
    nBaseline: repeat.length, nCondition: swit.length
  };
}
