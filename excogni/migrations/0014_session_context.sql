-- Session-context questionnaire: optional, consented state capture taken at the
-- start of a practice session. One row per submission. All fields nullable — every
-- question is skippable. Sleep is captured once per local day; caffeine/mood/alertness
-- per session. These attach to the session window for later aggregate analysis.
CREATE TABLE IF NOT EXISTS session_context (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  local_date    date,                  -- the user's local date, for once-per-day logic
  sleep_hours   real,                  -- hours slept last night (first session of day)
  napped        boolean,               -- additional rest later same day
  caffeine      text,                  -- 'none' | 'some' | 'lots' (per run)
  alertness     text,                  -- 'tired' | 'ok' | 'wired'
  mood          text,                  -- 'low' | 'neutral' | 'good'
  device_kind   text                   -- 'mobile' | 'desktop' | 'tablet' (auto-detected)
);

CREATE INDEX IF NOT EXISTS idx_session_context_user ON session_context(user_id, created_at DESC);
