# Excogni

A serious cognitive fitness platform - a gym for the mind. Adaptive challenges that
**train and measure at the same time**, producing a calibrated Elo-style rating and
percentile per cognitive category. Private by default. No gamification sugar.

**Open source (AGPL-3.0) · self-hostable · privacy-first · radically transparent.**
Excogni is built to be the honest one: the scoring formulas are published in-app
(`/methodology`), data is anonymous and aggregate-only by default with layered consent, and
nothing is sold. It's also a *state-tracking* instrument - not only "train your score" but
"how am I functioning today?", closing the loop with a short per-session check-in.

- **Self-host it:** `docker compose up --build` → http://localhost:3000
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md)
- **Security:** see [SECURITY.md](SECURITY.md)
- **How scoring works:** [DOCUMENTATION.md](DOCUMENTATION.md) and the in-app `/methodology` page
- **Known limitations:** see the section near the end of this README - read it, it's honest.

## Quickstart

```sh
docker compose up --build
```

Then open **http://localhost:3000**. The app container runs migrations and seeds
automatically on boot (idempotent - safe on every restart).

What you get out of the box:

- **3,294 reviewed challenges across 17 categories in 11 cognitive domains** - including three distinct strategic-planning suites (number paths, step ordering, grid paths) and 25 spaced-repetition decks (357 cards).
  *Quantitative*: Numerical Fluency (mental arithmetic), Estimation (approximation
  scored on a single error axis ranked against the population). *Fluid reasoning*:
  Pattern Recognition (sequences), Spatial Reasoning (rotation, symmetry,
  odd-one-out over SVG figures), Logical Reasoning (syllogisms, conditionals,
  ordering). *Memory*: Working Memory (digit span). *Processing speed*: Attention
  Control (target counting), Processing Speed (same/different, comparison).
  *Verbal*: Verbal Reasoning (synonyms/antonyms/analogies, per-language deck),
  Verbal Fluency (constrained word generation). *Executive function*: Inhibition
  (Stroop), Task Switching (rule-switching with switch cost). *Retention*:
  spaced-repetition fact recall over days. *Retrieval*: Retrieval Fluency
  (generate-many from a category). *Visual*: Visual Processing (matching, figure
  closure). *Reaction*: Reaction Time (reported as an honest band, never a single
  number). Reaction Time and Retention generate their stimuli live; the rest are
  statically generated and seeded.
- **120 simulated users** forming the percentile reference pool (dev flag)

### A note on Estimation scoring

Estimation is the one category that does **not** use right/wrong scoring. Your
guess is converted to a normalized error (`|guess - actual| / |actual|`) and
scored on a single axis: how your error ranks against everyone else's error on
the *same* item. Closer than most → higher score. No tolerance bands, no tiers
of "how wrong" - the population defines what counts as close. Until a challenge
has enough attempts to rank against, a smooth cold-start curve scores it
(exact → 1.0, falling off as error grows).

### Local development (without Docker for the app)

```sh
docker compose up db -d        # just postgres
cp .env.example .env
npm install
npm run migrate && npm run seed
npm run dev                    # http://localhost:5173
```

## Logging in

**Magic links** are the only registration method in this version.

- With `DEV_EXPOSE_MAGIC_LINKS=true` (default in dev), the link is rendered directly
  on the login page after you request it. No SMTP needed.
- Since v0.66.0 a link can NOT be reconstructed from the database (tokens are stored hashed):

  ```sql
  -- since v0.66.0 the DB stores only sha256(token): a link can NOT be reconstructed
  -- from the database. In dev, set DEV_EXPOSE_MAGIC_LINKS=true (link appears on the
  -- login page) or read it from stdout - mail.ts logs the full link when SMTP is not
  -- configured. DEV_EXPOSE_MAGIC_LINKS is hard-disabled when NODE_ENV=production.
  ```

- SMTP delivery works when `SMTP_HOST` (+ `SMTP_PORT/USER/PASS/FROM`) is set; without
  it the link is logged to stdout (`src/lib/server/auth/mail.ts`).
