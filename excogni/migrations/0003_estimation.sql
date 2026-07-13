-- Estimation: store the normalized error per attempt so we can rank a guess
-- against the population's errors on the same challenge.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS est_error real;
CREATE INDEX IF NOT EXISTS idx_attempts_est_error
  ON attempts(challenge_id) WHERE est_error IS NOT NULL;
