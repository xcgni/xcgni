-- Admin auth state (v0.66.0). A tiny KV for the single-admin auth machinery:
--   'session'           -> JSON { hash, exp }  (sha256 of the bearer token; single active session)
--   'totp_last_counter' -> the last ACCEPTED TOTP time-step, enforcing single-use codes
-- Deliberately separate from app_flags (boolean-valued, admin-toggled) and from user
-- auth_sessions (the admin is not a user role). Survives restarts, so a replayed TOTP
-- code stays dead and an admin session survives a redeploy within its TTL.
CREATE TABLE IF NOT EXISTS admin_auth (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
