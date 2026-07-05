-- ============================================================================
-- Retention: spaced-repetition facts. Trains AND measures — the honest way.
-- Scoring axis is "due-card recall", not right/wrong-on-first-sight: a card is
-- only a MEASUREMENT when it was genuinely due (long enough interval that recall
-- is a real test). Re-seeing a freshly-missed card is training, not scoring.
-- ============================================================================

-- The shared fact deck. Curated, clearly-scoped domains (never "universal").
CREATE TABLE IF NOT EXISTS retention_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck        text NOT NULL,             -- e.g. 'si_units', 'world_capitals'
  deck_label  text NOT NULL,
  prompt      text NOT NULL,
  answer      text NOT NULL,
  accepted    jsonb NOT NULL DEFAULT '[]', -- additional accepted answer strings
  level       integer NOT NULL DEFAULT 1, -- rough difficulty for laddering
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retention_cards_deck ON retention_cards(deck) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_cards_unique ON retention_cards(deck, prompt);

-- Per-user scheduling state (SM-2-style).
CREATE TABLE IF NOT EXISTS user_card_state (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id        uuid NOT NULL REFERENCES retention_cards(id) ON DELETE CASCADE,
  ease           real NOT NULL DEFAULT 2.5,     -- SM-2 ease factor
  interval_days  real NOT NULL DEFAULT 0,       -- current interval
  reps           integer NOT NULL DEFAULT 0,    -- successful reps in a row
  lapses         integer NOT NULL DEFAULT 0,    -- times forgotten when due
  due_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz,
  -- measurement signal: hits / total on cards that were genuinely DUE
  due_reviews    integer NOT NULL DEFAULT 0,
  due_hits       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_user_card_due ON user_card_state(user_id, due_at);

-- Retention rating per user (mastery-over-time, not in-the-moment processing).
-- Stored in the same user_category_state row family under a reserved slug so the
-- radar/records machinery works unchanged.
