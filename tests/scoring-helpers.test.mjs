import { percentError, estimationScore, ordinal, percentileWording } from '../src/lib/server/rating/index.ts';

let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }
function near(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }

// percentError
ok('exact guess = 0 error', percentError(100, 100) === 0);
ok('10% over', near(percentError(110, 100), 0.1));
ok('10% under', near(percentError(90, 100), 0.1));
ok('guards divide-by-zero on true=0', Number.isFinite(percentError(5, 0)));

// estimationScore - cold start (fewer than 5 others)
ok('cold start perfect -> 1.0', estimationScore(0, []) === 1);
ok('cold start 25% error -> ~0.5', near(estimationScore(0.25, []), 0.5, 0.02));
ok('cold start big error -> low', estimationScore(2, []) < 0.2);
ok('cold start clamped 0..1', estimationScore(0, []) <= 1 && estimationScore(99, []) >= 0);

// estimationScore - population branch (>=5 others): fraction you beat
ok('beats most of population', near(estimationScore(0.1, [0.2, 0.3, 0.4, 0.5, 0.6]), 1.0));
ok('beats none', near(estimationScore(0.9, [0.2, 0.3, 0.4, 0.5, 0.6]), 0));
ok('beats half', near(estimationScore(0.35, [0.1, 0.2, 0.4, 0.5, 0.6]), 0.6, 0.01));

// ordinal - the classic teens trap
ok('1st', ordinal(1) === '1st');
ok('2nd', ordinal(2) === '2nd');
ok('3rd', ordinal(3) === '3rd');
ok('4th', ordinal(4) === '4th');
ok('11th not 11st', ordinal(11) === '11th');
ok('12th not 12nd', ordinal(12) === '12th');
ok('13th not 13rd', ordinal(13) === '13th');
ok('21st', ordinal(21) === '21st');
ok('22nd', ordinal(22) === '22nd');
ok('23rd', ordinal(23) === '23rd');
ok('100th', ordinal(100) === '100th');
ok('111th', ordinal(111) === '111th');

// percentileWording
ok('wording includes ordinal + pct', percentileWording(92) === '92nd percentile · higher than 92% of rated users');

console.log(failures === 0 ? '\nALL SCORING-HELPER TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
