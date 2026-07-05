-- "Show less often": the middle scope between skip-this-session and never. The mixed picker
-- downweights these to ~35% of normal frequency; restorable in Settings.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS reduced_categories text[] NOT NULL DEFAULT '{}';
