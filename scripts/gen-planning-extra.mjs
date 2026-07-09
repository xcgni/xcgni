// Generates the two additional strategic_planning suites (v1.3.0):
//  - step_order (verbal): real-world procedures with strictly causal step chains, shown
//    scrambled; the answer is the letters in workable order. One defensible order by
//    construction: every step physically requires the one before it.
//  - grid_path (visual): small mazes (S start, T target, # wall, · floor); the answer is
//    a move sequence. BFS guarantees solvability and yields the optimum for efficiency
//    scoring, exactly like the number-path suite.
// Deterministic PRNG so regeneration is stable. No time pressure on either - deliberate.

import { writeFileSync } from 'node:fs';

let seed = 20260708;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const randint = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

// ---------------------------------------------------------------------------
// VERBAL: strictly causal procedures. Each list is in the ONE workable order;
// contiguous slices preserve causality, so shorter items come from the same chains.
// ---------------------------------------------------------------------------
const PROCEDURES = [
  { name: 'making tea', steps: ['fill the kettle with water', 'boil the water', 'pour the boiling water into the cup with the teabag', 'let the tea steep', 'remove the teabag', 'add milk to the brewed tea', 'drink the tea'] },
  { name: 'planting a tree', steps: ['choose the planting spot', 'dig the hole', 'place the sapling into the hole', 'fill the hole back in around the roots', 'press the soil firm', 'water the planted sapling', 'mulch around the watered base'] },
  { name: 'washing clothes', steps: ['gather the dirty clothes', 'load the clothes into the machine', 'add the detergent', 'run the wash cycle', 'take the wet clothes out', 'hang the wet clothes to dry', 'fold the dried clothes'] },
  { name: 'baking bread', steps: ['mix flour, water and yeast into a dough', 'knead the dough', 'let the dough rise', 'shape the risen dough into a loaf', 'bake the loaf in the oven', 'take the baked loaf out', 'let the loaf cool before slicing'] },
  { name: 'sending a parcel', steps: ['put the item into a box', 'seal the box with tape', 'write the address on the sealed box', 'take the box to the post office', 'pay for the postage', 'get the tracking receipt', 'track the shipment online'] },
  { name: 'painting a wall', steps: ['move furniture away from the wall', 'cover the floor with a protective sheet', 'sand the wall smooth', 'apply the primer coat', 'let the primer dry', 'paint the first colour coat', 'apply the second coat over the dried first'] },
  { name: 'cooking pasta', steps: ['fill a pot with water', 'bring the water to a boil', 'add the pasta to the boiling water', 'cook the pasta until tender', 'drain the cooked pasta', 'stir the sauce into the drained pasta', 'serve the finished dish'] },
  { name: 'changing a flat tyre', steps: ['pull over and stop the car safely', 'take out the jack and the spare wheel', 'loosen the wheel nuts slightly', 'jack the car up', 'remove the loosened nuts and the flat wheel', 'mount the spare wheel and tighten the nuts', 'lower the car back down'] },
  { name: 'setting up a new phone', steps: ['unbox the phone', 'insert the SIM card', 'power the phone on', 'connect to the network', 'sign in to your account', 'restore your data from backup', 'install your remaining apps'] },
  { name: 'a job application', steps: ['read the job posting', 'update your CV for the role', 'write the cover letter', 'submit the application', 'receive the interview invitation', 'attend the interview', 'accept the job offer'] },
  { name: 'a camping trip', steps: ['pick the campsite', 'pack the gear', 'drive to the campsite', 'pitch the tent', 'collect firewood', 'light the campfire', 'cook dinner over the fire'] },
  { name: 'making coffee with a moka pot', steps: ['fill the bottom chamber with water', 'put ground coffee into the filter basket', 'screw the pot together', 'place the pot on the stove', 'wait for the coffee to rise into the top', 'take the pot off the heat', 'pour the coffee into a cup'] }
];

// step counts per level: 4,4,4,5,5,5,6,6,7,7
const STEPS_AT = { 1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 5, 7: 6, 8: 6, 9: 7, 10: 7 };
const PER_LEVEL_ORDER = 8;
const LETTERS = 'ABCDEFG';