- If you practiced anonymously and then register, your anonymous user is **upgraded
  in place** - all history and ratings are preserved.

Google sign-in: planned, not implemented.

## Feature flags (`.env`)

| Flag | Effect |
|---|---|
| `ENABLE_SIMULATED_USERS` | Seeds 120 simulated users **and includes them in percentile pools**. Turn off once you have real users; the pool query excludes them instantly - no deletion needed. |
| `DEV_EXPOSE_MAGIC_LINKS` | Renders magic links on the login page (dev convenience) |
| `SHOW_DEBUG_UI` | Shows debug surfaces (raw scores, speed class, rating deltas inline, pool internals). **Never `true` in production.** |

Pool rules (enforced in the percentile query, `src/lib/server/stats/index.ts`):
anonymous users never enter the pool; test users never enter the pool; simulated
users only while the flag is on; ≥10 attempts in a category required.

### Calibration (honest percentiles)

Percentiles are norm-referenced. Below `MIN_POOL_FOR_PERCENTILE` (default 20)
rated users in a category, the UI shows an explicit **"calibrating"** state
instead of a fabricated number - the product never invents a percentile it can't
back. When you launch for real with `ENABLE_SIMULATED_USERS=false`, expect
categories to read "calibrating" until enough real users accumulate; that is
correct behaviour, not a bug. A rating with fewer than 10 attempts is also marked
**provisional**.

### Expert-review hardening (v0.4.0)

A pass shaped by what a psychometrician, cognitive psychologist, biostatistician,
and disclosure-control specialist would each demand:

- **Construct-valid executive scores** - raw accuracy on Stroop/switching conflates
  the executive component with general speed. Stats now show the **interference
  score** (incongruent - congruent) for inhibition and the **switch cost**
  (switch - repeat) for task switching, which isolate the actual construct.
- **Standard error of measurement** - individual ratings render as `rating ± SEM`,
  with the band shrinking as attempts accumulate. A score is never a point; the
  uncertainty is shown, not hidden (the same discipline as the reaction-time band).
- **Statistical rigor in admin** - Benjamini-Hochberg FDR (less conservative than
  Bonferroni at modest n), Cliff's delta (non-parametric effect size for skewed
  cognitive distributions) beside Cohen's d, reliability with confidence intervals,
  an inter-category **correlation matrix** (flags pairs r≥0.8 that may not be
  distinct constructs), a **practice-effect** panel (early vs late sessions - quantifies how much the rating reflects learning vs trait), and a
  **consenter-vs-non-consenter** selection-bias report.
- **External validity** - users can optionally share an outside test score
  (IQ/SAT/GRE/other) in Settings; the admin tool correlates Excogni ratings against
  it. This is the only evidence that moves the rating from *consistent* to *valid*.
- **Privacy hardening** - the consented CSV export now enforces **k-anonymity on
  the full quasi-identifier combination** (a rare age+region+language+education
  combination can be unique even when each field clears the floor) and coarsens
  geography to broad **region**.

All of this is honest about its own limits: the validity, reliability, correlation,
and practice-effect panels are mostly empty until real testers generate repeat-session
data - which remains the single most important next step.

### Fluency, visual processing & honest reaction time (v0.3.0)

Four more categories round out the battery toward a fuller cognitive map:

