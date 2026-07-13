-- v0.66.0 security hardening: bearer tokens are no longer stored in plaintext.
-- auth_sessions.token and magic_links.token now hold sha256(token) hex; the raw token
-- lives only in the user's cookie / emailed link. A leaked DB (dump, backup, injection)
-- no longer yields usable sessions or login links.
--
-- Existing rows are converted IN PLACE so every live session and pending magic link
-- survives the deploy: the application hashes the cookie/link value before lookup from
-- this version on. pgcrypto ships with the official postgres image.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Convert only rows that are not already hashes. Raw tokens are 43 chars of base64url
-- (32 bytes); sha256 hex is 64 chars of [0-9a-f]. The guard makes the migration
-- idempotent and safe to re-run.
UPDATE auth_sessions
SET token = encode(digest(token, 'sha256'), 'hex')
WHERE token !~ '^[0-9a-f]{64}$';

UPDATE magic_links
SET token = encode(digest(token, 'sha256'), 'hex')
WHERE token !~ '^[0-9a-f]{64}$';
