-- Layered consent: a distinct opt-in for long-term storage of anonymized, non-profile
-- app data (the de-identified measurement stream for the longitudinal dataset), separate
-- from consent to aggregate research use of profile-linked data.
--
-- This lives in its own migration (not appended to 0014) because 0014 may already be
-- recorded as applied on some databases — an edited migration is skipped by the runner,
-- so the column must arrive in a fresh, un-applied migration file. Idempotent regardless.
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS consented_data boolean NOT NULL DEFAULT false;