const orderItems = [];
for (let level = 1; level <= 10; level++) {
  const n = STEPS_AT[level];
  const used = new Set();
  let made = 0, guard = 0;
  while (made < PER_LEVEL_ORDER && guard < 2000) {
    guard++;
    const proc = PROCEDURES[randint(0, PROCEDURES.length - 1)];
    const maxStart = proc.steps.length - n;
    const startIdx = randint(0, maxStart);
    const key = `${proc.name}:${startIdx}:${n}`;
    if (used.has(key)) continue;
    used.add(key);
    const slice = proc.steps.slice(startIdx, startIdx + n);
    // scramble: assign letters to a shuffled presentation; reject the un-scrambled identity
    let perm;
    do { perm = shuffle([...Array(n).keys()]); } while (perm.every((v, i) => v === i));
    // presented[i] shows slice[perm[i]] labelled LETTERS[i];
    // correct order = for each position p in the true sequence, the letter whose perm value is p
    const presented = perm.map((srcIdx, i) => `${LETTERS[i]}. ${slice[srcIdx]}`);
    const correctOrder = [...Array(n).keys()]
      .map((p) => LETTERS[perm.indexOf(p)])
      .join('');
    made++;
    orderItems.push({
      bankKey: `spo-L${level}-${made}`,
      category: 'strategic_planning',
      challengeType: 'step_order',
      level,
      version: 1,
      active: true,
      scoringConfig: { scoringMode: 'deliberate', expectedMedianMs: 30000, deliberate: true },
      rendererType: 'planning_sequence',
      promptData: {
        kind: 'step_order',
        instruction: `Put the steps of ${proc.name} in workable order.`,
        steps: presented,
        hint: 'Type the letters in the order the steps must happen, like "C, A, D, B". Each letter exactly once. No clock - take your time.'
      },
      answerData: {
        scoringMode: 'deliberate',
        correctOrder
      }
    });
  }
}

// ---------------------------------------------------------------------------
// VISUAL: grid mazes. BFS for solvability + optimum.
// ---------------------------------------------------------------------------
function bfs(rows, start, target) {
  const R = rows.length, C = rows[0].length;
  const key = (r, c) => r * C + c;
  const seen = new Set([key(...start)]);
  let frontier = [start];
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const [r, c] of frontier) {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
        if (rows[nr][nc] === '#') continue;
        if (nr === target[0] && nc === target[1]) return depth;
        const k = key(nr, nc);
        if (!seen.has(k)) { seen.add(k); next.push([nr, nc]); }
      }
    }
    frontier = next;
  }
  return null;
}

// level knobs: grid size, wall density, wanted optimal-length window
const GRID_LEVELS = {
  1:  { size: 4, walls: 0.10, minOpt: 3,  maxOpt: 4 },
  2:  { size: 4, walls: 0.18, minOpt: 4,  maxOpt: 5 },
  3:  { size: 5, walls: 0.18, minOpt: 5,  maxOpt: 6 },
  4:  { size: 5, walls: 0.24, minOpt: 6,  maxOpt: 7 },
  5:  { size: 6, walls: 0.22, minOpt: 7,  maxOpt: 8 },
  6:  { size: 6, walls: 0.28, minOpt: 8,  maxOpt: 9 },
  7:  { size: 7, walls: 0.26, minOpt: 9,  maxOpt: 10 },
  8:  { size: 7, walls: 0.30, minOpt: 10, maxOpt: 12 },
  9:  { size: 8, walls: 0.28, minOpt: 11, maxOpt: 13 },
  10: { size: 8, walls: 0.32, minOpt: 12, maxOpt: 15 }
};
const PER_LEVEL_GRID = 12;

const gridItems = [];
for (let level = 1; level <= 10; level++) {
  const { size, walls, minOpt, maxOpt } = GRID_LEVELS[level];
  const used = new Set();
  let made = 0, guard = 0;
  while (made < PER_LEVEL_GRID && guard < 40000) {
    guard++;
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => (rand() < walls ? '#' : '·'))
    );
    const sr = randint(0, size - 1), sc = randint(0, size - 1);
    let tr = randint(0, size - 1), tc = randint(0, size - 1);
    if (Math.abs(tr - sr) + Math.abs(tc - sc) < Math.max(2, minOpt - 2)) continue;
    grid[sr][sc] = 'S'; grid[tr][tc] = 'T';
    const rows = grid.map((r) => r.join(''));
    const opt = bfs(rows, [sr, sc], [tr, tc]);
    if (opt == null || opt < minOpt || opt > maxOpt) continue;
    const sig = rows.join('/');
    if (used.has(sig)) continue;
    used.add(sig);
    made++;
    gridItems.push({
      bankKey: `spg-L${level}-${made}`,
      category: 'strategic_planning',
      challengeType: 'grid_path',
      level,
      version: 1,
      active: true,
      scoringConfig: { scoringMode: 'deliberate', expectedMedianMs: 30000, deliberate: true },
      rendererType: 'planning_sequence',
      promptData: {
        kind: 'grid_path',
        instruction: 'Plan a route from S to T. Walls (#) block the way.',
        rows,
        hint: 'Type your moves as U, D, L, R (up, down, left, right), like "R, R, D, D" or "RRDD". Any legal route that reaches T counts; shorter routes score higher. No clock.'
      },
      answerData: {
        scoringMode: 'deliberate',
        rows,
        optimalMoves: opt
      }
    });
  }
  if (made < PER_LEVEL_GRID) console.error(`grid L${level}: only ${made}`);
}

writeFileSync('challenge-bank/strategic-planning/step-order.levels.json', JSON.stringify(orderItems, null, 1));
writeFileSync('challenge-bank/strategic-planning/grid-path.levels.json', JSON.stringify(gridItems, null, 1));
console.log(`step_order: ${orderItems.length} items; grid_path: ${gridItems.length} items`);
