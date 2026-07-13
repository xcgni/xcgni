import { reactionBand, calibrateFromProbes, reactionScoreFromBand, DEFAULT_CALIBRATION } from '../src/lib/server/reaction/index.ts';

let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }

// band is always a range, never collapses
const b = reactionBand(300, DEFAULT_CALIBRATION);
ok('band has fast < slow', b.fastMs < b.slowMs);
ok('band width positive', b.widthMs > 0);
ok('fast edge >= physiological floor', b.fastMs >= 80);

// subtracting delay makes true RT faster than measured
ok('true RT faster than measured', b.slowMs < 300);

// calibration: tighter probes -> narrower band
const tight = calibrateFromProbes([45, 48, 50, 47, 52, 46], 144);
const wide = calibrateFromProbes([60, 120, 90, 160, 70, 140], 60);
ok('tight cal lower uncertainty', tight.uncertaintyMs <= wide.uncertaintyMs);
const bt = reactionBand(300, tight);
ok('calibrated band narrower than default', bt.widthMs < b.widthMs);

// floor estimated from minimum sample
ok('floor near min sample', Math.abs(tight.floorMs - 45) <= 1);

// too few probes -> safe default
ok('few probes -> default', calibrateFromProbes([100]).floorMs === DEFAULT_CALIBRATION.floorMs);

// score: faster band -> higher score, monotone
const fast = reactionScoreFromBand(reactionBand(220, tight));
const slow = reactionScoreFromBand(reactionBand(450, tight));
ok('faster scores higher', fast > slow);
ok('score in [0,1]', fast <= 1 && slow >= 0);

// elite ~180ms approaches 1, very slow approaches 0
ok('elite high score', reactionScoreFromBand({ fastMs: 170, slowMs: 190, widthMs: 20 }) > 0.9);
ok('slow low score', reactionScoreFromBand({ fastMs: 580, slowMs: 620, widthMs: 40 }) < 0.1);


// --- additional edge-case coverage ---

// physiological floor: even an impossibly fast measure can't beat 80ms
const floored = reactionBand(50, DEFAULT_CALIBRATION);
ok('fast edge never below 80ms', floored.fastMs >= 80);
ok('band never collapses (slow > fast even when floored)', floored.slowMs > floored.fastMs);

// monotonic: a slower measurement yields a slower band midpoint
const fastMeas = reactionBand(250, DEFAULT_CALIBRATION);
const slowMeas = reactionBand(450, DEFAULT_CALIBRATION);
ok('slower measure -> slower fast edge', slowMeas.fastMs > fastMeas.fastMs);
ok('slower measure -> slower slow edge', slowMeas.slowMs > fastMeas.slowMs);

// calibration: fewer than 3 samples falls back to default
ok('2 samples -> default cal', calibrateFromProbes([200, 210]).floorMs === DEFAULT_CALIBRATION.floorMs);
ok('empty samples -> default cal', calibrateFromProbes([]).floorMs === DEFAULT_CALIBRATION.floorMs);

// calibration floor tracks the minimum sample
const cal = calibrateFromProbes([220, 240, 260, 280, 300]);
ok('floor tracks min sample', cal.floorMs === 220);
ok('uncertainty has a positive floor', cal.uncertaintyMs >= 15);

// refresh rate contributes to uncertainty: lower Hz (slower frames) -> more uncertainty
const cal60 = calibrateFromProbes([200, 205, 210, 215, 220], 60);
const cal30 = calibrateFromProbes([200, 205, 210, 215, 220], 30);
ok('lower refresh rate -> >= uncertainty', cal30.uncertaintyMs >= cal60.uncertaintyMs);
ok('refreshHz recorded on calibration', cal60.refreshHz === 60);

// score clamps hard at both ends
ok('absurdly fast band clamps to 1', reactionScoreFromBand({ fastMs: 80, slowMs: 90, widthMs: 10 }) === 1);
ok('absurdly slow band clamps to 0', reactionScoreFromBand({ fastMs: 1500, slowMs: 1600, widthMs: 100 }) === 0);
ok('score is monotonic decreasing in time',
  reactionScoreFromBand({ fastMs: 200, slowMs: 220, widthMs: 20 }) >
  reactionScoreFromBand({ fastMs: 400, slowMs: 420, widthMs: 20 }));

console.log(failures === 0 ? '\nALL REACTION TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
