-- Immutable per-category BASELINES: the rating at the moment a category first calibrated
-- (10th attempt; retention: 3rd due review). Enables the honest two-rating view: "you vs
-- everyone's STARTING point" (test-naive against test-naive, how real norms work) alongside
-- "you vs everyone NOW", and from their difference, the improvement distribution.
-- Rows are write-once: capture uses ON CONFLICT DO NOTHING, nothing ever updates them.
CREATE TABLE IF NOT EXISTS user_category_baseline (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_slug text NOT NULL,
  rating integer NOT NULL,
  attempts_count integer NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_slug)
);
