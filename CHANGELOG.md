# Excogni - Changelog

All notable changes, newest first. Versions follow the build milestones. The pre-1.0.0
entries below are the private development history, published in full at the open-source
launch rather than curated away - the same transparency the product is built on.

---

## v1.3.0 - Strategic planning grows verbal and visual suites

Planning was measured through one lens (number paths). Two more, same deliberate philosophy
(no clock, thinking slowly is free), 200 new items:

- **Step ordering (verbal), 80 items**: real-world procedures with strictly causal step
  chains (each step physically requires the previous - boil before pour, dig before plant),
  shown scrambled with letters; the answer is the letters in workable order. Twelve base
  procedures sliced into 4-7 step items across levels 1-10. All-or-nothing scoring: a
  procedure is either in a workable order or it is not. Feedback reveals the one correct
  order - the exception to planning's no-spoiler rule, because here revealing teaches.
- **Grid paths (visual), 120 items**: small mazes (S start, T target, # walls) rendered in
  the instrument's mono grid; the answer is a move sequence (U/D/L/R, arrows, or words -
  run-together "RRDD" works too). Graded by replay exactly like number paths: any legal
  route that reaches T is correct, efficiency vs the BFS-known optimum is what scores.
  Grids scale 4x4 to 8x8 with optimal lengths 3 to 15 across levels.
- Both live under strategic_planning with tap-to-build chips (step buttons / move buttons)
  plus free typing, and kind-aware answer placeholders.
- New suite tests/planning-extra.test.mjs (24 checks): grader vectors for both kinds AND
  bank integrity - every shipped grid item is independently re-solved by BFS and must match
  its declared optimum exactly; every ordering item must be a clean single-use permutation.
  One real bug caught by the suite before ship: arrow-key moves were being eaten by the
  token splitter. Suites: 19.
## v1.2.0 - A proper quiz knowledge bank

The Retention faculty gains an extensive general-knowledge deck set: 247 cards across 17
themed decks (Biology, Chemistry, Physics & Space, Geography, World History, Art & Culture,
Literature & Language, Sport, Music, Film, Mathematics, Food & Nature, The Human Body,
Inventions & Technology, Mythology, World & Society, and General Knowledge). Quiz-show style,
deliberately broad and globally-minded rather than trivia tied to one country, each card with
accepted answer variants and a short teaching note. The new file
challenge-bank/retention/quiz-decks.json loads alongside the existing decks through the seed;
spaced-repetition scheduling and honest due-only scoring apply unchanged.
## v1.1.1 - Logs are data too

- **SMTP announces the real domain** (nodemailer `name: 'xcgni.com'`): without it the EHLO
  handshake carried the container's private 10.x address - a textbook spam signature that the
  provider rejected and logged as "unauthorized IP". This was the root cause of the mail
  outage.
- **SMTP now forces IPv4** (nodemailer `family: 4`): a host that starts resolving the mail
  server over IPv6 after a restart presents an address the provider has never authorized,
  which is exactly a "525 Unauthorized IP" outage. Pinning v4 removes the surprise.

Found while diagnosing a mail outage: the mail-failure and magic-link log events printed the
raw email address to stdout. "No readable email anywhere in our data" must include logs, so
every log site now emits the masked hint (s…@g….com) instead - masking happens inside the
log helper so no call site can forget. The operator fallback that prints the magic link when
mail is down stays (it is the only delivery path in that state; the link is short-lived and
single-use), with the address masked. Scanner-probe 404s (/wp-admin, /.env and friends) were
confirmed to never reach error triage - capture is gated to status 500+.
## v1.1.0 - Error triage: grouped, searchable, clickable

The admin error view grows from a flat recent-list into Sentry-style triage at /admin/errors,
so operating the instrument never requires docker and grep again:

