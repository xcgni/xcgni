# Excogni - testing checklist (v0.3.0)

Manual flow tests. Run through each in **multiple browsers** (Chrome, Firefox,
Safari) and at least one **mobile** device. Check the box when verified; note the
browser if something fails only in one.

Legend: `[ ]` untested · `[x]` pass · `[!]` fails (note browser)

---

## Onboarding & entry
- [ ] 1. First visit → `/welcome` 4-step contract → "Start practicing" lands in practice
- [ ] 2. Skip mid-onboarding works; `seen_intro` persists (intro not shown again)
- [ ] 3. Anonymous user created on first practice; can practice without registering
- [ ] 4. Register / magic-link login (dev: link shown on login page)
- [ ] 5. Anonymous → registered upgrade preserves history

## Core practice loop
- [ ] 6. Renderers display correctly: arithmetic, sequence, digit-span (memory),
        attention grid, spatial SVG, logical/verbal text-choice, two-choice, estimation
- [ ] 7. Get-ready 250ms pause before memory tasks; digits legible
- [ ] 8. Manual Next / Enter advance; feedback + "why level moved" line readable
- [ ] 9. Bounded session ends at configured length → "keep practicing?" prompt
- [ ] 10. Level-up → same-category confirm question → "Nice, you leveled up" only when aced
- [ ] 11. In-the-zone meter fills on sharp streaks, drops on misses
- [ ] 12. Numbered choices: clicking AND digit-keys (1-4) both work
- [ ] 13. Estimation: decimal input accepted; feedback shows "% off"

## New v0.3 flows
- [ ] 14. Inhibition (Stroop): word renders in correct INK color; pick-the-ink scores right
- [ ] 15. Task switching: rule cue (COLOR/SHAPE) changes; correct dimension is scored
- [ ] 16. Visual processing: match + closure variants render; 4 options; correct = target
- [ ] 17. Fluency (retrieval + verbal): timer counts down, chips add on Enter,
         count shown in feedback, "done early" submits
- [ ] 18. Reaction: refresh estimate → 5 calibration probes → "too soon" guard works →
         5 trials → **result shown as a RANGE (fast-slow ms), never a single number**
- [ ] 19. Retention: new card (learn/reveal) vs due card (recall test);
         "counts toward score" message only when genuinely due; mastery % shows

## Stats & self-knowledge
- [ ] 20. Radar renders; unrated domain axes appear dim, not collapsed to zero
- [ ] 21. Personal records show peak rating + max level WITH dates
- [ ] 22. Distribution "field" renders with your marker; no individual names
- [ ] 23. ⓘ explanations open/close on every stat (rating, percentile, domain, peak, field)
- [ ] 24. About pages `/about/<slug>` load for all 16 categories; Practice button routes correctly
         (retention → /practice/retention, reaction → /practice/reaction, others → run)

## Settings & data
- [ ] 25. Session-length slider saves; next session uses the new length
- [ ] 26. Category selection saves; mixed practice respects it (none ticked = all included)
- [ ] 27. Attributes save behind consent; privacy notice visible and accurate
- [ ] 28. Data export downloads JSON including attributes + temporal fields
- [ ] 29. Account deletion works and cascades (history gone)

## Admin (set ADMIN_TOKEN ≥16 chars)
- [ ] 30. `/admin` returns 404 with no token; `?key=TOKEN` grants; wrong key 401s
- [ ] 31. Overview panels render (most read "too few to display" on fresh data - correct)
- [ ] 32. Explore filters recompute distribution; small cohorts suppressed
- [ ] 33. Temporal trends render; CSV export withheld below the floor

## Cross-cutting (check in EACH browser)
- [ ] 34. No literal `\uXXXX` text anywhere (em-dashes, arrows, × all render as glyphs)
- [ ] 35. All charts/SVG render: radar, distribution, spatial figures, sparklines, rating chart
- [ ] 36. Mobile: tap targets usable, correct keyboards appear, no horizontal scroll

---

## Known weak spots to watch (flagged honestly)
- **Reaction time on touch**: tap latency differs from mouse/keyboard; the
  calibration *should* absorb it into the floor, but verify the band looks sane on mobile.
- **Fluency on mobile**: slower phone typing in a fixed 30s window yields fewer
  words → lower scores than desktop. Cross-device fairness issue, not a bug per se.
- **Keyboard shortcuts** (digit-select, Enter-advance) silently absent on mobile;
  tap targets cover it, but "press Enter" hints are desktop-only.
- **Fluency accept-lists are finite** → score is gameable by memorizing the list.
  Provisional until a dictionary/category API replaces curated lists.

## Validation (the real goal, beyond flows working)
- [ ] Recruit friends/students; have several do **repeat sessions over days**
- [ ] Check the admin **test-retest reliability** panel fills in (ICC per category)
- [ ] Confirm a person's rating orbits a stable center rather than drifting randomly
- [ ] Keep percentiles in "calibrating" for this biased pool - don't show real percentiles yet
