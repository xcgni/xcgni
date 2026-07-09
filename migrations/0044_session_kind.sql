-- Daily pulse (v1.5.0): sessions carry a kind so a 3-item pulse is distinguishable from a
-- full practice session in every analysis (and never pollutes session-length statistics).
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'practice';
CREATE INDEX IF NOT EXISTS idx_psessions_kind ON practice_sessions(user_id, kind, started_at DESC);
