// Verifies the categorized semantic wordlists (WORDLISTS-PLAN.md):
//  1. every listKey referenced by the retrieval bank has a wordlist file
//  2. every file is normalized: lowercase, no duplicates, no stray whitespace, no empty lines
//  3. every file is a superset of the bank's baked accept-lists for that key
//     (the wordlist may only WIDEN acceptance, never silently narrow it)
//  4. closed sets meet a minimum cardinality (all 118 elements, all 88 constellations, etc.)
// Dependency-free: node scripts/verify-wordlists.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WL_DIR = join(ROOT, 'challenge-bank', 'wordlists');
const BANK = join(ROOT, 'challenge-bank', 'retrieval-fluency', 'retrieval.levels.json');

// Closed or bounded sets and the minimum entries their file must carry
// (minimums, not exact counts: files also hold spelling variants and common alt names).
const CLOSED_MINIMUMS = { elements: 118, constellations: 88, countries: 193 };

let failed = false;
const fail = (msg) => { failed = true; console.log(`FAIL ${msg}`); };
const ok = (msg) => console.log(`ok   ${msg}`);

// inventory listKeys and baked accept-lists from the bank
const bank = JSON.parse(readFileSync(BANK, 'utf8'));
const baked = new Map(); // listKey -> Set of baked accepts
for (const it of bank) {
  const k = it.promptData?.listKey;
  if (!k) continue;
  if (!baked.has(k)) baked.set(k, new Set());
  for (const a of it.answerData?.acceptList ?? []) baked.get(k).add(String(a).trim().toLowerCase());
}

// 1. coverage
for (const k of baked.keys()) {
  if (!existsSync(join(WL_DIR, `${k}.en.txt`))) fail(`listKey '${k}' has no wordlist file`);
}
if (!failed) ok(`all ${baked.size} bank listKeys have wordlist files`);

// orphan files (a file with no bank key isn't fatal, but say it)
for (const f of readdirSync(WL_DIR)) {
  const k = f.replace(/\.en\.txt$/, '');
  if (f.endsWith('.en.txt') && !baked.has(k)) console.log(`note: wordlist '${k}' has no bank listKey (unused)`);
}

// 2 + 3 + 4 per file
for (const [k, bakedSet] of baked) {
  const p = join(WL_DIR, `${k}.en.txt`);
  if (!existsSync(p)) continue;
  const lines = readFileSync(p, 'utf8').split('\n');
  const entries = [];
  const seen = new Set();
  let clean = true;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === '' && i === lines.length - 1) continue; // trailing newline
    if (raw !== raw.trim()) { fail(`${k}: line ${i + 1} has stray whitespace`); clean = false; }
    const w = raw.trim();
    if (!w) { fail(`${k}: line ${i + 1} is empty`); clean = false; continue; }
    if (w.startsWith('#')) continue;
    if (w !== w.toLowerCase()) { fail(`${k}: '${w}' is not lowercase`); clean = false; }
    if (seen.has(w)) { fail(`${k}: duplicate entry '${w}'`); clean = false; }
    seen.add(w);
    entries.push(w);
  }
  const missing = [...bakedSet].filter((b) => !seen.has(b));
  if (missing.length) fail(`${k}: not a superset of the baked accept-list; missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
  const min = CLOSED_MINIMUMS[k];
  if (min && entries.length < min) fail(`${k}: closed set has ${entries.length} entries, expected >= ${min}`);
  if (clean && !missing.length && (!min || entries.length >= min)) ok(`${k}: ${entries.length} entries, normalized, superset of baked list`);
}

console.log(failed ? '\nWORDLIST VERIFICATION FAILED' : '\nALL WORDLISTS VERIFIED');
if (failed) process.exit(1);
