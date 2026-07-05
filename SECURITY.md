# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in Excogni, please report it privately rather than
opening a public issue.

- Use the **in-app feedback form** (the "Feedback" button, visible on every page of a running
  instance, or https://xcgni.com for the hosted one) and start your message with `[security]`.
  Feedback goes only to the maintainer's admin surface - it is a private channel, not a
  public tracker. Include a contact so the maintainer can reach you back.
- Please include: a description, steps to reproduce, and the potential impact.
- Please give a reasonable window to address it before any public disclosure.

I'll acknowledge the report, work on a fix, and credit you (if you'd like) once it's resolved.

## Scope

Excogni is self-hostable, so much of its real-world security depends on how an operator
deploys it. The most relevant areas:

- **Authentication / magic links** (`src/lib/server/auth/`)
- **The admin surface** (`/admin`, token-gated)
- **Data exports & public statistics** (suppression / k-anonymity - see DOCUMENTATION.md)
- **Session / attempt submission** (`src/lib/server/sessions/`)

## For self-hosters - deployment hardening

The application code is one half; your deployment is the other. At minimum:

- Keep **PostgreSQL off the public internet** (internal Docker network only - the prod compose
  does not publish 5432).
- Use **strong, unique secrets**: `POSTGRES_PASSWORD`, `ADMIN_TOKEN` (>=16 chars),
  `ADMIN_TOTP_SECRET` (from the generator script), `EMAIL_INDEX_KEY` (>=32 chars; losing it
  means every hashed email stops matching - back it up like a database key). Never commit
  your `.env`.
- Set `ORIGIN` to your real HTTPS origin; terminate TLS at your proxy / CDN.
- Keep all the dev flags off in production (the prod compose forces
  `ENABLE_SIMULATED_USERS`, `DEV_EXPOSE_MAGIC_LINKS`, `SHOW_DEBUG_UI`, `STATS_PREVIEW` to false).
- Put rate limiting in front of auth/API endpoints (e.g. at your CDN/WAF).
- Take regular, **tested** database backups (the named volume `excogni_pgdata`).

## Security model (what the code enforces)

As of v0.66.0:

- **No bearer token is stored readable.** User sessions and magic-link tokens are kept as
  `sha256(token)` - the raw value exists only in the cookie or the emailed link. A leaked
  database yields no usable sessions and no usable login links.
- **The login email is a blind index.** With `EMAIL_INDEX_KEY` set (>=32 chars), the DB holds
  only `HMAC-SHA256(email, key)` plus a masked hint (`b…@g….com`). The key lives in the server
  environment, never in the DB - so a dump alone cannot be matched offline against dictionaries
  of common addresses. Works because login is magic-link-only: the user types the address at
  every login, so the plaintext exists in memory exactly when the send happens and is never
  persisted (not even on the magic-link row).
  - Accepted trade-offs, stated plainly: the project cannot email its users unprompted (incident
    notice happens via the public changelog and in-app notice), and a forgotten address cannot be
    recovered from the DB - only re-verified by typing it.
- **Admin access is two-factor.** `/admin/login` takes the admin token plus a TOTP code
  (RFC 6238, standard authenticator apps) when `ADMIN_TOTP_SECRET` is set. Codes are single-use
  (last accepted time-step persisted - replay-proof across restarts), sessions are single-active
  and 8h, failures are rate-limited per-IP and globally with one generic error (no factor
  oracle), and the legacy `?key=` URL login is gone - secrets don't belong in URLs.
- **Guards are awaited and layered.** Every admin load, action, and endpoint carries its own
  `await isAdmin()` check (layout redirects never covered actions), enforced by a static test
  (`tests/admin-guards.test.mjs`) so the un-awaited-guard bug class cannot return.
- **Magic-link hygiene**: single atomic consumption (two racing requests can never both
  succeed), 30-minute expiry, per-email + per-IP request rate limiting, session rotation on the
  anonymous→registered upgrade, and `DEV_EXPOSE_MAGIC_LINKS` hard-disabled when
  `NODE_ENV=production` regardless of the flag.
- **Baseline headers** ship on every response (nosniff, frame DENY, referrer and permissions
  policy); a strict nonce-based CSP is a deliberate post-launch item on the project roadmap.

## Known limitations (not vulnerabilities, but be aware)

- Single-dimension public breakdowns can in principle be combined to infer suppressed groups
  (differencing). Documented in DOCUMENTATION.md; full mitigation is a roadmap item.
- The product is **not clinically validated** - it is not a diagnostic tool.
