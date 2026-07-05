-- Opt-in public badge: an embeddable SVG at /badge/<username>.svg showing the global rating
-- and percentile. Strictly opt-in (default false): an embeddable badge makes those two numbers
-- publicly reachable by URL, so the user must choose it.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS public_badge boolean NOT NULL DEFAULT false;
