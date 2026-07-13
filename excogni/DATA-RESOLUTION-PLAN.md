# Data resolution plan: capture the micro-signals, honestly

Prepared against v0.62.2. The maintainer's brief: do not miss gathering the resolution that makes
"power moves" possible later, even if some uses stay unshipped on principle.

**STATUS (v0.63.0): Phase A BUILT.** Captured now: first_input_ms (hesitation, measured from
answering-start, first key OR pointer), edits_count (deletions while answering), per-word fluency
timestamps (word_times, one per committed word), and the raw per-trial reaction series
(reaction_runs table, alongside floor + band). Honest scope note: first_answer_changed ships as
NULL for now, because choice items submit on first tap (no re-pick exists) and fluency chips are
not removable; the column waits for a confirm-step. Gray + medical territory (Tier 3 biometrics,
clinical inference) deliberately NOT built, per maintainer decision (v0.62.x).

**Certainty rule (maintainer decision, v0.62.x):** any measurement or behavioral claim may ship WITH its
certainty stated (the existing insight pattern). Certainty labels do NOT launder the forbidden
category: an inferred medical or biometric trait with a confidence number attached is still an
inferred special-category trait, and stays out.

**Current state (audited):** attempts carry per-ATTEMPT resolution only: client/server/effective
elapsed, answer, correctness, speed class, input method, local hour/dow/month. No per-interaction
events, no hesitation, no edit history, no per-word timing. The layer below the attempt is dark.

**The stance (from PRINCIPLES.md, applied):** capture at high resolution FOR MEASUREMENT, under an
explicit consent toggle, and tell the user what it enables. The same data that could silently link
accounts becomes, used transparently, the sharpest insight engine in the product. One capability is
surveillance, the other is a mirror; we build the mirror.

**Legal edge, named:** timing patterns precise enough to identify a person are biometric data under
GDPR (special category). That means: separate consent, never used for identification as a product,
short raw-retention with derived-feature persistence, and the linking capability treated as a
LIABILITY (a breach of linkable "anonymous" data is not anonymous). Person-linking ships only as
transparent, user-facing play ("your two accounts look like the same mind ;)" shown TO the user who
owns both, never as silent dedup).

---

## The signals, ranked by insight value per byte

### Tier 1: build first (cheap, huge insight yield)

1. **Time-to-first-input (hesitation).** ms from prompt render to first keydown/pointer. The
   single richest new number: separates "knew it slowly" from "hesitated then knew it". Insight:
   "On inhibition tasks you hesitate 2x longer before wrong answers than right ones - your gut
   knows before you do."
2. **Answer edit trace.** Count of backspaces/changes + whether the FIRST candidate answer equalled
   the final one. Metacognition made visible. Insight: "When you change your first answer, the
   change is right only 41% of the time - your first instinct beats your second thoughts."
3. **Per-word fluency timestamps.** Timestamp each produced word. This unlocks the real
   neuropsych measures: CLUSTERING (bursts of related words) and SWITCHING (gaps between
   clusters = executive shifting). Insight: "You produce words in large clusters with slow
   switches - depth over agility." A genuine differentiator; no consumer product does this.
4. **Within-run reaction series shape.** We keep the median band; also keep the per-trial series
   (5 numbers) to derive variance and fatigue slope. Insight: "Your first trial is consistently
   your slowest - you need one warm-up."

### Tier 2: strong, slightly more work

5. **Confidence probes.** Occasionally (rate-limited) ask "how sure?" after an answer. Yields
   calibration curves per domain: over/underconfidence. Insight: "In spatial reasoning, when you
   say 'unsure' you are right 78% of the time - trust yourself more." Psychology-grade content.
6. **Distractor forensics.** Store WHICH wrong option was chosen (we store the answer already;
   add the near-miss classification at scoring time: was the chosen distractor the designed
   near-miss or a random one?). Insight: "Your errors are near-misses, not guesses - attention,
   not ability."
7. **Inter-attempt pacing.** Derivable NOW from served_at/submitted_at chains: momentum curves,
   post-error slowing (a classic, robust effect). Insight: "After a miss you slow down 40% for
   two items - textbook careful mode."
