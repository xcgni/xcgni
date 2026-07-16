// Generates the strategic_planning bank: "number path" puzzles (start -> target via allowed ops).
// Procedurally generated with difficulty scaling by level; BFS guarantees each puzzle is solvable
// and yields the KNOWN optimal step count (so scoring rewards efficiency). No time pressure - these
// are the deliberate-hemisphere content where thinking slowly is free.

import { writeFileSync, mkdirSync } from 'node:fs';

const OPS = {
  '+1': (n) => n + 1, '+2': (n) => n + 2, '+3': (n) => n + 3,
  '-1': (n) => n - 1, '-2': (n) => n - 2,
  '*2': (n) => n * 2, '*3': (n) => n * 3
};

// BFS: minimum ops from start to target. Returns {moves} or null if unreachable within cap.
function optimal(start, target, allowed, cap = 14, bound = 300) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let depth = 1; depth <= cap; depth++) {
    const next = [];
    for (const v of frontier) {
      for (const op of allowed) {
        const nv = OPS[op](v);
        if (nv === target) return depth;
        if (nv >= -bound && nv <= bound && !seen.has(nv)) { seen.add(nv); next.push(nv); }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

// difficulty knobs per level: allowed op-set + the optimal-length window we want puzzles to land in.
// More ops and longer required paths as level rises.
const LEVELS = {
  1:  { ops: ['+2','*2'],                 minOpt: 1, maxOpt: 3 },
  2:  { ops: ['+3','*2','-1'],            minOpt: 2, maxOpt: 4 },
  3:  { ops: ['*2','+3','-1'],            minOpt: 3, maxOpt: 5 },
  4:  { ops: ['*3','+2','-1'],            minOpt: 3, maxOpt: 5 },
  5:  { ops: ['*3','*2','+1','-1'],       minOpt: 4, maxOpt: 6 },
  6:  { ops: ['*3','+2','-2'],            minOpt: 4, maxOpt: 6 },
  7:  { ops: ['*2','*3','-2','+1'],       minOpt: 5, maxOpt: 7 },
  8:  { ops: ['*3','+3','-2','+1'],       minOpt: 5, maxOpt: 8 },
  9:  { ops: ['*2','*3','+2','-1'],       minOpt: 6, maxOpt: 8 },
  10: { ops: ['*3','*2','+3','-2','+1'],  minOpt: 6, maxOpt: 9 }
};

const PER_LEVEL = 24;

// deterministic PRNG so regenerating is stable
let seed = 1337;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const randint = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const out = [];
for (let level = 1; level <= 10; level++) {
  const { ops, minOpt, maxOpt } = LEVELS[level];
  const seen = new Set();
  let made = 0, guard = 0;
  while (made < PER_LEVEL && guard < 20000) {
    guard++;
    const start = randint(1, 5 + level);
    const target = randint(start + 2, 16 + level * 8);
    if (target === start) continue;
    const key = `${start}->${target}`;
    if (seen.has(key)) continue;
    const opt = optimal(start, target, ops);
    if (opt == null || opt < minOpt || opt > maxOpt) continue;
    seen.add(key);
    made++;
    out.push({
      bankKey: `sp-L${level}-${made}`,
      category: 'strategic_planning',
      challengeType: 'number_path',
      level,
      rendererType: 'planning_sequence',
      promptData: {
        instruction: `Start at ${start}. Reach ${target}.`,
        start, target, allowed: ops,
        hint: 'Apply steps to the start number, in order, to reach the target. You can reuse each step as many times as you like. Type them like "*2, +3". No clock - take your time.'
      },
      answerData: { scoringMode: 'deliberate', start, target, allowed: ops, optimalMoves: opt },
      scoringConfig: { scoringMode: 'deliberate', expectedMedianMs: 30000, deliberate: true },
      version: 1, active: true
    });
  }
  if (made < PER_LEVEL) { console.error(`L${level}: only made ${made}/${PER_LEVEL}`); process.exit(1); }
}

mkdirSync('challenge-bank/strategic-planning', { recursive: true });
writeFileSync('challenge-bank/strategic-planning/number-path.levels.json', JSON.stringify(out, null, 2) + '\n');
const byLevel = {};
out.forEach(o => byLevel[o.level] = (byLevel[o.level] || 0) + 1);
console.log(`wrote ${out.length} puzzles:`, Object.entries(byLevel).map(([l,n]) => `L${l}:${n}`).join(' '));
