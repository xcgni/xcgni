import { gradePlan, normalizeOp } from '../src/lib/server/sessions/planning.ts';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } }

// normalizeOp
ok('normalize *2', normalizeOp('*2') === '*2');
ok('normalize x2', normalizeOp('x2') === '*2');
ok('normalize X2', normalizeOp('X2') === '*2');
ok('normalize ×2', normalizeOp('×2') === '*2');
ok('normalize 2* (reversed)', normalizeOp('2*') === '*2');
ok('normalize +3', normalizeOp('+3') === '+3');
ok('normalize unicode minus', normalizeOp('\u22121') === '-1');
ok('reject garbage', normalizeOp('blah') === null);
ok('reject *5 (not a primitive)', normalizeOp('*5') === null);

// gradePlan - correct path: 3 ->*3-> 9 ->+2-> 11
{
  const r = gradePlan('*3, +2', { start: 3, target: 11, allowed: ['*3', '+2', '-1'] });
  ok('correct reaches target', r.correct === true);
  ok('correct counts 2 moves', r.moves === 2);
}
// arrows accepted
{
  const r = gradePlan('*3 -> +2', { start: 3, target: 11, allowed: ['*3', '+2', '-1'] });
  ok('arrow separator works', r.correct === true && r.moves === 2);
}
// wrong target
{
  const r = gradePlan('+2', { start: 3, target: 11, allowed: ['*3', '+2', '-1'] });
  ok('wrong endpoint not correct', r.correct === false);
  ok('reached reported', r.reached === 5);
}
// disallowed op
{
  const r = gradePlan('*2', { start: 3, target: 11, allowed: ['*3', '+2', '-1'] });
  ok('disallowed op flagged', r.correct === false && r.invalidOp === '*2');
}
// inefficient but correct: 3 ->+2->5->+2->7->+2->9->+2->11 (4 moves, optimal 2)
{
  const r = gradePlan('+2,+2,+2,+2', { start: 3, target: 11, allowed: ['*3', '+2', '-1'] });
  ok('inefficient path still correct', r.correct === true);
  ok('inefficient path counts 4 moves', r.moves === 4);
}
// empty answer is not correct
{
  const r = gradePlan('', { start: 3, target: 11, allowed: ['*3', '+2', '-1'] });
  ok('empty not correct', r.correct === false && r.moves === 0);
}

console.log(`\nPlanning tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('FAILURES'); process.exit(1); } else { console.log('ALL PLANNING TESTS PASSED'); }
