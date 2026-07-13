import { validateAnswer } from '../src/lib/server/challenges/validate.ts';

let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }

// numeric correctAnswer: exact and tolerant
ok('numeric exact', validateAnswer({ correctAnswer: 42 }, '42') === true);
ok('numeric wrong', validateAnswer({ correctAnswer: 42 }, '43') === false);
ok('numeric with spaces trimmed', validateAnswer({ correctAnswer: 42 }, '  42 ') === true);
ok('decimal comma tolerated', validateAnswer({ correctAnswer: 3.5 }, '3,5') === true);
ok('decimal point works', validateAnswer({ correctAnswer: 3.5 }, '3.5') === true);

// string correctAnswer (e.g. multiple-choice index as string)
ok('string index match', validateAnswer({ correctAnswer: 2 }, '2') === true);
ok('string mismatch', validateAnswer({ correctAnswer: 'cat' }, 'dog') === false);
ok('string exact', validateAnswer({ correctAnswer: 'cat' }, 'cat') === true);

// digit-span: answers typed with spaces should match the stripped form
ok('digit span with spaces', validateAnswer({ acceptedAnswers: ['4729'] }, '4 7 2 9') === true);
ok('digit span exact', validateAnswer({ acceptedAnswers: ['4729'] }, '4729') === true);
ok('digit span wrong', validateAnswer({ acceptedAnswers: ['4729'] }, '4720') === false);

// acceptedAnswers list
ok('accepted list hit', validateAnswer({ acceptedAnswers: ['1', '01'] }, '1') === true);
ok('accepted list miss', validateAnswer({ acceptedAnswers: ['1', '01'] }, '2') === false);

// empty / malformed inputs don't throw and return false
ok('empty given', validateAnswer({ correctAnswer: 5 }, '') === false);
ok('no answer data', validateAnswer({}, '5') === false);
ok('garbage given', validateAnswer({ correctAnswer: 5 }, 'abc') === false);

// numeric equivalence across representations
ok('leading zero numeric', validateAnswer({ correctAnswer: 7 }, '07') === true);
ok('trailing zero decimal', validateAnswer({ correctAnswer: 2.5 }, '2.50') === true);


// --- additional edge cases & regression guards ---

// REGRESSION: empty string must not match correctAnswer 0 (Number('')===0 bug, fixed)
ok('empty does NOT match correctAnswer 0', validateAnswer({ correctAnswer: 0 }, '') === false);
ok('zero matches correctAnswer 0', validateAnswer({ correctAnswer: 0 }, '0') === true);
ok('whitespace-only does not match 0', validateAnswer({ correctAnswer: 0 }, '   ') === false);

// negative numbers
ok('negative exact', validateAnswer({ correctAnswer: -5 }, '-5') === true);
ok('negative decimal comma', validateAnswer({ correctAnswer: -3.5 }, '-3,5') === true);
ok('negative wrong sign', validateAnswer({ correctAnswer: 5 }, '-5') === false);

// numeric equivalence with whitespace + comma together
ok('spaced negative decimal', validateAnswer({ correctAnswer: -2.5 }, '  -2,5 ') === true);

// string answers are case-sensitive as authored (exact match only)
ok('string case-sensitive miss', validateAnswer({ correctAnswer: 'Cat' }, 'cat') === false);

// accepted list with comma-normalized numeric
ok('accepted list comma normalized', validateAnswer({ acceptedAnswers: ['3.5'] }, '3,5') === true);

// both fields present: either path can validate
ok('both fields, accepted hit', validateAnswer({ correctAnswer: 9, acceptedAnswers: ['nine'] }, 'nine') === true);
ok('both fields, correct hit', validateAnswer({ correctAnswer: 9, acceptedAnswers: ['nine'] }, '9') === true);
ok('both fields, neither', validateAnswer({ correctAnswer: 9, acceptedAnswers: ['nine'] }, 'ten') === false);

// large numbers and scientific-ish input
ok('large number exact', validateAnswer({ correctAnswer: 1000000 }, '1000000') === true);

// null/garbage answerData doesn't throw
ok('null answerData -> false', validateAnswer(null, '5') === false);
ok('undefined answerData -> false', validateAnswer(undefined, '5') === false);

console.log(failures === 0 ? '\nALL CHALLENGE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
