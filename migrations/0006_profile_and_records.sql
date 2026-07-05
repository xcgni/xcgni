-- ============================================================================
-- User attributes (group-statistics only; never tied to identity in any output)
-- All optional, all consented, all exportable/deletable.
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_attributes (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_year      integer,        -- year only, less identifying than full DOB
  country         text,           -- self-declared region/country, never IP-derived
  gender          text,           -- optional, free-choice incl. 'prefer_not'
  education        text,          -- optional band
  native_language text,           -- relevant to verbal-category interpretation
  handedness      text,           -- 'left' | 'right' | 'ambi' | null
  consented_stats boolean NOT NULL DEFAULT false, -- explicit consent to aggregate use
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Personal records: peak rating and max level per category, with dates.
-- ============================================================================
ALTER TABLE user_category_state ADD COLUMN IF NOT EXISTS peak_rating integer;
ALTER TABLE user_category_state ADD COLUMN IF NOT EXISTS peak_rating_at timestamptz;
ALTER TABLE user_category_state ADD COLUMN IF NOT EXISTS max_level integer;
ALTER TABLE user_category_state ADD COLUMN IF NOT EXISTS max_level_at timestamptz;

-- ============================================================================
-- Cognitive domain mapping for the radar (data-driven, not hardcoded in UI).
-- New categories just declare their domain here / in seed.
-- ============================================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS domain text;