- **Retrieval Fluency** (`retrieval_fluency`, Retrieval domain) - "name as many X
  as you can" in a time window; scored by count of valid unique answers against a
  categorized topic wordlist (40 lists, plural and near-miss tolerant, fail-open
  to the item's baked accept-list; shipped v0.65.0). Probes long-term-memory
  retrieval, the half Retention doesn't cover.
- **Verbal Fluency** (`verbal_fluency`, Verbal domain) - constrained word
  generation ("words starting with TR", "words ending in TION"); a classic,
  sensitive measure of lexical access and executive search.
- **Visual Processing** (`visual_processing`, Visual domain) - visual matching and
  figure closure over SVG figures; a distinct intelligence from verbal/numerical.
- **Reaction Time** (`reaction_time`, Reaction domain) - the honest one. A measured
  tap includes screen + input delay we can't know exactly, so reaction time is
  reported as a **band** (`fast-slow ms`), never a single number. A per-user
  **calibration probe** (responding to near-zero-cognition flashes) estimates the
  personal hardware floor and narrows the band - a tight wired setup gets a tight
  answer, a laggy touchpad a wide one, which is *correct*. The band never collapses
  to a point, anywhere. Lives in `src/lib/server/reaction/` (unit-tested).

Fluency uses a timed chip-list renderer inside the practice run; reaction time and
retention have their own screens (`/practice/reaction`, `/practice/retention`)
because their loops differ from the timed single-answer flow.

**Practice is now configurable** - session length (3-50) and which categories
appear in mixed practice are set in Settings, per account.

**Per-category About pages** (`/about/<slug>`) give an engaging plain-language
explainer of each faculty: what it is, where it matters in real life, why it's
worth measuring - linked from each dashboard card.

These add three radar domains (Retrieval, Visual, Reaction); the data-driven
category→domain mapping absorbed them with no chart changes. Migrations 0009
(session length, reaction band + calibration) and 0010 (about text).

### Executive function & retention (v0.2.0)

Three new categories extend the battery beyond in-the-moment processing:

- **Inhibition** (`inhibition`, Executive Function domain) - a Stroop task: name
  the ink colour, not the word. Measures suppression of the prepotent reading
  response. Difficulty scales the incongruent-trial rate and tightens timing.
- **Task Switching** (`task_switching`, Executive Function domain) - a cue selects
  the rule (judge colour vs judge shape) and it changes trial to trial; measures
  cognitive flexibility and the switch cost.
- **Retention** (`retention`, its own domain) - the flagship: spaced-repetition
  facts that **train and measure at once**. Cards are scheduled SM-2-style; the
  rating is *honest about what counts* - a card scores you only when it was
  genuinely **due** (interval long enough that recall is a real test). Forgetting
  something you just saw is part of learning, not a mark against you. Mastery
  blends due-recall hit-rate with the share of cards held at long intervals, and
  stays "calibrating" until there are enough due reviews to mean something.

These add two new radar domains - **Executive Function** and **Retention** - demonstrating the "add a super-category when the data outgrows the axes" scaling:
the category→domain mapping is just data (`categories.domain`), so the radar
absorbed them with no chart changes.

Retention decks are curated, clearly-scoped domains (SI units, world capitals,
scientific facts, word roots) - never smuggled in as "universal knowledge", and
cross-culturally robust to avoid measuring background instead of memory. The
scheduling and scoring live in `src/lib/server/retention/` (dependency-free,
unit-tested in `tests/retention.test.mjs`); the flow has its own practice screen
at `/practice/retention` because learn→recall→self-grade differs from the timed
single-answer loop.

### Admin statistical tool (standalone, env-gated)

A separate research surface at `/admin`, **not** a user role. Enable it by setting
`ADMIN_TOKEN` (≥16 chars) in the environment; sign in at `/admin/login` with the token
(plus a TOTP code from your authenticator app when `ADMIN_TOTP_SECRET` is set - generate
one with `node --experimental-strip-types scripts/gen-totp-secret.mjs`; strongly
recommended in production). With no token set, `/admin` returns 404. Login issues a
short-lived (8h) single-active-session cookie; the old `?key=` URL login is gone - secrets don't belong in URLs. The tool is read-only and shows **aggregates only** - it
cannot drill down to any individual.

Built-in discipline (the same honesty as the rest of the product, applied to
research):
- **Suppression floor** (`ADMIN_MIN_CELL`, default 20): no group below the floor
  is ever displayed, guarding against re-identification of small cohorts.
- **Consent-gated**: attribute slices use only users who ticked the stats consent.
- **Uncertainty everywhere**: every summary carries n and a 95% CI; distributions
  show median and IQR, not just means.
- **Effect sizes**: cohort comparisons report Cohen's d and a plain effect label,
  not just "a difference."
- **Multiple-comparisons warnings**: exploratory slicing inflates false positives;
  the tool says so and gives a Bonferroni threshold.
- **No engagement metrics**: it measures cognition trends, not stickiness.

Pages:
- **Overview** - population vitals (with consent rate + selection-bias caution),
  global rating distribution, category difficulty and observed-median drift vs the
  hand-tuned timing guesses (the recalibration signal), the Verbal-by-native-language
  bias check (with effect size and an exploratory-slicing warning), and test-retest
  reliability (ICC-style) per category - the core validation metric.
- **Explore** - stackable attribute filters (age, country, gender, education,
  native language, handedness); the rating distribution recomputes per slice,
  suppressed when the cohort is too small.
- **Temporal** - accuracy by local hour, day of week, and month (seasonality),
  filterable by country/language; local-time aggregates assume a stable timezone
  (flagged), cross-checkable by country.
- **Export** - one anonymized row per consented user (decade-banded age, coarse
  attributes, per-category ratings) as CSV for analysis in R/Python; withheld
  entirely if the consented set is below the floor.

Statistics primitives live in `src/lib/server/admin/stats.ts` (dependency-free,
unit-tested in `tests/admin-stats.test.mjs`); consent/suppression-gated queries in
`src/lib/server/admin/queries.ts`; standalone auth in `src/lib/server/admin/auth.ts`.

A deferred next step (specced, not built): a **cohort question tool** - compose an
optional, research-flagged multiple-choice/scale question, target a filter-defined
cohort, read only aggregate answers (≥floor). It is the ethical path to lifestyle
trends (sleep, caffeine) without storing standing health data. Standing
lifestyle/health data collection is deliberately out: it would pull into GDPR
special-category data and needs separate consent and legal review.

### Session feel, records, and self-knowledge

- **Bounded sessions**: practice runs in focused blocks of 10 questions, ending
  with "Regular session complete - keep practicing?" A finish line and a choice,
  not an infinite grind.
- **Manual advance**: after each answer you press Next (or Enter) - feedback and
  the "why your level moved" line are readable, not auto-skipped.
- **Get-ready beat**: a 250ms pause precedes memory-recall stimuli so attention
  has landed before the digits appear (better feel *and* cleaner measurement).
- **Confirmed level-ups**: when you advance a level you immediately get a
  same-category confirm question; ace it (correct and not slow) and you see
  "Nice - you leveled up." Flukes that you fall back from don't celebrate.
- **In-the-zone meter**: a quiet rolling sharpness signal across the session,
  reflecting *this session's rhythm* - earned, tied to real performance.
- **Keyboard-solvable choices**: multiple-choice options are numbered; press the
  digit (1-4) instead of clicking. Rotation tasks no longer need a mouse.
- **Personal records**: peak rating and max level per category, each with the
  date reached - a chess-style high-water mark, shown in Stats.
- **Cognitive profile (radar)**: a domain-level fingerprint across eleven cognitive
  domains (Fluid Reasoning, Processing Speed, Memory, Quantitative, Verbal,
  Executive Function, Retention, Retrieval, Visual, Reaction, Strategic Planning).
  Categories aggregate into domains (confidence-weighted); the domain→category
  mapping is data (`categories.domain`), so new categories just declare a domain
  and the chart stays legible. Unrated axes render dim, never as a false zero.
- **The field**: an anonymous distribution of rated users with your marker on it.
  No names, no ranking of individuals. Named leaderboards / top-user displays /
  public account-age are a deliberate non-goal.
- **ⓘ explanations**: every tracked number (rating, percentile, domains, peak,
  the field) has a quiet, plain-language explanation on demand.

### About-you attributes (anonymous aggregate only)

Optional self-declared details - birth year, country/region, gender, education,
native language, handedness - collected in Settings behind explicit consent.
They are used **only** for anonymous, aggregate group statistics and trends, are
**never** tied to identity in any output, never shown to other users, and are
fully exportable and deletable. Native language in particular lets verbal-category
scores be interpreted honestly. (A future admin panel will surface aggregate
trends built on this consented data - collected cleanly from day one so the
future analysis is trustworthy.)



- **First-run onboarding** (`/welcome`): a short, skippable four-step intro that
  sets the contract before the first challenge - what Excogni is, that
  slow-correct is valid, how the rating works (calibrating/provisional), and the
  privacy stance. Tracked per user via `user_settings.seen_intro`; the practice
  screen redirects first-timers here.
- **Transparency in-flow**: after each answer the practice screen shows a plain
  reason for any difficulty change ("quick and right - level up", "stepping down
  to find your level"). The session summary adds a one-line "what changed"
  narrative, not just numbers. The system shows its work.
- **Data export** (`GET /api/export`, button in Settings): downloads everything
  held about the user - account, settings, every session and attempt, full
  rating history - as one JSON file. Anonymous users included. Makes the
  privacy-by-default promise verifiable, not just stated.

### Trend-of-state context logging

Every answered attempt records, in addition to timing: the user's **local hour**
(0-23), **day of week**, and **session position** (1-based index within the
session). These are derived from a timezone offset captured client-side and
stored on the session - time is always anchored to UTC and local hour is
*computed*, never stored as wall-clock, so DST and travel don't corrupt it.

This powers the **"Your patterns"** readout on the Stats page: when you tend to
perform best, and whether you fatigue within a session. It follows the same
honesty discipline as percentiles - buckets below a minimum attempt count are
dropped, and the whole section stays hidden until there's a real baseline
(`MIN_TOTAL_FOR_PATTERNS`). "You're sharpest at 9am" off five attempts is
fiction, so it isn't shown.

### Magic-link rate limiting

`createMagicLink` is throttled to 5 requests per email (and per IP when
available) within a 15-minute window, backed by the `magic_link_requests` table.
This prevents flooding the link table and, once SMTP is live, mail-bombing
arbitrary addresses. Exceeding the limit returns HTTP 429 with a friendly message.

## How measurement works

- Every challenge is both training and a measurement sample.
- **No visible timers.** Timing is recorded; slow-but-correct is never treated as
  wrong (score floor 0.45; normal pace ≈ 0.75; fast ≈ 0.9-1.0).
- **Timing integrity**: the server records `served_at` when a challenge is dealt and
  clamps the client-reported elapsed time into `[300ms, server-observed elapsed]`.
  Answers are validated server-side; answer data never reaches the browser.
- **Adaptive ladder**: fast-correct +2 levels, normal-correct +1, slow-correct 0,
  wrong -1, consecutive wrong -2.
- **Stable level**: highest level with ≥3 attempts and ≥65% accuracy in the recent
  window (last 40 attempts).
- **Rating**: a monotone summary of stable level, recent accuracy, and pace,
  displayed Elo-style (~700-1750 typical). Percentile is norm-referenced against
  the pool. Confidence: low <10 attempts, medium <30, high ≥30.
- Each challenge carries a hand-tuned `expectedMedianMs`; the server also maintains
  `observed_median_ms` (EMA) per challenge for later recalibration.

All scoring logic is dependency-free in `src/lib/server/rating/index.ts` and covered
by tests:

```sh
node --experimental-strip-types tests/rating.test.mjs
```

## Adding a category or more challenges

1. Generate or write a bank file: an array of objects like those in
   `challenge-bank/*/*.levels.json` (see `scripts/generate-bank.mjs`, which is the
   deterministic, seeded generator for the current banks - `npm run generate:bank`).
2. Drop the JSON file under `challenge-bank/<category>/`.
3. List the file in `BANK_FILES` in `scripts/seed.mjs`.
4. If it is a new category, add it to `CATEGORIES` in the same file with
   `implemented: true`.
5. Restart (or `npm run seed`). Seeding upserts by `bank_key`, so re-seeding is safe.

If the new category reuses the `numeric_text_input` renderer (typed numeric answer,
optionally with a `block` symbol grid in the prompt) or `memory_recall` (timed
display-then-recall), **no application code changes are needed**. A genuinely new
renderer type requires adding its rendering branch in
`src/routes/practice/run/+page.svelte`. For timed-display challenges, put
`displayMs` in both `promptData` (client display) and `scoringConfig` (the server
excludes it from response timing).

## Architecture

- **SvelteKit 2 + TypeScript**, Node adapter
- **PostgreSQL 16 + Drizzle ORM** (hand-written idempotent SQL migrations in
  `/migrations`, applied by `scripts/migrate.mjs`)
- **Tailwind** - dark instrument-panel aesthetic, system font stacks, no external assets
- Core flow: `POST /api/practice/next` deals a challenge and records a pending
  attempt → `POST /api/practice/submit` validates, scores, steps the ladder,
  recomputes stable level/rating/percentile, and returns the result.
- Sessions are implicit: a gap of >4 minutes of inactivity closes the session.
- Account deletion cascades through all user data (`ON DELETE CASCADE`).

## Roadmap (next runs)

- SMTP magic-link delivery; Google sign-in
- Percentile recalibration from observed medians
- Opt-in sharing / comparison features (privacy stays default-off)

## Known limitations (read this - honesty is the point)

Excogni's whole character is being honest about what it is and isn't. So, plainly:

- **It is not clinically validated.** It is not a diagnostic tool and makes no medical claims.
  The ratings are an internally consistent, Elo-style measure of performance on *these tasks* - whether they correlate with real-world cognition is exactly the kind of validation that still
  needs doing (test-retest reliability, external validity, expert psychometric review).
- **Fluency (word-list) scoring is imperfect.** Letter-fluency is dictionary-checked (EN,
  can still reject very rare words), category-fluency uses finite topic wordlists (generous,
  plural-tolerant, but a valid obscure word may not count). A known, deliberated design
  tension; Croatian wordlists remain a roadmap item.
- **Public-statistics suppression handles single dimensions.** Combining breakdowns could in
  principle infer a suppressed small group (differencing). Mitigated by offering single-dimension
  breakdowns in v1; fuller protection is a roadmap item. See DOCUMENTATION.md §8b.
- **Percentiles need a population.** Until enough consented users exist, percentile/population
  features honestly show a "calibrating" / "not enough data" state rather than a fake number.
- **Reaction time is reported as a band, not a single number** - on purpose; per-trial timing in
  a browser is noisy.

If something here looks wrong or you can help close one of these gaps, contributions and
issues are very welcome.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: Svelte 4 (no Svelte-5 runes), migrations are
immutable once applied, keep it honest (no overclaiming, no dark patterns, privacy by default),
and run the type-checks + test suites before a PR. Good first contributions: challenge-bank
additions, new language decks, accessibility, and docs.

## Source

Open source under AGPL-3.0: https://github.com/xcgni/xcgni

## Acknowledgments

Excogni is built and maintained by [initsix.dev](https://initsix.dev). Source: [github.com/xcgni/xcgni](https://github.com/xcgni/xcgni).

Alpha-phase testers who boot-tested early builds, found real bugs, and shaped the pre-launch
experience - the full record lives at `/contributions` in the app:

- **Matea Berišić** - the finds behind v0.64.24 (fluency honesty, the circles form fix, mobile fit)
- **Vladimir Anić** - early-build testing and pre-launch feedback
- **Domagoj Špiranec** - alpha-phase security testing

## License

[AGPL-3.0-only](LICENSE). You can self-host, modify, and redistribute it freely; if you run a
*modified* version as a network service, the AGPL requires you to make your source available.
This keeps Excogni genuinely open while preventing a closed-source SaaS fork.

© 2026 Branimir · [initsix.dev](https://initsix.dev)
