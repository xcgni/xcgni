-- Session tags + free-text note: optional self-tracking on the session questionnaire. Tags are a
-- curated set of state/context labels (poor sleep, coffee, stressed, deep work, etc.) the user can
-- toggle; the note is a free-text "how/why I felt today" capture. Both are PRIVATE to the user and
-- used only for the user's own self-comparison ("how do I do on poor-sleep days") - never in any
-- cross-user aggregate or population statistic. Both nullable; every field skippable.
ALTER TABLE session_context ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE session_context ADD COLUMN IF NOT EXISTS note text;

-- A note can also be attached retroactively to a specific local day (e.g. annotating a flagged
-- best/worst performing day from the statistics page). day_note rows are keyed by user + date.
CREATE TABLE IF NOT EXISTS day_note (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date  date NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date)
);
CREATE INDEX IF NOT EXISTS idx_day_note_user ON day_note(user_id, local_date DESC);
