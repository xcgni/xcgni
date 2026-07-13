// Categorized semantic wordlists (v0.65.0, WORDLISTS-PLAN.md). Exercises the REAL repo files
// (fs only, no dependencies) plus the fail-open path. Run from the repo root:
//   node --experimental-strip-types tests/wordlists.test.mjs
import { categoryWordlist, _resetWordlistCache } from '../src/lib/server/text/wordlists.ts';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); } }

// NB: the loader resolves from process.cwd(); these tests assume the repo root, same as
// the runtime container (WORKDIR /app with challenge-bank/ beside build/).

_resetWordlistCache();

// --- real loads ---
const colors = categoryWordlist('colors');
ok('colors list loads', colors instanceof Set && colors.size > 50);
ok('baked entry present (red)', colors?.has('red'));
ok('extension entry present (crimson)', colors?.has('crimson'));

const elements = categoryWordlist('elements');
ok('elements list loads', elements instanceof Set);
ok('closed set complete (oganesson)', elements?.has('oganesson'));
ok('spelling variant kept (sulphur)', elements?.has('sulphur'));

// --- plural variants generated at load time ---
const animals = categoryWordlist('animals');
ok('singular present (zebra)', animals?.has('zebra'));
ok('naive plural accepted (zebras)', animals?.has('zebras'));
const bodyParts = categoryWordlist('body_parts');
ok('y->ies variant (artery -> arteries)', bodyParts?.has('arteries'));
const shapes = categoryWordlist('shapes');
ok('es variant (box -> boxes class: rhombus -> rhombuses)', shapes?.has('rhombuses'));
const gems = categoryWordlist('gems');
ok('multi-word plural on last token (star sapphire -> star sapphires)', gems?.has('star sapphires'));

// --- fail-open ---
ok('unknown key -> null (fallback to baked list)', categoryWordlist('no_such_list') === null);
ok('null is cached, still null on retry', categoryWordlist('no_such_list') === null);

// --- path safety: a key can never shape a path ---
ok('path-traversal key rejected', categoryWordlist('../retention/decks') === null);
ok('absolute-ish key rejected', categoryWordlist('/etc/passwd') === null);
ok('uppercase key rejected (files are lowercase-keyed)', categoryWordlist('Colors') === null);

// --- cache behavior ---
const again = categoryWordlist('colors');
ok('repeat load returns the cached set', again === colors);
_resetWordlistCache();
const fresh = categoryWordlist('colors');
ok('reset produces a fresh set', fresh !== colors && fresh instanceof Set);

console.log(`\nWordlist tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL WORDLIST TESTS PASSED' : 'WORDLIST TESTS FAILED');
if (fail > 0) process.exit(1);
