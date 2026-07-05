-- Optional short factoid shown when a card is missed, to turn a wrong answer into a moment of
-- learning rather than just "wrong". Nullable; cards without one simply show nothing extra.
ALTER TABLE retention_cards ADD COLUMN IF NOT EXISTS note text;
