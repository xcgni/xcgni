-- Lightweight, privacy-respecting traffic log: one row per first-visit, recording only the
-- referrer's host (not the full URL, not query strings) and a coarse timestamp. NOT linked to
-- any user id - this is aggregate traffic analytics, not per-person tracking.
CREATE TABLE IF NOT EXISTS visit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_host text,                                    -- e.g. 'news.ycombinator.com', or null/'direct'
  landing_path  text,                                    -- which page they first hit
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_events_created_idx ON visit_events (created_at);
CREATE INDEX IF NOT EXISTS visit_events_referrer_idx ON visit_events (referrer_host);
