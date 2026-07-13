-- Lightweight spelling-accuracy counters per user. Incremented whenever the user types a WORD
-- answer (retention recall, category fluency): how many were typed, and how many needed typo
-- tolerance to be accepted. A "spelling accuracy" trait, reported descriptively like persistence.
CREATE TABLE IF NOT EXISTS user_spelling (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  typed_words integer NOT NULL DEFAULT 0,   -- total word answers that were accepted (exact or fuzzy)
  typo_words  integer NOT NULL DEFAULT 0,   -- of those, how many were accepted via typo tolerance
  updated_at  timestamptz NOT NULL DEFAULT now()
);
