# Plan: unify Retention and Reaction into the mixed run

**Goal (from the maintainer):** the user should never have to consciously *decide* "now I'll go do reaction" or "now I'll do retention." Mixed practice should fold them in naturally, as bursts, so it feels like one continuous session that happens to include all kinds of cognition, not three separate destinations.

**Hard constraint (do not break):** each of these has a measurement-honesty rule that unification must respect, or the whole point of the product is undermined. This plan is built around those rules, not around ignoring them.

---

## Why it isn't just "add them to the pool"

The mixed selector picks one challenge at a time from categories that have a challenge bank. Retention and Reaction don't fit that shape, for real reasons:

- **Reaction time** needs (a) a one-time **calibration** of the user's hardware/display floor, and (b) a **run of several trials** to get a stable median. A single reaction trial dropped into the mix is pure noise, and without calibration it isn't comparable across devices. Reaction is only meaningful as a *burst*, and only *after* calibration exists.
- **Retention** (SM-2 spaced repetition) only counts as a **measurement when a card is genuinely DUE** (the interval has grown long enough that recall is a real test). Freshly-seen or freshly-missed cards are *training*, not measurement. So: you can show *learning* cards anytime, but *measurement* (due) cards can only appear when the schedule says they're due, that's time-gated and can't be forced mid-session.

The honest unification is therefore **"fold in bursts at the right moments, each respecting its own measurement rule,"** not "sprinkle single items randomly."

---

## The design: bursts, not single items

Within a mixed run, alongside the normal one-at-a-time challenges, the flow can hand off into a short **burst** of one of these modules, then return seamlessly to the mix. From the user's side it's still one session; they never choose to "switch."

### Retention burst (e.g. 5 cards when it comes up)

- When the mix decides to include retention, it serves a **small batch (e.g. 5 cards)** in a row, then returns to normal challenges. A batch fits spaced-repetition's nature far better than one isolated card.
- **Batch composition respects the honesty rule:**
  - If the user has **due** cards, the burst prioritises those (these *are* the measurement).
  - If there are no due cards but the user opted into learning new material, the burst can be **new/learning cards** (clearly framed as learning, *not* scored as measurement).
  - If there are neither (no due cards, no appetite for new), retention simply **doesn't come up** in this run, no filler.
- **Frequency:** retention shouldn't dominate. Cap it (e.g. at most one retention burst per mixed run, or gated on "are there enough due cards to be worth it"). Due cards drive inclusion; if nothing's due, it stays quiet.

### Reaction burst (calibration-aware)

- **First time:** if the user has never calibrated, the reaction burst opens with the quick calibration phase, then a short run of trials. This is the one place a tiny bit of "this is a reaction test" framing is unavoidable, calibration is inherent. Keep it a smooth few-second step, not a separate destination.
- **Subsequent times:** once calibration is stored, a reaction burst is just a **short run of trials** (enough for a stable median) folded into the mix, no separate screen, no decision.
- **Frequency:** reaction state changes slowly; it doesn't need to appear every run. Include it occasionally (e.g. once every N runs, or when the last reaction sample is stale), so it contributes to the profile without hijacking sessions.

### Selector changes (conceptual)

- Extend the mixed selector so its "what comes next" decision can yield not just a single-challenge category but a **module burst** (retention batch / reaction run), with:
  - retention offered when due cards exist (or learning is wanted),
  - reaction offered occasionally / when stale and calibration allows,
  - both still respect the **enabled/unticked** setting, if the user unticks retention or reaction, it never comes up (this preserves the existing opt-out).
- The calibration-aware "fast to full profile" logic (v0.54.0) should treat retention and reaction as domains to *cover* too, so a complete profile genuinely includes them.

### Flow / return

- The run page needs to host these module bursts inline: hand off to a retention-card sub-view or reaction-trial sub-view, capture results through the existing retention/reaction APIs (reuse them, don't reinvent scoring), then return to the mixed flow and continue the session counter naturally.
- Session length accounting: decide whether a 5-card retention burst counts as 1 "step" of the session or 5. Probably present it as one coherent segment so the session-length promise ("10 challenges") stays legible.

---

## Second ask: clearer text while learning and when correct

Independent of unification, the retention card copy can be clearer. Review and revise **only if it genuinely helps** (don't add noise):

- **New card ("learn this"):** make the learning framing unmistakable, this is not a test, just absorb it; you'll be tested later when it's due. Current label is "New - learn this"; consider a one-line supporting sentence so a first-timer understands why they're being shown the answer.
- **On a correct due recall:** the confirmation should make clear *what* was correct and that it counted (or, for a not-yet-due card, that it was practice). The grade already carries `countedAsMeasurement`; surface it in plain words ("Got it, this one counted" vs "Nice, still learning this one, it'll count when it's due").
- **Fuzzy/typo-tolerant correct:** if a recall was accepted via fuzzy match, say so gently ("Counted, close enough on spelling") so the user isn't confused about why a near-miss passed, same transparency principle as the fluency word-verdicts.
- **Guiding rule:** clarity, not verbosity. Every added word must earn its place; if the current text is already clear in context, leave it. This is a "revise IF needed" pass, not a rewrite.

---

## Sequencing (suggested build order)

1. **Retention burst first** (higher value, simpler): batch-of-N due-or-learning cards folded into the run, honesty rule intact, opt-out respected. This alone delivers most of the "don't make me switch" goal.
2. **Text clarity pass** on retention cards (cheap, do alongside #1 while in that code).
3. **Reaction burst** (calibration-aware): trickier because of the calibration phase; do after retention proves the burst pattern works.
4. **Selector integration + full-profile coverage:** once bursts exist, teach the selector to offer them at the right cadence and count them toward profile completeness.

---

## Open decisions (decide before building)

- Retention burst size (5? adaptive to how many are due?).
- Reaction cadence (every N runs? staleness-based?).
- How a burst counts toward the session-length number.
- Whether an un-calibrated reaction burst is skipped entirely in the mix until the user has calibrated once on the dedicated screen, or whether calibration folds into the first in-mix reaction burst (smoother but a longer first encounter).
- Keep the dedicated /practice/retention and /practice/reaction screens as well (for users who *do* want to go straight to one), or retire them once unified? (Likely keep them, unification is about not *forcing* the choice, not removing it.)
