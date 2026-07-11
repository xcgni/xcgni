# Contributing to Excogni

Thanks for considering a contribution. Excogni is an open, self-hostable cognitive-fitness
platform, and it's better with more eyes on it.

## Ground rules (the short version)

- **Be honest about uncertainty.** Excogni's whole character is honesty over hype - in the
  product and in the code. Don't add features that overclaim (e.g. "scientifically proven",
  clinical claims, "beta waves improve your brain"). See "Known limitations" in the README.
- **Privacy is not negotiable.** Anything touching user data must default to private,
  consented, and aggregate-only where it leaves the individual. No analytics that phone home,
  no third-party trackers, no dark patterns.
- **No engagement mechanics that pressure users.** No streaks-as-guilt, no manufactured
  urgency, no "psychological buy-triggers". Support consistency through tools the user
  controls, never compulsion.

## Getting set up

```sh
git clone <your-fork>
cd excogni
cp .env.example .env        # edit secrets for anything beyond local dev
docker compose up --build   # runs migrations + seed automatically, serves :3000
```

Open http://localhost:3000. The dev compose uses throwaway local DB credentials
(`excogni:excogni`) - fine for local only. For any real deployment, use the prod compose and
real secrets (see README "Deploying").

## Stack & conventions

- **SvelteKit 2 + Svelte 4** (NOT Svelte 5 runes - no `$state`/`$derived`/`$props`/`{#snippet}`/
  `onclick=`; use `export let`, `$:`, `on:click`). TypeScript. PostgreSQL 16 + Drizzle.
  Tailwind. Docker Compose. Capacitor for mobile.
- **Migrations are immutable once applied.** Never edit an existing migration; add a new
  numbered one. The runner skips already-applied migrations.
- **Dark "instrument panel" aesthetic.** Minimal, calm, tabular/mono for numbers. Match it.
- **Dependency-light.** Prefer the standard library and what's already here over new deps.

## Before opening a PR

Run the checks the project relies on (no network needed):

```sh
# type-check all TS (except the logger)
for f in $(find src scripts -name "*.ts" ! -name "log.ts"); do node --experimental-strip-types --check "$f"; done
# run the unit test suites
for t in rating admin-stats retention reaction email challenges scoring-helpers; do npm test  # or a single suite: node --experimental-strip-types tests/$t.test.mjs; done
```

- Keep PRs focused - one change per PR is easier to review.
- If you change behaviour, say so in the PR and update CHANGELOG.md.
- New scoring/validation logic should come with a unit test (the test suites have caught real
  bugs - see the changelog).

## Good first contributions

- Challenge bank additions/fixes (see `challenge-bank/`).
- New language decks for Verbal Reasoning.
- Accessibility improvements.
- Documentation / self-hosting clarity.
- Anything in the public plan documents (docs/ and the changelog's named next slices) marked low-risk/additive.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and (if a server error)
anything from the in-app Health panel or the container logs. Screenshots help for UI issues.

## Security

Please do **not** open public issues for security vulnerabilities. See SECURITY.md.

## License

## Licensing of contributions

By contributing, you agree that:
1. Your contribution is licensed under the project's AGPL-3.0 license, and
2. You grant the project maintainer a perpetual, worldwide, non-exclusive right to relicense
   your contribution as part of the project, including under commercial or dual-license terms.

The second point keeps the project's future options open (for example, offering a commercial
license alongside AGPL to fund development). Your contribution always remains available under
AGPL-3.0 regardless; nothing is ever taken out of the commons.

Please sign off your commits (Developer Certificate of Origin): `git commit -s`, which adds a
Signed-off-by line certifying you have the right to submit the work.
