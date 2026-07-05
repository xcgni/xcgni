import { scoreDeliberate } from '../src/lib/server/rating/index.ts';

let pass = 0, fail = 0;
function eq(name, got, want) { if (Math.abs(got - want) < 1e-6) pass++; else { fail++; console.log(`  FAIL ${name}: got ${got}, want ${want}`); } }

eq('wrong = 0', scoreDeliberate(false), 0);
eq('wrong with moves = 0', scoreDeliberate(false, { moves: 3, optimalMoves: 3 }), 0);
eq('correct, no optimum = full', scoreDeliberate(true), 1.0);
eq('correct, optimal = full', scoreDeliberate(true, { moves: 5, optimalMoves: 5 }), 1.0);
eq('correct, under optimal = full', scoreDeliberate(true, { moves: 4, optimalMoves: 5 }), 1.0);
eq('correct, 2x optimal = 0.75', scoreDeliberate(true, { moves: 10, optimalMoves: 5 }), 0.75);
eq('correct, 4x optimal = floor+', scoreDeliberate(true, { moves: 20, optimalMoves: 5 }), 0.625);
eq('custom floor', scoreDeliberate(true, { moves: 10, optimalMoves: 5, floor: 0.4 }), 0.7);

// speed independence: there is no time parameter at all, so identical inputs always score identically
eq('speed-independent A', scoreDeliberate(true, { moves: 6, optimalMoves: 6 }), 1.0);
eq('speed-independent B', scoreDeliberate(true, { moves: 6, optimalMoves: 6 }), 1.0);

console.log(`\nDeliberate-scoring tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('FAILURES'); process.exit(1); } else { console.log('ALL DELIBERATE-SCORING TESTS PASSED'); }
