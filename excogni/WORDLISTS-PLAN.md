# Categorized Semantic Wordlists - Plan

**Status: IMPLEMENTED in v0.65.0.** Files at `challenge-bank/wordlists/<listKey>.en.txt`
(40 lists, ~5,900 entries), loader at `src/lib/server/text/wordlists.ts` (lazy, cached,
fail-open; plural variants expanded at load time rather than enumerated in the files - a deliberate deviation from step 2 below, documented here), verification at
`scripts/verify-wordlists.mjs`, tests at `tests/wordlists.test.mjs`. The loader unions
the wordlist with the item's baked accept-list in `src/lib/server/sessions/index.ts`;
the baked list always still counts, so acceptance can only widen, never narrow.

Referenced by the project roadmap and the v0.64.28 changelog. Letter fluency graduated to
dictionary-checked in v0.64.27 (`src/lib/server/text/dictionary.ts`, `word-list`,
fail-open to structural heuristics). Semantic fluency ("name common colors") still
runs on small hand-curated accept-lists - the remaining source of
real-words-rejected complaints.

## Where the lists live today

- Defined as `RETRIEVAL_LISTS` inside `scripts/generate-bank.mjs` and baked into
  each item's `answerData.acceptList` at bank-generation time.
- Validated at submit time in `src/lib/server/sessions/index.ts`
  (`scoringMode: 'fluency_count'`), with typo tolerance.
- Inventory (40 listKeys in `challenge-bank/retrieval-fluency/retrieval.levels.json`):
  animals, colors, fruits, countries, body_parts, kitchen, instruments, sports,
  metals, professions, trees, vegetables, birds, elements, astro, gems, farm,
  drinks, clothing, games, shapes, flowers, languages, units, food, household,
  vehicles, weather, tools, furniture, jobs2, transport_words, rocks, emotions,
  herbs, fish, rivers, composers, constellations, philosophers.

## The build

1. **Inventory first** (done above; re-run against the bank before starting - new
   listKeys may have landed).
2. **Repo-owned list files**, one per listKey, under `challenge-bank/wordlists/`
   (`<listKey>.en.txt`, one entry per line, pre-normalized lowercase). Plurals,
   common inflections and spelling variants included as entries - validation stays
   a Set lookup, no stemming at runtime.
3. **Closed sets exhaustive** (elements, constellations, countries, units): the
   full enumeration, verified against an authoritative source, listed in the file
   header comment.
4. **Open sets generous** (animals, food, emotions): target coverage that makes a
   real word being rejected rare; err toward accepting. The honesty scoring
   already tolerates the tail.
5. **Loader**: lazy, once, server-side into `Map<listKey, Set<string>>` beside the
   letter dictionary; **fail-open** to the current baked accept-lists if a file is
   missing or unreadable (same posture as v0.64.27: a worse validator beats a dead
   practice page). The test suites run in fallback mode and must stay green.
6. **Per-list verification script** (`scripts/verify-wordlists.mjs`): every listKey
   in the bank has a file; every file is normalized (lowercase, no dupes, no
   whitespace); closed sets match their expected cardinality.
7. **Honesty copy** update: review label and input note say which check applied
   ("categorized wordlist (EN)"), mirroring the letter-fluency wording.

## Deliberately out of scope here

- **Croatian lists** - separate roadmap item; the note keeps saying EN plainly.
- Runtime stemming/lemmatization - entries are enumerated instead.
- Any external API - repo-owned and offline, same as the letter dictionary.
