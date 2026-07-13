-- Per-session category skips ("not this, not today"): the session generator excludes these for
-- the remainder of the session. The skip events themselves live on attempts (status='skipped',
-- carrying local_hour/local_dow) - a refusal is also a measurement.
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS skipped_categories text[] NOT NULL DEFAULT '{}';
