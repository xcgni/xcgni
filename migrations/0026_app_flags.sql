-- Runtime-overridable feature flags. Flags still have env defaults (so a fresh deploy behaves
-- predictably), but an admin can override them live from /admin/toggles without a redeploy. A row
-- here wins over the env default; no row falls back to env. Kept tiny and explicit - only the flags
-- we intend to toggle at runtime live here.
CREATE TABLE IF NOT EXISTS app_flags (
  key text PRIMARY KEY,
  value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
