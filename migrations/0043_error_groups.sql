-- Error triage state (v1.1.0). Errors are GROUPED at query time by a signature
-- (normalized message + top stack frame), Sentry-style. This table holds only the
-- operator's triage status per group; the events themselves stay in error_log.
-- A group with new events after being resolved shows as regressed (computed, not stored).
CREATE TABLE IF NOT EXISTS error_groups (
  signature          text PRIMARY KEY,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  status_changed_at  timestamptz NOT NULL DEFAULT now()
);
