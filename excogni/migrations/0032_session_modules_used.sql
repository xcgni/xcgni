-- Record WHICH modules (retention/reaction) a session included, so the session summary can tell
-- the whole session's story, not just the bank challenges.
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS modules_used text[] NOT NULL DEFAULT '{}';
