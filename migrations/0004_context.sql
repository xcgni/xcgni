-- Context logging for trend-of-state analysis (best time of day, fatigue, consistency).
-- Always anchored to UTC; local hour is derived from the stored timezone offset,
-- never stored as wall-clock (DST/travel safe).

-- Session carries the user's IANA timezone + offset captured client-side at start.
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS tz_offset_min integer;

-- Per-attempt context, computed at submit time from the session timezone.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS local_hour integer;     -- 0..23 in user local time
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS local_dow integer;      -- 0=Sun .. 6=Sat, user local
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS session_position integer; -- 1-based answered index within session

CREATE INDEX IF NOT EXISTS idx_attempts_user_hour ON attempts(user_id, local_hour) WHERE status = 'answered';
