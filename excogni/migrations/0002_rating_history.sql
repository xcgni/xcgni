-- Rating history: one row per category rating change, for trends and deltas.
CREATE TABLE IF NOT EXISTS rating_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_slug text NOT NULL,
  rating        integer NOT NULL,
  attempt_id    uuid REFERENCES attempts(id) ON DELETE SET NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rating_history_user_cat
  ON rating_history(user_id, category_slug, recorded_at);

-- Magic-link rate limiting: track requests per email/IP within a window.
CREATE TABLE IF NOT EXISTS magic_link_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mlr_email_time ON magic_link_requests(email, created_at);
CREATE INDEX IF NOT EXISTS idx_mlr_ip_time ON magic_link_requests(ip, created_at);

-- Attempt rating snapshot: record rating before/after each answered attempt
-- so Review can show "rating before -> after".
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rating_before integer;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rating_after integer;
