-- Count module hand-offs (Retention/Reaction bursts) per session, so the resumed session progress
-- credits each burst as one step. The previous boolean-style credit (last_module_at IS NOT NULL)
-- gave at most +1 even when both a retention and a reaction burst happened in one session.
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS module_handoffs integer NOT NULL DEFAULT 0;
