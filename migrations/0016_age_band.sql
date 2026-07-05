-- Store age as a band rather than precise birth year: privacy-friendlier (a band can't
-- pinpoint someone the way an exact year + other attributes can) and it matches how the
-- public breakdowns group. birth_year is kept for any existing data but new onboarding
-- writes age_band.
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS age_band text;