8. **Learning-rate as a trait.** First-exposure penalty per challenge TYPE: how fast a user
   adapts to an unfamiliar format. Insight: "New task formats cost you one session - faster
   adaptation than 80% of users."

### Tier 3: capture raw, decide later

9. **Keystroke dynamics** (dwell/flight on text answers) and **touch geometry** (tap offset from
   target centre, pressure where available). The biometric tier: highest identification power,
   also motor-control signal. Capture ONLY under the explicit high-resolution consent, retain raw
   briefly, persist derived aggregates. This is also where "two accounts or a twin ;)" lives -
   as a transparent, opt-in party trick, never silent dedup.
10. **Person-fit statistics (IRT residuals).** How internally consistent a user's response
    pattern is with their own ability estimate. Legitimately serves DATA QUALITY (bot/shared-
    account/cheating detection for the population pool, disclosed in methodology), and doubles
    as an integrity flag.

## Schema sketch (one migration when built)

- attempts gains: first_input_ms int, edits_count int, first_answer_changed boolean.
- new table attempt_events (attempt_id FK cascade, events jsonb, size-capped ~4KB): compact
  arrays [[t_ms, type, detail?], ...] for the raw stream; retained N days (config), aggregated
  into derived columns nightly, then pruned. Raw is a working buffer, not an archive.
- fluency: answerData already carries words; add per-word t_ms alongside.
- reaction: store the 5-trial series next to the band.
- user_settings: highres_consent boolean default false (its own toggle, its own sentence of
  disclosure: what is captured, what it enables, that it never identifies anyone).

## Red lines (so the power stays a mirror)

- No silent cross-account linking, ever. The capability is acknowledged in methodology as a risk
  we deliberately do not operationalise.
- Raw event streams: short retention, derived features only long-term.
- Population statistics never ingest Tier 3 raw data.
- Every insight built on these signals passes the PRINCIPLES test: respect + serves sharpness,
  insight or self-knowledge.

## Sequencing

Phase A (one session): first_input_ms + edits_count + per-word fluency timestamps + reaction
series (all additive, no consent change needed - these are task measurements, disclosed in
methodology). Phase B: confidence probes + distractor forensics + the derived insights. Phase C:
the consent-gated Tier 3 capture, only when there is a concrete honest use.


---

## Addendum: deducible traits and honest certainty

The structural gift: handedness, age band and native language are ASKED in the about-you form, so
every deduction below is trainable against volunteered ground truth. Primary use: VALIDATION, not
profiling. "Our timing data predicts self-reported handedness at ~80%" is evidence the instrument
measures something real; filling in fields users chose not to share is the same capability pointed
the wrong way, and GDPR treats INFERRED special-category traits exactly like collected ones.

High certainty (enough sessions):
- Chronotype (morning/evening): session-hour habits + performance-by-hour. Near-certain in weeks.
- Age band: RT + processing speed vs age is among the most robust effects known; +/-10y at ~70-80%.
- Impaired-day detection WITHIN a user (sleep deprivation, alcohol): deviation from own baseline
  (RT variance up, accuracy down); how fitness-for-duty testing works. High within-person.

Moderate:
- Handedness: Tier 3 needed (tap-offset bias, swipe curvature, inter-hand flight asymmetries);
  ~75-85% over many sessions; single-session hand-in-use is NOT handedness.
- Native vs non-native language: verbal/non-verbal gap, typo patterns, vocabulary rarity.
- Mood/stress episodes: train on the user's own tags, detect on untagged days. Within-user.

Weak individually (say so):
- Sex: group differences exist, distributions overlap massively; barely above chance per person.
- Clinical anything (ADHD-like variability, depressive slowing, parkinsonian keystroke signs):
  real published population signals, but individual inference is medical territory: low certainty,
  high harm, behind the red line permanently absent ethics review.

Governing principle: group-difference inference is weak; within-user deviation detection is
strong. The product leans on the second: better science AND the respectful posture.
