# Excogni - Admin Manual

The admin tool is a standalone, read-only, research surface. It exists to study the
population in aggregate, never to inspect or act on individuals. This manual covers
how to enable it, what each panel means, and how to read the numbers honestly.

---

## 1. Enabling access

The admin tool is **off unless an admin token is set.**

1. Set `ADMIN_TOKEN` to a long random string (≥16 characters) in the environment.
   With no token, every `/admin` route returns 404 - the tool does not exist.
2. Strongly recommended in production: set `ADMIN_TOTP_SECRET` so login also requires a
   code from your authenticator app. Generate the secret and verify your app is in sync:
   `node --experimental-strip-types scripts/gen-totp-secret.mjs` - put the printed line in
   the env file AND add the key to your authenticator (TOTP, SHA1, 6 digits, 30s - the
   defaults). The script prints the current code so you can confirm the pairing BEFORE
   deploying; codes are single-use (replay-proof, persisted across restarts).
3. Sign in at `/admin/login` with the token (+ code). Success issues an 8-hour cookie;
   only one admin session is active at a time - a new login revokes the previous one, and
   "Log out" in the nav revokes it immediately. Five failures from one IP (or 30 globally)
   lock login for 15 minutes; every failure gets the same generic message on purpose.
4. Optionally set `ADMIN_MIN_CELL` (default 20) - the suppression floor (see §3).

If you lose the authenticator: remove `ADMIN_TOTP_SECRET` from the env and redeploy
(token-only login), then generate a fresh secret. There are no backup codes - this is a
single-admin tool with server access assumed.

The admin token is **not** a user role. It is a separate gate. Admins are not users
and users are never admins.

---

## 2. What the tool is - and isn't

- **Read-only.** It never writes to user data. It cannot edit, delete, or message
  anyone.
- **Aggregates only.** Every figure is a group statistic. There is no screen that
  shows one person's data.
- **Consent-gated.** Attribute breakdowns (age, country, etc.) only include users
  who explicitly consented to aggregate research.
- **No engagement metrics.** No "active users", no retention funnels. This is a
  measurement-quality instrument, not a growth dashboard.

---

## 3. The suppression floor (read this first)

Every group smaller than `ADMIN_MIN_CELL` (default 20) is **withheld** - shown as
"too few to display" rather than a number. This protects individuals: a statistic
over 3 people can re-identify them. If a panel looks empty, that is usually correct
and means the data is too thin to show safely yet, not that something is broken.

The CSV export goes further with **k-anonymity on the full quasi-identifier
combination**: a row is only exported if its complete (age band + region + gender +
education + language + handedness) signature is shared by at least the floor number
of people. Geography is coarsened to a broad region. Rare combinations are dropped.

---

## 4. The Overview page, panel by panel

**Population vitals.** Headcount of rated users, consent rate, and a selection-bias
caution. The consent rate matters: if only a third of users consented, every
attribute breakdown describes that third, not everyone.

**Rating distribution.** Mean (with 95% CI), median, and IQR of overall ratings.
Median and IQR are more trustworthy than the mean if the distribution is skewed.

**Category difficulty + observed-median drift.** For each category, the difficulty
and how far the *observed* median response time has drifted from the *hand-tuned*
target (`expectedMedianMs`). A large drift is the signal to recalibrate that
category's timing - the hand-tuned guess was off.

**Verbal-by-language bias check.** Compares verbal-reasoning performance across
native-language groups, with an effect size. Flagged as **exploratory**: verbal
tasks are language-bound, so a difference here is expected and is a fairness caution,
not a finding.

**Test-retest reliability (ICC, with CI).** The core validation number. ICC near 1
means the instrument ranks people consistently across separate sessions. Below ~0.5,
the rating is too noisy to treat as a stable measure. **This is the single most
important panel** - it answers "does the rating mean anything stable?" The CI tells
you how much to trust the ICC itself; a wide CI means not enough repeat sessions yet.

**Category correlation matrix.** Pearson r between users' ratings across category
pairs. A pair at **r ≥ 0.8** is flagged: those two categories may be measuring the
same underlying thing rather than distinct faculties. Distinct categories should
correlate moderately (shared general ability) but not near-perfectly.

**Practice effect (early vs late).** Each category's mean rating in users' early
sessions vs their late sessions. A large positive gain means the rating is capturing
*learning*, not a stable trait - important because the product trains as it measures.
A category that rises steeply is one where "improvement" may be practice, not growth.

**External validity (vs self-reported scores).** For users who shared an outside
test score (IQ/SAT/GRE), the correlation between that score and their Excogni rating.
**This is the only evidence that moves the rating from "consistent" to "valid."** A
positive r here is the validation goal. Withheld until enough scores are shared.

**Selection bias (consenter vs non-consenter).** Compares the two groups on shared
variables (e.g. whether they are rated at all). A large gap means consenters differ
systematically from everyone else - so consent-gated breakdowns are biased toward an
unrepresentative subgroup. Quantifies the caution rather than just stating it.

---

## 5. Other pages

**Explore.** Stackable attribute filters (age band, country, language, etc.). Recomputes
the rating distribution for the filtered cohort, with suppression applied. Use it to
ask "what does the distribution look like for X?" - but remember every filter shrinks
the cohort toward the suppression floor.

**Temporal.** Performance by local hour, day of week, and month, with optional
country/language filters. Useful for spotting time-of-day or seasonal effects in the
aggregate.

**Health.** The operational panel (distinct from the statistical ones): a pulse of
server errors (last 24h / unseen / total), the recent error stream, and recent user
feedback. Check this routinely after launch - it is how live failures and user
confusion reach you.

**Export.** Downloads the consented, k-anonymized CSV (see §3). One row per qualifying
subject, ratings per category, coarse demographics. Suppressed rows are silently
dropped; the response header `x-rows-suppressed` reports how many.

---

## 6. How to read numbers honestly

- **Small n is not a finding.** If a panel shows a number, check the n beside it. A
  difference over 25 people is a hint, not a conclusion.
- **Effect size over significance.** The tool reports Cohen's d and Cliff's delta
  (non-parametric, robust to skew) and corrects for multiple comparisons with
  Benjamini-Hochberg FDR. A "significant" result that is tiny in effect rarely matters.
- **Reliability before validity.** Until the ICC panel is healthy, treat ratings as
  provisional. Until the external-validity panel is populated, make no claim that the
  rating measures cognitive ability.
- **Consent and selection bias colour everything.** Every attribute breakdown is of
  consenters only. The selection-bias panel tells you how much that distorts things.

---

## 7. Operational notes

- The 8-hour admin cookie expires; re-enter with `?key=` to renew.
- To disable the tool entirely, unset `ADMIN_TOKEN` and redeploy - every `/admin`
  route returns to 404.
- The tool runs the same queries against live data; heavy use on a large database
  will add load. It is built for occasional research review, not constant dashboards.
