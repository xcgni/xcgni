-- Richer temporal context per attempt for seasonality / monthly / weekly trends.
-- Same UTC-anchored derivation as local_hour: stored as derived local values,
-- never wall-clock, so DST and travel stay honest.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS local_month integer;       -- 1..12 local
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS local_day integer;         -- 1..31 local
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS local_week integer;        -- ISO-ish week 1..53
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS local_year integer;        -- local calendar year

CREATE INDEX IF NOT EXISTS idx_attempts_user_month ON attempts(user_id, local_year, local_month) WHERE status = 'answered';
