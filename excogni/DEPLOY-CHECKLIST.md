# Deploy checklist

The order matters. Written for the maintainer's launch deploy; useful for any self-hoster
doing a first production deployment of the security features.

## 0. Before touching production
- [ ] `pg_dump` the current database. Then RESTORE it somewhere and open the app against the
      restore - an untested backup is a hope, not a backup.
- [ ] Generate secrets locally:
      - `openssl rand -base64 48` -> EMAIL_INDEX_KEY (store it in the password manager NOW,
        in a different entry than the DB password - together they reassemble what the design
        takes apart)
      - `node --experimental-strip-types scripts/gen-totp-secret.mjs` -> ADMIN_TOTP_SECRET;
        add the key to the authenticator app and CONFIRM the printed code matches before
        deploying.

## 1. Deploy
- [ ] Set in the prod env: EMAIL_INDEX_KEY, ADMIN_TOTP_SECRET (plus existing secrets).
- [ ] Rebuild + up. Migrations 0040-0042 run automatically via the entrypoint.
- [ ] Watch the logs through first boot: migrations applied, no errors.

## 2. One-time conversions
- [ ] `node scripts/backfill-email-hash.mjs` (inside the app container, env present).
      Expect: "no plaintext emails remain".
- [ ] Cloudflare: purge everything once (per the standing post-deploy note).

## 3. Verify
- [ ] `./scripts/smoke.sh https://xcgni.com` - all green.
- [ ] Log in at /admin/login with token + authenticator code. Log out. Log back in.
- [ ] Full user pass on the PHONE: anonymous practice run -> register via magic link
      (real inbox) -> practice -> /stats -> settings shows the MASKED email -> export
      downloads and contains no readable address -> statistics page strips render sanely
      at phone width.
- [ ] Magic-link deliverability: request a login link to one Gmail and one Outlook address;
      confirm inbox (not spam) and acceptable latency.
- [ ] /statistics under STATS_PREVIEW=false shows the honest empty state (or real data),
      never synthetic.

## 4. Point monitoring at it
- [ ] Uptime monitor on https://xcgni.com/healthz (expects 200, alert on 503/timeout).

## 5. Open-source release
- [ ] Fresh history: `git init` in the clean tree, single initial commit, push. (The private
      dev history stays private; a fresh init discloses nothing.)
- [ ] Confirm on GitHub: ROADMAP.md absent, .env.example present, CI runs green on the
      first push.
- [ ] Branch protection on main: require CI green.

## 6. Only after all of the above
- [ ] The initsix post, and the HN submission (12:00-15:00 UTC window).
