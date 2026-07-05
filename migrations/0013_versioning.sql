-- Provenance fields so historical attempts can be cleanly segmented when scoring
-- logic or the challenge bank changes. Cheap to add now, painful to retrofit.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS scoring_model_version integer NOT NULL DEFAULT 1;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS challenge_version integer; -- copied from the challenge at serve time

-- Challenges may be retired without deleting history. 'active' already gates
-- selection; this records WHEN/why a version was retired for auditing.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS retired_at timestamptz;
