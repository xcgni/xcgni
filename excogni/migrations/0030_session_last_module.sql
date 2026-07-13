-- Track when the mixed run last handed off to a dedicated module (Retention / Reaction),
-- so the selector can space them out without relying on the attempts table (which those
-- modules do not write to). Time-based spacing avoids re-handing-off immediately on return.
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS last_module_at timestamptz;
