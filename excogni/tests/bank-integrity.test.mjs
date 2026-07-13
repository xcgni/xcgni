// Bank integrity (v1.3.1): content is data, so the data gets a test suite.
// Validates EVERY challenge-bank levels file against per-renderer field contracts, and
// independently re-derives the number-path optimum for all strategic_planning items via
// BFS (the check the original suite never had; the grid suite got it at birth).
//   node --experimental-strip-types tests/bank-integrity.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; } else { fail++; console.log('  FAIL:', name, detail); }
}

const KNOWN_RENDERERS = new Set([
  'numeric_text_input', 'two_choice', 'multiple_choice_svg', 'multiple_choice_text',
  'memory_recall', 'fluency_list', 'planning_sequence'
]);

// collect all levels files
const root = 'challenge-bank';
const files = [];
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const f of readdirSync(join(root, dir.name))) {
    if (f.endsWith('.levels.json')) files.push(join(root, dir.name, f));
  }
}
ok('found bank files', files.length >= 10, `(${files.length})`);

const allKeys = new Set();
let dupKeys = 0, badRenderer = 0, badLevel = 0, noInstruction = 0, seedFieldBad = 0;
let choiceBad = 0, numericBad = 0, memoryBad = 0, fluencyBad = 0;
const planningItems = [];

for (const file of files) {
  const items = JSON.parse(readFileSync(file, 'utf8'));
  for (const it of items) {
    if (allKeys.has(it.bankKey)) { dupKeys++; }
    allKeys.add(it.bankKey);
    if (!KNOWN_RENDERERS.has(it.rendererType)) badRenderer++;
    // levels legitimately exceed 10 in some suites (arithmetic to 15, figures to 12)
    if (!(Number.isInteger(it.level) && it.level >= 1 && it.level <= 20)) badLevel++;
    // arithmetic items carry promptData.expression instead of an instruction (the renderer
    // shows the expression itself); either one satisfies the prompt contract
    if (!it.promptData?.instruction && !it.promptData?.expression) noInstruction++;
    // the seed inserts these verbatim; an undefined here crashes boot (v1.5.0 incident:
    // freshly generated items lacked scoringConfig/version/active and postgres refused)
    if (it.scoringConfig == null || it.version == null || it.active == null) seedFieldBad++;

    const p = it.promptData ?? {};
    const a = it.answerData ?? {};
    switch (it.rendererType) {
      case 'two_choice':
      case 'multiple_choice_text':
      case 'multiple_choice_svg': {
        const n = Array.isArray(p.options) ? p.options.length : 0;
        const idx = Number(a.correctAnswer);
        const min = it.rendererType === 'two_choice' ? 2 : 2;
        const exact2 = it.rendererType === 'two_choice' ? n === 2 : true;
        if (!(n >= min && exact2 && Number.isInteger(idx) && idx >= 0 && idx < n)) {
          choiceBad++;
          if (choiceBad === 1) console.log('  first bad choice item:', it.bankKey, 'options:', n, 'idx:', a.correctAnswer);
        }
        break;
      }
      case 'numeric_text_input': {
        // estimation items score by error rank against trueValue, not a correctAnswer
        const hasAnswer = a.correctAnswer != null && a.correctAnswer !== '';
        const isEstimate = typeof a.trueValue === 'number';
        if (!hasAnswer && !isEstimate) numericBad++;
        break;
      }
      case 'memory_recall': {
        const digits = String(p.digits ?? '');
        if (!digits.trim() || !(Number(p.displayMs) > 0)) memoryBad++;
        break;
      }
      case 'fluency_list': {
        const hasList = Array.isArray(a.acceptList) && a.acceptList.length > 0;
        const hasKey = typeof p.listKey === 'string' && p.listKey.length > 0;
        const hasRule = typeof a.constraint === 'string' && a.constraint.length > 0;
        if (!((hasList || hasKey || hasRule) && Number(p.timeMs) > 0)) fluencyBad++;
        break;
      }
      case 'planning_sequence':
        planningItems.push(it);
        break;
    }
  }
}

