-- Phase A of the data-resolution plan: the "sure wins", per-attempt micro-signals that unlock
-- hesitation, metacognition and fluency clustering/switching insights. All task measurement
-- (disclosed in methodology), no biometric tier.
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS first_input_ms integer,
  ADD COLUMN IF NOT EXISTS edits_count integer,
  ADD COLUMN IF NOT EXISTS first_answer_changed boolean,
  ADD COLUMN IF NOT EXISTS word_times jsonb;

-- Reaction runs: the client already sends the full trial series; persist it so variance and
-- fatigue-slope can be derived (we only kept the band before).
CREATE TABLE IF NOT EXISTS reaction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_ms integer[] NOT NULL,
  floor_ms integer,
  band_fast_ms integer,
  band_slow_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
