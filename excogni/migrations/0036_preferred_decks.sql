-- Preferred retention decks, asked at onboarding and editable in Settings. Empty = all decks
-- (never a dead end). Honored everywhere retention serves cards without an explicit deck choice,
-- including the in-mix hand-off.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS preferred_decks text[] NOT NULL DEFAULT '{}';
