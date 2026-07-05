-- Session preferences: user-chosen session length (enabled_categories already exists).
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS session_length integer NOT NULL DEFAULT 10;

-- Reaction time stored as an HONEST BAND, never a single number. fast_ms/slow_ms
-- bound true RT after subtracting estimated min/max hardware+display delay; the
-- per-user calibrated floor (from a low-cognition probe) narrows the band.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rt_fast_ms integer;   -- lower bound (assumes max delay)
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rt_slow_ms integer;   -- upper bound (assumes min delay)

-- Per-user reaction-time calibration: the measured hardware/input floor and the
-- residual uncertainty width, captured from a calibration probe.
CREATE TABLE IF NOT EXISTS user_rt_calibration (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  floor_ms       integer NOT NULL,   -- personal min plausible delay (hw + input + display)
  uncertainty_ms integer NOT NULL,   -- residual band half-width after calibration
  refresh_hz     integer,            -- estimated display refresh, if known
  samples        integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
