-- Excogni initial schema. Idempotent: safe to run repeatedly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE,
  username      text UNIQUE,
  password_hash text,
  is_anonymous  boolean NOT NULL DEFAULT false,
  is_test       boolean NOT NULL DEFAULT false,
  is_simulated  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);

CREATE TABLE IF NOT EXISTS magic_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  implemented boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  sort        integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS challenges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug      text NOT NULL REFERENCES categories(slug),
  challenge_type     text NOT NULL,
  level              integer NOT NULL,
  renderer_type      text NOT NULL,
  prompt_data        jsonb NOT NULL,
  answer_data        jsonb NOT NULL,
  scoring_config     jsonb NOT NULL,
  version            integer NOT NULL DEFAULT 1,
  active             boolean NOT NULL DEFAULT true,
  -- hand-tuned guess lives in scoring_config.expectedMedianMs;
  -- this column accumulates reality so we can recalibrate later.
  observed_median_ms integer,
  bank_key           text UNIQUE, -- deterministic key from the seed file, enables idempotent re-seeding
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenges_cat_level ON challenges(category_slug, level) WHERE active;

CREATE TABLE IF NOT EXISTS practice_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_psessions_user ON practice_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id      uuid NOT NULL REFERENCES challenges(id),
  category_slug     text NOT NULL,
  level             integer NOT NULL,
  status            text NOT NULL DEFAULT 'pending', -- pending | answered | abandoned
  served_at         timestamptz NOT NULL DEFAULT now(),
  submitted_at      timestamptz,
  client_elapsed_ms integer,
  server_elapsed_ms integer,
  effective_ms      integer, -- timing used for scoring after integrity clamping
  answer            text,
  correct           boolean,
  score             real,
  speed_class       text -- fast | normal | slow
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, served_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);

CREATE TABLE IF NOT EXISTS user_category_state (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_slug  text NOT NULL REFERENCES categories(slug),
  current_level  integer NOT NULL DEFAULT 1,
  stable_level   integer NOT NULL DEFAULT 1,
  rating         integer NOT NULL DEFAULT 0,
  attempts_count integer NOT NULL DEFAULT 0,
  correct_count  integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_slug)
);
CREATE INDEX IF NOT EXISTS idx_ucs_pool ON user_category_state(category_slug, rating);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
