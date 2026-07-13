// Session-context questionnaire: optional state capture at the start of a session.
// Cadence rules (per the spec):
//   - sleep_hours: asked once on the FIRST session of the user's local day; later
//     same-day sessions get a "had a nap?" checkbox instead.
//   - caffeine / alertness / mood: asked every session (state changes run to run).
// Everything is optional and skippable. Nothing here is rated or feeds the cognitive
// score - it's covariate data for honest aggregate analysis, consented separately.

import { pg } from '$lib/server/db';

export interface ContextPlan {
  askDaily: boolean;   // first session of the user's local day → ask sleep (the daily set)
  askNap: boolean;     // later sessions same day → offer the nap checkbox instead
}

// Decide what to ask. The "daily" questionnaire (sleep) fires once on the first session
// of the user's local day; later same-day sessions get the per-session set plus a nap
// checkbox. Per-session questions (caffeine/alertness/mood) are always asked.
export async function contextPlan(userId: string, localDate: string): Promise<ContextPlan> {
  const rows = await pg`
    SELECT 1 FROM session_context
    WHERE user_id = ${userId} AND local_date = ${localDate} AND sleep_hours IS NOT NULL
    LIMIT 1
  `;
  const dailyDoneToday = rows.length > 0;
  return { askDaily: !dailyDoneToday, askNap: dailyDoneToday };
}

export interface ContextAnswers {
  localDate?: string | null;
  sleepHours?: number | null;
  napped?: boolean | null;
  rested?: string | null;       // 'poor' | 'ok' | 'good'
  hoursAwake?: number | null;   // rough integer
  caffeine?: string | null;     // 'none' | 'some' | 'lots'
  otherStimulant?: boolean | null;
  alertness?: string | null;    // 'tired' | 'ok' | 'wired'
  mood?: string | null;         // 'low' | 'neutral' | 'good'
  tags?: string[] | null;       // curated self-tracking tags (validated upstream)
  note?: string | null;         // free-text session note, private
  deviceKind?: string | null;   // 'mobile' | 'desktop' | 'tablet'
}

const ENUMS: Record<string, Set<string>> = {
  rested: new Set(['poor', 'ok', 'good']),
  caffeine: new Set(['none', 'some', 'lots']),
  alertness: new Set(['tired', 'ok', 'wired']),
  mood: new Set(['low', 'neutral', 'good']),
  deviceKind: new Set(['mobile', 'desktop', 'tablet'])
};

function clean(field: string, v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return ENUMS[field].has(v) ? v : null;
}

// Save one questionnaire submission. All fields validated/sanitized; bad values become
// null rather than rejecting the whole row.
export async function saveContext(userId: string, a: ContextAnswers): Promise<void> {
  let sleep: number | null = null;
  if (typeof a.sleepHours === 'number' && Number.isFinite(a.sleepHours)) {
    sleep = Math.min(24, Math.max(0, a.sleepHours)); // clamp to a sane range
  }
  let hoursAwake: number | null = null;
  if (typeof a.hoursAwake === 'number' && Number.isFinite(a.hoursAwake)) {
    hoursAwake = Math.min(24, Math.max(0, Math.round(a.hoursAwake)));
  }
  const napped = typeof a.napped === 'boolean' ? a.napped : null;
  const otherStimulant = typeof a.otherStimulant === 'boolean' ? a.otherStimulant : null;
  const localDate = typeof a.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.localDate)
    ? a.localDate : null;
  const tags = Array.isArray(a.tags) && a.tags.length > 0
    ? a.tags.filter((t) => typeof t === 'string').slice(0, 30) : null;
  const note = typeof a.note === 'string' && a.note.trim() ? a.note.trim().slice(0, 500) : null;

  await pg`
    INSERT INTO session_context
      (user_id, local_date, sleep_hours, napped, rested, hours_awake, caffeine, other_stimulant, alertness, mood, tags, note, device_kind)
    VALUES
      (${userId}, ${localDate}, ${sleep}, ${napped}, ${clean('rested', a.rested)}, ${hoursAwake},
       ${clean('caffeine', a.caffeine)}, ${otherStimulant}, ${clean('alertness', a.alertness)},
       ${clean('mood', a.mood)}, ${tags}, ${note}, ${clean('deviceKind', a.deviceKind)})
  `;
}
