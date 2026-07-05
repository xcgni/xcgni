-- DATA VALIDITY HARDENING (pre-launch, so early-user data is analysable forever).
-- Principle: never delete or silently drop a questionable attempt - FLAG it, so analysis can
-- exclude it while the raw record is kept. This lets any future methodology be applied to all
-- history without discarding early users.

-- Per-attempt quality flags. Empty = clean. Possible flags (text):
--   'too_fast'        : faster than plausible human reaction (likely not a genuine response)
--   'too_slow'        : far beyond the window (likely AFK / distracted / tab-switched)
--   'first_exposure'  : the user's first ever attempt at this challenge type (task-learning confound)
--   'client_clock'    : client elapsed implausible vs server elapsed (untrusted client timing)
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS quality_flags text[] NOT NULL DEFAULT '{}';

-- Input method for this attempt: 'keyboard' | 'touch' | 'mouse' | 'unknown'. Timing differs by
-- input modality, a real confound for speed-based scoring; capturing it lets us control for it.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS input_method text;

-- Consent provenance: WHEN consent was given and to WHICH version of the consent text. Storing the
-- booleans alone isn't enough for GDPR or for knowing which data we're cleared to analyse.
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS consent_version integer;

CREATE INDEX IF NOT EXISTS idx_attempts_quality ON attempts USING gin (quality_flags);
