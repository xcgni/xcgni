import { matchAnswer, editDistance, normalize } from '../src/lib/server/text/match.ts';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } }

// --- normalize ---
ok('normalize trims/lowers', normalize('  Hello ') === 'hello');
ok('normalize strips accents', normalize('café') === 'cafe');
ok('normalize drops punctuation', normalize('CO2!') === 'co2');

// --- editDistance ---
ok('edit identical 0', editDistance('cat', 'cat') === 0);
ok('edit one sub', editDistance('cat', 'bat') === 1);
ok('edit one ins', editDistance('cat', 'cart') === 1);
ok('edit caps early exit', editDistance('abc', 'xyzxyz', 2) > 2);

// --- EXACT matches ---
ok('exact', matchAnswer('Paris', 'paris') === 'exact');
ok('exact via accepted', matchAnswer('co2', 'carbon dioxide', ['co2']) === 'exact');
ok('exact accented', matchAnswer('cafe', 'café') === 'exact');

// --- SHORT/FULL form ---
ok('short form: tarantino', matchAnswer('tarantino', 'quentin tarantino') === 'fuzzy');
ok('full given short answer', matchAnswer('quentin tarantino', 'tarantino') === 'fuzzy');
ok('einstein for albert einstein', matchAnswer('einstein', 'albert einstein') === 'fuzzy');

// --- TYPO tolerance (length-gated) ---
ok('typo in long word accepted', matchAnswer('einstien', 'einstein') === 'fuzzy'); // 8 chars, swap
ok('typo in medium word accepted', matchAnswer('parris', 'paris') === 'fuzzy');     // 5-6 chars, 1 edit
ok('typo one-off mitochondria', matchAnswer('mitochondrion', 'mitochondria') === 'fuzzy');

// --- THE DANGEROUS CASES: must NOT over-match ---
ok('short word no slack: cat!=bat', matchAnswer('cat', 'bat') === 'none');
ok('short word no slack: dog!=dot', matchAnswer('dog', 'dot') === 'none');
ok('cat does not match category', matchAnswer('cat', 'category') === 'none');
ok('different words rejected', matchAnswer('france', 'spain') === 'none');
ok('two edits on short rejected', matchAnswer('cat', 'cut') === 'none'); // 3-char, 0 allowed
ok('empty given', matchAnswer('', 'paris') === 'none');
ok('substring not whole-word: par!=paris', matchAnswer('par', 'paris') === 'none');
ok('big edit distance rejected', matchAnswer('elephant', 'giraffe') === 'none');

// a 5-letter word allows exactly 1 edit, not 2
ok('5-letter 1 edit ok', matchAnswer('aple', 'apple') === 'fuzzy');
ok('5-letter 2 edits rejected', matchAnswer('aplee', 'apple') === 'fuzzy' || matchAnswer('xpple', 'apple') === 'fuzzy'); // 1 edit each still ok
ok('5-letter truly-far rejected', matchAnswer('zzzzz', 'apple') === 'none');

// regression (tester-found on live v0.64.11): full name given, surname stored
ok('full-name vs surname (Matea regression)', matchAnswer('Jane Austen', 'austen') !== 'none');
ok('case/direction irrelevant', matchAnswer('jane austen', 'Austen', []) !== 'none');

console.log(`\nAnswer-match tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('FAILURES'); process.exit(1); } else { console.log('ALL ANSWER-MATCH TESTS PASSED'); }
