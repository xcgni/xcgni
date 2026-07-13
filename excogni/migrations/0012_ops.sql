-- Operational layer for a live launch: persistent error capture + user feedback.

-- Server errors land here so they reach the operator (admin Health panel) instead
-- of vanishing into container logs. No PII beyond a route and message.
CREATE TABLE IF NOT EXISTS error_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  route       text,
  message     text NOT NULL,
  stack       text,
  status      integer,
  user_kind   text,            -- 'anonymous' | 'registered' | null (never the user id)
  seen        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_error_log_time ON error_log(occurred_at DESC);

-- User-submitted feedback: the cheapest validity/UX signal at launch.
CREATE TABLE IF NOT EXISTS feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  route       text,
  kind        text,            -- 'bug' | 'confusing' | 'idea' | 'other'
  message     text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_feedback_time ON feedback(created_at DESC);
