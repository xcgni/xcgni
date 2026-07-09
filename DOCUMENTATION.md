# Excogni - Documentation

*A gym for the mind: adaptive cognitive challenges that train and measure at the same time.*

The living reference. Versions and history live in CHANGELOG.md.

---

## 1. What Excogni is

Excogni is a self-hostable web application that exercises and measures cognition
in one motion. Every challenge is simultaneously a piece of training and a sample
of how you are performing. There are no separate tests, no gamified streaks, and
no engagement-maximizing mechanics. The design ethos is an **honest instrument
panel**: dark, quiet, numeric, and candid about what it does and does not know.

The founding idea - train *and* measure, with continuous statistics - is taken
seriously throughout. Where a number cannot be stated honestly, the app says so
("calibrating", "provisional", a range instead of a point) rather than
fabricating precision.

### Guiding principles

1. **Measurement honesty above all.** Percentiles only appear with a real pool;
   ratings carry a standard error; reaction time is a range, not a point;
   estimation is ranked against the population rather than graded against a fake
   tolerance. When in doubt, the app shows less.
2. **No manipulation.** No leaderboards, no streaks, no notifications, no public
   profiles, no "play longer" rewards. Rewards are tied to *real performance*
   (earned level-ups, visible progress), never to duration or habit-forming loops.
3. **Privacy by default.** Anonymous practice never enters the reference pool.
   Attributes are optional, consented, aggregate-only, and never tied to identity.
   Users can export everything and delete everything.
4. **Scope discipline.** The app measures the trainable, fluid core of cognition
   and deliberately avoids what the web cannot measure honestly (true reaction
   time without a hardware caveat, creativity, deep crystallized knowledge).

---

## 2. The categories (17) and domains (11)

Each category belongs to a cognitive **domain**; the mapping is data
(`categories.domain`), so the radar and aggregation scale as categories grow.

| Category | Domain | What it measures |
|---|---|---|
| Numerical Fluency | Quantitative | Mental arithmetic, number sense |
| Estimation | Quantitative | Calibrated approximation (error-ranked vs population) |
| Pattern Recognition | Fluid Reasoning | Rule detection in sequences |
| Spatial Reasoning | Fluid Reasoning | Mental rotation, symmetry, odd-one-out |
| Logical Reasoning | Fluid Reasoning | Syllogisms, conditionals, ordering |
| Working Memory | Memory | Digit span forward/reverse, timed recall |
| Attention Control | Processing Speed | Target counting under load |
| Processing Speed | Processing Speed | Fast same/different, comparison |
| Verbal Reasoning | Verbal | Synonyms, antonyms, analogies (per-language) |
| Verbal Fluency | Verbal | Constrained word generation |
| Inhibition | Executive Function | Stroop - name the ink, not the word |
| Task Switching | Executive Function | Rule-switching, switch cost |
| Retention | Retention | Spaced-repetition fact recall over days |
| Retrieval Fluency | Retrieval | Generate-many from a category |
| Visual Processing | Visual | Visual matching, figure closure |
| Reaction Time | Reaction | Raw response speed, reported as a band |
| Strategic Planning | Strategic Planning | Thinking moves ahead; untimed, plan quality over speed |

3,294 statically-generated challenges (deterministic, seeded) plus a curated
retention card deck (110 cards). Reaction time and fluency generate their stimuli live.

---

## 3. The rating system

The only rating mechanism is **norm-referenced percentile against a pool**, fed by
an internal raw rating (~600-1900). Two honest views:

- **Percentile** - where you rank among *rated* users. Needs a real pool
  (`MIN_POOL_FOR_PERCENTILE`); below that it reads "calibrating".
- **Raw rating trend** - your personal progress over time, which is meaningful
  even with no pool.

Mechanics (all in `src/lib/server/rating/`, dependency-free and unit-tested):

- **Effective time** is clamped (`[300ms, server-measured]`) to resist tab-switch
  inflation and impossibly-fast clicks.
- **Score** floors at 0.45 for slow-but-correct: a careful right answer is never
  treated as wrong.
- **Adaptive ladder**: fast+correct climbs two levels, normal+correct one, slow
  holds, wrong drops, consecutive wrong drops two.
- **Stable level** is the highest level held with enough accuracy; the rating is
  built from it, so a lucky spike doesn't inflate the number.
- **Standard error of measurement** (`standardError`) renders the rating as a band
  that narrows with attempts - uncertainty is shown, not implied away.

Specialized scoring axes:
- **Estimation** - `|percent error|` ranked against the population's error on the
  same item; no tiers of miss, with a cold-start curve until a pool exists.