ok('bankKeys globally unique', dupKeys === 0, `(${dupKeys} dupes)`);
ok('all rendererTypes known', badRenderer === 0, `(${badRenderer})`);
ok('levels are integers 1-20', badLevel === 0, `(${badLevel})`);
ok('every item has an instruction or expression', noInstruction === 0, `(${noInstruction})`);
ok('every item carries scoringConfig, version, active (seed inserts them verbatim)', seedFieldBad === 0, `(${seedFieldBad})`);
ok('choice items: options + in-range integer index', choiceBad === 0, `(${choiceBad})`);
ok('numeric items carry a correctAnswer or trueValue', numericBad === 0, `(${numericBad})`);
ok('memory items: digits + positive displayMs', memoryBad === 0, `(${memoryBad})`);
ok('fluency items: a validity source + positive timeMs', fluencyBad === 0, `(${fluencyBad})`);

// --- planning: independent optimum verification for ALL kinds ---
const OPS = {
  '+1': (n) => n + 1, '+2': (n) => n + 2, '+3': (n) => n + 3,
  '-1': (n) => n - 1, '-2': (n) => n - 2, '*2': (n) => n * 2, '*3': (n) => n * 3
};
function numOptimal(start, target, allowed, cap = 20, bound = 400) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let d = 1; d <= cap; d++) {
    const next = [];
    for (const v of frontier) for (const op of allowed) {
      const nv = OPS[op](v);
      if (nv === target) return d;
      if (nv >= -bound && nv <= bound && !seen.has(nv)) { seen.add(nv); next.push(nv); }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}
function gridOptimal(rows) {
  let S = null, T = null;
  rows.forEach((r, ri) => [...r].forEach((ch, ci) => { if (ch === 'S') S = [ri, ci]; if (ch === 'T') T = [ri, ci]; }));
  if (!S || !T) return null;
  const R = rows.length, C = rows[0].length, key = (r, c) => r * C + c;
  const seen = new Set([key(...S)]);
  let frontier = [S], depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const [r, c] of frontier) for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= R || nc < 0 || nc >= C || rows[nr][nc] === '#') continue;
      if (nr === T[0] && nc === T[1]) return depth;
      const k = key(nr, nc);
      if (!seen.has(k)) { seen.add(k); next.push([nr, nc]); }
    }
    frontier = next;
  }
  return null;
}

let numChecked = 0, numBad = 0, gridChecked = 0, gridBad = 0, orderChecked = 0, orderBad = 0, shapeBad = 0;
for (const it of planningItems) {
  const a = it.answerData;
  if (typeof a.correctOrder === 'string') {
    orderChecked++;
    const n = it.promptData.steps?.length ?? 0;
    const want = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).sort().join('');
    if ([...a.correctOrder].sort().join('') !== want) orderBad++;
  } else if (Array.isArray(a.rows)) {
    gridChecked++;
    const flat = a.rows.join('');
    if ((flat.match(/S/g) ?? []).length !== 1 || (flat.match(/T/g) ?? []).length !== 1) shapeBad++;
    const opt = gridOptimal(a.rows);
    if (opt !== a.optimalMoves) gridBad++;
  } else if (typeof a.start === 'number' && typeof a.target === 'number' && Array.isArray(a.allowed)) {
    numChecked++;
    if (a.allowed.some((op) => !OPS[op])) { numBad++; continue; }
    const opt = numOptimal(a.start, a.target, a.allowed);
    if (a.optimalMoves != null && opt !== a.optimalMoves) numBad++;
    if (opt == null) numBad++; // unreachable puzzle shipped
  }
}
ok(`number-path items independently re-solved (${numChecked})`, numBad === 0, `(${numBad} mismatched/unreachable)`);
ok(`grid items re-solved at declared optimum (${gridChecked})`, gridBad === 0, `(${gridBad})`);
ok('grid items have exactly one S and one T', shapeBad === 0, `(${shapeBad})`);
ok(`step-order items are clean permutations (${orderChecked})`, orderBad === 0, `(${orderBad})`);

console.log(`\nBank integrity: ${pass} passed, ${fail} failed across ${allKeys.size} items in ${files.length} files`);
console.log(fail === 0 ? 'ALL BANK-INTEGRITY TESTS PASSED' : 'BANK-INTEGRITY TESTS FAILED');
if (fail > 0) process.exit(1);