- **Grouping by signature**: events group by their normalized message (digit runs collapse to
  #, so "user 123 not found" and "user 456 not found" are one group) plus the top stack frame
  (identical messages from different code paths stay distinct). Computed at query time - no
  schema change to error_log, historical rows group retroactively.
- **Each group shows** the latest sample message, total occurrence count, first/last seen,
  distinct route count, and HTTP status; ordered by most recent.
- **Click a group** to open its latest 20 occurrences inline - timestamp, route, status, user
  kind (never an id), and the full stack behind a disclosure.
- **Search** across message and route; **filter tabs** for active / resolved / ignored / all.
- **Triage workflow**: resolve or ignore a group (new error_groups table, migration 0043);
  a resolved group whose error returns shows as REGRESSED - state is never silently lost.
- **Retention**: daily housekeeping now prunes error events older than 30 days and triage rows
  whose group has been silent long after its last status change.
- Linked from the admin nav; guarded like every admin surface (awaited isAdmin in load and
  action - the guard test covers the new route).
## v1.0.1 - Payments off for launch; changelog and dead links fixed

- **Payment rails disabled.** No entity, no GitHub Sponsors, no Liberapay for the HN launch,
  so the support page no longer shows pay buttons that go nowhere. It now asks only for the
  help that costs nothing and matters most right now: register and consent (feed the commons),
  star or fork the repo, report holes, share it. The money part is stated honestly as a
  later step, gated on a real legal entity and announced here when it happens.
- **Merged the duplicate v1.0.0 changelog entries** into one (two had been committed).
- **Fixed dead /formulas links** across the support, statistics, and about pages - the route
  was merged into /methodology a while back; these still pointed at the old path and would
  have 404'd for launch visitors.
## v1.0.0 - Public launch

Excogni is open source and live. Deployed and smoke-tested end to end on production (15/15),
admin TOTP verified live, the blind email index active with zero plaintext addresses
remaining. The instrument, the methodology (m1, formulas + limitations published), and the
population statistics are open to everyone; the code is AGPL at https://github.com/xcgni/xcgni,
linked from the footer, README, and /about.

- Alpha-phase security testing credited: Domagoj Špiranec joins Matea Berišić and Vladimir
  Anić on /contributions and in the README.
- 1.0.0 means what semver says it means: self-hosters can rely on the schema and env contract,
  and breaking changes will bump the major.
- Everything the 0.6x line built toward is in place: hashed bearer tokens, the blind email
  index (the readable address is never stored), admin TOTP, the awaited-guard test that pins
  the one real hole the audit found, categorized semantic wordlists, the redesigned statistics
  page with its researcher dataset, the public changelog, CI, and the deploy tooling that
  verified this release.

The version number changes; the principle does not. A shape, not a score.

## v0.67.8 - The admin login page discloses nothing

The login form is now identical whether or not TOTP is configured: the setup hint that told
visitors "TOTP is not configured" is gone (it advertised a weaker target and internals), and
the authenticator field always renders - the server simply ignores it when TOTP is off. A
visitor learns nothing about the deployment's auth posture from the page; failures stay one
generic message.
## v0.67.7 - The changelog gets a page

/changelog renders this file on the site - same content, no marketing digest, latest 25 with
a show-all link. It makes the promise on the privacy page true: the "public changelog" that
serves as the incident-notice channel now exists at a URL. Wired: footer link, sitemap entry,
CHANGELOG.md shipped in the runtime image, smoke-test line.
## v0.67.6 - For the scientists

- **/statistics gains a "For researchers" section**: the exports formalized as a citable
  aggregate dataset - schema per row (group, n, median_rating, q1, q3), collection conditions
  stated plainly (self-selected, unsupervised, k-truncated), and a copyable BibTeX block.
- **/methodology gains a Limitations section**, unprompted: self-selection, unsupervised
  setting, device/network variance (bounded, not eliminated), pool-relative percentiles,
  k-truncated slices.
- **Learning vs ability, said outright**: ratings conflate trait with practice exposure -
  a property of every repeated cognitive measure - and every attempt carries its ordinal
  position and first-exposure flag precisely so learning curves can be modeled and separated
  by anyone. Test-retest figures promised once repeat volume permits.
## v0.67.5 - m1 formulas complete: estimation, fluency, reaction

The public formulas block was missing three scorers that were live all along. Now documented
with formula + plain explanation, verified against the code: estimation (normalized error
|guess-true|/max(|true|,1), population-ranked per item with 1/(1+4e) cold-start, e<=0.15 counts
as "correct" for accuracy displays), fluency (min(1, valid/12), per-word verdicts disclosed),
and reaction (band, never a point; 600ms network-credit cap). Documentation completeness only -
no formula changed, so this is still methodology m1, with the additions noted in its registry
entry.
## v0.67.4 - Deploy day tooling

- **scripts/smoke.sh <url>**: fourteen read-only checks against a deployed instance - the
  unauthenticated surface renders, auth boundaries hold (admin 404s without a token, export
  401s without a session), the sitemap carries the faculty pages, and healthz is genuinely
  no-store. Run it after every deploy; it creates no accounts and sends no email.
- **DEPLOY-CHECKLIST.md**: the launch sequence in order - backup RESTORE test first, secrets
  generated and stored separately, migrations, the one-time email backfill, cache purge,
  smoke test, a full phone-width user pass, deliverability check, uptime monitoring, and the
  fresh-history open-source push. The post goes out last.
## v0.67.3 - Calendar dates pruned from everything public

Development-timeline datetimes are gone from every public surface: the plan documents and
DOCUMENTATION.md now anchor decisions to app versions instead of dates, a code comment lost
its audit date, and the public methodology page says "since v0.63.0" rather than a release
date - the scientific property that matters is WHICH methodology produced a number, and the
version carries that without disclosing the calendar. Changelog headers never carried dates.
The copyright year in LICENSE stays (it is a legal convention, not a timeline). Test-fixture
dates in scripts stay (synthetic data, not history).
## v0.67.2 - CI, and the roadmap goes private

- **GitHub Actions CI** (.github/workflows/ci.yml): every push and PR runs all 18
  dependency-free suites plus the wordlist verification (fast, nothing to install), and a
  second job proves the SvelteKit build compiles. Free on GitHub-hosted runners for public
  repos.
- **ROADMAP.md is now gitignored** - it is the maintainer's private planning document
  (strategy, consultant notes), not part of the open-source tree. Public docs that pointed
  at the file now reference "the project roadmap" without naming a path a cloner won't have.
## v0.67.1 - Launch hardening: the statistics page can take a crowd

- **Public aggregates are cached (60s TTL, in-memory)** with a stampede guard: a burst of
  identical first requests produces ONE database query, concurrent callers share the in-flight
  promise, errors are never cached, and the store is bounded. All five public entry points
  (stats, behavioral, trends, explore, breakdown) go through it, which covers the /statistics
  page AND its CSV/JSON exports. Sixty seconds of staleness on population medians is
  invisible; Postgres surviving a front-page spike is not. Per-user data never touches this
  cache. New suite: tests/cache.test.mjs (TTL, coalescing, error retry, bound). Suites: 18.
- **/healthz sends Cache-Control: no-store** - a CDN-cached 200 would mask a real outage from
  uptime monitors. (The endpoint itself already existed and stays data-free.)
- **Daily opportunistic housekeeping** (src/lib/server/gc.ts, fired non-blocking from the
  request path, at most once per day per process, no cron): removes anonymous rows older than
  30 days that never left a trace (no attempts, reaction runs, retention state, day notes,
  session context, or feedback - registered users are never touched, however empty), plus
  auth sessions and magic links expired more than 7 days ago. Holding nothing about people
  who left is the privacy posture, applied to the database itself.
## v0.67.0 - The statistics page learns to compare

The explorer had the right machinery (shareable URLs, stackable filters, strict >=50
suppression) and the wrong output: a bare table. This release gives the whole page one
statistical grammar and the explorer real comparative power. The floor does not move: every
group below 50 is withheld exactly as before, and the differencing guard on filtered totals
stays.

- **Quantile strips** are the page's shared visual language now: every group and every
  category renders as a middle-50% band with a median tick on a SHARED axis, plus a dashed
  reference line - the population median, or the selected skill's population median when one
  is in focus. Above/below the commons is legible at a glance; the printed numbers (median,
  IQR, n) stay on every row, the strip adds comparability rather than replacing figures.
- **Drill-down**: clicking a group pins it as a filter and regroups by the next free
  dimension - "group by country -> click Croatia -> compare Croatian age bands" is now two
  clicks. The 'unknown' bucket is not clickable (it's the COALESCE bucket, not an attribute).
- **Sorting**: median / group size / A-Z, client-side, instant.
- **The overview got the same care**: the rating distribution gained a median marker, shaded
  middle-50%, axis ends, and hover counts; the category table became strips sorted by median,
  each linking to that faculty's explainer; suppressed categories show as "withheld", not
  omitted - a gap is information too. Server-side, the per-category query now also returns
  quartiles (suppression-gated identically to the median).
- New component: src/lib/components/QuantileStrip.svelte (aria-labelled per row, degrades to
  a "withheld" note below the floor).
## v0.66.4 - Contact goes through the feedback form

SECURITY.md and CODE_OF_CONDUCT.md no longer point at email addresses: both route through the
in-app feedback form (prefix `[security]` / `[conduct]`, include a way to be reached back).
The form is a private channel - it lands only on the maintainer's admin surface, which suits
vulnerability reports better than a mailbox that might be unattended. initsix.dev stays in the
README/footer as entity credit; it just isn't a support address.
## v0.66.3 - Open-source repo hygiene

Pre-push sweep of the whole tree; findings and fixes:

- **.gitignore corrected**: /capacitor-shell was ignored, but capacitor.config.ts points
  webDir at it and its two files (redirect stub, offline error page) are hand-written
  source - the OSS mobile build would have broken on a fresh clone. The shell is committed
  now; the actually-generated native projects (/android, /ios, .gradle) stay out. Added
  belt-and-suspenders patterns for signing material (*.keystore, *.jks, *.p12, *.pem,
  key.properties) and database dumps (*.dump, *.sql.gz, backups/) - user data and keys
  must never reach the repo in any form.
- **.env.example modernized**: documents ADMIN_TOTP_SECRET and EMAIL_INDEX_KEY (with the
  back-it-up warning and the one-time backfill step), and no longer describes the removed
  ?key= URL login.
- **Content sweep clean**: no secrets, tokens, hostnames, or personal data found in any
  committed file. One cosmetic fix: doc/test examples in the email-index module used a
  first name; now a neutral placeholder. The named alpha-tester credits in
  /contributions and the README are intentional and stay.
## v0.66.2 - The email fact, said out loud (and the ask, actually asked)

- **"We can't leak your email. We don't have it."** now on the landing page, in the practice-hub
  pool ask, and as a plain-language /privacy#email section (the "Learn how →" target). No
  jargon anywhere - the limits are stated in house style instead ("your results are connected
  to each other - just not to a readable you"), including the flip side: we can't email you
  unprompted, so incident notice happens on the site, not in your inbox.
- **The claim is truth-gated per deployment**: every one of these renders only when
  EMAIL_INDEX_KEY is actually set. A self-hosted instance without the key gets honest fallback
  copy instead of a borrowed promise.
- **The anonymous pool ask now always greets accountless users** on the practice hub - it was
  accidentally nested inside the profile-readiness condition, so anonymous users with a filled
  profile stopped being asked at all. Still dismissible per visit; still never nags a session
  twice.
## v0.66.1 - Rate-limit IPs no longer accumulate

magic_link_requests rows (rate-limit keys + IPs) were kept forever; they are worthless past
the 15-minute window and indefinite IP retention would undercut the privacy claims the blind
index makes possible. Pruned opportunistically on each link request (24h grace, no cron).
## v0.66.0 - Security release: admin TOTP, hashed tokens, the blind email index - and the hole the audit caught

A security review done the way the product talks about honesty: what was found is written
down, including the bad part.

**The bad part first.** (For the record: this was caught during pre-launch development and
never reached a public deployment - but the honest thing is to write it down anyway.) When
admin auth became DB-backed (async), ten call sites kept calling `isAdmin()` without `await`.
A Promise is always truthy - so every one of those checks would have passed for EVERYONE.
Would have been exploitable had it shipped: the anonymized research CSV at
/admin/export/data.csv was downloadable without auth, and the /admin/toggles and
/admin/challenges form actions (which layout redirects never protected) accepted writes -
anyone could flip app flags or edit challenge content. All ten are fixed, every admin load now
carries its OWN awaited guard (defense in depth: layout gates don't survive refactors and never
covered actions), and a static test (tests/admin-guards.test.mjs) pins the bug class: an
un-awaited isAdmin anywhere in src fails the build, as does an admin server file without its
own guard.

**Admin TOTP, completed.** The core shipped half-built (module + migration existed; the login
FORM did not - the route was a dead end). Now whole: /admin/login page (token + authenticator
code when ADMIN_TOTP_SECRET is set), /admin/logout (POST-only) with a nav button,
scripts/gen-totp-secret.mjs (prints the current code so you verify the authenticator pairing
BEFORE deploying), and tests/totp.test.mjs pinned to the official RFC 4226/6238 test vectors -
31 checks, so this implementation provably computes what every authenticator app computes.
Codes are single-use (last accepted time-step persisted - replay dead across restarts),
sessions single-active with 8h TTL, failures rate-limited per-IP and globally behind one
generic message.

**No bearer token is stored readable anymore.** auth_sessions.token and magic_links.token now
hold sha256(token); the raw value exists only in the cookie or the emailed link. Migration
0041 converts live rows IN PLACE (idempotent), so every active session and pending link
survives the deploy. A leaked database yields no usable sessions and no usable login links.

**The blind email index (EMAIL_INDEX_KEY).** The login email is no longer stored readable
anywhere: the DB keeps HMAC-SHA256(email, key) for login/uniqueness plus a masked hint
("b…@g….com") for display - the key lives only in the server env, so a DB dump alone cannot
be dictionary-matched offline (a plain unsalted hash would NOT achieve this; emails are
low-entropy). It fits this product exactly because login is magic-link-only: the user types
the address at every login, so the plaintext exists in memory at send time and is never
persisted - not even on the magic-link row. Legacy rows convert lazily at next login and in
bulk via scripts/backfill-email-hash.mjs; without the key, everything behaves exactly as
before (dev stays zero-config). Trade-offs stated plainly in SECURITY.md: the project cannot
email its users unprompted, and a forgotten address is re-verified by typing, never recovered.
The per-user export now truthfully notes that a readable address is not part of "everything".

**Also hardened while in there:** magic-link consumption is one atomic claim (racing requests
can never both succeed); the session rotates on the anonymous->registered upgrade
(fixation hygiene); DEV_EXPOSE_MAGIC_LINKS is hard-disabled when NODE_ENV=production
regardless of the flag (exposed links = login as anyone); account deletion now also removes
magic-link rows, which are keyed by email identity and were missed by the FK cascade; and the
README's admin instructions no longer describe the removed ?key= URL login.

Deploy: rebuild + migrations 0040-0042 run automatically. Then (1) generate and set
ADMIN_TOTP_SECRET, (2) set EMAIL_INDEX_KEY (>=32 chars, BACK IT UP - losing it means hashed
emails stop matching) and run scripts/backfill-email-hash.mjs once. Suite count: 17, all
green, including RFC-vector TOTP and the guard scanner.
## v0.65.0 - Semantic wordlists ship; the people behind the app get named

The feature the last two releases pointed at, plus the credits an app should carry before
strangers arrive.

**Categorized semantic wordlists (the WORDLISTS-PLAN.md build, done):**
- 40 repo-owned lists at challenge-bank/wordlists/<listKey>.en.txt, ~5,900 entries. Seeded from
  the UNION of every baked accept-list in the bank (so acceptance can only widen, never
  narrow), then extended generously toward what people actually type: colors 65->102,
  professions 79->167, food 177->281, birds 79->192, philosophers 119->253, and so on across
  all 40. Closed sets completed: all 118 elements verified present, all 88 modern
  constellations, countries extended to full UN coverage plus common short names (uk, usa,
  holland, czechia...).
- Loader (src/lib/server/text/wordlists.ts): lazy, cached per key, and FAIL-OPEN like the
  letter dictionary - a missing or unreadable file falls back to the item's baked accept-list.
  Plural variants are expanded at load time (+s/+es/y->ies, last token for multi-word entries),
  so "zebras" counts when the file says "zebra". Keys are pattern-gated so a listKey can never
  shape a filesystem path.
- Wired as a UNION with the baked accept-list in the submit path; the short/full matcher and
  typo tolerance operate on the widened set unchanged.
- scripts/verify-wordlists.mjs: every bank listKey has a file, every file is normalized
  (lowercase, deduped, no stray whitespace), every file is a superset of its baked list, and
  closed sets meet minimum cardinality. All 40 verified.
- tests/wordlists.test.mjs (18 checks): real repo loads, plural variants, fail-open, path
  safety, cache behavior. Suite count: 14.
- Honesty copy tells the new truth: the run-page note says category tasks are checked against
  curated topic wordlists with plural and near-miss tolerance, and the review label now says
  which validator actually applied - "dictionary-checked (EN)" for letter tasks,
  "topic wordlist (EN)" for semantic ones (it previously claimed dictionary for both).

**Credits and provenance:**
- Alpha-phase testers named on /contributions (the empty-state page finally has people):
  Matea Berišić (the finds behind v0.64.24) and Vladimir Anić (early-build testing).
  Also in the README acknowledgments.
- initsix.dev named as the entity behind the app: footer ("Built by initsix.dev"), /about,
  README acknowledgments, and package.json author. LICENSE already carried it.

Deploy: one rebuild (the wordlists ride in the existing challenge-bank COPY). No migration,
no re-seed. All 14 test suites green; wordlist verification green; schema and undeclared-scan
audits clean.
## v0.64.29 - Audit round two: the export's missing tables, the scanner that was promised, the orphaned about pages

The 0.64.28 audit verified columns; this one verified TABLES and promises. Findings, all fixed:

- **The export was not "everything"**: `user_spelling` (the spelling-accuracy trait) and circle
  memberships (the display name and sharing choices the user set) were absent entirely. Also
  missing: `birth_year` from attributes (the user TYPED it; age_band alone was exported),
  `disabled_categories`/`reduced_categories`/`session_length`/`public_badge` from settings,
  `skipped_categories`/`modules_used`/`module_handoffs` from sessions ("a refusal is also a
  measurement" - then it's also the user's data), and the rt band + version stamps
  (`rt_fast_ms`, `rt_slow_ms`, `challenge_version`, `scoring_model_version`,
  `methodology_version`) from attempts. Every added column re-verified against the migrations
  (the 0.64.28 bug class); destructure arity matches query count (17 = 17). Circles the user
  created are exported too; other members' data never is.
- **The v0.64.26 changelog claimed a permanent undeclared-assignment check "runs clean across
  the whole repo" - no such check existed in the repo.** It does now:
  `tests/svelte-undeclared.test.mjs`, strings/comments stripped, aware of multi-declarations,
  TS type aliases, $:, params, destructuring and catch. It carries a self-test that must catch
  the exact v0.64.26 failure shape (assignment surviving a deleted declaration), so the scanner
  itself is pinned. Repo scan: 51 .svelte files, clean.
- **The /about/<slug> faculty explainers were orphaned** - the route existed, the docs
  advertised it, and not one link in the app pointed there (crawlers and people alike could
  only guess the URLs). Fixed twice over: the sitemap now lists every active faculty page
  (DB-driven, so a new category joins automatically; fail-open to the static list) plus
  /contribute, and /about gained a faculties index linking each explainer.
- **Strategic Planning's about page showed the raw slug as its domain** - the page kept a local
  copy of DOMAIN_LABELS that went stale when the 17th category landed. The local copy is gone;
  the label now resolves server-side from the one canonical map, so this drift class is closed
  for that page.
- **WORDLISTS-PLAN.md existed only in the changelog** - v0.64.28 and ROADMAP.md both cite it as
  "the spec"; the file was never committed. Written now, grounded in the actual mechanism
  (RETRIEVAL_LISTS in generate-bank.mjs, 40 listKeys inventoried, fail-open loader posture).
- **Docs told last month's story**: DOCUMENTATION.md said 16 categories / 9 domains /
  migrations 0001-0011; README said ~2,681 challenges across 16/9. Reality, now on the page:
  17 categories, 11 domains, 3,094 seeded challenges + 110 retention cards, migrations
  0001-0039, and the fluency sections say what v0.64.27 made true.

No migration, no re-seed. One rebuild. All 13 test suites green (12 prior + the new scanner).
## v0.64.28 - Changelog audit: export 500 caught before HN could; wordlists to roadmap

Every 0.64.x changelog claim was re-verified against the current tree, hunting for promises
that quietly broke. One real defect found and fixed:
- **The data export would 500 for any user with retention history**: the v0.64.14 expansion
  selected user_card_state.updated_at - a column that does not exist (the real one is
  last_seen_at). "Download everything Excogni holds about you" is a headline claim; it would
  have failed on first click mid-launch. Fixed and column-audited: every column referenced by
  every export query now verified to exist in the schema (all other tables clean).

Verified intact, on the record: sitemap pages all resolve; the dictionary gate is wired; the
badge settings anchor, circles use:enhance (5 forms), skip chips (both phases), HTML no-cache,
security headers, and the skip endpoint's ensureSession call are all as the changelog claims.

Roadmap: categorized semantic wordlists added as the next work item (spec in
WORDLISTS-PLAN.md) - letter fluency has its dictionary; semantic fluency's hand lists are the
remaining source of real-words-rejected complaints.
## v0.64.27 - Letter fluency graduates to dictionary-checked ("shuguosuo" dies)

Tester-found (with a grin): "shuguosuo" passed "words starting with SH". Correct behaviour of
the structural heuristics - it has vowels and doesn't stutter - and exactly their stated limit:
only a dictionary can tell an invented plausible word from a real rare one. So:
- New dependency `word-list` (~275k inflected English words, SCOWL-derived, MIT): loaded lazily
  ONCE server-side into a Set. Letter-fluency answers must now match the constraint AND exist
  in the dictionary (the item's own accept-list always counts too).
- Deliberately fail-open: if the package is unavailable (tests without node_modules, a broken
  install), validation falls back to the structural heuristics - a worse validator beats a dead
  practice page. The test suites run in exactly that fallback mode and stay green, which proves
  the degradation path works.
- Honesty copy updated to the new truth: "checked against an English dictionary (~275k words) -
  very rare words and proper nouns may not count." Review label: "dictionary-checked (EN)".
- Croatian wordlists remain a roadmap item; the note says EN plainly.

Deploy: the rebuild's npm install fetches the dependency automatically. No migration, no re-seed.
## v0.64.26 - THE SPINNER FIX: practice boots again (undeclared variable killed hydration)

Root cause of the stuck loading wheel on every practice start (live since the v0.64.24 deploy),
found via the browser console: v0.64.22 replaced the old exclude-category helper - deleting its
variable DECLARATIONS - but one assignment to the deleted `excludedJustNow` survived at the top
of fetchNext. Strict-mode ESM throws ReferenceError on assignment to an undeclared variable, so
fetchNext died on its first line, before its try/catch: the page painted, hydration crashed,
the fetch never fired, the spinner never ended. Server was healthy the whole time (the API
answered curl perfectly) - the bug lived entirely in the client bundle.

- The stale assignment is removed (zero references remain).
- NEW permanent verification check (this failure class will not ship again): every .svelte
  script is scanned for assignments to identifiers that are never declared - aware of Svelte
  reactive declarations ($:), destructuring, imports and params, with strings and comments
  stripped. Runs clean across the whole repo.
- v0.64.25's defenses ship with this (HTML no-cache, 15s fetch abort -> visible error + retry,
  Health panel >=500 only) - with the abort in place, even a bug of this class would now surface
  as an error screen instead of an eternal spinner.

Deploy this INSTEAD of v0.64.25 (it contains it). One rebuild; migrations already applied on
live; no re-seed.
## v0.64.25 - The eternal spinner made impossible; Health panel hears signal again

Post-deploy field report: practice stuck on the loading wheel. The run page's fetch handles
failures correctly (error phase + message), so an ETERNAL spinner means the fetch never fired -
the classic stale-bundle failure: cached HTML references immutable hashed JS chunks that the
new deploy deleted, the page paints its SSR shell and never hydrates. Three defenses, each
correct regardless of any single incident:
- **HTML is never cacheable** (Cache-Control: no-cache, must-revalidate on text/html): browsers
  and CDNs must revalidate documents on every load, so a new deploy can never strand a client
  on HTML that points at deleted chunks. Hashed assets under /_app/immutable stay long-cached.
- **The next-challenge fetch aborts after 15s**: any future hang becomes the visible error UI
  with retry, never a spinner that outlives patience.
- **Health panel persists only real server errors (>=500)**: scanner bots probing /info.php,
  /@vite/env, /.vscode/sftp.json and friends had flooded it with 404 noise, drowning the one
  signal it exists for. 404s still reach the structured log; the panel hears signal again.

OPS with this deploy: purge the Cloudflare cache once (Dashboard -> Caching -> Purge
Everything) and hard-refresh any stuck phone (or one incognito visit) - after that, this
failure class is structurally gone.
## v0.64.24 - Matea's list: fluency honesty, circles form no longer wipes, mobile fit, Austen pinned

- **Letter-fluency gibberish** ("hshshsher", "nznznzer" sailed through on the suffix alone):
  rule-based fluency now requires structural sanity - a vowel, and no character or bigram
  stuttered 3+ times in a row. Heuristics can't catch every invention (nothing short of full
  dictionaries can), so the input now carries the honesty note in plain words: letter tasks are
  pattern-checked and honesty-scored; category tasks check an English wordlist (which also
  explains why real Croatian words don't count there - the wordlists are EN; HR lists are a
  roadmap item). The review page's "open - any valid words" label now says what's true:
  "pattern-checked, honesty-scored".
- **Circles: an unticked box no longer erases the whole form** - the forms now submit via
  use:enhance, so a failed action keeps every field as typed instead of a full-page reload
  wiping them.
- **Mobile fit** (both tester-found): the fluency input placeholder no longer truncates
  ("words · comma or Enter"), and page content now clears the floating feedback button
  (bottom padding on mobile) instead of being covered by it.
- **"Jane Austen" vs "austen"**: the current matcher already accepts full-name-for-surname in
  both directions (verified directly); the failure was on live v0.64.11, which predates the
  matcher in this build. Pinned as a named regression test so it can never quietly return.
- Her /stats 500 screenshot is the known v0.64.11 userId bug, fixed since v0.64.12 - this
  deploy erases it.
## v0.64.23 - The mix leans toward weakness; "show less often"; the avoidance insight earns its recommendation

Pondered (maintainer's framing: "weakest in math in the morning, evading it - double down") and
built the version the data can honestly carry:

- **Weakness-weighted picking** (the answer to "do we serve weak categories more on filled-up
  users?" - we didn't; after calibration it was plain round-robin): calibrated users now get a
  weighted mix - categories rated below their own average appear up to ~2x as often (capped:
  a mix should still feel mixed), "show less often" categories at ~0.35x, and a session-balance
  decay keeps within-session variety.
- **"Show less often"** - the missing middle scope between skip-today and never (migration
  0039): a third button in both in-run rows; persistent ~35% frequency; restorable in a new
  Settings section listing reduced categories.
- **The avoidance insight now conjoins skips with the user's own ratings** - and only claims
  what the data carries. Skipping your WEAKEST domain earns the plain recommendation:
  "avoidance and weakness pointing at the same spot - double down; put it first while you're
  fresh; that's where the next points live." Skipping a STRONG domain reads as boredom and
  points at "show less often" instead. Daypart appears only as the observed concentration of
  the skips themselves - never as a performance-by-hour claim, whose cells are too thin to
  assert ("weakest in the morning" would be exactly the false confidence this product refuses).
  "Evading" as motive-attribution stays out; patterns, not psychoanalysis.

Migration 0039 adds user_settings.reduced_categories. No re-seed.
## v0.64.22 - "Not this category": session skips, prominent controls in both phases, and avoidance as a signal

A refusal is also a measurement. New in the mixed session (migration 0038):
- **Skip {category} this session** - a mood, not a preference: mutes the category for the
  session's remainder (the generator subtracts it; if everything gets skipped, it falls back to
  the full enabled set rather than stalling). Skipping AT the question closes the pending
  attempt as status='skipped', which keeps its local-time context.
- **Don't show again** (the existing permanent exclude, now with a confirm) - same
  enabled-categories preference as the Practice-page toggles.
- Both controls are now visible BOTH at question time and after the answer, as bordered
  buttons instead of the old single quiet checkbox that existed only in the feedback phase.
- **Avoidance insight**: 3+ skips of a category, with 60%+ concentrated in one part of the
  day, yields an honest pattern note ("You tend to skip numerical fluency in the morning - 4 of
  5 skips. A pattern, not a verdict."). Spread-out skips instead suggest the permanent toggle.
  Named as patterns, never as judgments.

Migration 0038 adds practice_sessions.skipped_categories. No re-seed.
## v0.64.21 - Badge: a presentable page for humans, and an honest line instead of silence

Tester screenshot findings, both real:
- Opening the badge URL directly showed a tiny SVG in the corner of a white page (default
  browser rendering of a bare SVG). The endpoint now content-negotiates: an <img> embed still
  receives the raw SVG; a person navigating (Accept: text/html) receives a small dark page with
  the badge centered, the copy-paste embed snippet, and a link home. Same URL, both audiences.
- The percentile was missing without explanation. It was withheld BY DESIGN (a public,
  shareable artifact never carries simulated percentiles; the real pool must have 5+ qualified
  users) - but silence read as breakage. The badge now states its honest state with progress:
  "percentile calibrating · pool N/5", or "rating calibrating · N/4 domains rated" before the
  rating exists at all. The design was right; now it explains itself.
## v0.64.20 - Reaction module: a false start during trials no longer strands the user

Tester-found (in the in-session reaction step): clicking before the green cue showed the
"too soon" text and then nothing - the trial never resumed, leaving only the return-to-session
button. Root cause: the false-start recovery hardcoded the CALIBRATION path. Two failure modes
from one line: a freshly-calibrated user (calibration samples full) stalled forever at the red
text, and a previously-calibrated user was silently rerouted into re-calibration instead of
resuming trials. The recovery now resumes exactly the phase the false start interrupted -
trial resumes trials, calibration resumes calibration - after the same brief 900ms scold.
## v0.64.19 - The pool ask, at the start of every anonymous run

Launch-critical (maintainer's call, and correct): a traffic wave of anonymous runs feeds the
pool nothing, and the pool is the one resource the product cannot build alone. At the start of
an anonymous practice visit, a banner now states the trade-off and makes the ask plainly:
anonymous results stay yours alone and never join the pool; the pool is what makes percentiles
real; the single biggest help is registering (an email, nothing more - it exists to make fake
data harder, never to identify you) and ticking the research consent. Dismissible per visit
(sessionStorage), so it asks again next visit but never nags within one. Registered users never
see it.
## v0.64.18 - App reminders shown only inside the app

Tester question with a correct premise: why do notification settings mention Android in the web
app? The preferences are server-stored so web and app agree, but a BROWSER cannot fire local
notifications - a visible toggle that can never act is a silent broken promise. The "App
reminders" section is now gated behind the native-shell check (isNative): visible inside the
Android app where it works, absent in every browser. Copy no longer needs to say "in the
Android app" - inside the app, that's simply where you are.
## v0.64.17 - Android native half, blind-built as an overlay

The Capacitor shell's native side, built to drop onto a generated android/ project
(excogni-android-overlay.zip, with INSTALL.md):
- Full AndroidManifest.xml: App Links (autoVerify) for https://xcgni.com so tapped magic links
  open inside the app; POST_NOTIFICATIONS; FileProvider; singleTask launch.
- MainActivity.java (dev.initsix.excogni), complete resource set: launcher icons at every
  density generated from the real icon-512 (round + adaptive v26 included), a status-bar-rule
  white-silhouette notification icon (ic_stat_icon), dark splash for pre-12 AND Android 12+.
- make-variant.mjs now writes the LocalNotifications plugin config (smallIcon ic_stat_icon,
  iconColor #E2A33B) into capacitor.config.ts, so regeneration wires the icon at the source.
Blind-built (no device/AS here): INSTALL.md lists the known blind spots to check first.
## v0.64.16 - Senior audit pass: security headers, tz-hardened notifications, badge consistency

A full pre-launch code audit (security surfaces first, recent fast-written paths second).

Fixed:
- **Security headers on every response** (there were none): X-Content-Type-Options nosniff,
  X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, and a minimal
  Permissions-Policy. A strict CSP is deliberately DEFERRED to post-launch (recorded in the
  roadmap): adding one untested the day before a wave risks breaking hydration; these four are
  safe and cost nothing.
- **GET /api/notify/plan could 500 on a garbage timezone:** the tz is client-supplied (stored
  from the browser) and an invalid IANA name makes Postgres throw. The conditional block is now
  defensive - any failure degrades to "reminder only, no conditionals", never a broken endpoint.
- **Badge owner lookup excludes test accounts**, consistent with every other pool rule.

Audited and found GOOD (no change needed, stated for the record):
- Session cookies: httpOnly, sameSite lax, secure in production, scoped, bounded age.
- Admin gate: timing-safe comparison (crypto.timingSafeEqual), the cookie stores a HASH of the
  token (never the token), /admin-scoped, 8-hour TTL. Better than the auditor assumed.
- Error handling: every unhandled server error is persisted to the Health panel and the client
  receives a generic message - never a stack trace.
- All SQL goes through parameterized tagged templates; form actions ride SvelteKit's built-in
  origin checks; the statistics page carries no residue from the you-marker removal.
## v0.64.15 - Exported image: the REAL overlap culprit removed; the badge lives at the share moment

- The exported radar's true overlap source found: a centered "methodology m1" stamp was drawn at
  the same baseline as the footer row - predating the provenance line and colliding with it once
  that line grew. The centered stamp is removed; the bottom-left line (date · methodology · vs N
  rated users) carries the citation alone. One methodology mention, zero overlap.
- The badge option now lives where pride happens, not buried in Settings: next to "Save as
  image", a registered user without the badge sees "enable a live badge ->" (deep link to the
  Settings toggle), and a user WITH it sees their live badge URL right there, ready to copy.
  The Settings section keeps the full control and embed snippet (anchored, so the link lands on
  it exactly).
## v0.64.14 - Export made truthful again; PNG footer fixed; opt-in embeddable badge

Data export, audited against the "everything Excogni holds about you" promise - and it had
quietly fallen behind the schema:
- SIX user-data tables were missing: retention card state (per-card ease/interval/due), reaction
  calibration, category baselines, reaction runs, day notes, and the feedback you sent. All
  included now.
- The attempts export gains the Phase A micro-signal columns (first_input_ms, edits_count,
  first_answer_changed, word_times) and the settings export gains reminders, preferred decks and
  the badge flag.
- export_meta now states the one deliberate exclusion in writing: auth-session and magic-link
  tokens (credentials, not data about you).

Exported radar PNG: the provenance line and the date were two separate draws two pixels apart in
the lower-left corner - overlapping text. Merged into one line: date · methodology · vs N rated
users.

Embeddable badge (opt-in, migration 0037):
- /badge/<username>.svg renders a compact instrument-styled badge: global rating, percentile with
  pool size, methodology stamp. Cached one hour.
- STRICTLY OPT-IN (Settings -> "Public badge", default off): the badge makes exactly two numbers
  publicly reachable by username; the user must choose that. 404 for everyone who has not.
- When enabled, Settings shows the copy-paste embed snippet.

Migration 0037 adds user_settings.public_badge. No re-seed.
## v0.64.13 - Global stats is purely the population: the "you" marker removed

The aggregate page promised "no individual is ever shown" and then marked the viewer on the
rating distribution. Removed: the distribution is now purely the population, with a one-line
pointer to Your stats, where the same placement lives with its full context (pool size, SEM,
percentile wording) - the same thing, prettier, and in the right home. The server no longer
computes the viewer's rating for this page at all.
## v0.64.12 - Hotfix: /stats 500 for registered users (undefined userId in the reviews query)

The retention-reviews query added in v0.64.11 referenced `userId` where that load function uses
`locals.user.id` - a 500 on /stats for every registered user. Fixed. Root cause of the miss:
the verification suite's syntax check cannot see undefined identifiers; a new check now scans
every template literal for identifiers never declared in their file, so this failure class is
caught before packaging from now on.
## v0.64.11 - Generated names explained at first sight; retention reviews visible on Stats

- The generated username is now explained AT THE POINT OF SURPRISE: hovering the name in the
  header says why it exists ("so no page ever shows your email as identity - Settings has the
  details"), and the privacy page's account section mentions the generated username alongside
  the email. Settings already carried the full explanation.
- Stats gains a "Retention reviews" panel: due now, due in 24h, retained (held >= 7 days), and
  cards seen - the review schedule was invisible outside sessions. The copy keeps the philosophy
  straight: reviews come to you inside sessions when due; this is the schedule's honest state,
  not a to-do list (no guilt mechanics).
## v0.64.10 - Search visibility: the site stops asking to be invisible

Root cause of the brand-query problem (a similarly-named site outranking xcgni.com on
DuckDuckGo): robots.txt still carried the alpha-days `Disallow: /` - the site was literally
asking every search engine not to index it. Launch posture now:
- robots.txt allows indexing (auth/admin/api stay excluded) and points to the sitemap.
- /sitemap.xml lists the public pages (landing, about, methodology, statistics, support,
  contributions, privacy).
- The layout now carries the crawler-facing identity every page lacked: meta description,
  canonical URLs on xcgni.com, OpenGraph tags (the og-image.png that existed unused in static
  is finally referenced), and a Twitter card.

MAINTAINER OPS (the half only you can do): after deploying, submit https://xcgni.com/sitemap.xml
to Bing Webmaster Tools (Bing powers DuckDuckGo - this is the lever for that specific result)
and Google Search Console, and request indexing of the landing page. Keep the excogni.com 301.
Expect days-to-weeks for brand queries to settle; the HN wave's backlinks will accelerate it
more than anything else.
## v0.64.9 - Full usernames visible; footer dedup; the anonymous choice states its trade-off

- Generated usernames render in FULL in the header (the truncation to 10 characters plus
  ellipsis defeated the point of having an identity).
- Footer: "Methodology & formulas" removed - it lives under Learn more (the About page's
  buttons) and is linked from every radar caption; the footer no longer duplicates it.
- The landing's "Proceed without account" moment now states the trade-off at the exact point of
  choice: anonymous practice stays entirely yours and never joins the population statistics;
  registering (an email, nothing more) is what makes results count - and the email exists to
  make fake data harder, not to identify you.
- Considered again and kept: Stats stays top-level, not under an account menu. It is opened
  after nearly every session (the practice -> see-what-it-did loop); account menus are for
  things touched monthly. The measurement product does not hide its measurements.
## v0.64.8 - Generated usernames: identity without exposing the email

Every registered account now carries a generated, reddit-style username (quiet-falcon-42,
steady-quartz-17: curated adjective + noun wordlists in the instrument's own register, ~144k
combinations, collision-retried against the unique constraint). Assigned lazily and exactly
once at resolve time, which transparently covers every account that registered before usernames
existed - no migration, no backfill script.

Why: the header and settings were username-first with an email FALLBACK, and since usernames
were never generated, the fallback always showed the email. Now no surface ever has to display
an email as identity. Settings still shows the login email (privately, clearly labelled - users
must know which address is attached) with a one-line explanation of why the username exists.

Also considered and deliberately rejected: moving "Stats" under an account menu. Practice and
Stats are the product's two verbs (train, and see the truth about yourself); Stats is the payoff
of everything measured, not account plumbing, and stays top-level.
## v0.64.7 - Admin instrumentation panel; verify-deletion cleans its own artifacts

The "verify-cascade" feedback mystery, solved: feedback.user_id is SET NULL on account deletion
BY DESIGN (the message outlives the account, the identity link is severed) - so the deletion-
verification script's planted feedback row passes the per-user check and then lingers as an
orphan in the admin feedback list, one more per run. The script now removes its own artifacts
by content (message = 'verify-cascade' AND user_id IS NULL - never anyone's real feedback) and
logs the SET NULL semantics so the design decision is visible in the output.
One-time prod cleanup for the artifact(s) already there:
  docker compose exec db psql -U excogni -c "DELETE FROM feedback WHERE message = 'verify-cascade' AND user_id IS NULL;"

Admin, brought up to the instrument's own standard:
- New "Instrumentation" panel on the overview: baseline coverage (rows + users), micro-signal
  fill rate over the last 7 days (% of answered attempts carrying first-input), fluency
  word-timed attempts, reaction runs kept, and opt-in adoption (reminders, conditionals, deck
  preferences). The operator can now SEE whether every new measurement layer is actually
  filling - a capture path that silently stops is worse than one that never existed.
- Deliberately NOT added: any mutation controls. The admin's "read-only, aggregates only" banner
  is a promise, and it holds.
## v0.64.6 - Ambient sound rebuilt: a living pad instead of a held organ note

The optional focus sound was four unfiltered oscillators holding a fixed chord - a static drone
that turns fatiguing within a minute, with buzzy triangle harmonics on laptop speakers, and a
leftover debug readout visible in the UI. Rebuilt as a proper generative pad (still zero assets,
all synthesized in-browser):
- a warm detuned A-chord (A2/A3/E4/A4) through a gentle LOWPASS, so cheap speakers get warmth
  instead of buzz;
- a slow breath LFO (~0.07 Hz) swells the pad like breathing, and a second, slower LFO drifts
  the filter cutoff so the timbre never sits still;
- a whisper of low-passed noise underneath - the distant-air layer that makes synthetic pads
  read as organic;
- longer fade-in (2.5s) to a calmer level (a focus pad should be felt, not noticed), graceful
  0.8s fade-out, full node cleanup on stop;
- the debug readout is gone from the UI.
Still honest by design: comfort audio, not a cognition claim; default OFF; persists nothing.
NOTE: parameters are chosen by synthesis craft and verified structurally - ears are the final
test, and the maintainer's listen decides if levels need a nudge.
## v0.64.5 - IA sweep: formulas published and versioned, radar carries its pool size, cleaner footer and settings

- **Methodology now hosts the actual formulas, versioned (m1):** speed classes, the attempt score
  (clamp(1.06 − 0.31·r, 0.45, 1.0)), the planning-tasks quality rule, the difficulty ladder, the
  stable-level rule, the rating formula (700 + 52·stable + 380·(acc − 0.6) + 260·(speed − 0.7),
  clamped [600, 1900]), SEM (±400/√(attempts+3)) with confidence tiers, and the percentile rule.
  Stated plainly that any change mints a new version and the AGPL repository is the canonical
  source: what you read is what runs.
- **The radar states its evidence:** the profile caption and the exported PNG both now carry
  "methodology m1 · percentiles vs N rated users" - a percentile without its pool size is a
  half-truth, especially in a screenshot travelling without context.
- **About links to Methodology & formulas** (the Learn more path now reaches the formulas).
- **Footer cleanup:** Welcome removed (the wordmark is the way home), "Statistics" renamed
  "Global stats" so the footer (global) and header "Stats" (personal) stop shadowing each other.
- **Settings:** the duplicated "Your data" section removed (registered users saw the export block
  twice). The delete-account copy now says precisely and gracefully what deletion means: your
  personal data and every link between you and your records go (verified cascade); what stays is
  only what was never yours alone - contributions already blended into anonymous aggregates,
  which cannot lead back to you.
## v0.64.4 - Support page: real donation rails, no company needed, said honestly

- The placeholder "coming soon" buttons are replaced with real individual donation rails:
  GitHub Sponsors and Liberapay - both pay individuals, so no legal entity is required.
- Donations-only by design: the page now states plainly that contributions buy nothing, unlock
  nothing, and are not purchases; that Excogni is currently one person's project, not a company;
  and that if support grows into real sustained costs, a proper entity follows - announced in
  this changelog like everything else. "Monthly membership" wording removed (membership implies
  a purchase; donations do not).
- NOTE for the maintainer: the GitHub Sponsors and Liberapay profiles must exist before deploying
  this page (create both under the initsixdev handle, or adjust the URLs).
## v0.64.3 - Definitions on every missed synonym/antonym; anonymity and the pool, said honestly

Vocabulary lessons, completed:
- A missed synonym, antonym or analogy already showed short definitions of the prompt word and
  the correct answer (the code was built and rendering) - but 41 of the 85 words those items use
  had no dictionary entry, so many misses taught nothing. The dictionary now covers every word
  in the bank (coverage check: 0 missing). No code change needed; the gap was data.

Anonymity and the population pool, explained where it matters (tester finding: people practised
anonymously believing they were contributing):
- Stats (anonymous banner) now states it plainly: anonymous results stay yours alone and do NOT
  join the pool or percentiles; registering is what makes data count; the email exists to make
  fake and duplicate data harder, never to identify you - aggregates carry no identity.
- The welcome research-consent checkbox carries the same sentence, so consent is informed at the
  moment it is given.
- The privacy page's "what it's used for" section explains the same email rationale.
## v0.64.2 - Tester feedback: tooltips dismiss on any click; global stats links back to yours

- The ⓘ explanations now close on a click anywhere (or Escape), not only on the same ⓘ - an open
  tooltip should never need hunting to close. Clicking the tooltip text itself still keeps it
  open for reading.
- The public statistics page ("The aggregate picture") now carries a "← Your stats" link back to
  the personal view.
## v0.64.1 - Pre-launch: privacy page and high-resolution disclosure

Launch-readiness audit fixes (the things that must be true BEFORE the first wave of public users,
so the ground never moves beneath the dataset or the people in it):
- **/privacy page** (footer-linked): what is collected (including the high-resolution task
  measurements), what it powers, what is never done (no ads, no sale, no trackers, no
  identification from timing), deletion with a verified cascade, contact. Changes to the page
  announce themselves in this changelog.
- **Methodology discloses the micro-measurements**: time to first input, edit counts, per-word
  fluency timing, per-trial reaction series - and states the standing decision in writing:
  timing precise enough to fingerprint a person is a capability we acknowledge and deliberately
  do not build.
Audit results that needed no change: simulated users are hard-off in the production compose (the
population pools cannot be polluted), magic-link requests are rate-limited per email and per IP,
the admin panel is token-gated, and users carry created_at so the pre/post-launch cohorts stay
distinguishable forever.
## v0.64.0 - Onboarding asks what to memorize; getting-to-know-you after first login; tags that make sense

Preferred retention decks (maintainer request):
- The welcome step now asks "What would you like to memorize?" with the deck list as tap-chips.
  Empty selection = all decks, never a dead end. Stored in user_settings.preferred_decks
  (migration 0036), editable any time in Settings (new "Retention decks" section).
- The preference is honored EVERYWHERE retention serves cards without an explicit choice,
  including every in-mix hand-off. The dedicated screen's deck picker still overrides per visit.

Getting to know you, as the first step after login:
- A first login whose account has never answered the about-you step now lands on /welcome instead
  of practice. Completed profiles never see the detour; explicitly requested redirects (deep
  links) still win.

Tags, made to make sense:
- QUICK ROW: your own recently-used tags (private, on-device memory), falling back to eight
  sensible defaults - one tap for the common case. The full grouped taxonomy now sits behind a
  single "more…" toggle instead of a wall of group expanders.
- WHY WE ASK, said out loud: the questionnaire now opens with one honest line: "your answers
  power your own insights - comparing your days with and without each factor. Private to you,
  never shared, and everything is optional." A form that asks about your body without saying why
  is exactly what this product claims not to be.

Migration 0036 adds user_settings.preferred_decks. No re-seed needed.
## v0.63.1 - Repo scrubbed for open source: private names and internal references removed

In preparation for open-sourcing, the repository was audited for content that should not ship in
a public release. Removed or neutralised: a private tester's name (everywhere: plans, roadmap,
changelog history), personal attributions in internal documents (now "the maintainer"; the
README's public signature is intentionally kept), a real email address in a test fixture (now a
neutral example), and references to a private strategy document. Verified: no employer, business
or launch strategy was ever committed to the repo; those live outside it, which is now the
standing rule: strategic and personal notes never enter the repository.
## v0.63.0 - Micro-signals, Phase A: hesitation, edit traces, per-word fluency timing, reaction series

The "sure wins" of the data-resolution plan, captured from this version on (gray and medical
territory deliberately left out; certainty rule recorded: behavioral claims ship with stated
certainty, inferred special-category traits stay out regardless of labeling).

- **Hesitation (first_input_ms):** ms from answering-start to the FIRST input of any kind (key or
  pointer), reset per challenge, measured from when answering becomes possible (memory items
  measure from after memorisation, not from display).
- **Edit trace (edits_count):** deletions while answering. first_answer_changed exists in the
  schema but ships NULL, honestly: choice items submit on first tap (no re-pick step exists) and
  fluency chips are not removable, so the signal has nothing real to measure yet.
- **Per-word fluency timestamps (word_times):** one timestamp per committed word. This is the raw
  material for CLUSTERING and SWITCHING analysis (bursts of related words, gaps between bursts),
  a genuine neuropsych measure no consumer product surfaces.
- **Reaction series (reaction_runs table):** the client always sent the full per-trial series;
  the server now keeps it (with floor + band), enabling variance and fatigue-slope insights.
- All server-side validation is defensive: ints only, non-negative, word_times capped at 200
  entries, series capped at 20 trials.

These are capture-only changes: no new UI, no behavior change for users. The derived insights
(gut-knows-before-you-do, first-instinct accuracy, clustering profile, warm-up trial) are Phase B,
built once real data has accumulated.

Migration 0035 adds the attempt columns and the reaction_runs table. No re-seed needed.
## v0.62.2 - Home goes to Welcome for signed-in users; About optimized, not just grown

- **The EXCOGNI wordmark now takes a signed-in user to /welcome** (anonymous visitors still get
  the landing). Previously / redirected signed-in users straight to practice, which made the
  welcome page unreachable from the home button.
- **About page optimized after the values addition, per the "do not just add" rule:** the
  "Why we're honest about the limits" section was fully redundant with the new values (same
  honesty stance said twice) - its one unique sentence ("if a measurement can't be made honestly,
  we say so instead of inventing a figure") folded into the values, section dropped. The values'
  data clause now hands off to the existing "How we treat your data" section instead of repeating
  it. Net: About is SHORTER than before the values landed (458 words vs 497), with more said.
- **Welcome page reviewed and deliberately left alone:** four intro steps of ~40 honest words
  each is tight already; cutting would hurt. The landing (~270 words) is fine too.
## v0.62.1 - The values, stated: what Excogni stands for

The product's core values were enacted everywhere (SEM bands, correlational wording, opt-in
notifications, verified deletion) but stated nowhere in one place. Now they are:
- **About page, "What we stand for":** three aims (staying sharp; insight in the broad sense, not
  just numbers; self-knowledge) and one way of working (respect: transparent methods, honest
  numbers, no dark patterns, data dignity).
- **PRINCIPLES.md (internal canon):** the same values as the source every future copy, feature and
  design decision derives from, ending with the shipping test: does this respect the person, and
  does it serve sharpness, insight or self-knowledge? If it only serves engagement, it does not
  ship.
## v0.62.0 - Module cadence capped per session; category descriptions in plain language

Retention cadence (answering the maintainer's cadence question, and fixing what the
audit of that question found):
- FOUND: the only spacing between module bursts was a 90-second gap, so a long session could
  hand off to retention a second (or third) time while the user was still uncalibrated with
  unseen cards, which read as nagging.
- FIXED: each module now fires at most ONCE per session (checked against the session's
  modules_used record). Combined with the existing gates, the cadence is: never in a session's
  first two challenges, at most one retention burst and one reaction run per session, retention
  only when cards are due or a first learning pass is still needed, reaction only when
  uncalibrated or stale. Due-driven frequency decays naturally with SM-2: near-daily while
  learning, then increasingly rare as intervals grow.

Category clarity (do common users understand the categories?):
- All 17 category descriptions rewritten PLAIN-FIRST: an everyday anchor before the task
  mechanic. "Inhibition: Not blurting the automatic answer. Tasks: name the ink colour, not the
  word it spells." "Working Memory: Holding a few things in mind while you use them, like a
  phone number while dialing." Shown on the practice cards and the about pages.
- RE-SEED REQUIRED to apply the new descriptions (categories upsert on slug):
  `docker compose exec app node scripts/seed.mjs`
## v0.61.0 - Two ratings: baseline vs now, and the improvement distribution

Maintainer's idea, built: the single "all users" percentile mixed novices with practised users, so
position confounded ability with practice time. Now there are two honest comparisons plus what
falls out of their difference:

- **Baselines (migration 0034, user_category_baseline):** the rating at the moment a category
  first calibrated (10th attempt; retention: 3rd due review), frozen forever. Write-once by
  construction (ON CONFLICT DO NOTHING); nothing ever rewrites history. Captured live by hooks in
  all three rating paths (bank attempts, retention grading, reaction trials).
- **Backfill for everyone already active:** scripts/backfill-baselines.mjs reconstructs baselines
  exactly for bank categories (the rating_after of the 10th answered attempt - attempts are the
  ground truth) and approximately for retention/reaction (earliest rating_history entry, flagged
  with attempts_count = -1). Idempotent; run once after deploy:
  `docker compose exec app node scripts/backfill-baselines.mjs`
- **Baseline percentile ("first-test spread"):** your first calibrated global rating against
  everyone else's FIRST - test-naive against test-naive, the way real norming samples work. Same
  eligibility rules and pool gates as the current percentile.
- **Improvement:** your current global minus your baseline, shown next to the pool's median
  improvement over users who have both (gated: no median shown under N=5, a median of three
  people is noise). This is also the seed of the group-improvement view (roadmap: cohort-matched
  comparison and an admin group curve, because raw improvement grows with time practised).
- **Honesty note, in the UI itself:** improvement on these tasks includes task familiarity, not
  only cognitive change. The tooltip says so.

Stats hero now reads, under the percentile: "starting point: 58th of first-test spread · since
calibration: +112 (typical: +64, N=41)".

Migration 0034 adds user_category_baseline. Run the backfill script once after deploying.
## v0.60.0 - Android Phase 1, server/web half: notifications, back button, App Links, offline page

The Android app's reason to exist beyond the browser, built where it lives: on the server. The app
remains a shell around the SAME backend and database; login stays magic-link email (one account
across web and app; the phone's Google account is NOT the identity).

Notifications (timed + conditional, all opt-in, anti-nag by design):
- user_settings gains reminder_enabled / reminder_time / conditional_enabled (migration 0033),
  everything default OFF.
- Settings has an "App reminders" section: daily reminder toggle + time, and a "heads-up when
  cards come due" toggle (at most one per day). Copy states the philosophy: quiet facts, never
  pressure.
- GET /api/notify/plan returns exactly what the shell should schedule: the reminder (if enabled)
  plus at most ONE conditional - currently "N retention cards are due", fired tomorrow 09:30 in
  the user's own timezone (taken from their latest session). Caps live server-side so no client
  can nag.
- native.ts: syncNotificationSchedule mirrors the plan into the OS scheduler via
  @capacitor/local-notifications (permission asked once, a "no" is respected with no retries;
  cancels-then-schedules so the OS always matches the latest plan). No-op on the web.

Native shell plumbing:
- registerBackButton: Android back goes back in history, minimises at the root (never hard-exits).
- keepScreenAwake via the standard Wake Lock API (no plugin): engaged during reaction calibration
  and trials, released at the result and on leave - a dimming screen mid-measurement ruins timing.
- The layout now runs a native init on mount: hideSplash (existed but was never called), back
  button, and notification sync from /api/notify/plan.
- /.well-known/assetlinks.json route for Android App Links: serves the app's cert fingerprints
  from env ANDROID_CERT_SHA256 (404 until configured, so nothing half-set is ever served). This is
  what makes magic-link emails open INSIDE the app.
- capacitor-shell/error.html: an on-brand offline page (radar sweep, "No signal", Retry) wired as
  errorPath in capacitor.config.ts and the make-variant generator.
- New deps: @capacitor/local-notifications, @capacitor/app. RUN npm install BEFORE BUILDING.

The native half (manifest intent-filter, keystore, cert fingerprint, device acceptance loop) is a
your-machine job: exact ordered steps are in ANDROID-APP-PLAN.md.

Migration 0033 adds the notification preference columns.
## v0.59.2 - Canonical app domain: xcgni.com

The Capacitor shell tooling (variants.config.ts, make-variant.mjs, capacitor.config.ts) pointed at
excogni.com while production lives at xcgni.com; App Links, cookies and allowNavigation all key off
the domain, so the mismatch would have silently broken magic-link login inside the Android app.
All shell tooling now uses xcgni.com (keep a 301 from excogni.com). See ANDROID-APP-PLAN.md.
## v0.59.1 - Admin nav wraps (no more horizontal scroll); header no longer collides with the grid

- The admin sub-navigation (Overview ... Health, Export) forced a horizontal scroll on desktop
  once it outgrew the row (overflow-x-auto + nowrap items). It now WRAPS into tidy rows at any
  width - a visible second row beats a hidden sideways scroll.
- The sticky main header's background was translucent enough (85%) that the fixed background grid
  showed through and visually collided with the EXCOGNI wordmark. Raised to 95% (blur kept), so
  the wordmark sits on clean ink.
## v0.59.0 - Wordlists broadened, short/full answers accepted, tag-driven insights, performance calendar

Fluency wordlists (the "not accepting my answers" complaint, fixed at the data level):
- 21 thin accept-lists broadened from a 2332-word total to 3873. The thinnest were genuinely scarce:
  philosophers 26 -> 119, constellations 27 -> 96 (all 88 IAU plus common asterisms), rocks/minerals
  28 -> 106, composers 30 -> 115. Two closed sets were simply wrong and are now complete: chemical
  elements 49 -> all 118 (plus spelling variants), planets & moons 49 -> 67. Principle held: human-
  salient members, exhaustive only where the set is genuinely closed. Item versions bumped.
- RE-SEED REQUIRED to apply: `docker compose exec app node scripts/seed.mjs` after deploy.

Short/full answer equivalence ("tarantino" vs "Quentin Tarantino", "co2" vs "carbon dioxide"):
- Audit finding: retention grading ALREADY handles this (matchAnswer's short/full rule), and the
  decks carry the right aliases (co2, surnames). The real gap was FLUENCY scoring, which only knew
  exact-match + 1-edit typos, so "johann sebastian bach" scored zero against a list holding "bach".
- Fluency now applies short/full matching too, conservatively: multi-word input matches by in-order
  whole-word containment either direction; single-word input only matches a multi-word entry's LAST
  token (surname / head-noun rule, >=4 chars), so a generic leading adjective ("red") can't score
  via "red mullet". Accepted this way shows as a fuzzy chip (≈), same transparency as typos.

Insights, smarter (the self-tracking tags finally pay off):
- TAG-DRIVEN insights: the tags people log (exercised, poor sleep, stressed, fasting, ...) are now
  mined with the same honest machinery as every other insight: for any tag with >=4 days on both
  sides, tagged days are compared against untagged days; only effects that clear the evidence gates
  appear, capped to the strongest 3 so heavy taggers aren't flooded. Correlational wording only.
- Weekday vs weekend: a new bucketer in the standard set, purely from the calendar, no logging needed.

Data presentation:
- The persistence calendar now shades each practised day by that day's AVERAGE SCORE (brighter =
  better) with attempts + average in the tooltip - the calendar shows how days went, not just that
  they happened.
- Further candidates recorded in the roadmap to pick deliberately: a drawn SEM band around the
  rating, per-category trend sparklines, a personal-records timeline, and a session-compare view.
## v0.58.1 - "Which shape completes" fixed at the data level; anonymous population position

The shape-giveaway bug (worklist B3), investigated from the banks themselves, no screenshot needed:
- **spatial-reasoning:** 15 rotation items had a correct option IDENTICAL to the prompt (identity/
  symmetric rotations), a literal giveaway. Each now contains a REAL rotation of the prompt (90/180/
  270, chosen so it differs from the prompt and every distractor); none needed deactivating. Item
  versions bumped; the seed upserts on bank_key, so a redeploy updates them in place.
- **visual-processing:** 100 items said "Which figure completes the pattern above?" while the task
  was actually matching, the wording lied about the task. Reworded to "Which figure is identical to
  the one above?". The other 100 ("exactly matches") were always honest: prompt = correct option IS
  the perceptual-matching task, by design. Versions bumped on all reworded items.
- RE-SEED REQUIRED to apply: `docker compose exec app node scripts/seed.mjs` after deploy.

Anonymous population position (roadmap item, small and on-brand):
- Under the percentile: "N of M rated score above you" (or "top of M rated"), plain anonymous
  counts, never names. Shown only when a real percentile exists.
## v0.58.0 - Theme v2: a visibly different instrument (honest do-over), plus C4/C6

Honest note first: v0.57.0 was a refinement pass when the ask was a DIFFERENT theme - the changes
were real but nearly invisible. This release changes the three things that actually define a look:
typography, shape language, and hierarchy.

The new instrument theme (visible this time):
- **Typography.** Instrument Sans for all UI text and IBM Plex Mono for numerals, labels and data -
  a real pairing with terminal heritage, replacing the anonymous system stack. Self-hosted through
  the build (fontsource packages), so the no-third-party-requests privacy posture holds. NOTE:
  requires `npm install` before the next build (two new dependencies).
- **Background.** Instrument graph paper: a fine fixed grid under everything (theme-aware, drawn
  from the scheme's edge colour) plus the powered-on accent glow. The page reads as an instrument
  surface, not a flat void.
- **Hierarchy.** Primary buttons are now SOLID accent with ink text - the single biggest visible
  change; actions finally look like actions. Hover adds a brightness lift and a soft glow.
- **Shape language.** A machined 3px corner radius on panels, buttons and fields - present, precise,
  nothing like a friendly app's pillow corners.
- **Signature.** Every section label carries a small accent tick and is set in the mono face - a
  systemwide mark you'll recognise on any screen. (Scoped to section labels only, not links.)
- **Navigation.** The header is sticky with a backdrop blur, so the instrument's controls stay at hand.
- All of it rides on the scheme variables: Amber, Warm, Slate, Phosphor and Ion all get the full look.

Worklist items in the same pass:
- C6: the reaction result screen ignores key input for 600ms after appearing, so rhythmic tapping
  can't skip the result before it can be read.
- C4: scripts/verify-deletion.mjs - verifies the account-deletion cascade end to end on the real
  database (plants a throwaway user across every user-referencing table, deletes, asserts zero
  orphans; discovers user_id tables from the schema so drift can't hide). Run:
  `docker compose exec app node scripts/verify-deletion.mjs`. With GDPR erasure written into the
  pitch, this needs to be demonstrably true.
- C2 WITHDRAWN with a correction: the audit misread the retention bank - it holds 110 cards across
  8 decks (deck objects were counted as cards). The pool is sound; expansion stays a nice-to-have.

DEPLOY NOTE: run `npm install` (or let the Docker build do it) - two new font dependencies.
## v0.57.0 - The instrument theme, radar-sweep loading, fluency you can see, fuller summaries

One theme, five colour schemes:
- The design language is now a single deliberate "instrument" theme, deepened rather than replaced:
  a barely-there powered-on glow at the top of every page (theme-aware, uses the scheme's accent), a
  raised surface layer (surface2) for hover/elevated states, panels with a faint top-light so they sit
  ON the page instead of being outlines, a consistent 150ms micro-interaction language with a soft
  accent glow on primary buttons, slashed-zero + tabular numerals everywhere numbers appear, and a
  touch of negative tracking on page headings.
- Colour schemes ride on top of the one theme, exactly as before but with a fuller set: Amber
  (default), Warm, Slate, and two new instrument-native schemes - Phosphor (CRT-green radar) and Ion
  (electric cockpit blue). Pick in Settings; everything (charts, exports, buttons) follows the scheme.

Loading that carries the identity (closes the "off-brand loading" todo):
- New radar-sweep Loader: the brand mark, working - a ring with a rotating sweep and a centre pip,
  pure CSS, theme-aware, reduced-motion safe (sweep stops, pip breathes). Used on the practice run
  (which previously showed NOTHING while loading) and retention. The top navigation bar is now a
  hairline sweep with a soft trail instead of a solid block.

Fluency scoring you can see (worklist C1, a tester's confirmed legibility gap):
- After a fluency item, every word you produced is shown as a chip: green = counted, dimmed
  strike = didn't count, "≈" = accepted through typo tolerance. The rules existed; now they're visible
  at answer time, not just in review.

The summary tells the whole session's story (worklist B6):
- Sessions that included a Retention burst or a Reaction run now say so on the summary
  ("also included: a Retention burst · a Reaction run"), via practice_sessions.modules_used
  (migration 0032).

Welcome is reachable (worklist B5 + audit finding A6):
- Audit found /welcome never actually blocked logged-in visitors - the missing piece was a way IN.
  Added a footer "Welcome" link. Roadmap updated to match reality (retention/reaction-in-mix marked
  done, .dockerignore marked present, loading-animations closed by this release).

Roadmap additions (maintainer request, for later): better ambient sound (deliberate, instrument-fit,
non-fatiguing); account deletion that DECOUPLES anonymized stats instead of destroying them - spec'd
with the GDPR constraints that make it legitimate (true anonymization, honest disclosure in the
deletion flow, legal re-identification check, absolute-erasure path kept).

Migration 0032 adds practice_sessions.modules_used.
## v0.56.2 - Build fix + module-system audit fixes (worklist items A1-A5, B1, C5)

BUILD FIX: v0.56.1 failed to build - sessions/index.ts already had touchSession(sessionId) and the
new session-keepalive helper was added as a second touchSession(userId), a duplicate export that the
syntax-only static check cannot catch (esbuild does). Renamed the new helper touchUserSession and
updated its four callers. A duplicate-export scan is now a permanent part of the pre-package
verification suite so this class of failure can't ship again.

Worklist fixes (from the claims-vs-code audit), all in the module hand-off system:
- A2, no more empty hand-offs: retention is offered only when there is actually something to serve,
  due cards (the real measurement) or unseen cards to learn. Previously "uncalibrated" fired even
  when everything was learned and nothing due, handing the user to an instant "All caught up" screen.
  The reason codes are now due-cards / learning / uncalibrated / stale.
- A3, calibrate once, ever: the reaction page now loads whether a hardware calibration is stored;
  in-mix, a calibrated user goes straight to trials. Previously every in-mix reaction re-ran the
  full calibration, against the plan's own design.
- A4, honest staleness: reaction staleness is measured from updated_at (last actual run), not
  peak_rating_at, so a daily-active user with an old PEAK is no longer nagged to re-measure.
- A1, profile-complete no longer silently gated for weeks: retention calibrates at 3 genuinely-due
  recalls instead of the global 10-attempt bar. Its attempts_count only counts due reviews (SM-2),
  so the old bar meant "profile complete" waited on weeks of maturing intervals, contradicting the
  "few focused days" promise. Three real due recalls is an honest first read for a construct that
  matures over days by nature. (Applied in readiness and in the hand-off selector.)
- A5, correct burst accounting: practice_sessions.module_handoffs (migration 0031) counts each
  hand-off; resumed session progress credits every burst as one step. Previously the credit was a
  boolean +1 even when both a retention and a reaction burst happened in one session.
- B1, retention copy: audit found the promised clarity items mostly already present (fuzzy-match
  transparency, counted-in-plain-words). Added the one missing piece: a learning-framing line on new
  cards ("Just learn it - this isn't a test. It will come back as a real recall test when it's due.").
- C5, hand-off observability: every hand-off decision is logged (module + reason + the driving
  number) so burst cadence can be tuned on evidence during testing.

Migration 0031 adds practice_sessions.module_handoffs.
## v0.56.1 - Seamless module hand-offs: questionnaire once per session, resumed progress, keyboard reaction

Fixes from the maintainer's local testing of v0.56.0's Retention/Reaction-in-the-mix.

The questionnaire that kept popping up (the real bug):
- Root cause found: sessions go stale after 4 minutes of inactivity, and the Retention/Reaction
  endpoints never refreshed the session's last_activity_at. A burst taking longer than 4 minutes
  silently ended the session, so returning to the run started a NEW session and re-asked the
  pre-session questionnaire. Fixed at the source: retention next/grade and reaction trial/calibrate
  now touch the open session (touchSession), so a module burst counts as session activity and the
  session survives it. touchSession never resurrects an already-stale session.
- Belt and braces: the run page now checks server-side whether the current session is already in
  progress (has attempts) and skips the questionnaire entirely on return. One session, one ask.

One continuous session (progress + counting):
- The run's progress counter resumes from the server instead of restarting at 1 on every remount.
- A module burst counts as ONE step of the bounded session, exactly "treat retention and reaction
  as one challenge in the global session".
- If the hand-off happened on the session's final step, returning closes the session out instead of
  serving an extra challenge past the bounded length.

Reaction, made seamless:
- In-mix, calibration starts automatically on arrival - no intro click.
- Enter (or Space) now works everywhere as the tap: react to the cue, advance stages, and return to
  practice from the result. Key-repeat is guarded so holding a key can't machine-gun reactions.
  (Replaces the old Space-only handler, which lacked the repeat guard.)
- In-mix, the result auto-returns to the run after 4 seconds ("returning automatically..." hint),
  with the button still there for anyone faster.

Small seams closed:
- The "Exit" link on both module screens now returns to the run when in-mix (it went to /stats,
  which silently dropped the user out of their session).
- Retention in-mix shows burst progress ("2/5") and hides the deck picker (a mid-mix detour; due
  cards ignore deck choice anyway).
## v0.56.0 - Retention & Reaction are part of the mixed run (radar no longer skewed)

Root cause of the "radar and percentile look wrong": Retention and Reaction Time were only reachable
via their own dedicated screens and were NEVER served in mixed practice, so those two radar spokes sat
empty/uncalibrated and skewed the profile shape and the percentile. The other 15 domains were seeded
and served correctly (verified end to end).

Fix: the mixed run now hands off to Retention and Reaction in rotation, so they are genuinely part of
the mix without the user choosing to "switch" to them. Each respects its own measurement-honesty rule:
- **Retention** hands off as a burst of up to 5 cards, offered when the user has due cards (the real
  measurement) or has never been measured on retention yet. Returns to the run when the burst is done
  or nothing is due.
- **Reaction** hands off as a calibrate-then-trials run, offered when the user has never done it or
  their last measurement is stale. Returns to the run when the trials finish.
- Both respect the enabled/unticked setting: if a user unticks Retention or Reaction, it never comes up.
- Spacing: a session won't open on a module, and won't hand off to another within 90s of the last one,
  so the mix feels like a mix. This uses a new practice_sessions.last_module_at timestamp (migration
  0030) because these modules don't write to the attempts table, an attempts-based guard would have
  caused an immediate re-handoff loop (caught and fixed before shipping).

Scope note: this is the "hand off to the module screen and return" approach. Rendering the bursts fully
inline inside the run page (never leaving the page) is deferred to a later pass; it needs extracting the
two interactive flows into components and is higher-risk interactive work. The current approach already
achieves the goal, all domains in the mix, no manual switching, radar fed.

Migration 0030 adds practice_sessions.last_module_at.
## v0.55.4 - Fix duplicated readiness message on the practice page

The practice "profile filling in" panel printed the same sentence twice side by side: the ProgressWheel
renders readiness.message internally, and the practice page rendered it again next to the wheel. Added
a showMessage prop to ProgressWheel (default true) and set it false on the practice page, so the wheel
shows just the ring + the two stat lines (areas measured, practice days logged) while the page owns the
heading, message and "See your stats" link. The stats page keeps the message in the wheel (it's used
standalone there). No other change - the "2/20 toward insights" wording and low fill % seen in the
screenshot were the pre-fix v0.55.1 state, already corrected in v0.55.3.
## v0.55.3 - Finish removing the "20-day" framing (progress wheel)

v0.54.0 removed the insights GATE and cleaned the readiness message copy, but two places still showed
the old 20-session wall to the user - now fixed:
- The progress wheel literally displayed "3/20 practice days · toward insights" - the exact countdown
  framing we'd meant to drop. It now leads with "areas measured · toward a complete profile" (the
  reachable milestone) and shows practice days as an accumulating count ("4 practice days logged ·
  patterns appear as your data builds"), not a fraction of 20.
- The wheel's fill percentage was 50% weighted on sessions/20, so a fully-measured profile still read
  ~50% until an arbitrary session count. Reweighted to 85% profile-completion + 15% depth, so
  measuring every ability takes the wheel visibly near-full, with depth easing in the last bit rather
  than gating half of it.

The INSIGHT_SESSIONS=20 constant remains internally (depth is a real, gentle secondary signal) but is
no longer surfaced as a "X/20" wall anywhere the user looks.
## v0.55.2 - Changelog-vs-code audit fixes

Audited every feature claim from v0.51-v0.55 against the actual code. Result: all substantive claims
(calibration-aware selector, insights unlocking, themes reaching every element, RGB-triplet build fix,
answer-on-miss display across all challenge types, export current-shape + percentile, tags/notes/
best-worst end-to-end, radar icon set) verified present and wired end-to-end. Two gaps found and fixed:
- The day-note API did NOT validate the date or cap the note, despite the v0.53 claim that both
  note APIs "validate and cap input". Now rejects a non-YYYY-MM-DD date with a clean 400 and caps the
  note at 500 chars (matching the session-context API).
- Documented that day_note.localDate is intentionally declared text() in the Drizzle schema (the DB
  column is date; all access is raw pg SQL which casts automatically) - preventing a future ORM
  coercion surprise. No functional change.
## v0.55.1 - Fix radar PNG export: missing current shape + percentile

The "Save as image" export was broken in two ways versus the live view:
- The "you (now)" plane (your current shape), its vertex dots and value labels were INVISIBLE in the
  export. Cause: when colours were made themeable they became `rgb(var(--c-accent))`, but a cloned/
  serialized SVG is detached from the document and can't resolve CSS variables - so those fills
  rendered transparent. The dashed "best"/"lowest" planes (hardcoded white/red) survived, which is why
  only the current shape vanished. Fix: resolve --c-accent to a concrete colour and substitute it into
  the SVG clone before serializing, so the current plane renders (in whatever theme is active).
- The percentile was missing from the export header. Added it beside the global rating (e.g. "92 th
  percentile"), matching the in-app headline, shown only when a real percentile exists.
## v0.55.0 - Show the right answer on a miss; slower, readable feedback

Fixed a real bug and a pacing complaint in the practice feedback.

Always show what the answer was:
- Getting "Incorrect" with no correct answer shown was a bug - the display only handled some challenge
  types and fell through to an empty string for others, and multiple-choice showed a useless
  "option 3" instead of the answer. Now every served challenge type surfaces a meaningful answer:
  text answers in full (e.g. "D is heavier than A.", "RED"), the actual option text for text-choice
  questions, the option NUMBER for visual/spatial choices (where the option is a shape, not text -
  and never "[object Object]"), goal+optimal-steps for planning, the true value for estimation, and
  example valid answers for fluency. Verified across all challenge types: zero empty, zero object
  bugs.
- The feedback also now shows what YOU answered, struck through, beneath the correct answer - so a
  miss is a "you said X, it was Y" you can actually learn from.

Slower, readable pacing:
- Auto-advance dwell raised from 2.6s to 4s on a correct answer, and 6s on a miss (there's a correct
  answer - and your own answer - to actually read). Manual Next / Enter still advances instantly for
  anyone who wants to move faster, and missed-vocab lessons still wait for a deliberate click.
## v0.54.0 - Fast to full profile; insights unlock as they go (no 20-day wall)

Two core-loop fixes addressing "how do we actually get to a full profile fast" and "why 20 days".

Calibration-aware challenge selection:
- The mixed-practice selector now front-loads UNCALIBRATED categories (lifetime attempts < 10) until
  every enabled ability is measured, then drops to normal session balancing. Previously it only
  balanced within a single session and had no cross-session or calibration awareness, so reaching a
  complete profile was left to chance and you could re-grind already-finished categories while others
  sat at zero. Ties among uncalibrated categories break by fewest-this-session, so a single sitting
  still feels varied rather than hammering one category ten times in a row. This is the direct path to
  "profile complete".

Insights unlock progressively (removed the global 20-session wall):
- Insights previously showed NOTHING until 20 total sessions - a hard all-or-nothing gate sitting on
  top of each insight's own evidence checks. That gate is gone. Each insight (sleep, caffeine,
  alertness, mood, time-of-day, population, skip-gap) already self-gates on its own data (enough days
  per bucket, large enough effect, distinguishable from noise) and now appears as soon as IT is
  individually sound. A minimal floor (5 days) remains, below which any two-bucket split is
  meaningless. Some patterns need calendar spread by nature (you can't know your Monday-vs-Friday
  pattern without real Mondays and Fridays) - those simply appear later, when their own evidence
  arrives, rather than being implied ready or gating everything else.
- Readiness + insights copy reworded: insights "appear as patterns emerge" and trends keep
  stabilising, instead of "wait ~20 days". The two-tier profile (measure everything fast -> deeper
  stable trends over time) stays, but no longer frames a hard 20-day lock.
## v0.53.1 - Stats: group "Your patterns" with Insights

Moved the "Your patterns" section (best time of day, fatigue/warm-up signal, accuracy-by-hour) to sit
directly under Insights, since both are the "what your data reveals about you" content. New order:
Insights -> Your patterns -> Persistence. No logic change.
## v0.53.0 - What you get, self-tracking tags & notes, best/worst days

Value proposition (landing): a plain "What you get" section spelling out the four things Excogni
actually does - Measure, Improve, Compare to others, Compare to yourself - in honest, concrete terms,
with a note that a first read comes within a few sessions and deeper patterns build over time.

Two-tier profile (already in the engine, now the framing the product leads with): "profile complete"
= every ability measured to calibration (>=10 attempts each) - an achievement reached in a few focused
days, not a 20-day calendar gate. "Deep profile" = enough repeat days for stable trends and insights.
The nearer, motivating milestone comes first; the calendar-bound one stays honest about needing time.

Session self-tracking:
- Curated, grouped tags on the session questionnaire (48 tags across Sleep, Body & intake, Physical,
  Mind, Context, Session type) - trimmed and de-overlapped from a larger list so it's quick, not a
  chore. Tap a group to expand, tap tags to toggle.
- A free-text session note ("how/why I felt today").
- Both are PRIVATE to the user and used only for the user's own self-comparison - never in any
  cross-user aggregate or population statistic.

Best & toughest days (statistics):
- Your highest- and lowest-scoring days, surfaced early (from 3 qualifying days, each needing enough
  attempts to be a fair sample) but honestly labelled "early - will steady with more" until there's
  enough history. Each day shows its self-reported tags.
- "+ add note" on any surfaced day to annotate what made it good or hard (sleep, stress, mood),
  saved privately - turning the data into self-knowledge.

Schema: registered session_context.tags/note and the day_note table in the ORM layer (migration 0029
created them in the DB). Day-note + session-context APIs validate and cap input; tags are restricted
to the known set.
## v0.52.4 - Refined radar mark (outline schematic)

Reworked the radar symbol to a cleaner "instrument schematic" treatment: an elegant amber OUTLINE
fingerprint with vertex nodes and a bright centre pip, over a faint grid - no heavy fill. Restraint
reads best at small sizes and feels more high-end / ownable than the filled blob. Also rebalanced the
fingerprint profile so it's a pleasing shape rather than lopsided. Applied across favicon.svg,
favicon.ico (grid dropped at 16px), apple-touch-icon, PWA icons, and the OG social card - all
consistent. Drop-in at existing paths; no code change.
## v0.52.3 - The radar becomes the symbol (icon / favicon / social)

The cognitive-fingerprint radar is the most distinctive thing in the product, so it's now the mark
across the whole identity - derived from the real RadarChart geometry (concentric polygon rings,
spokes, an irregular amber fingerprint with vertex dots), not a generic spider chart:
- favicon.svg (crisp, full radar at any size) + favicon.ico (multi-size; simplified to the fingerprint
  alone at 16px where grid would be noise)
- apple-touch-icon.png (180), icon-192/512.png (PWA / home screen)
- og-image.png rebuilt so the social link preview leads with the radar mark beside the wordmark

The interior fill is a solid warm amber (amber mixed ~34% over ink) rather than a low-alpha overlay,
so the mark reads as amber instead of washing out to cream at small sizes. All drop-in at existing
static paths - no code or markup change. Now the favicon, app icon, social card, and the live radar in
the app are all the same symbol.
## v0.52.2 - Themes reach everything; admin responsive; gentler simulated population

Theme coverage:
- The theme now applies to ALL elements, not just CSS-class-styled ones. Replaced hardcoded amber
  (#E2A33B) with the themeable rgb(var(--c-accent)) in every SVG component (radar, progress ring,
  sparkline, distribution, rating chart, spatial figure, percentile bars, trends, circle radar), the
  mix-categories checkmarks and range inputs, the reaction tap-target, and the canvas profile export
  (which resolves the active theme at draw time so the saved PNG matches what's on screen). The
  progress ring's complete-state green is now themeable too. Email keeps fixed brand colours (mail
  can't read site CSS), and the Settings theme swatches stay fixed by design (they preview each theme).

Admin responsive:
- The admin shell crammed an 8-item nav and a long subtitle into one justify-between row that broke
  on mobile. Header now stacks on small screens; the nav scrolls horizontally with non-wrapping
  items; min-h-screen -> min-h-dvh. (User-facing tables were already wrapped.)

Simulated population:
- Lowered the simulated reference baseline from a 1150 mean to ~930 (~20% down). The synthetic
  population only exists to populate the comparison UI before real data; during that bootstrap it's
  better for early real users to land at or above the simulated median than below it. Still clearly
  labelled simulated/preview everywhere it appears, and replaced by real data as users accumulate.
  Re-run gen-mock-data.mjs to apply.

Noted for a dedicated design session (NOT done here): making Excogni visually unmistakable rather than
"another dark app with an accent" - a planned pass on a signature element (the cognitive-fingerprint
radar as hero) and a deliberate display/mono type pairing, done as its own focused design exploration
rather than improvised.
## v0.52.1 - Build fix: themeable colors must use RGB channels (opacity modifiers)

v0.52.0 broke the production build. Converting the Tailwind palette to plain `var(--c-x)` hex values
disabled Tailwind's opacity modifiers - `bg-accent/10`, `text-muted/60`, `border-accent/50` and many
others across the app no longer compiled ("The `bg-accent/10` class does not exist"), failing the
vite build at the CSS step.

Fix (Tailwind's documented themeable-color pattern): the palette CSS variables are now RGB CHANNEL
TRIPLETS (e.g. `--c-accent: 226 163 59`) and Tailwind references them as
`rgb(var(--c-accent) / <alpha-value>)`. Opacity modifiers work again AND the colours remain
runtime-themeable via [data-variant]. All 27 palette values (9 colours x 3 themes) validated as
proper RGB triplets; every Tailwind colour wrapped in rgb(...); the two opacity-modified classes in
app.css's @apply blocks (accent/10, muted/60) confirmed resolvable.

Also removed a genuinely-unused `export let form` in practice/+page.svelte (build warning).

Note: this class of failure (static checks pass, real `vite build` fails on Tailwind opacity
compilation) can only be caught by an actual build - which is why it surfaced on deploy.
## v0.52.0 - Legible fluency review, inconsistency reports, selectable themes

Three tester-driven additions plus a theming system.

Green accepted words in review:
- Fluency answers in the session review now show each produced word as a chip - accepted words in
  green, rejected ones dimmed and struck through. Makes scoring legible (directly addresses "hard to
  track because of typos"). Computed at review time with the SAME matching rules as the scorer
  (rule-based for letter fluency, accept-list + 1-edit typo tolerance for semantic), so it's accurate
  and works retroactively on existing attempts. No migration.

Report inconsistency:
- A "Report inconsistency" button on the practice screen lets a tester flag a challenge that looks
  wrong. It captures a structured STATE SNAPSHOT (challenge id, prompt, level, the answer given,
  viewport, user-agent, timestamp) - the reliable, searchable part - plus a BEST-EFFORT screen image
  (html2canvas, loaded lazily from CDN; may be imperfect or absent on some browsers, never blocks).
- New 'inconsistency' feedback kind; migration 0028 adds nullable snapshot (jsonb) + image (text)
  columns. The admin Health panel shows both, with the snapshot and image in expandable details and
  inconsistency reports flagged in red.

Selectable themes (appearance):
- The palette is now driven by CSS variables, so the look is themeable at runtime. Three themes in
  Settings -> Appearance: Default (the original amber instrument), Warm (warmer surfaces + a teal
  second accent), and Slate (cooler blue-grey with a soft cyan accent). Addresses the "a bit too
  serious / needs some colour" feedback by offering a coherent palette shift - not scattered colour
  pops - while keeping the calm instrument feel. Theme is applied at the document root before first
  paint (cookie-based, no flash) and persists across sessions. Default unchanged for everyone who
  doesn't pick another.
## v0.51.3 - Broaden semantic fluency accept-lists (English)

Substantially widened the retrieval-fluency (semantic) accept-lists from common, recognizable members
so testers are far less likely to have a valid answer wrongly rejected. 40 categories broadened; total
accept-words now ~2,332. Notable: food 110->177, jobs 39->68, vehicles 35->53, household 41->57,
emotions 28->45, tools 32->48, fish 26->39, transport 23->40, drinks 43->54, vegetables 49->61.

Deliberate scope decisions:
- ENGLISH ONLY. Mixing other languages into an English semantic-fluency list would corrupt the
  measurement (crediting "kruh"/"brot" on an English "name foods" task tests the wrong thing).
  Other languages belong in their own batteries with their own population pools (see localization
  plan), not bolted onto English lists.
- NOT exhaustive. We add what people actually NAME (common, salient members), not every entity that
  exists - "all foods/cars there are" is a near-infinite long tail that would make a worse list.
- Phonemic fluency ("words starting with U") was left alone: it is rule-validated server-side (any
  real word matching the prefix/suffix counts), so it needs no accept-list and broadening it would be
  pointless. Effort focused where accept-lists actually decide correctness: semantic categories.

De-duplicated on merge (0 internal duplicates); several already-comprehensive lists (fruits, gems,
metals, elements, shapes) correctly did not grow.
## v0.51.2 - Fluency input: accept run-together and pasted lists

On mobile especially, people naturally type or paste several answers at once. Now all of these split
into separate words correctly:
- "food1 food2 food3" (space-separated)
- "food1,food2,food3" (comma, no spaces)
- "food1, food2, food3" (comma + spaces)
- pasting any of the above

How it works:
- Typing a comma live-commits everything before it into chips, keeping the fragment after the last
  comma as the in-progress word (so "ice cream, olive oil" preserves multi-word phrases).
- Pasting a blob splits on commas AND whitespace immediately (a pasted list is finished input).
- A trailing space does NOT commit - space is still allowed mid-entry so phrases like "ice cream" can
  be typed; those commit on comma, Enter, "Done early", or timer expiry.
- Whitespace-separated lists still split at submit time as before; the server also has a raw-string
  split fallback.
- Placeholder fixed: it claimed "press space or Enter" but space no longer commits; now reads
  "type words - comma, Enter, or paste a list".

All tokens are trimmed, lowercased, and de-duplicated. Verified against all four input styles.
## v0.51.1 - Remove `!reset` from prod compose ports (deploy-safety)

The prod override still carried `ports: !reset` on both db and app. `!reset` requires Docker Compose
2.24+ and on the deploy host it silently dropped the app's port mapping, which is what caused the
Caddy 502 during deployment (app reachable only inside the Docker network, nothing on the host's
127.0.0.1:3000 for native Caddy to proxy to).

Fixed: both services now use plain port directives with no `!reset`:
- base binds db and app to 127.0.0.1 only (loopback - never internet-reachable);
- prod app restates `127.0.0.1:3000:3000` explicitly; prod db inherits the base loopback binding.

This is the exact config that worked on the server after `!reset` was removed live - now baked into
the artifact so a fresh `up --build` won't reproduce the 502. Verified: no `!reset` directives remain
(only explanatory comments), both files are valid YAML, ports parse to real loopback bindings.
## v0.51.0 - Project-wide responsive pass

A systematic responsive sweep rather than reactive per-report fixes. Audited all 28 pages and 19
components. Finding: the foundation was already sound - every SVG chart (radar, distribution, rating,
sparklines, circle radar) already used viewBox + w-full and scaled correctly; most pages already used
flex-wrap and max-w caps. The work was hardening the gaps and adding fluid primitives.

Design-system primitives (apply project-wide via app.css):
- .btn / .btn-primary / .field now have min-height 44px - the accessibility standard for touch
  targets, so every button and input is comfortably tappable on a phone.
- New .h-page fluid heading: clamp()-based, scales smoothly from mobile to desktop with no per-element
  breakpoints. Applied to main page titles (statistics, about, methodology, circles, contribute,
  support).
- Earlier additions retained: .min-h-dvh (Safari address-bar fix), .safe-bottom / .safe-bottom-fixed
  (device safe-area insets for fixed elements).

Layout hardening:
- Responsive vertical rhythm: large py-10 / gap-8 page padding now steps up from a tighter mobile base
  (py-8/gap-6) at sm:.
- Stats hero padding responsive (p-4 -> sm:p-6).
- Methodology formula tables made horizontally scrollable on narrow screens (block overflow-x-auto,
  reverting to normal table at sm:).
- Admin grids (health, challenges) given a single-column mobile fallback instead of forced 3-col.
- Run-screen header (v0.50.3) and estimation dot-row (v0.50.3) wrap fixes retained.

Remaining (roadmap): fluid type on secondary headings, auto-fit card grids, and multi-device QA
across a range of real Android/iOS hardware. The reactive fixes plus this pass cover the real
breakages; the rest is incremental refinement best done with more user signal.
## v0.50.3 - Android tester pass: estimation overflow, planning clarity, responsive + safe areas

From a second tester (Android/Chrome), who also confirmed the v0.50.2 fixes landed (review
nulls gone, cookie notice showing):

- **Estimation "About how many items?" dot-row no longer overflows.** The long unbroken run of dots
  in the instruction now wraps instead of pushing off-screen horizontally.
- **Strategic planning rules made explicit.** The hint didn't say the steps can be reused or that they
  apply in order to the start number. Now: "Apply steps to the start number, in order... You can reuse
  each step as many times as you like." (All 200 items patched.)
- **Run-screen header wraps cleanly** on narrow screens (category/level/progress/ambient/End no longer
  cramped).
- **Safe-area insets** on the fixed cookie notice (and utility for the feedback button) so they clear
  the iPhone home indicator / Android gesture bar.
- Confirmed NOT a bug: fluency does capture the word still being typed when the timer expires
  (submitFluency commits the pending entry). Recorded the real gap - scoring isn't legible to the user
  - on the roadmap, along with the tester's recognition-mode and visual-polish ideas.
## v0.50.2 - Tester fixes: review nulls, mobile/responsive, cookie notice

From a real tester's iPhone/Safari screenshots:

- **No more "null" in session review.** Fluency challenges (verbal/retrieval) and planning have no
  single correct answer, so the review's ANSWER column rendered "null". describeAnswer now returns
  meaningful text: fluency shows the user's word count and "open - any valid words"; planning shows
  "reach <target> (best: N steps)". Added ?? "-" fallbacks as defense.
- **Retrieval lists widened + fairer prompts.** Foods 47 -> 110 entries (now includes condiments,
  fruit, regional items like ajvar that testers correctly gave but were marked invalid); animals,
  countries, colors, sports likewise widened. Prompts reframed "Name as many FOODS" -> "Name as many
  common foods as you can" to set a clearer, fairer boundary.
- **"PERSISTENCESHOWING UP" fixed** - the persistence header collapsed two labels together on narrow
  screens; now stacks with a gap on mobile, row on desktop.
- **Radar info tooltip** no longer inherits the parent label's ALL-CAPS + wide tracking (it was a
  shouty wall of capitals overlapping the radar); now normal-case, narrower, max-width capped to the
  viewport.
- **Review table** wrapped in horizontal scroll (min-width) so long prompts no longer overflow the
  page off-screen on mobile.
- **Nav fits on small screens** - the wordmark tracking and per-item padding shrink on mobile so the
  "Account" menu is no longer cut off at the right edge.
- **Mobile Safari viewport** - main layout uses 100dvh (dynamic viewport height) with a 100vh
  fallback, fixing the address-bar jump/layout shift.
- **Cookie notice** - a lightweight, dismissible informational notice (NOT a consent wall). Excogni
  sets only essential first-party cookies (session/auth + a UI preference + first-visit flag) with no
  analytics, ads, or third-party tracking, so an informational notice is the correct, compliant, and
  least-annoying choice. Dismissal is remembered via a first-party cookie; the site is fully usable
  throughout.
## v0.50.1 - Rename Elo -> "Excogni Rating"; drop fake ZZ country on simulated users

Two fixes from external review:

- **The per-domain score is now the "Excogni Rating", not "Elo".** It was never classic Elo (no
  head-to-head opponents) - it's adaptive single-player estimation from calibrated difficulty,
  accuracy, response time, and population normalization. Calling it Elo invited the fair question
  "where are the opponents?". Methodology now names it the Excogni Rating and states its lineage
  honestly: inspired by competitive rating systems like Elo but distinct from them, closer in spirit
  to adaptive psychometrics. Borrowing chess's authority for something that isn't chess ran against
  the project's whole honest-measurement stance.
- **Simulated users no longer carry a fake 'ZZ' country** (which rendered as a broken-looking "ZZ" in
  public breakdowns). Their demographic fields (country/language/handedness) are left NULL - they have
  no real demographics, and inventing them is misleading. They group honestly as "unknown", and the
  page already labels the whole view "Preview - includes simulated data". Re-run gen-mock-data.mjs to
  refresh existing sim rows.
## v0.50.0 - Launch polish: link previews, favicons, robots, practice completeness

Fixing the real 404s and gaps that show up to actual users and crawlers before HN:

- **Social link previews.** Sharing the URL (Viber, Slack, iMessage, X, etc.) showed just "excogni"
  with no image. Added Open Graph + Twitter Card meta tags and a branded 1200x630 og-image.png, plus
  a real page description. The link now unfurls with the wordmark, "a gym for the mind", and the
  domain.
- **Favicons + icons.** Only favicon.svg existed (hence /favicon.ico, /apple-touch-icon.png 404s from
  real browsers). Added favicon.ico (multi-size), apple-touch-icon.png (180), PWA icons (192/512),
  and a web manifest - all in the dark instrument aesthetic with the three-bar mark.
- **robots.txt** with an alpha noindex (Disallow: /) so the site stays out of search results until
  launch, plus explicit Disallow on /auth, /admin, /api. Flip to allow indexing when you go public.
- **Completeness ring on practice.** New users land on /practice and couldn't see their profile
  filling in (the ring was stats-only). Added a compact ProgressWheel at the top of practice for
  signed-in users until they hit 100% - honest progress (calibrated domains + sessions), right where
  they're working.

DB pool limits from v0.49.5 included. All static assets in /static; no migration.
## v0.49.5 - Explicit DB pool limits (HN spike readiness)

Set explicit connection-pool parameters on both postgres.js clients (raw + Drizzle) instead of
relying on defaults: max 10 each (20 total, well under Postgres's default max_connections of 100),
idle_timeout 20s so a burst doesn't hold idle connections, connect_timeout 10s to fail fast rather
than hang a request under saturation. Override with DB_POOL_MAX if ever needed. This is the main
origin-survival factor for a traffic spike on a single VPS.
## v0.49.4 - Always land on practice after sign-in

Simplified the post-login landing: everyone goes to /practice after signing in (stats is one click
away in the nav). Practice is useful to new and returning users alike and never shows the empty-stats
screen a brand-new account would hit.

This replaces the v0.49.3 conditional (new-vs-returning by attempt count), which was correct but
solved a subtler problem than the tester phase needs - and didn't trigger in practice because a
"new email" upgrades the existing anonymous session (which already has attempts) rather than creating
a zero-history account. Landing everyone on practice is simpler, matches the "practice first, numbers
later" tester framing, and removed the attempts query entirely.

All /stats login defaults switched to /practice (magic endpoint, login form default, logged-in bounce).
## v0.49.3 - New users land on practice, not empty stats

First-run polish: signing in via magic link sent everyone to /stats, which for a brand-new account is
an empty "you've done nothing" screen - a poor first impression.

- The magic-link landing is now conditional: a user with zero answered attempts lands on /practice
  (get them doing the thing); a returning user with history still lands on /stats (their payoff).
- Only the *default* landing is overridden - if a user was explicitly heading to a specific page and
  got bounced through login, that destination is still respected.
- On any uncertainty (query error), falls back to the safe default. Redirect throw kept outside the
  try/catch so it always propagates cleanly.
## v0.49.2 - SECURITY: stop publishing app + Postgres ports to the internet

On a real prod boot, `docker compose ps` showed both 0.0.0.0:3000 (app) and 0.0.0.0:5432
(Postgres) published on all interfaces - the database was reachable from the internet, and the
app origin was hittable directly, bypassing Caddy + Cloudflare.

Cause: the base compose published "3000:3000" and "5432:5432" (all-interfaces), and the prod
override's `ports: []` did not reliably clear them (list-field merge behaviour across Compose
versions).

Fix:
- Base compose now binds BOTH ports to 127.0.0.1 only (loopback), never 0.0.0.0. This alone closes
  the public exposure even if the override is ignored.
- Prod override uses `ports: !reset` to explicitly clear the db port (none published) and pin the
  app to 127.0.0.1:3000 (Caddy reaches it over loopback; the internet cannot).

After deploying, verify with: `sudo ss -tlnp | grep -E '0.0.0.0|:::'` - only 80 and 443 should be
public; 3000 and 5432 must not appear on 0.0.0.0.
## v0.49.1 - Fix: migration 0027 crashed on boot (scalar enabled_categories)

Migration 0027 failed on deploy with "cannot get array length of a scalar": some legacy
user_settings rows store enabled_categories as a JSON scalar (e.g. null) rather than an array, and
jsonb_array_length() / the ? operator both error on scalars.

- 0027 now filters to array-typed rows in a CTE *before* any array operator runs, so a scalar can
  never reach jsonb_array_length or ?. Non-array/empty/absent values correctly mean "all on" (empty
  disabled set). The failed migration was never recorded as applied, so it re-runs cleanly.
- Migration runner now wraps each file in a transaction: a partial failure rolls the whole file back
  instead of leaving it half-applied. Prevents this class of problem going forward.

No code changes beyond the runner; runtime reads were already scalar-safe (Array.isArray guards).
## v0.49.0 - Testing fixes: radar now-frame, category defaults, settings dedupe, circle focus

From real boot testing:

- **Radar "now" frame now matches the live radar exactly.** Scrubbing the timeline to the latest frame
  rendered a reconstructed shape that could differ from the main radar above it - confusing. The
  timeline's latest frame now renders the live domain values verbatim (same source as the main radar),
  so the two are guaranteed identical at "now". Earlier frames still show the historical reconstruction.
- **Fixed "methodology undefined" on the radar + saved image.** methodologyVersion was only in the
  anonymous stats return, not the authenticated one, so signed-in users saw "undefined". Now in both;
  the simulated-population flag key was also reconciled.
- **New categories now default ON.** Category preferences switched from an enabled-list to a
  disabled-list model (migration 0027). Previously, any category added after a user saved prefs was
  absent from their enabled-list and silently defaulted OFF (why Estimation/Strategic Planning showed
  unticked). Now everything is on unless explicitly opted out, so newly-added categories are always in
  the mix. Existing prefs are converted.
- **Settings de-duplicated.** The practice-category picker appeared both inline in settings AND as a
  separate "manage categories" link. Removed the inline grid; the practice page (richer grid with
  descriptions and Train buttons) is the single home for category selection. Settings keeps session
  length and links out.
- **Circle focus is now an obvious action.** Replaced the subtle focus chips with a primary "Start a
  focus session" button (plus per-area chips). Clarified honestly that circle practice IS normal
  practice - the circle adds visibility, not a separate session type.

Migration 0027 (disabled_categories). All 12 test suites pass.
## v0.48.0 - Simulated reference population + runtime toggles

Launch-readiness: a populated-but-honest experience that flips to real-only when the data arrives.

- **Mock data generator** (scripts/gen-mock-data.mjs) - creates a simulated reference population with
  realistic per-category ratings across ALL categories, so every radar axis has blue population
  points and distributions aren't empty. Every row is tagged is_simulated=true (quarantined).
- **Quarantine fix.** populationDomainMedians (the blue points on the personal radar) did NOT respect
  the simulated toggle - it would have always included sim users. Now every population query gates on
  (is_simulated = false OR includeSim) consistently. With the flag off, zero simulated data reaches
  any statistic.
- **The flip.** While the simulated-population flag is ON, sim users populate the comparison backdrop
  (blue points, distributions, percentiles). Flip it OFF and every stat recomputes against real humans
  only - instantly, with no effect on real users' own scores (a user's rating was always computed from
  their own attempts; only what they're compared against changes). Sim rows can be deleted wholesale.
- **/admin/toggles** - a unified control panel for runtime feature flags: the simulated population,
  practice circles (Social/Experimental), and public stats preview. Backed by an app_flags table
  (migration 0026) so toggles take effect live without a redeploy; each flag falls back to its
  deploy-time env default and can be reset. Defaults: everything OFF (experimental features dark,
  simulated population off until you turn it on for launch).
- **User-facing honesty.** While simulated data is on, the personal radar shows a quiet note: the
  population comparison includes simulated data until enough real users exist; your own scores are real.

Migration 0026 (app_flags). The generator and the DELETE are deliberate manual server actions.
All 12 test suites pass.
## v0.47.0 - Testing-round fixes: radar timeline, methodology surfacing, abandon-on-leave, info merge

From real boot testing:

- **Radar "shape over time" now ends on the current shape.** The timeline rolled domains up with an
  equal-weight average while the live radar uses an attempts-count-weighted average, so the final
  frame didn't match. The timeline now uses the same weighting - the last frame equals the current
  radar.
- **Methodology version is now visible** under the radar on personal stats (links to /methodology) and
  is stamped onto the saved radar PNG, so a shared image is self-describing.
- **Abandon-on-leave.** Leaving a challenge mid-way (navigation, tab close, app background) now marks
  the still-pending attempt as 'abandoned' via sendBeacon, instead of leaving it dangling as pending.
  No migration (status is free text); a just-answered attempt is never abandoned.
- **Formulas + methodology merged into one info page.** /methodology is now the single hub: versioned
  methodology with per-version expandable detail PLUS the live formula transparency (worked examples
  from the real functions). /formulas now 308-redirects there.
- **Removed the duplicate admin formulas page** (it mirrored the public one); admin nav points to
  /methodology.

Notes confirmed not-bugs: the "you vs the field" distribution with your marker is already on personal
stats (in the More-detail expander). The Social/circles section is intentionally hidden behind
ENABLE_CIRCLES (off by default) - set it true to surface it.

Also recorded in ROADMAP: the named-leaderboard-with-contact idea was considered and deliberately
rejected (it's a public ranking of "who's smarter" + a privacy/safety surface); the on-brand
anonymous "where you stand" display is kept as a small todo.
## v0.46.0 - From product to protocol: versioned methodology, tiers, contributions

The scaffolding that lets Excogni become a citable instrument rather than a black box.

- **Versioned methodology.** src/lib/methodology.ts defines METHODOLOGY_VERSION ('m1') as a single
  addressable bundle - the rating algorithm, scoring constants, validity thresholds, and a per-version
  changelog, in a registry built to grow. Discipline: bump the version (never mutate a published one)
  whenever a change would affect an official score.
- **Every result is stamped.** The methodology version is recorded on every scored attempt, every
  rating snapshot, and the data export (migration 0025). A score is now always interpretable and
  reproducible, and a formula change can't silently rewrite the meaning of past data.
- **Canonical vs experimental tiers.** Challenges carry a tier. Experimental challenges still collect
  full attempt data on real users but do NOT move official ratings - a proving ground for new
  paradigms until they're validated and graduated. Enforced at the rating-write boundary.
- **Public /methodology page** - the citable artifact: current version, exactly what it pins
  (algorithm + every constant), and the version history.
- **/contributions page** - acknowledgments for methodology contributors, research & validation,
  testers, supporters, and code contributors (editable JSON, honest empty state for now).
- **"Contribute methodologically"** - a /contribute proposal form (new paradigms, scoring, or validity
  methods) routed through feedback; linked from the feedback widget, methodology, and contributions.
  Proposals enter experimental and graduate only after review.
- **Admin challenge manager** gains a per-challenge canonical/experimental toggle.

Migration 0025 (methodology_version on attempts + rating_history; tier on challenges). All 12 test
suites pass; static + contract checks clean. Re-seed not required for the methodology layer; existing
challenges default to canonical tier.
## v0.45.0 - Admin challenge manager

A new admin page (/admin/challenges) to manage the challenge content directly, no re-seed required:

- **Category overview grid** - each category shows active/total counts with a fill bar and level span,
  colour-coded (green = all active, amber = some disabled, red = none active). Click to drill in.
- **Per-challenge enable/disable** - toggle any single challenge; disabled ones are immediately
  dropped from the serving pool (the serve path already filters on `active`). Bulk "enable/disable all"
  for a whole category or a single level.
- **Inline editor** - edit a challenge's type, level, renderer, and the promptData / answerData /
  scoringConfig JSON, with validation (malformed JSON is rejected before it can break serving; the
  renderer must be one the practice page can actually draw).
- **Author new challenges** - an add form with renderer-aware starter templates (multiple choice,
  numeric, planning, fluency). Manually-added challenges are tagged `manual-…` so a re-seed never
  clobbers them.
- **Honest re-seed warning** - editing a *seeded* challenge shows "a re-seed will overwrite edits
  here", since the seeder upserts by bank_key; manual challenges are safe.

All gated behind the existing admin token. New src/lib/server/admin/challenges.ts (list/toggle/edit/
add with JSON + renderer validation). No migration - uses existing challenge columns.
## v0.44.0 - Challenge content: the thin banks built up (2704 -> 3102)

Filled out the four sparsest challenge banks so practice doesn't repeat quickly:

- **strategic_planning: 15 -> 200** (L1-10, 20 each). The generator now procedurally creates number-
  path puzzles with difficulty scaling by level, every one BFS-verified solvable with a known optimal
  step count. Sampled puzzles confirmed to grade correctly end-to-end.
- **verbal_fluency: 16 -> 160** (L1-8, 20 each). Generated from a curated lexicon across starts-with /
  ends-with constraints, difficulty rising from common letters to clusters to affixes; each prompt has
  a generous accept-list.
- **verbal_reasoning: 97 -> 150**, and evened out (was a lumpy 7-12 per level, now 13-19). 53 new
  hand-curated synonym/antonym/analogy items with plausible distractors, difficulty by word rarity.
- **retrieval_fluency: 24 -> 40**. 16 new hand-curated "name as many X" categories (foods, vehicles,
  tools, rivers, composers, constellations, philosophers, etc.) with real accept-lists.

Honest note: retrieval_fluency and verbal_reasoning are hand-authored (can't be procedurally generated
without producing nonsense), so they got solid quality batches rather than being padded to 20/level
with weak filler. The generated banks (planning, fluency) hit the full 20/level.

All migration-free (content + seed only); re-seed to load. All 12 test suites pass; every bank valid,
all 3095 challenge bankKeys unique.
## v0.43.1 - Audit pass: planning feedback fix

Full codebase audit against the feature set (no test environment, so this is static + contract
review). One real bug found and fixed; everything else verified sound.

- **Fixed: blank "correct answer" on a missed planning puzzle.** Planning challenges store
  start/target/allowed/optimalMoves, not a `correctAnswer` field, so the feedback line fell through to
  an empty string. Now shows a useful, non-spoiling hint ("reach 11 - can be done in 3 steps") instead
  of revealing one specific solution (planning puzzles have many valid answers).

Audited and confirmed correct (no change needed): session_context date-join ::text casts intact;
all new columns exist in migrations (0021-0024, sequence clean); insights bucketer fields selected;
component prop contracts match server shapes; anonymous/null-data guards on stats, circles, global
pages; circles flag short-circuits before queries; no circular imports; all domains hemisphere-mapped
and labelled; planning is correctly untimed (fluency timer is isolated to fluency only); all 12 test
suites pass.
## v0.43.0 - Completeness ring + consistent instrument aesthetic

- **Progress wheel on the stats page.** An honest completeness ring showing how far you are from a
  full, valid profile - where insights fire and your measurements are trustworthy. It tracks the REAL
  gates, not a fake bar: half the ring is breadth (domains calibrated past the 10-attempt provisional
  gate), half is depth (practice days toward the 20-session insights threshold). Shows a plain-spoken
  message ("4 more practice days until insights unlock") and disappears once you hit 100%. This is a
  truthful reason to return - your numbers aren't valid yet - rather than a streak guilt-trip.
- **Consistent boot aesthetic.** The "Get ready" beat before each challenge now uses the same calm
  pulsing-accent instrument motif as the first-run power-on, so the visual language is consistent.
  No timing changed and no artificial delay was added - it only dresses the moment that already
  existed (we don't slow the app to look fancier).
- New userReadiness() (verified math: 0 -> 50 -> 75 -> 100 across the milestones) + ProgressWheel.
## v0.42.0 - Strategic Planning: the first deliberate-hemisphere content

The first playable content for the "deliberate & constructive" side of the radar - a domain where
thinking slowly is the point, not a penalty.

- **Strategic Planning category** with "number path" puzzles: start at a number, reach a target using
  a small set of allowed operations (e.g. start 2, reach 11 with +3, *2, -1). You type the sequence
  of steps. 15 puzzles across 5 levels.
- **No clock.** These are scored by scoreDeliberate - solution QUALITY (optimality), never speed. A
  slow, well-planned answer scores full; an inefficient correct answer scores a bit less; speed is
  ignored entirely. Optimal step counts are BFS-computed at generation time, so efficiency scoring is
  honest.
- **Robust answer parsing**: accepts "*2, +3", "x2 -> +3", unicode minus, reversed tokens ("2*"),
  arrows/commas/newlines as separators; flags disallowed or unrecognised steps clearly.
- New planning_sequence renderer (prompt shows start -> target and tappable allowed-step chips; a
  plain text input, no timer). Wired through submit with a dedicated grading branch.
- 28 new unit tests (18 planning validation + 10 deliberate scoring), all green. Generator with
  BFS optimal-path verification. Migration-free (content + seed only); re-seed to load the puzzles.
## v0.41.0 - The radar becomes a map of cognition TYPES (hemispheres + deliberate scoring)

The shift you asked for: stop measuring only fast, single-answer thinking (which read as a speed
leaderboard) and start mapping the KIND of cognition - so a slow, deliberate, planning thinker has a
shape instead of looking like "the slower individual".

- **Hemisphere grouping on the radar.** Every domain is now sorted into "Quick & reactive" (speed,
  perception, recall, fluency) vs "Deliberate & constructive" (reasoning, working-through, planning,
  retention), with a reserved "Open & generative" third for creative measures. The radar orders its
  axes by hemisphere so the two kinds of thinking read as distinct arcs, not an interleaved jumble.
  (src/lib/hemispheres.ts; on by default, toggleable per chart.)
- **Deliberate scoring.** A new scoring mode for planning/strategy where SPEED IS IGNORED entirely -
  the score reflects solution QUALITY (optimality), so thinking slowly is rewarded, not penalised.
  This is the engine the strategic side of the radar runs on. 10 tests.
- **Strategic Planning** registered as a domain (in the deliberate hemisphere), ready for content.
- Roadmap: the full cognition-types plan captured - strategy puzzles next, then divergent thinking
  (originality scored honestly by population rarity, no AI judge), incubation (scored on process not
  product), and generative work (un-scored cultivation first). Also logged the self-selection bias
  note for later mitigation.

This release is the foundation; the strategy CONTENT (playable planning puzzles) is the next build -
kept separate so it isn't shipped untested.
## v0.40.0 - Circle stats: radar, compare, superlatives + Experimental framing

- **Circle radar.** The circle's median forms the reference shape (dashed blue, anchored like the
  population ring on the personal radar); tap any sharing member to overlay their shape. "I'm the
  memory one, you're the logic one" made visible. Only members who opted to share ratings appear.
- **Head-to-head.** Pick any two sharing members and compare their domain ratings side by side, the
  higher value highlighted per row.
- **Where you rank in the circle** - your position per domain ("#2 of 6 for processing speed"),
  framed as friendly, not a verdict.
- **Superlatives** - small honest call-outs: domain leads and most-consistent (by 30-day active days),
  only over members who share the relevant dimension.
- **Reframed as "Experimental".** The section is now labelled Experimental (was Social) in the nav and
  on the page - a home for circles, and later training games and stat experiments. Added an explicit
  note: this is fully optional, your data already powers your own + global stats regardless, and the
  complete Excogni experience needs no circle.
- All still behind ENABLE_CIRCLES, off by default. New circleStats(); DOMAIN_LABELS now exported.
## v0.39.0 - Circles, refined: focus, agree-to-join, admin toggle

- **Feature flag for the whole thing.** Practice circles are now gated behind ENABLE_CIRCLES (off by
  default). Ship it dark, switch it on when ready, kill it instantly if it ever pulls practice the
  wrong way. When off, the route redirects and the nav link is hidden.
- **Moved under "Social"** in the nav (was "Circles") - signals it's a distinct, optional mode.
- **The circle creator is its admin.** They name the circle and set its FOCUS - a chosen subset of
  the existing categories. The focus shows as one-tap "practise this area" buttons for members
  (suggested, never forced). Only the creator can edit the focus.
- **Agree-to-join.** Joining now needs an explicit "I agree to join and share my activity" tick, so
  nobody enters a shared space without knowing what's shared.
- **Multiple circles per user** (already supported; now clearer in the UI).
- Per-member sharing unchanged: activity on by default, cognitive rating off by default and opt-in.
- Migrations 0024 (circle focus categories). Circles tables from 0023.
## v0.38.0 - You vs the world + practice circles

- **You on the global distribution.** The public rating histogram now highlights YOUR bin in green
  with a "you" marker, and a line beneath reads "Your rating is X - ahead of Y% of rated users". Turns
  a static population chart into a mirror. (Shows a gentle prompt instead if you've not practised yet.)
- **Practice circles** - small, private, shared-key groups for friendly company:
  - Create a circle -> get a 6-character code; anyone with the code can join.
  - The emphasis is ACTIVITY and PERSISTENCE (streaks, days practised, the circle's combined problem
    count) - showing up together, not ranking ability. Deliberately on-brand with "measured, not
    gamified".
  - **Each member controls what they share**: activity is on by default; cognitive rating is OFF by
    default and individually opt-in. Members who keep activity private simply show as private.
  - Circles need an account (so friends recognise you across visits); join/leave any time. New
    "Circles" entry in the main nav. Migration 0023.
## v0.37.0 - Global stats: trends over time + a fancier look

- **Community trends over time** on the public statistics page. A proper multi-line chart (axes,
  gridlines, area fill, toggle tabs) with three views:
  - Community growth - cumulative consented users accumulating week by week.
  - Weekly active - distinct people who practised each week.
  - Median rating - shown but honestly labelled: it's shaped by WHO joins when (new users haven't
    calibrated), so it's framed as context, not a "community getting smarter" scoreboard.
  Consent-gated and floor-suppressed like every public number; only appears once the community
  clears the threshold and there are at least two weeks of history.
- **Fancier global page.** The Population block is now a proper hero (big mono numerals: rated users,
  median rating, middle-50%, total joined) matching the polish the personal stats page got, rather
  than the old cramped inline row.
- New publicTrends() query (weekly buckets, same consent discipline) + TrendsChart component.
## v0.36.0 - Context data, real-boot fixes, layout polish

New context data (locked in before first users; high-value, low-friction, non-special-category):
- **Restedness** ("How rested do you feel?") - subjective recovery, separate from sleep hours and
  often a better predictor. Asked once per day. Now also an insights bucketer.
- **Hours awake** - a circadian variable relative to the person's own rhythm. Once per day.
- **Other stimulant** (boolean) - captures nicotine/energy-drink/medication without asking which
  (no substance list = privacy-respecting). Per session; also an insights bucketer.
- **City** (optional) on the profile, like country - enables regional analysis / weather derivation.
  Optional and editable in Settings, same privacy posture as the other demographics.
- All included in the personal data export, which now also carries session_context, consent
  provenance, quality_flags and input_method.

Fixes from real-browser testing:
- **Vocabulary lesson now fires on analogies too**, not just synonym/antonym. The miss in testing was
  an analogy ("HOT : COLD :: UP : ?"); the lesson now defines the answer word and the analogy's third
  term when they're known. (It stays silent when the words aren't in the dictionary - honest.)
- **Persistence calendar fixed.** It was generating a stray extra week and stranding the active days
  mid-grid; now a clean 12-week strip that ends on today (future days hidden), centered.
- **Rating + percentile now lead the stats page** as a prominent hero, instead of being buried in the
  "More detail" expander. The number you came for is the first thing you see.

Layout:
- **Wider content column** (max-w-4xl -> 5xl) - less wasted margin on big screens while staying
  readable.
- **Denser practice grid** - 3 columns on large screens with tighter cards, so 15 categories don't
  require as much scrolling.
## v0.35.1 - Onboarding glow-up

- **Reworked the first-run welcome experience.** Same honest, plain-spoken copy and the same optional
  about-you form (unchanged field contract), but now it opens with a brief instrument "power-on"
  sequence - a few lines that double as a statement of values ("no scores stored without consent",
  "calibrating baseline") rather than a fake loading bar. Tap anywhere to skip it.
- Intro steps now fade/slide in as you advance, the progress bar animates, labels pick up the amber
  accent, and the final Next reads "Almost there" before the form. Respects prefers-reduced-motion
  (the power-on finishes near-instantly for those users).
- Aim: make the first 30 seconds feel crafted and calm - matching the instrument-panel aesthetic -
  without overselling or adding a single dishonest flourish.
## v0.35.0 - Data-validity hardening + presentation upgrades

Data acquisition (the irreversible-if-missed work, done before first users):
- **Per-attempt quality flags** (migration 0021): every answer is checked for `too_fast` (sub-250ms,
  faster than human reaction), `too_slow` (AFK/distracted), `first_exposure` (task-learning confound
  on first sight of a challenge type), and `client_clock` (untrusted client timing). Flags NEVER
  delete - they let analysis exclude questionable attempts while keeping the raw record, so early
  data stays analysable forever. Pure, unit-tested helper (10 tests).
- **Input method** captured per attempt (keyboard/touch/mouse) - a real timing confound for speed
  scoring, now controllable for.
- **Consent provenance**: consent timestamp + version stored per user (GDPR + knowing which data
  you're cleared to analyse). New CONSENT_VERSION constant to bump when wording changes.
- **Data-quality admin panel**: clean-attempt %, flag breakdown, input-method split, consent-stamped
  count - so dataset health is visible at a glance.

Presentation (borrowed from the best stats sites + dashboard best practice):
- **Percentile standing** per area ("you're in the 80th percentile for memory") - the most legible
  "how do I compare" device; honest blanks where there isn't enough community data to rank.
- **Headline summary** at the top of stats: one honest sentence stating your state + direction (the
  5-second test), e.g. "trending up in 2 of 3 areas; memory is your strongest (top 18%)".
- **Progressive disclosure**: the detailed breakdowns (overall, progress, categories, patterns,
  records, distribution) now live behind a "More detail" expander, so the page leads with the
  at-a-glance picture instead of overwhelming - per current dashboard cognitive-load guidance.
## v0.34.0 - Radar through time, trend sparklines, data download

- **Radar through time.** A new "Your shape over time" section under the main radar, with a scrub
  SLIDER (and a Play button) that morphs your radar across your own history. Each snapshot is
  reconstructed from rating_history - the latest rating per category as of that date, rolled into
  domains - with the population reference held fixed behind it so progression reads clearly. The
  original radar (with min/max planes) is kept exactly as-is; this is additive. Appears once you have
  at least two distinct history points; otherwise it shows the current radar with a gentle note.
- **Trend sparklines.** A new "Trends by area" grid: one mini line per domain over your history, with
  a first->last delta and colour (green up, red down, grey flat). The clearest at-a-glance answer to
  "which areas am I actually improving?" - a strong companion to the radar's shape.
- **Download your data, now discoverable.** A full personal JSON export already existed at /api/export
  but wasn't linked anywhere; added a "Your data" section in Settings with a clear download button
  (account, settings, every attempt, full rating history). The existing radar PNG export is unchanged.
- Honest note: the timeline weights each domain's categories equally at past dates (historical
  attempt counts aren't snapshotted), a small simplification noted in code; the live radar's
  attempt-weighting is unchanged. Timeline reconstruction sanity-checked.
## v0.33.1 - Footer restyle

- **Simpler footer.** It was wrapping into two ragged rows (a justify-between of the tagline, four
  links, and the version). Now it's a deliberate centered stack: the links on one centered line, and
  the tagline with the version folded into a single muted subline beneath. Reads as one intentional
  block at any width instead of an accidental wrap, and the version no longer sits as its own stray
  element.
## v0.33.0 - Fluency fix, in-challenge opt-out, vocabulary cultivation, behavioural global stats

- **Fixed fluency mis-scoring.** Multi-letter prefix constraints ("words starting with SP") and suffix
  constraints ("words ending in ING") were graded against a short accept-list, so valid words
  (sport, spain, singing...) were wrongly marked as mistakes with a null result. Now ALL phonemic
  fluency is graded by rule: detects prefix vs suffix from the instruction, accepts any plausible word
  of ANY part of speech that fits. Verified across single-letter, multi-letter, and suffix cases.
- **In-challenge "Don't show this category again" checkbox.** On the feedback screen you can opt a
  category out of future practice; it writes the same preference as the practice-page toggles, so the
  two stay in sync. (Expands the implicit "all enabled" set before removing, so it persists correctly.)
- **Synonym/antonym is now vocabulary cultivation.** On a miss, the definitions of BOTH the prompt word
  and the correct answer appear, and auto-advance is held so you read them and click Next deliberately.
  134 concise definitions written for the synonym/antonym bank, bundled into the build (no runtime file
  dependency).
- **Global stats now include the behavioural traits** (persistence + spelling) in a VISIBLY SEPARATE
  section with a divider and a note that these are behaviour, not cognition - kept distinct from the
  cognitive ratings on purpose. Same consent + suppression discipline.
- Roadmap: footer restyle queued (it is now two rows).
## v0.32.0 - Factoids on all cards, spelling metric, broader verbal acceptance

- **Every retention card now has a factoid** (110 cards across 8 decks). On a miss, a short, accurate
  fact appears beneath the answer - turning a wrong answer into a moment of learning. Hand-written per
  card via scripts/populate-retention-notes.mjs; seed updated to load the note (migration 0019 already
  added the column).
- **New spelling-accuracy metric** (like persistence: a measured behavioural trait, reported honestly).
  Each typed word answer records whether it was clean or accepted via typo tolerance; the stats page
  shows "Spelling: X% clean over N typed" once there are 20+ typed words. Migration 0020 + user_spelling
  table.
- **Verbal/word acceptance broadened.** Letter fluency already accepts ANY part of speech (not just
  nouns) by rule; now also accepts hyphenated and apostrophe word forms. Category fluency keeps the
  1-edit typo tolerance from v0.31. (Verbal-reasoning is multiple-choice, so spelling doesn't apply there.)
- Note: the off-by-one/typo tolerance and short/full-form acceptance from v0.31 cover the typed verbal
  challenges; numeric/exact challenges stay strict by design.
## v0.31.0 - Fairer answer matching: typos, short/full forms, miss factoids

- **New shared answer matcher** (src/lib/server/text/match.ts, 27 unit tests) used for free-text
  answers. It returns exact / fuzzy / none so callers can reward clean recall and gently penalise
  near-misses:
  - **Short/full forms accepted:** "tarantino" for "quentin tarantino", "einstein" for "albert
    einstein" (whole-word, must be a genuine abbreviation - "cat" never matches "category").
  - **Typo tolerance, length-gated:** 1 edit forgiven for 5+ letter words, 2 for 8+; SHORT words get
    zero slack so "cat" can't become "bat". Accent-insensitive ("cafe" = "café").
  - The dangerous over-matches are explicitly tested to be rejected.
- **Retention:** uses the matcher; a fuzzy match still counts but is capped below the fast-recall
  bonus ("close enough - a clean spelling scores a touch higher"). Exact equivalents like "co2" /
  "carbon dioxide" work via each card's accepted-alternates list.
- **Factoid on a miss:** retention cards gain an optional `note` (migration 0019); when you miss a
  card, a short factoid appears beneath the answer, turning a wrong answer into a moment of learning.
- **Category fluency:** a 1-edit typo of a listed word now counts (length-gated, can't turn a wrong
  word into a listed one). Letter fluency unchanged (already rule-based). Numeric/exact challenges
  (arithmetic, digit span) deliberately stay exact - fuzzy there would corrupt the measurement.
## v0.30.0 - Persistence panel + skip-gap insight

- **New "Persistence" panel under the radar** - consistency of showing up, treated as a measured
  behavioural trait (willpower & organisation), NOT a guilt-streak. A calendar heat-strip (each
  square a day, filled = practised) plus current run, longest run, days in last 30, and total active
  days. Deliberately kept OFF the radar: the radar measures cognitive domains (one comparable kind of
  thing); persistence is behavioural and temporal, so it sits beside the radar, not as an axis - and a
  calendar shows the over-time pattern far better than a spoke could. No loss-framing, no "don't break
  it"; copy explicitly notes rest is part of any real routine.
- **New skip-gap insight (long-term users only, 40+ active days).** Built into the existing insights
  engine with the same honesty gates: "When you return after a break of 3+ days, you tend to perform
  ~X% [better/lower] than when practising regularly." Strictly descriptive and BIDIRECTIONAL - if rest
  suits you, it says so; it never nags you to practise daily.
- Both reuse the tested comparison/honesty-gate machinery; gap bucketing sanity-checked.
## v0.29.0 - Version in footer + engagement/retention metrics (admin)

- **App version now shows in the site footer** (e.g. "v0.29.0"), read from package.json server-side.
- **New "Engagement & retention" admin panel - the metrics that actually matter.** Beyond raw counts:
  - Return rate (7d / 1d): of users whose first practice was long enough ago, what share came back on
    another day. This is the truest signal a training product works - a flood of one-time triers means
    little; repeat use is what validates it.
  - Repeat users (2+ distinct days = validation-grade) vs. one-and-done.
  - Avg practice days per user, median attempts per session, busiest local hour (+ its share).
  - Rates show '-' until at least 10 eligible users, to avoid noise from tiny samples.
- Deliberately NOT just more vanity counters: the focus is on actionable signal (are people coming
  back, how deep do sessions go, when is the load) rather than feel-good totals.
## v0.28.0 - Website metrics + referrer tracking (admin)

- **New "Website metrics" panel at the top of /admin** (operational, real users only - test/
  simulated excluded): registered users, anonymous users, active now (last 15 min), active today,
  registered-who-practised, signups (24h/7d), anonymous runs (24h/7d), and visits (24h).
- **New "Top referrers" panel** - first-visit referrer hosts over the last 30 days, plus visit
  totals (24h/7d/30d). 'direct' = no referrer (typed URL/bookmark/app).
- **Privacy-respecting referrer capture:** a new visit_events table (migration 0018) logs ONLY the
  referrer host + landing path + timestamp, once per browser (cookie-gated), never linked to a
  user. Aggregate traffic analytics, not per-person tracking - consistent with the brand.
- Honesty note: true anonymous->registered conversion isn't directly measurable (the upgrade reuses
  the same user row without recording it was once anonymous), so instead of a misleading "converted"
  number we report "registered who have practised" - an honest proxy, clearly labelled.
- These live in admin for now; a curated public version can come later once we decide what's worth
  showing.
## v0.27.1 - Fix /stats 500 (scaleLo not defined)

- **/stats was 500-ing with "scaleLo is not defined".** When the radar scale was rewritten for
  population-anchoring (v0.27.0), scaleLo/scaleHi/span moved from module scope into the norm()
  function - but the ring-label line (the honest rating numbers on each ring) still referenced
  scaleLo/span at the top level, which no longer existed. Replaced it with an invNorm() that is
  the proper inverse of the new scale, so the printed ring values stay truthful under both the
  population-anchored path and the adaptive fallback. Verified the anchor maps to its ring and
  labels increase monotonically outward.
- Another runtime-only failure (compiles clean; only breaks when the component actually renders).
  Audited the whole RadarChart template for other undefined references - none remain.
## v0.27.0 - Population-anchored radar + honest comparison caveat

- **The radar now anchors to the population, so two users' charts are comparable.** Previously the
  scale floated to each user's own peak, which made the same population median land at a different
  radius for everyone - radars looked nothing alike and the population line meant nothing. Now the
  population median sits at a fixed reference ring (60% radius) on every chart, and your shape reads
  as deviation from it: bulging outside where you're above the median, inside where you're below.
  This is the comparison people actually share these for. (Falls back to the old adaptive fit when
  there's no population data yet.)
- **Missing population data now shows an honest gap.** The population is drawn as a dot per axis that
  has real (unsuppressed) data; an axis with no/suppressed population data simply gets no dot, instead
  of the old behaviour of collapsing the line onto the user's own value (which falsely implied the
  crowd equalled you there).
- **Added an honest "who is everyone?" caveat** under the radar and on the global stats page: Excogni's
  users are mostly people who actively seek cognitive training, not a random cross-section - so sitting
  below the median here doesn't mean below-average in the general population. This protects users from
  misreading the comparison (and is just true).
## v0.26.2 - Plain hyphens, homepage redirect, FAQ roadmap

- **Normalized all dash punctuation to plain hyphens** across the site text (272 total) -
  a purely aesthetic preference. age_band values were normalized too (18-24); since
  age_band is a stored key, migration 0017 converts any existing rows so filtering/insights stay
  consistent.
- **Logged-in (registered) users hitting the homepage now go straight to /practice** - they want
  to practise, not re-read the pitch. Anonymous and logged-out visitors still see the homepage.
- ROADMAP: added a distant-future FAQ page item (to be seeded from real HN/tester questions after
  launch, not guessed up front).
- Note on insights population comparison: currently only the under-6.5h-sleep bucket compares
  against the community; it's a single wired slice of the framework and won't fire until >=50
  consented community sessions exist. Expanding to all factors is best done once real data exists
  to test against.

## v0.26.1 - Fix /stats 500 (insights date/text join)

- **The whole /stats page was 500-ing** with "operator does not exist: date = text". Cause: the
  new insights queries join attempts (a text 'YYYY-MM-DD' derived via to_char) against
  session_context.local_date - which is actually a DATE column in the DB (the 0014 migration
  created it as `date`, though the Drizzle schema labels it text). date = text has no operator.
  Fixed by casting the date side to text (sc.local_date::text) in both the personal and
  population insight joins; date::text is ISO 'YYYY-MM-DD', matching the to_char output exactly.
- This was a runtime-only failure: the TypeScript compiles cleanly because the type clash only
  exists at the database layer, not in the code. Caught by the first real boot, as usual.
## v0.26.0 - Insights: honest, self-updating performance patterns

- **New "Insights" section under the radar.** It surfaces correlational patterns between your
  logged context (sleep, caffeine, alertness, mood, nap, time of day) and your performance - e.g. "You tend to perform about 18% better feeling alert than feeling tired." Three honest
  states: not-enough-data (with a clear explanation), no-strong-patterns (itself honest info),
  and found-insights.
- **Built around honesty gates, not flashiness.** An insight only appears if it clears ALL of:
  enough sessions in EACH compared bucket (>=8), a large-enough effect (>=10% relative, Cohen's
  d >=0.4), and statistical significance (Welch's t-test p<=0.05). Confidence is labelled
  (moderate/strong). Wording is strictly correlational ("tend to", "when you've reported") - never causal. The whole engine is unit-tested (21 tests) to prove noise is rejected and small
  samples never report.
- **Self-updating / self-removing.** Insights are recomputed each visit, so one that stops
  holding as new data arrives simply disappears - no stale claims.
- **Population comparison (you vs everyone).** Where enough consented community data exists in
  the same context bucket (>=50 community sessions), it can show how you compare to the typical
  person in that state - conservatively gated, labelled "vs community".
- New module src/lib/server/insights/ (pure stats.ts + DB-querying index.ts), tests/insights-stats.test.mjs.
## v0.25.7 - Powerful global stats explorer + consent copy tightening

- **Global stats is now a powerful multi-filter explorer** - the flagship feature. You can group
  by any dimension (age, country, education, language, handedness), stack filters (e.g. group by
  country, filtered to a specific age band AND education), and focus on a single skill or overall.
  Every view is a shareable URL; works without JavaScript (GET form).
- **The 50-floor is enforced on every final group, always.** However the population is sliced, any
  group with fewer than the public floor (>=50) of people is never shown - and the matched-total is
  itself withheld if it's below the floor (differencing guard). This is what makes powerful slicing
  safe: you can explore freely without any small group ever being exposed.
- CSV/JSON exports honor the active group-by + filters + skill.
- **Stats page navigation:** added a clear "Global stats →" button; removed the practice launcher
  buttons (Retention/Reaction/Start mixed) from the stats top - those live in the Practice tab.
  Renamed the stale "Dashboard" label to "Your stats". The global page is branded "Global stats".
- **Consent + about-you copy tightened** - the welcome consent line and settings copy were verbose
  and mixed first/second person; rewritten concise and consistent. Still one genuine opt-in,
  default-off, with an expandable "What does this cover?" for the detail. App fully usable without it.
## v0.25.6 - Consistent end buttons + anonymous reset ("let a friend try")

- **Consistent practice end buttons.** Post-session buttons across run/retention/reaction/
  summary said "Dashboard" (stale - that page is /stats now); all now say "Stats". In-session
  exits are consistent: "← Exit" (retention/reaction) and "End" (mixed run, which goes to its
  session summary recap).
- **"Reset for a new person"** - anonymous users get a reset control in Settings that ends this
  browser's session and starts a fresh anonymous account, for letting someone else try on a
  shared device. The old anonymous data stays in the DB (still useful in aggregate) but is
  unlinked from this browser. Refuses for registered users (they should log out, which keeps
  their account).
- **Confirmed (already worked, no change needed):** anonymous users' attempts/ratings ARE
  logged (real user row, tagged is_anonymous=true, fully filterable in queries); and the
  anonymous→registered upgrade preserves all data by updating the SAME user row (same id), so
  history carries over automatically on register/login.
## v0.25.5 - Much bigger fluency word lists (fewer false rejections)

- **Category-fluency accept-lists were far too small**, so valid common answers got no hit - e.g. ANIMALS had only 56 entries, so naming lynx/badger/weasel/raccoon counted as wrong.
  Substantially expanded 22 category lists: animals 56→202, countries 40→118, professions
  30→68, birds 32→74, body parts 36→74, fruits/colors/sports/etc. all roughly doubled+.
- Done via a repeatable script (scripts/expand-fluency-lists.mjs) that unions curated word
  sets into the existing lists - idempotent, reviewable, offline. Farm-animals kept to its
  correct narrower set (not the full animal list).
- This sharply reduces false rejections but is a PARTIAL fix by nature - no finite list is
  ever complete. The deeper "how should fluency validate" deliberation (rule-based vs lexicon
  vs reframe as productivity count) remains on the roadmap.
- Letter-fluency unchanged (already rule-based). All challenge tests pass.
## v0.25.4 - Imminent polish: footer wording + toggle-all categories

- **Footer "What this is" → "Learn more"** - consistent wording with the home button and nav.
- **"Select all / Clear all" for practice categories** - one control above the 16 category
  checkboxes that selects every implemented category (or clears them), instead of clicking each.
  It flips the checkbox state and persists via the same form-submit path as an individual toggle;
  the label flips between "Select all" and "Clear all" based on current state, and only touches
  implemented categories.
## v0.25.3 - One consent checkbox (smoother onboarding)

- **Collapsed the two consent checkboxes into one.** The welcome flow asked two related-but-
  distinct questions (aggregate stats vs. longitudinal dataset) which created an onboarding
  "wall". Now it's a single clear opt-in - "Share my anonymised results to help the science" - with a "What exactly does this cover?" expandable that preserves the full transparency (both
  uses, de-identified, revocable, never required to use the app) for anyone who wants the detail.
- The single checkbox sets BOTH underlying flags (`consented_stats` + `consented_data`) together,
  so nothing downstream changed - gating/queries are untouched. Settings consent toggle now keeps
  both columns in sync too.
- Consent remains a genuine, default-off, affirmative opt-in (GDPR-appropriate) and the app stays
  fully usable without it - only the optional research contribution is gated.
## v0.25.2 - Dashboard/stats merge cleanup; blink bug; nav dedupe

- **Fixed the recurring "extra answer then blink" bug** (this time properly). Cause: during
  feedback, the window Enter handler advances - and the SAME Enter that submitted an answer (or
  a held/auto-repeating Enter) could immediately advance, flashing feedback for one frame before
  the next question. Now: Enter auto-repeat is ignored, and advancing requires a 350ms dwell on
  feedback, so the submit-Enter can't double as an advance-Enter.
- **Dashboard fully merged into /stats** - /stats is now the user home (practice launchers on
  top, full analysis below); /dashboard is a permanent 308 redirect so old links work.
- **Removed the duplicate nav item** - both "Dashboard" and "Stats" pointed at /stats; now a
  single "Stats" entry in the primary nav.
- (Home page already reads "Proceed without account" and "Learn more →".)
## v0.26.0 - Merge dashboard into stats; clearer home-page labels

- **Dashboard and Stats merged into one page** (at /stats, the user's home). The two overlapped
  confusingly - both showed your rating. Now one coherent page: practice launchers (Mixed /
  Retention / Reaction) and the anonymous-user register prompt on top (the "do"), then the full
  analysis below - radar, rating, history, categories, patterns, records, distribution, and the
  last-session summary brought over from the dashboard (the "reflect"). /dashboard now 308-redirects
  to /stats so old links/bookmarks still work; all in-app links updated. Nav, title, and heading
  are consistently "Dashboard".
- **Home page labels clearer:** "Give it a try" → "Proceed without account" (honest about what
  it does - starts an anonymous session, no registration), and "What this is →" → "Learn more →".
## v0.25.1 - Fix production build (module-scope DB query)

- **The prod build failed** with "DATABASE_URL is not set" during SvelteKit's post-build
  analyse step. Cause: `DIM_SQL` in stats/public.ts (added with the breakdowns in v0.19.0) was
  a MODULE-SCOPE constant that called pg`...` at import time - which fires the DB client during
  the build, when no DATABASE_URL exists. Made it a lazy function (dimExprFor) that builds the
  fragment at query time instead. The DB client itself was already correctly lazy; this was the
  one place a query ran at import.
- Scanned the whole server tree - no other module-scope pg queries - and added that scan to the
  verification routine so this build-only failure class (invisible to type-checks and unit tests)
  is caught in future.
- Cleaned up a harmless warning: removed the unused `confidence` prop from RatingReadout.
- (The remaining a11y / autofocus build warnings are non-fatal and unchanged.)
## v0.25.0 - Open-source prep (no app changes)

- Added the scaffolding to publish Excogni as an open-source project, without changing how the
  app runs:
  - **LICENSE** - AGPL-3.0 (header + copyright in place; drop in the canonical full text from
    gnu.org before publishing). package.json `license` set to `AGPL-3.0-only`, repo/homepage added.
  - **CONTRIBUTING.md** - setup, stack conventions (Svelte 4 not 5, immutable migrations),
    the honesty/privacy ground rules, pre-PR checks, good first contributions.
  - **SECURITY.md** - private disclosure path + self-hoster hardening checklist + honest
    known-limitations note.
  - **CODE_OF_CONDUCT.md** - Contributor-Covenant-style.
  - **.dockerignore** - keeps build context clean, never copies .env/secrets/native folders.
  - **.gitignore** hardened - explicit secret safety (.env ignored, .env.example kept).
  - **README** - added positioning + self-host/contributing/security links up top, and an
    honest "Known limitations" + Contributing + License section (the limitations section is
    deliberately prominent - it's what earns trust on launch).
- Pre-publish secret sweep: no .env committed, no API keys / private keys / tokens in source,
  .env.example holds only placeholders. App verification unchanged - all 7 suites pass.
## v0.24.6 - Symbol-count overflow, radar label clip, "you (now)"

- **Fixed symbol-counting overflow.** The dots/asterisks to count rendered on one non-wrapping
  line; past ~30 symbols it overflowed the container and broke the layout. Now it wraps within
  the column and scales the font down as the count grows (>20 and >40 thresholds).
- **Fixed clipped radar label.** "Processing Speed" (the longest domain label) had its final
  letter cut off on the right edge, on both the page and the exported image. Widened the SVG
  horizontal padding so all labels fit with room to spare; the export inherits the fix.
- **Radar "now" → "you (now)".** The amber shape is now labelled "you (now)" instead of just
  "now", so the contrast that matters - you vs. your range vs. everyone - reads clearly, while
  keeping the honest note that it's your current state. Updated on-screen and in the export legend.
## v0.24.5 - Ambient sound: make it actually audible

- The sound was working all along (browser showed the speaker icon, status read "playing") - it was just inaudible: the pad was at 110/165 Hz, below what laptop/phone speakers can
  reproduce, at very low gain. Moved it up to an audible range (A3-E4-A4, ~220-440 Hz, which
  every speaker handles), switched sine→triangle for a little warmth/harmonics, and raised the
  level to gentle-but-hearable (peak ~0.2 amplitude, no clipping). It should now be clearly
  audible while staying calm and ambient.
## v0.24.4 - Remove redundant Skip button; legend on exported radar

- **Removed the redundant "Skip" button** on the pre-session questionnaire. It did the same
  thing as "Start practice →" (both just begin the session; the questionnaire was already
  fully optional - leave any field blank). One clear button now. Copy still notes fields are
  optional and never affect your score.
- **Exported radar image now has a legend.** The PNG keepsake gained a centered legend row
  (between radar and footer) with the actual line styles - amber "now" (solid), white "your
  best" (long dash), red "your lowest" (short dash), blue "everyone (median)" (dots) - so a
  shared image is self-explanatory. Only includes the lines actually present.
- ROADMAP: added the verifiable-share-link + QR-on-export idea (anonymous read-only shared
  radar via xcgni.com), with its privacy/token/snapshot/revocation design notes.
## v0.24.3 - Fix build break in AmbientSound (stray brace)

- A stray duplicate closing brace in AmbientSound.svelte's start() broke the Vite/Svelte
  build ("Unexpected }"). Removed it. Added a JS-brace balance check to the verification
  routine so this class of error (which the Svelte-block counter doesn't catch) is flagged
  next time. Build compiles again.
## v0.24.2 - Radar prominence, session-end fix, sound diagnostics

- **Radar planes dialled up.** Best/lowest/population lines were too faint and white-vs-blue
  too close. Now each has a distinct signature on three axes at once: color + width (all
  1.75px, brighter colors) + dash pattern - white "best" = long dashes, red "lowest" = short
  dashes, blue "everyone" = fine dots, amber "now" = solid+fill. Legend shows real dash
  swatches so the key matches the lines.
- **Fixed fleeting extra challenge at session end.** Two causes: (1) after a level-up confirm
  question at the session boundary the code could auto-advance and briefly fetch one more
  challenge before ending - now it ends cleanly; (2) the Enter key and the auto-advance timer
  could both call advance(), double-firing - added a re-entrancy guard.
- **Sound: still silent in Firefox with no console output → added on-screen diagnostics.**
  Reordered so the audio graph is wired before resume(), and the toggle now shows a tiny
  status readout (ctx created / resumed / playing / error) right next to it, so we can finally
  see what Firefox actually does on click. (Temporary diagnostic; removed once it's working.)
- ROADMAP: added the long-term cognition+personality "mega-radar" + social-matching idea with
  a full deliberation of its validity/privacy/safety/scope tradeoffs; and earlier, the fluency
  validation item flagged for deliberation.
## v0.24.1 - Ambient sound hardened for Firefox / Chrome / Edge

- Reworked the Web Audio startup to be robust across engines: resume the context and AWAIT
  it before scheduling anything, then anchor all timing (gain ramps, oscillator start) to the
  post-resume clock - this is what Firefox in particular needs; scheduling against a still-
  suspended clock was why nothing played. Oscillators now start at an explicit anchored time.
- Added a re-entrancy guard so rapid on/off toggles can't race, and a bail-out if the user
  toggles off while the async resume is still in flight. webkitAudioContext fallback retained.
- Toggle now reads more clearly: amber ♫ "Sound on" vs muted ♪ "Ambient sound".
## v0.24.0 - Fluency space-to-submit, sound fix, rotation wording, radar colors + population line

- **Word lists: space locks in a word** like Enter (and comma). Type a word, hit space, it's
  captured - the natural way to do fluency input. Placeholder updated to say so.
- **Ambient sound fixed.** It never played because the AudioContext starts *suspended* until
  a user gesture and we weren't resuming it; the gain ramp also targeted zero. Now resumes
  the context on toggle and uses exponential fades, so it actually sounds.
- **Mental rotation wording clarified.** All 72 rotation challenges now ask "Which figure is
  the same shape turned (rotated) - not flipped or mirrored?" - removing the rotation-vs-
  mirror ambiguity that muddied what the task actually tests.
- **Radar colors reworked for visibility + meaning.** Current = solid amber (you, now);
  your best = white dashed; your lowest = red dashed (was faint green/grey, hard to see on
  the dark ground). A small legend decodes them.
- **Radar population line (blue).** Optional blue dotted line = the consented population's
  *median* per domain (the honest statistic for skewed bounded ratings), excluding you so it
  reads as "everyone else". Suppressed below the public floor, so it only appears once there
  are enough consented users (and in STATS_PREVIEW now) - never computed from a handful.
## v0.23.1 - Fix: level-up question auto-skipped before you could answer

- **Bug:** after an answer that triggered a level-up, the auto-advance timer (added in
  v0.20.0) would fire and jump straight into the level-up "confirm" question - so it looked
  like the question switched on its own before you'd engaged with it. The auto-advance and
  the level-up confirm were stepping on each other.
- **Fix:** auto-advance now runs ONLY for an ordinary next question. When a level-up is
  pending, entering the confirm question is manual - the feedback shows a clear
  "Level-up question →" button (and an accent hint "You leveled up - ready for a harder one
  to confirm it?") with no auto-advance bar, and waits for a click or Enter. Leaving the
  confirm question still auto-advances normally, so only *entering* it is manual.
- This was purely client-side sequencing in practice/run; no scoring or data change, so old
  user data isn't involved - anyone would have hit it after a level-up.
## v0.23.0 - Radar min/max planes + admin age filter fix

- **Radar now shows your personal range.** Alongside the solid amber current shape (a real
  snapshot), the radar draws two faint dashed planes: your best-ever (green) and lowest-ever
  (grey) rating in each domain, from rating_history. Today's shape sits inside your historical
  band. Honest small-print clarifies the planes are composite envelopes - those peaks didn't
  all happen at once. Scale adapts to include the extremes so the max plane always fits.
  New `userDomainRanges()` query; RadarChart takes an optional `ranges` prop (no ranges →
  unchanged single-polygon behaviour, e.g. the PNG export).
- **Fixed: admin Explore age filter.** It still filtered on birth_year (which new age_band
  users don't have), silently missing them. Now an age_band dropdown. This removes the last
  birth_year query reference - the column remains only as a kept-for-legacy schema field.
## v0.22.1 - Consistency fix: age_band everywhere (found in review)

- A code review found drift after the v0.20.0 age_band switch: onboarding wrote age_band but
  the **settings page still edited birth_year**, and **both data exports still emitted
  birth_year** (null for all new users). Fixed: settings now uses the age_band dropdown (plus
  country/language dropdowns, matching onboarding); admin CSV and personal exports use the
  age_band column directly. birth_year column is kept (not dropped) for any legacy data.
- Flagged (not fixed - admin-only, non-crashing): the admin Explore age-range filter still
  filters on birth_year, so it misses new users until converted to an age_band selector.
## v0.22.0 - Mobile variants: multiple apps, one backend

- **Variant system** so you can ship several apps (serious / playful / kids) from one
  codebase and one backend, customised and duplicated easily rather than hand-edited.
- `variants.config.ts` defines each flavor in one place: app id, name, theme, server URL,
  and feature switches. `node scripts/make-variant.mjs <key>` generates that variant's
  `capacitor.config.ts`; then the normal `cap add/sync/open` flow builds it.
- Three starter variants: **Excogni** (serious, default), **Mind Gym** (playful),
  **Brain Quest** (kids - conservative: questionnaire/consent/account/public-stats OFF).
- Each variant loads the same site with `?variant=<key>`; the server persists it and exposes
  `data-variant="<key>"` on the layout root, so a variant can be themed purely in CSS
  (`[data-variant="playful"] …`) with no separate front-end.
- **Kids variant carries an explicit warning** (in variants.config.ts and MOBILE.md): the
  flags are a starting posture, NOT compliance. A real kids app needs its own COPPA / GDPR-K
  / child-safety / parental-consent pass before shipping - flagged, not hand-waved.
- MOBILE.md documents the full multi-app workflow.
## v0.21.0 - Capacitor mobile scaffold

- **Mobile app scaffolding** so a real iOS/Android build is a few commands away on a machine
  with Android Studio / Xcode. Because Excogni is SSR (server-side scoring + Postgres), the
  chosen architecture is a **native shell that loads your deployed server** - one codebase,
  one backend, web and mobile always in sync, web fixes ship without an app-store update.
- Added: `capacitor.config.ts` (app id, dark splash/status bar, server.url to your origin),
  Capacitor deps + `cap:*` npm scripts in package.json (install on your machine - needs
  network), a native-capability bridge (`src/lib/native.ts`: haptics, share, splash - real
  on native, no-op on web, so the app passes store review as a legitimate app not a bare
  webview), a subtle haptic tap on answer feedback, and `MOBILE.md` with the full runbook.
- The container here has no network / Android SDK / Xcode, so binaries can't be produced
  from here - MOBILE.md gives the exact `npx cap add android/ios` → `cap sync` → `cap open`
  steps. Native folders are gitignored.
- Noted follow-ups: device push-token endpoint (backend), app icon/splash assets (design),
  push notifications of the "serving not compelling" kind.
## v0.20.0 - UX wins from the data-reviewer feedback

- **Dropdowns for demographics.** Country, native language, and age (as a band) are now
  dropdowns instead of free text - cleaner input and, crucially, consistent values so the
  public breakdowns actually group correctly (free-text country would fragment). Shared
  option lists in src/lib/demographics.ts; age stored as a band (privacy-friendlier than a
  precise birth year). Migration 0016 adds age_band.
- **Radar fills to the data, honestly.** The cognitive-fingerprint radar no longer sits
  perpetually half-full - it now scales to your actual rating range so the shape is
  readable, with the rating value shown at the rings so a strong-looking polygon is read
  relative to the real scale, not mistaken for absolute. (Honest scaling, not flattery.)
- **Auto-advance after each answer.** Feedback now shows with a thin progress bar that fills
  over ~2.6s and advances to the next challenge automatically - no clicking required. The
  manual Next button and Enter still work for anyone who wants to go faster.
- **Optional ambient focus sound.** A toggle (default OFF) plays a soft, generated ambient
  pad while practising, for focus/comfort. Deliberately framed as ambient sound, NOT a
  clinical "beta waves improve cognition" claim - pleasant, honest, off by default.

Saved the not-yet-clear reviewer items (radar group/mean overlays, "yours over the years"
messaging, visual-first redesign, earned-value monetization timing) and the platform/mobile
strategy notes to ROADMAP.md for deliberate decisions later.
## v0.19.1 - Diagnostic on the empty stats state

- The /statistics empty state now says *why* it's empty: whether preview mode is on (and
  the seed needs re-running) or off (and STATS_PREVIEW needs setting + a rebuild). This
  makes the "I don't see filters" situation self-explaining - the breakdown filters live
  inside the populated view, so an empty page hides them; the diagnostic points at the cause.
## v0.19.0 - Extensive public statistics: breakdowns + open export

- **Public /statistics is now extensively explorable.** Slice the consented population by
  one dimension - age band, country, education, native language, or handedness - each
  group showing n, median rating, and IQR.
- **Open aggregate export**: every breakdown downloads as CSV or JSON (aggregate rows only,
  never individual records).
- **Stricter public privacy floor.** New `PUBLIC_MIN_CELL` (default 50, always >= the admin
  floor of 20) - higher precisely because this surface is openly filterable and exportable.
  Any group below the floor is withheld entirely; the page reports how many were suppressed.
  Suppression re-checks each *final* group, so a small slice can never surface.
- **Differencing** (inferring a withheld group by subtracting two permitted cuts) is noted
  as a known limitation: v1 offers single-dimension breakdowns rather than nested filters to
  limit it; fuller protection is a future hardening item. Flagged honestly in DOCUMENTATION.md
  rather than overclaimed.
- Documented in DOCUMENTATION.md (new section 8b). `PUBLIC_MIN_CELL` wired into both compose
  files and .env.example. Simulated users still excluded from the real page (preview mode only).
## v0.18.4 - Fix: STATS_PREVIEW never reached the container

- **The real reason the /statistics preview stayed empty:** the dev docker-compose.yml
  passes a fixed list of env vars into the app container's `environment:` block, and
  STATS_PREVIEW wasn't in it - so setting it in .env had no effect inside Docker. Added
  `STATS_PREVIEW: ${STATS_PREVIEW:-false}` to the compose env block; it now reads from .env.
- The Dockerfile, entrypoint (migrate + seed run on boot), seed, and stats code were all
  correct - this was purely compose env wiring. The seed already runs on container start
  with ENABLE_SIMULATED_USERS=true, so simulated consented users are created automatically;
  they just weren't being *shown* because the app never saw STATS_PREVIEW.

To see the preview: set STATS_PREVIEW=true in .env, then `docker compose up --build`
(rebuild so the container picks up the new env wiring). Reload /statistics.
## v0.18.3 - Seed diagnostic for stats preview

- The seed now prints how many simulated users have consent after running, so you can
  confirm the /statistics preview will populate (instead of guessing). If it prints 0,
  the simulated block was skipped - set ENABLE_SIMULATED_USERS=true when seeding.
- No code fix needed for the "still empty" report: the cause is operational - simulated
  users created before v0.18.2 have no user_attributes/consent rows until the seed is
  re-run with the current code. Re-running the seed backfills consent onto them.

To populate the preview:
  1. .env: ENABLE_SIMULATED_USERS=true and STATS_PREVIEW=true
  2. ENABLE_SIMULATED_USERS=true npm run seed   (watch for "simulated users with consent: N")
  3. restart, reload /statistics
## v0.18.2 - Statistics preview mode (for demoing before real users)

- **Public /statistics can now be populated with simulated data for demos**, behind the
  `STATS_PREVIEW` flag. When on, simulated users are included and the page shows a clear
  "Preview - includes simulated data" banner so it's never mistaken for real population
  data. The real public page is unchanged: simulated users stay excluded and consent is
  required.
- The seed now gives simulated users consent + varied demographics (country, language,
  education, handedness), so preview mode demonstrates the distribution, per-category
  medians, and (in admin) the demographic slices.
- **Prod-safe by design:** `STATS_PREVIEW` is hardcoded `false` in the production compose
  override, alongside the other dev flags - synthetic data can never leak into the real
  public page in prod even if the var lingers in .env.
- Roadmap note added for a future cleaner form (an admin-gated `?preview=1` instead of an
  env flag); current form is safe, low priority.
## v0.18.1 - Fix: /welcome 500 (consented_data column not applied)

- **Fix**: submitting the first-run questionnaire errored with
  `column "consented_data" of relation "user_attributes" does not exist`. The column was
  added by appending an ALTER to migration 0014 - but 0014 was already recorded as applied,
  and the runner skips migrations it has already run, so the new line never executed.
  Migrations must be immutable once applied. The ALTER now lives in its own fresh migration
  (0015_consented_data.sql), which the runner picks up regardless of 0014's state. Idempotent
  (ADD COLUMN IF NOT EXISTS), so it's safe whether or not the column already exists.
- Verified every column the /welcome insert writes is backed by a migration.

Run migrations (or rebuild, which runs them on boot) to apply 0015 before using the
first-run questionnaire.
## v0.18.0 - Three questionnaires, fluency scoring fix, slider fix

**Fix: verbal-fluency miscount.** Letter-fluency ("words starting with B") was scored
against a finite ~50-word accept-list, so most valid words a user typed were ignored - 7 real B-words counted as 1. Letter-fluency now validates by the *rule* (starts with the
letter, alphabetic, 2+ chars, unique) instead of a hand-listed set. Category-fluency
(animals, etc.) still uses its accept-list. (A dictionary check to also reject non-words
stays roadmapped.)

**Three-questionnaire structure** (by cadence):
- **First-run** (once, in /welcome): the intro carousel now ends with an optional "About
  you" step - birth year, country, native language, education, handedness - plus the two
  layered consent checkboxes (aggregate stats; long-term anonymised research data). Saved
  to user_attributes, editable later in Settings.
- **Daily** (first session of the local day): hours slept.
- **Per-session** (every run): caffeine, alertness, mood - plus the nap checkbox on later
  same-day sessions.

**Fix: sleep slider looked pre-set.** The untouched slider sat at the midpoint looking like
a real answer; it now reads "not set" and shows dimmed/inactive until dragged, so an unset
value is visibly unset (and stays null in the data).

**New:** `consented_data` column (layered consent) added to user_attributes (migration 0014).
## v0.17.0 - Pre-session questionnaire (state-covariate capture)

- **New one-page questionnaire at the start of a practice session.** Optional and fully
  skippable - never affects the score. Captures the state covariates we'll need to study
  how condition affects performance (and eventually tell users when they personally
  function best).
- **Cadence per the spec:** sleep ("hours slept last night") asked once on the first
  session of the user's local day; later same-day sessions show a "had a nap?" checkbox
  instead. Caffeine, alertness, and mood asked every session. Device type auto-detected,
  not asked.
- New `session_context` table (migration 0014), `sessions/context.ts` (cadence + validated
  save), API endpoint, and `SessionContextForm` component. The run page now opens in a
  'context' phase that begins the session on submit/skip.
- Privacy: this is covariate data, not rated, never part of the cognitive score; it'll fall
  under the same consented/anonymised aggregate rules as everything else.

Built ahead of the data review - fields and scales are easy to adjust once the data
reviewer weighs in (e.g. caffeine as mg, mood scale points, sleep buckets).
## v0.16.1 - Fix: public /statistics 500 (consent column on wrong table)

- **Fix**: the public statistics page errored with "column a.consented_stats does not
  exist". The new public-stats queries checked `consented_stats` on the attempts alias
  (`a`), but that column lives on `user_attributes`. The queries now join
  `user_attributes ua` and check `ua.consented_stats` - matching how the (working) admin
  queries do it. (Surfaced by the Health panel, as designed.)
- While fixing, removed a latent second bug: the queries also had an unnecessary
  `JOIN attempts`, which would have multiplied rows per attempt and distorted the counts.
  And tightened the "rated" filter to the established standard (`attempts_count >= 10 AND
  rating > 0`) so the public page counts a rated category the same way every other query
  does - `rating` defaults to 0, so the previous `IS NOT NULL` check would have polluted
  the medians with unrated rows.
## v0.16.0 - Public statistics page (making the open-commons promise real)

- **New public `/statistics` page** - the aggregate population picture, open to everyone,
  no account needed. We were promising "global statistics, open to all" on the about and
  support pages but the page didn't exist yet; now it does, so the claim is true.
- Shows: count of rated consented users, overall rating distribution (binned), median +
  IQR, and median rating per category. New `stats/public.ts` module enforces the same
  integrity as the admin export - **consented users only, suppression floor on every group,
  no per-user data, no filtering, simulated users excluded.** No individual is ever shown.
- Honest empty state: until the pool clears the suppression floor, the page says so plainly
  ("showing nothing until it's safe to show something is the honest default, not a bug") - it fills in as real users arrive.
- Linked from the footer (every page) and from the global-statistics claims on the about and
  support pages, which now actually go somewhere.
- `/admin/explore` stays - its per-attribute filtering/drill-down is legitimately admin-only;
  the public page is the safe population-only view. Different purposes, both kept.
## v0.15.0 - Level progression: correct always advances

- **Design fix to the level ladder.** Previously a slow-but-correct answer held you in
  place (delta 0) - you could answer everything correctly yet never climb because you
  weren't fast enough. Now **a correct answer always advances the level** (fast +2, normal
  or slow +1); **failure is what normalizes the level downward.** Speed no longer *blocks*
  progression.
- Speed is unchanged where it belongs: in the **rating**. `scoreAttempt` still scores a
  fast-correct ~0.94 and a slow-correct ~0.45, so two people at the same level have
  honestly different ratings by speed - but a careful, always-correct solver now climbs to
  their true ceiling instead of being stuck artificially low. Cleaner separation: correctness
  drives *where you are*, speed drives *how good your number is there*.
## v0.14.2 - Deeper coverage of the level ladder & rating

- **rating suite 43 → 53 assertions**, targeting the thinnest real gap - the functions
  that produce the headline number:
  - `stableLevel`: the ≥3-attempts and ≥65%-accuracy qualification thresholds, the
    exactly-2/3 boundary, picking the highest qualifying level among several, and the
    fallback floored at 1.
  - `computeRating`: empty-recent → 0, both clamp bounds (floor 600 / ceiling 1900), and
    monotonicity - higher stable level and higher accuracy each raise the rating.
- Coverage is now deep where it matters most (the scoring core) and flat across suites.
  Remaining gaps are DB-coupled modules (session pipeline, admin queries, executive-function
  SQL) that need an integration harness rather than unit tests - a separate, larger effort.
## v0.14.1 - Strengthened the weakest test suites (and caught a real bug)

- **Bug found & fixed**: `validateAnswer(null, …)` threw instead of returning false - a
  malformed/empty challenge payload reaching the validator would have crashed the answer
  check. Now guards null/non-object answerData up front. (Surfaced precisely by the new
  tests below.)
- **Retention suite 18 → 35 assertions**: SM-2 grade boundaries (easy/good/hard interval
  and ease behavior), ease floor under repeated lapses, multiplicative interval growth,
  configurable measurement threshold, the exactly-5-reviews boundary, the zero-totalSeen
  divide guard, and mastery→rating monotonicity/range.
- **Challenges suite 18 → 33 assertions**: the empty-string-vs-correctAnswer-0 regression
  guard, negative numbers, comma+whitespace combinations, case-sensitivity, both-fields
  interaction, and null/undefined answerData (which is what caught the bug).
- Test-count distribution is now flat (24-43 across all seven suites); no thin outliers.
## v0.14.0 - Public transparency + the open/supported model, stated plainly

**Formulas page is now public** (`/formulas`)
- The "how every number is computed" page, previously admin-only, is now public - radical
  transparency as the product's whole thesis. Still live (imports real constants, runs real
  functions); the admin-only operational knob (suppression floor) is trimmed from the public
  view. The admin version stays for operators.

**Support / membership page** (`/support`)
- States the model plainly: the instrument, global statistics, and tools are free and open
  to everyone; the project is funded by people who choose to support it. One-time and monthly
  contributions framed as keeping a commons open (positive-sum), never as gated access.
  Members get recognition and a voice, never special data access - there is no tier that
  unlocks the science, because the science is already open. Payment plumbing is not wired yet
  (needs a provider + keys); this is the honest scaffold of the model ahead of the plumbing.

**The model made legible where it's encountered**
- About page now states it directly: free, open, anonymous aggregates, no ads, never sold,
  supporter-funded - with links to the formulas and support pages.
- Footer everywhere now reads "Free & open · anonymous · supported, not sold" and links
  What this is / How it works / Support.

No measurement logic changed. All seven test suites green.
## v0.13.0 - Admin formulas page (live, read-only) + correlation-matrix fix

**Admin formulas documentation page** (`/admin/formulas`)
- A new admin page documenting every formula the system uses - effective-time / anti-spoof,
  per-attempt scoring curve, category rating, SEM & confidence, percentile, estimation
  scoring, the SM-2 retention schedule, and the operational constants.
- It is LIVE, not static: the page imports the real constants and runs the real scoring
  functions on sample inputs, so the documented values and worked examples are computed by
  the same code the live app uses and cannot drift out of sync.
- Deliberately READ-ONLY. Measurement formulas stay in code (versioned, test-gated): a
  rating only means something if it's computed the same way for everyone over time, so
  changing one is an engineering decision with a version bump, not a setting. Operational
  knobs are listed for transparency too.

**Bug fix**
- Admin category-correlation matrix was unreadable - every category truncated to 4 cryptic
  letters (atte, esti, inhi…). Now: rows show full names + a clear 3-letter code, columns
  use the codes with a decoding legend, and the high-correlation callout uses full names.

Added a "Formulas" link to the admin nav.
## v0.12.2 - Retention flow: one fewer step, clearer deck picker

- **Removed a redundant step for new cards.** Learning a new card was three screens:
  prompt → reveal+"Got it" → a separate "Saved" confirmation → next. The "Saved" screen
  added a click without information. Now: prompt → reveal + "Got it - next" advances
  straight to the next card (the card is still recorded as seen in the background).
  The graded result screen now only appears for genuine due-card recall tests, where the
  outcome actually matters.
- **Deck picker is now a real, visible control.** Was a small muted "1 DECK ▾" in the
  corner; now a bordered button reading "Decks: All ▾" that invites interaction, so the
  themed decks (film, literature, philosophy, …) are actually discoverable.
- Due-card result now carries the ✓ / ✗ mark for colorblind-safe feedback, matching the
  practice runner.
## v0.12.1 - Fix: practice crashed on every challenge

- **Critical fix**: every practice session (mixed and single-category) errored with
  "GET_READY_MS is not defined". When the get-ready beat was added in v0.10.0, the edit
  that changed the constant's value accidentally deleted its `const` declaration, leaving
  two usages referencing an undefined variable - a runtime crash that static checks
  (node --check, block-balance) don't catch because the reference is syntactically valid.
  Declaration restored.
- Added a project-wide scan for SCREAMING_CASE identifiers used but never declared, to
  catch this class of runtime-only bug in future verification.

## v0.12.0 - On-brand visual additions (dark, instrument-language)

**Domain glyphs**
- New `DomainGlyph` component: one minimal, geometric, line-based icon per cognitive
  domain (monochrome, currentColor, shared 1.5 stroke - drawn in the instrument
  language, not decorative). Shown beside each domain panel on the dashboard for faster
  scanning and recognition. Deliberately NOT added to the radar (its label-positioning
  is delicate and already clip-tuned; glyphs there would be high-risk, low-reward).

**Accessibility: feedback beyond color**
- Correct/incorrect results now carry a ✓ / ✗ mark alongside the word and the color, so
  the signal no longer depends on color perception alone (colorblind-safe redundancy).

**Polished profile export**
- The "Save as image" cognitive-profile PNG is now a composed keepsake: a header band
  with the EXCOGNI wordmark and the global rating, a framed radar, and a dated footer
  with an honest caption ("a shape, not a score · not a clinical measure") - so even
  when shared it stays true to the product's claims. Was previously just the radar on a
  flat background with one caption line.

Kept fully dark by design - no illustrations, mascots, or celebratory graphics.
## v0.11.0 - Themed retention decks + deck picker, stronger reaction tests

**Themed retention decks (interest-based)**
- Added four interest decks - Film & cinema, Literature, Philosophy, General knowledge - doubling the retention content from 4 decks / 54 cards to 8 decks / 110 cards. Makes
  spaced repetition fun without changing how retention is measured.
- **Deck picker** on the retention screen: choose which interests to learn new cards
  from. Important integrity detail - the filter only narrows NEW cards; cards already
  *due* for review always surface regardless, so a theme choice can't break the
  spaced-repetition schedule.

**Tests**
- Reaction suite strengthened from 12 to 25 assertions (it was the thinnest): the 80ms
  physiological floor, band never collapsing, monotonicity of band edges and score,
  calibration fallbacks, the refresh-rate contribution to uncertainty, and hard score
  clamping at both extremes.

**Roadmap**
- Captured the design discussion: themed decks (done), a future unrated memory-technique
  mode (method of loci etc.), an engagement principle ("support consistency through
  tools the user controls, never mechanics designed to compel") with forgiving streaks /
  self-set goals / honest recap as the humane options, and human-connection concepts
  (cooperative weekly challenge, training partners by consistency, cooperative escape
  rooms) flagged with their real infra/design costs.
## v0.10.0 - Content depth, logic variance, smoother pacing, more tests

**Logical-reasoning variance (was a real flaw)**
- The L1-4 syllogisms were all the *same* shape: `A>B, B>C ∴ A>C`, only names/relation
  changing - so a solver could pattern-match the format instead of reasoning. Rewrote
  them with four interleaved structures: forward chain, reversed-relation phrasing,
  converging (`A>B, C>B` → indeterminate), and diverging (`A>B, A>C` → indeterminate).
  A steady ~1/3 of items are now genuinely "Cannot be determined" (was 0%), so the
  answer can't be guessed by always avoiding it.

**Content depth (thin banks filled out)**
- verbal_fluency 8 → 16 prompts (more starting-letter / word-pattern variants per level)
- retrieval_fluency 16 → 24 prompts (added farm animals, drinks, clothing, games,
  shapes, flowers, languages, units - each with a real accept-list)
- Total challenges 2,665 → 2,681.

**Pacing**
- Challenges no longer snap in instantly. Every challenge now gets a short "Get ready…"
  beat (~600ms) before it appears, not just memory tasks - a calmer rhythm between items.

**Tests**
- New scoring-helpers suite (26 assertions): percentError, estimationScore (both the
  population and cold-start branches), and ordinal - including the 11th/12th/13th teens
  trap. Seven suites total now.
- README challenge count updated.

## v0.9.2 - Unified practice category cards

- **The category cards are now the selection surface.** Each card carries both an
  "In mix" checkbox (include this category in mixed practice) and a "Train this"
  button (run it on its own). Ticking auto-saves immediately via `enhance` - no
  separate "Save selection" button.
- **Removed the bolted-on save-form**: the standalone "Mixed practice categories"
  checkbox section that read like a misplaced settings panel is gone; its job now
  lives on the cards where you actually choose.
- The "Start mixed practice" button reflects the live count of ticked categories.
- Hardening: `setEnabledCategories` now validates slugs against real implemented
  categories before persisting (matches the settings-page guard).

## v0.9.1 - Dashboard by domain, nav cleanup

- **Dashboard grouped by cognitive domain**: the flat 16-category grid is replaced
  by ~9 domain panels (matching the radar's super-categories). Each panel shows a
  domain-average rating and its categories as compact rows (rating + 7-day delta, or
  "practice →" when unrated). Much calmer first impression; mirrors the radar so the
  two views reinforce each other. Category routing unchanged (rated → stats, unrated →
  practice, retention/reaction → their screens).
- **Nav cleanup**: removed the redundant "Categories" account-menu item - it pointed
  to `/practice`, duplicating the "Practice" tab.
- Category rating views now carry their `domain` (used for the grouping).

## v0.9.0 - Robustness pass, test coverage, content depth

**Audit + fixes**
- Extracted `validateAnswer` into a pure, dependency-free module (`challenges/
  validate.ts`) - and fixed a latent bug found while doing so: an empty answer
  string coerced to `Number('') === 0`, so `correctAnswer: 0` wrongly matched ''.
  Now guarded.
- Settings now validates submitted category slugs against real implemented
  categories before persisting (was storing arbitrary form input).
- Broad audit of the pipeline (pg() identifier misuse, API auth/guards, double-submit,
  parse safety, null access, division-by-zero) - no other issues found; the scoring
  and session paths are sound.

**Test coverage**
- New suite for `validateAnswer` (numeric/string/decimal-comma/digit-span/empty/
  malformed - 19 cases).
- Email validator suite (30+ cases) and challenge suite now run alongside the
  existing rating/admin/retention/reaction suites - six suites total.

**Content depth**
- Verbal reasoning deck expanded from 81 to 97 unique items (more synonyms,
  antonyms, analogies per level), with generation-time de-duplication so repeated
  prompts can't slip in.

**UX**
- Session summary gains an actionable next-step line (e.g. "X lagged the rest - a
  focused session there would even out your profile"), derived from how the session
  actually went.

## v0.8.4 - Proper email validation

- **Fix**: the login form only checked for an `@` and length, so junk like `m@m.m`,
  `a@b`, and `foo@bar` passed. Added a real validator (`auth/email.ts`): exactly one
  `@`, non-empty local/domain parts, valid characters, no bad/doubled/edge dots,
  proper domain labels, and a TLD that is ≥2 letters (rejects `m@m.m`, `a@b.1`).
  Pragmatic, not RFC-exhaustive - the magic link arriving is the real proof - but it
  stops the obviously-invalid before sending. New test suite covers 30+ cases.

## v0.8.3 - Exit affordances + roadmap reconciliation

- **Retention/Reaction exit button**: a clear "← Exit" affordance now sits in the
  header of both dedicated screens, so a session can be left mid-flow (previously the
  only way out was a small "Done" link, or nothing on the reaction screen).
- **Test-user cleanup**: the `test1…test20` seeding was already absent from code;
  removed the dangling `ENABLE_TEST_USERS` references from compose, `.env.example`,
  README, and docs so they no longer mislead. (`is_test` column kept; admin queries
  defensively exclude it.)
- **Roadmap reconciled with reality**: on review, several "approved" items were already
  implemented in earlier work - scoring-model version stamping, challenge-bank version
  stamping (migration 0013), minimum-category coverage for the global rating
  (`MIN_CATEGORIES_FOR_GLOBAL`), and magic-link rate limiting (per email + IP). Marked
  done in `ROADMAP.md`; README counts were already accurate.

## v0.9.0 - Approved roadmap items

Cleared the approved, code-only roadmap backlog.

- **Removed built-in test users** - the seeded `test1`…`test20` accounts, their login
  action, the login-page form, `loginTestUser`, and the `ENABLE_TEST_USERS` flag are
  gone. Real magic-link accounts cover testing. The `is_test` column stays (it still
  excludes any test/simulated users from reference pools).
- **Minimum category coverage for the global rating** - the overall rating now reads
  "calibrating" until you've rated in at least 4 distinct categories, so the headline
  number isn't built on one or two. Dashboard shows how many more are needed.
- **Scoring-model + challenge-bank versioning** - every attempt now records
  `scoring_model_version` and the serving challenge's `challenge_version`; challenges
  gain `retired_at`. Future recalibration can segment historical data cleanly.
  (Migration 0013.)
- **Retention exit button** - a "Done" link in the retention header to leave mid-session.
- **README** updated to the real 16 categories / ~2,649 challenges / 9 domains.
- Magic-link rate limiting was already implemented (5 per email & per IP / 15 min) - verified and marked done.

## v0.8.2 - Admin temporal query fix

- **Fix**: the admin Temporal tab returned 500. The query built its grouping column
  with `pg('a', col)`, which postgres.js renders as two comma-separated identifiers
  (`"a","local_month"`) instead of one qualified column (`a."local_month"`), causing
  `syntax error at or near ","`. Now uses a single dotted identifier `pg(\`a.\${col}\`)`.
  The column name comes from a fixed internal allowlist (local_hour/local_dow/
  local_month), never user input. (Surfaced by the Health panel's error log - working
  as designed.)
- Note: pre-fix temporal errors remain visible in the Health panel as history; new
  ones stop after deploy. Explore was unaffected (it does not use that pattern).

## v0.8.1 - Admin env fix

- **Fix**: `docker-compose.yml` never forwarded `ADMIN_TOKEN` (or `ADMIN_MIN_CELL`)
  to the app service, so setting it in `.env` had no effect and `/admin` always
  404'd (the tool reads the token from the process environment). The app service now
  pulls both from the environment (`ADMIN_TOKEN: ${ADMIN_TOKEN:-}`). After this,
  `docker compose down && up --build` makes `/admin?key=...` work on port 3000.
- Note for operators: the admin tool serves on the Docker app port (3000), not the
  Vite dev port (5173). A 404 specifically means no valid token reached the app; a
  wrong key returns 401.

## v0.8.0 - Bug fixes, profile export, timing integrity

**Bug fixes (from review feedback)**
- Retention factoid answer now shows: new ("learn this") cards include the answer so
  it can be revealed; due cards keep it hidden until graded (a real recall test).
- Routing fixed: dashboard cards for Retention and Reaction Time now go to their
  dedicated screens instead of falling into mixed practice; `/practice/run` redirects
  any bankless category to the right screen. Bank-backed categories (e.g. pattern
  recognition) run directly as intended.
- Cognitive-profile radar: viewBox widened so outer domain labels are no longer clipped.

**Features**
- **Save cognitive profile as image** - exports the radar to a PNG on the user's
  machine, rendered on the app's ink background. (Stats page.)
- **Admin manual** (`ADMIN_MANUAL.md`) - how to enable the tool, what each panel
  means, and how to read the numbers honestly.
- **Roadmap** (`ROADMAP.md`) - the full future-todo list, with engagement-mechanic
  items flagged as deliberate direction decisions rather than default tasks.

**Timing integrity (anti-spoof)**
- Server-measured elapsed (submitted_at − served_at) is now authoritative. The client
  time may only subtract a capped network credit (≤600ms), so a user cannot report a
  response faster than the server observed. Closes the hole where any sub-server-bound
  client time was trusted outright. New tests cover the spoof-resistance.

## v0.7.0 - Seed robustness fix + classy polish

**Fix (carried in from your build)**
- Retention deck data moved to `challenge-bank/retention/decks.json`; the seed
  script now reads it via `JSON.parse(readFileSync(...))` instead of dynamically
  importing a TypeScript module at runtime (which was fragile under plain Node).
  Removed the now-orphaned `decks.ts` so the JSON is the single source of truth - no two-copies drift.

**Polish (perceived craftsmanship, no logic change)**
- Subtle 120ms page fade between routes.
- Thin top navigation progress bar during loads (`$navigating`).
- Rating readout counts up to its value (tweened) - the measurement feels earned.
- Primary/secondary buttons get an active press-state and disabled styling.

**Operational**
- Unauthenticated `/healthz` liveness probe (DB ping; 200 ok / 503 degraded) for
  uptime monitors and orchestrators - distinct from the human admin Health panel.

## v0.6.0 - Last-mile: a stranger can actually use it

The non-cognition gaps between "works on my machine" and "a stranger arrives and
succeeds": email, production config, first impression, graceful failure.

**Email delivery (the hard blocker)**
- Real SMTP magic-link delivery via nodemailer (`auth/mail.ts`), with a styled
  HTML email. Falls back to stdout logging when SMTP is unconfigured, so dev needs
  no mail server and the app runs identically with or without email set.
- `nodemailer` added as a dependency (dynamically imported - only loaded when
  SMTP_HOST is set).

**Production deployment**
- `docker-compose.prod.yml` override: all dev flags OFF, secrets required from the
  host environment (no hardcoded passwords), Postgres port no longer published,
  `restart: unless-stopped`. Launch is now one command.
- `.env.example` documents SMTP and production secrets.

**First impression & graceful failure**
- Landing page links to the honest `/about`; rating copy softened to avoid
  overclaiming pending validation.
- Styled `+error.svelte` - failures keep the instrument-panel aesthetic and tell
  the user the error was logged, instead of dropping to raw browser default.

**Hardening**
- Feedback endpoint now rate-limited (5/min per user or IP) to stop table flooding.

## v0.5.0 - Launch safety & operational layer

Operational hardening for going live with real users before expert review, plus a
code audit of all prior work.

**Audit fix (launch-blocking)**
- `pickMixedCategory` could serve Retention / Reaction Time in the timed run - categories that have no challenge bank and their own screens - causing a "no
  challenges available" crash. Mixed practice now only draws from bank-backed
  categories; the `next` endpoint falls back to mixed practice for any
  bankless/unknown category instead of erroring.

**Error visibility**
- `handleError` hook captures every unhandled server error into a persistent
  `error_log` table (route, message, stack, status, coarse user kind - never the
  user id) and returns a safe generic message to the client.
- Admin **Health panel** (`/admin/health`): error pulse (24h / unseen / total),
  recent errors, and recent feedback.
- Added missing error handling to the retention `next` endpoint.

**Feedback capture**
- Unobtrusive in-app feedback widget (bug / confusing / idea / other) writing to a
  `feedback` table - the cheapest validity/UX signal at launch. Visible on app
  screens, hidden on onboarding/auth/admin.

**Honest public framing**
- Public `/about` page: plainly states what Excogni is and isn't - not an IQ test,
  not a diagnosis, not yet scientifically validated - and how data is handled.
  Linked from the footer.

- Migration 0012 (error_log, feedback).

## v0.4.0 - Expert-review hardening

Shaped by simulated feedback from a psychometrician, cognitive psychologist,
biostatistician, and disclosure-control specialist.

**Construct validity**
- Stroop **interference score** (incongruent − congruent) for Inhibition and
  **switch cost** (switch − repeat) for Task Switching, isolating the executive
  component from raw speed. Surfaced in Stats. (`stats/executive.ts`)

**Measurement honesty**
- **Standard error of measurement**: individual ratings render as `rating ± SEM`,
  the band narrowing as attempts accumulate.
- Test-retest reliability now reports **confidence intervals**.

**Statistical rigor (admin)**
- **Benjamini-Hochberg FDR** (replaces over-conservative Bonferroni).
- **Cliff's delta** non-parametric effect size beside Cohen's d.
- **Inter-category correlation matrix** - flags pairs r>=0.8 as possibly
  non-distinct constructs.
- **Practice-effect** panel - early vs late session ratings, quantifying learning
  vs trait.
- **Consenter-vs-non-consenter** selection-bias report.
- **External validity** - optional self-reported external test score (IQ/SAT/GRE),
  correlated against Excogni rating in admin.

**Privacy hardening**
- CSV export enforces **k-anonymity on the full quasi-identifier combination**
  (not per-field) and coarsens geography to **region**.

- Migration 0011 (external-criterion fields).
- New tests: FDR, Cliff's delta, proportion gap, SEM, reliability CI.

---

## v0.3.0 - Fluency, visual processing, honest reaction time

**New categories (4), new domains (3)**
- **Retrieval Fluency** (Retrieval) - generate-many, scored by valid unique count.
- **Verbal Fluency** (Verbal) - constrained word generation.
- **Visual Processing** (Visual) - visual matching + figure closure.
- **Reaction Time** (Reaction) - measured as an honest **band** accounting for
  hardware/display delay, narrowed by a per-user calibration probe, never a single
  number. (`reaction/`, unit-tested)

**Flows & config**
- Timed fluency chip-list renderer in practice; dedicated `/practice/reaction` and
  `/practice/retention` screens.
- **User-configurable** session length (3-50) and mixed-practice category selection.
- **Per-category About pages** (`/about/<slug>`) with engaging explainers.

- Migrations 0009 (session length, RT band + calibration), 0010 (about text).
- New tests: reaction-time band/calibration.
- 16 categories, ~2,649 static challenges.

---

## v0.2.0 - Executive function & retention

**New categories (3), new domains (2)**
- **Inhibition** (Executive Function) - Stroop, ink-color naming.
- **Task Switching** (Executive Function) - rule-switching with switch cost.
- **Retention** (Retention) - spaced repetition, SM-2 scheduling, **scores only
  when a card was genuinely due** (forgetting something just seen is training, not
  a mark against you). Own screen and curated fact decks. (`retention/`)

- Radar gains Executive Function and Retention domains (data-driven mapping).
- Migration 0008 (retention_cards, user_card_state).
- New tests: retention scheduling/scoring.

---

## v0.1.0 - First feature-complete alpha (admin milestone)

**Categories & rating**
- Nine categories (~1,985 challenges): numerical fluency, pattern recognition,
  working memory, attention control, spatial, logical, verbal, processing speed,
  estimation.
- Norm-referenced percentile rating with **calibration honesty**
  ("calibrating"/"provisional" instead of fabricated numbers), adaptive ladder,
  stable-level rating, effective-time clamp, slow-correct floor.
- Estimation **error-rank** scoring (single |error| axis vs population).

**Session feel & self-knowledge**
- Bounded sessions + "keep practicing?" prompt; manual Next/Enter advance; 250ms
  get-ready pause before memory; **confirmed level-ups** ("Nice, you leveled up"
  only when aced); **in-the-zone meter**; numbered + digit-key choices.
- **Cognitive radar** (5 domains, confidence-weighted, unrated dim); **personal
  records** (peak rating + max level with dates); anonymous **distribution**;
  **i explanations** on every number.

**Onboarding, transparency, data**
- First-run `/welcome` contract; in-flow "why your level moved"; session "what
  changed" narrative.
- **User attributes** (consented, aggregate-only) with privacy framing.
- **Data export** (JSON) and cascade **deletion**.
- Trend-of-state context capture (local hour/day) + temporal extension
  (month/day/week/year, UTC-anchored).
- Magic-link auth with anonymous-upgrade and rate limiting.

**Admin statistical tool**
- Standalone env-gated `/admin`, read-only, consent-only, N>=20 suppression +
  differencing guard. Standing insights (vitals, distribution, category difficulty
  + observed-median drift, Verbal-by-language bias check, reliability,
  consent/missingness). Stackable filters; temporal trends; consented CSV export.
  Statistical primitives: summarize (CI/median/IQR), compare (Cohen's d),
  multiple-comparisons, suppression, ICC reliability.

**Foundational fixes folded into the alpha**
- Literal \uXXXX escapes that rendered as text in Svelte markup - fixed across
  components (punctuation, arrows, x).
- Per-category repeat-exclusion (a global window barely excluded any single
  category in mixed practice, causing repeats at a held level).
- Bank-depth audit; estimation magnitude pool expanded to full depth.

---

## Conventions

- **Versioning**: minor bump per feature milestone, patch for fixes. `VERSION`
  file + this changelog track it; zips are tagged `excogni-vX.Y.Z.zip`.
- **Process**: a short commit message precedes each package; the project ships
  with `node --check` / strip-types / Svelte-balance / no-runes verification and
  dependency-free unit tests.
- **Honesty discipline**: every release flags what it cannot verify (no live app
  run in the build environment; charts visually unverified; rating validity
  unproven pending real testers).
