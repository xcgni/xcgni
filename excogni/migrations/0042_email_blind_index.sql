-- v0.66.0: blind email index. The login email is no longer stored readable anywhere.
--
-- users.email_hash        HMAC-SHA256(normalized email, EMAIL_INDEX_KEY) hex. The key lives
--                         only in the server environment - a DB dump alone cannot be
--                         brute-forced against common addresses without it.
-- users.email_hint        a masked display form ("b…@g….com") captured at login, so the
--                         settings page can still show WHICH address you signed in with
--                         without the DB ever holding the address itself.
--
-- magic_links gets the same pair: the link row never needs the address either - the
-- send happens in-memory at request time, to the address the user just typed.
--
-- magic_link_requests.email becomes a rate-limit KEY (the hash when the index key is
-- configured); renamed to say what it now is.
--
-- users.email and the legacy behavior remain for deployments without EMAIL_INDEX_KEY
-- (dev, zero-config). scripts/backfill-email-hash.mjs converts existing rows and nulls
-- the plaintext; consumeMagicLink also lazily converts a legacy row on next login.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS email_hint text;

ALTER TABLE magic_links
  ADD COLUMN IF NOT EXISTS email_hash text,
  ADD COLUMN IF NOT EXISTS email_hint text;

ALTER TABLE magic_links ALTER COLUMN email DROP NOT NULL;

ALTER TABLE magic_link_requests RENAME COLUMN email TO email_key;
