-- Onboarding: track whether a user has seen the first-run intro (the "contract").
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS seen_intro boolean NOT NULL DEFAULT false;