- **Fluency** - count of valid, de-duplicated answers. Letter tasks are checked
  against an English dictionary (~275k words, fail-open to structural heuristics);
  category tasks against categorized topic wordlists (40 lists, plural and near-miss
  tolerant, fail-open to the item's baked accept-list).
- **Reaction time** - an honest band (see §5).
- **Retention** - due-card recall hit-rate (see §4).

---

## 4. Retention (spaced repetition, train-and-measure)

The flagship category and the clearest expression of the founding idea. Facts are
scheduled SM-2-style (`src/lib/server/retention/`). The honesty rule: **a card is
a measurement only when it was genuinely due** - its interval had grown long
enough that recall is a real test. Re-seeing a freshly-missed card is *training*
and does not score you. Mastery blends due-recall hit-rate with the share of cards
held at long intervals, and stays "calibrating" until there is enough due-review
evidence. Decks are curated, clearly-scoped domains (SI units, capitals, science,
word roots), never smuggled in as "universal knowledge".

---

## 5. Reaction time (honest band)

A measured tap includes screen + input delay that cannot be known exactly, so
reaction time is reported as a **range** (`fast-slow ms`), never a single number.
A per-user **calibration probe** (responding to near-zero-cognition flashes)
estimates the personal hardware floor and residual uncertainty, narrowing the
band - a tight wired setup yields a tight answer, a laggy touchpad a wide one,
which is correct. The band never collapses to a point anywhere, including in the
rating and admin aggregates. Logic in `src/lib/server/reaction/`, unit-tested.

---

## 6. Self-knowledge surfaces

- **Cognitive radar** - a fingerprint across the (up to 9) domains;
  confidence-weighted aggregation, unrated axes shown dim rather than as a false
  zero. New domains appear automatically as categories declare them.
- **Personal records** - peak rating and max level per category, each with a date.
- **The field** - an anonymous distribution of rated users with the viewer's
  marker. No names, no ranking of individuals.
- **Your patterns** - time-of-day and within-session fatigue trends, surfaced only
  once there is enough data to mean it.
- **Executive scores** - Stroop interference and switch cost as construct-valid
  difference scores, separating control/flexibility from raw speed.
- **ⓘ explanations** - a quiet, plain-language note on every tracked number.
- **About pages** (`/about/<slug>`) - an engaging explainer per faculty.

---

## 7. Privacy & user data

- Anonymous by default; anonymous practice is excluded from the reference pool.
- Optional **attributes** (birth year, country, gender, education, native
  language, handedness) and an optional **external test score** for validity work - all behind explicit consent, used only for anonymous aggregate statistics, never
  tied to identity, never shown to others.
- **Export** - one click downloads everything (account, sessions, attempts,
  ratings, attributes, temporal context) as JSON.
- **Deletion** - account deletion cascades to all derived data.
- **Context capture** - per attempt: local hour/day/week/month/year (UTC-anchored,
  DST/travel-safe) and session position, for honest trend analysis.

---

## 8. Admin statistical tool (standalone, env-gated)

A separate research surface at `/admin`, enabled only by `ADMIN_TOKEN` (≥16
chars), reached via `/admin?key=TOKEN`. Not a user role; read-only; aggregates
only; returns 404 when no token is set.

Built-in rigor:
- **Suppression floor** (`ADMIN_MIN_CELL`, default 20) on every displayed group.
- **k-anonymity** on the full quasi-identifier combination for CSV export, with
  geography coarsened to region.
- **Consent-gated** attribute slices.
- **Uncertainty**: n and 95% CI on summaries; median and IQR, not just means.
- **Effect sizes**: Cohen's d *and* Cliff's delta (non-parametric).
- **Multiple comparisons**: Benjamini-Hochberg FDR with warnings.
- **No engagement metrics** - research only.

Standing panels: population vitals (+ consent rate, selection-bias caution),
rating distribution, category difficulty and observed-median drift (recalibration
signal), Verbal-by-native-language bias check, test-retest reliability (with CIs),
inter-category correlation matrix (distinctness), practice-effect (early vs late),
external validity (vs self-reported scores), consenter-vs-non-consenter bias.
Explore (stackable filters), Temporal (hour/day/month), and consented CSV export.

---

## 8b. Public open statistics (`/statistics`)

The aggregate picture is a public good - open to everyone, no account needed, at
`/statistics`. It is the public counterpart to the admin tool, with deliberately
stricter privacy because it is openly filterable and exportable.

What it shows:
- Population size (consented, rated users), overall rating distribution, median + IQR.
- Median rating per category.
- **Extensive breakdowns**: slice the consented population by one dimension - age band, country, education, native language, or handedness - each group showing
  n, median, and IQR.
- **Aggregate export**: every breakdown is downloadable as CSV or JSON (aggregate
  rows only, never individual records).

Privacy model (k-anonymity):
- **Consent-gated**: only users who opted into aggregate research are counted.
- **Public suppression floor** (`PUBLIC_MIN_CELL`, default 50) - higher than the admin
  floor (20) precisely because this surface is open and combinable. Any group below the
  floor is withheld entirely; the page reports how many groups were suppressed.
- **Per-group re-check**: suppression applies to each *final* group in a breakdown, not
  the top-level population, so a small slice can never appear.
- **Simulated users excluded** from the real public page (included only in the labeled
  `STATS_PREVIEW` demo mode, never on in production).

Known limitation - **differencing**: with per-group suppression, a determined observer
can sometimes infer a withheld group by subtracting two permitted breakdowns. To limit
this, v1 offers single-dimension breakdowns rather than arbitrary nested filters. Full
differencing protection (e.g. query auditing or differential-privacy noise) is a future
hardening item, flagged honestly rather than overclaimed. Code: `src/lib/server/stats/public.ts`.

---

## 9. Architecture

- **Stack**: SvelteKit 2 + Svelte 4 (no runes), TypeScript, PostgreSQL 16, Drizzle
  ORM, Tailwind, Docker Compose.
- **Server modules** (`src/lib/server/`): `rating/`, `challenges/`, `sessions/`,
  `stats/` (+ `stats/executive.ts`), `retention/`, `reaction/`, `admin/`
  (`auth`, `stats`, `queries`), `auth/`, `db/`, `flags.ts`, `log.ts`.
- **Migrations** (`migrations/`, idempotent, run by `scripts/migrate.mjs`):
  0001 init → 0042 email_blind_index. Each adds capability without breaking prior data.
- **Challenge banks** (`challenge-bank/`): deterministic generation via
  `scripts/generate-bank.mjs` (seeded mulberry32); loaded by `scripts/seed.mjs`.
- **Tests** (`tests/`): dependency-free `.mjs` suites for rating, admin stats,
  retention, reaction - run with `node --experimental-strip-types`.

### Running it

```
docker compose up --build
```

Migrations apply and the bank seeds on boot. A simulated reference pool exists
only while `ENABLE_SIMULATED_USERS` is on, to populate aggregate views during
development. Real accounts are created via magic link.

### Production deployment

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

The prod override disables every dev flag, requires `POSTGRES_PASSWORD` and
`ORIGIN` from the environment, stops publishing the database port, and wires SMTP.
Set secrets in a `.env` file beside the compose files (see `.env.example`).

### Production notes

Set `NODE_ENV=production` and disable dev flags (`ENABLE_SIMULATED_USERS`,
`DEV_EXPOSE_MAGIC_LINKS`, `SHOW_DEBUG_UI`). Before a real
public launch: wire SMTP (`src/lib/server/auth/mail.ts` is a stub), set HTTPS and
`ORIGIN`, change the default Postgres password, and set a strong `ADMIN_TOKEN` (or
leave blank to keep `/admin` disabled).

---

## 10. Honest limitations

- **Validity is unproven.** The rating is demonstrably *consistent*, not yet shown
  to be *valid* or *stable* on real humans. The reliability, validity,
  correlation, and practice-effect panels exist precisely to answer this once real
  testers generate repeat-session data. **No validity claims should be made until
  then.**
- **`expectedMedianMs` is hand-tuned.** Timing targets are educated guesses;
  `observed_median_ms` accumulates reality for later recalibration.
- **Fluency acceptance is list-bounded**: letter fluency is dictionary-checked (EN,
  v0.64.27) and semantic fluency runs on categorized wordlists (~5,900 entries across
  40 topics, v0.65.0) - generous, but a very obscure real word may still not count.
  Croatian wordlists remain a roadmap item.
- **Verbal deck is finite** and shallow per level.
- **Reaction time / fluency on mobile** may score differently than desktop (touch
  latency, typing speed) - a cross-device fairness caveat, not yet corrected.
- **Pools from friends/students are biased** and not a valid percentile reference;
  keep percentiles "calibrating" for such groups.

---

## 11. Operational layer (live-launch safety)

Added for going live before formal validation:

- **Error capture** - a `handleError` hook persists every unhandled server error to
  `error_log` (route, message, stack, status, coarse user kind; never the user id)
  and returns a safe generic message to the client. Errors reach the operator
  instead of vanishing into container logs.
- **Admin Health panel** (`/admin/health`) - an error pulse (24h / unseen / total),
  the recent error stream, and recent user feedback in one view.
- **In-app feedback** - an unobtrusive widget (bug / confusing / idea / other)
  writes to a `feedback` table. At launch, user-reported friction is the cheapest
  validity and UX signal available.
- **Public framing** (`/about`) - states plainly what Excogni is and isn't (not an
  IQ test, not a diagnosis, not yet validated) and how data is handled.

## 12. Standing roadmap (not yet built)

- Cohort question tool (admin composes an optional research question to a filtered
  cohort, reads only aggregate ≥ floor) - the ethical path to lifestyle trends.
- Croatian (HR) wordlists and decks; EN semantic wordlists shipped in v0.65.0 (WORDLISTS-PLAN.md).
- Verbal deck depth expansion.
- IRT item calibration once data volume allows.
- Device-type capture to quantify cross-device scoring fairness.
- Mobile tuning for the timing-sensitive flows.
- Expert review (psychometrician + biostatistician) before any public claim.
