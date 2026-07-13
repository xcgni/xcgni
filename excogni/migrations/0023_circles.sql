-- Practice circles: small, opt-in, shared-key groups for friendly company. Deliberately NOT a
-- global leaderboard - they're private (need the code to join), and each member controls what they
-- share. The default emphasis is ACTIVITY and PERSISTENCE (showing up together), not ability
-- ranking, to stay true to "measured, not gamified".

CREATE TABLE IF NOT EXISTS circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,            -- the shareable join key
  name text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name text,                    -- what other members see (not the account email/username)
  share_activity boolean NOT NULL DEFAULT true,   -- streak / days practised / attempts
  share_ratings boolean NOT NULL DEFAULT false,   -- per-member opt-in to expose cognitive ratings
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
