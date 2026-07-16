// Deterministic challenge-bank generator. No dependencies.
// Re-running with the same SEED always produces identical files,
// so the bank can be regenerated, reviewed and diffed safely.
//
// Usage: node scripts/generate-bank.mjs
// Output: challenge-bank/numerical-fluency/arithmetic.levels.json
//         challenge-bank/pattern-recognition/sequence.levels.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 20260612;

// mulberry32 - small, deterministic PRNG
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
const ri = (min, max) => Math.floor(rng() * (max - min + 1)) + min; // inclusive
const pick = (arr) => arr[ri(0, arr.length - 1)];

// ---------------------------------------------------------------------------
// Numerical Fluency - arithmetic, levels 1..15, typed numeric answer
// ---------------------------------------------------------------------------

// expectedMedianMs is a hand-tuned starting guess per level; the app records
// observed medians per challenge and these can be recalibrated later.
const ARITH_MEDIANS = {
  1: 2400, 2: 2800, 3: 3400, 4: 4200, 5: 5000,
  6: 4600, 7: 6500, 8: 7500, 9: 8500, 10: 11000,
  11: 12000, 12: 13000, 13: 15000, 14: 18000, 15: 22000
};

function arithLevel(level) {
  switch (level) {
    case 1: { // single-digit addition
      const a = ri(2, 9), b = ri(2, 9);
      return { expr: `${a} + ${b}`, ans: a + b };
    }
    case 2: { // single-digit subtraction, non-negative
      const a = ri(3, 9), b = ri(1, a - 1);
      return { expr: `${a} − ${b}`, ans: a - b };
    }
    case 3: { // two-digit + one-digit
      const a = ri(11, 89), b = ri(2, 9);
      return { expr: `${a} + ${b}`, ans: a + b };
    }
    case 4: { // two-digit subtraction
      const a = ri(25, 99), b = ri(11, a - 10);
      return { expr: `${a} − ${b}`, ans: a - b };
    }
    case 5: { // two-digit addition with carry
      let a, b;
      do { a = ri(15, 89); b = ri(15, 89); } while ((a % 10) + (b % 10) < 10);
      return { expr: `${a} + ${b}`, ans: a + b };
    }
    case 6: { // multiplication 2-10
      const a = ri(2, 10), b = ri(2, 10);
      return { expr: `${a} × ${b}`, ans: a * b };
    }
    case 7: { // mixed two operations, small numbers
      const a = ri(5, 30), b = ri(2, 15), c = ri(2, 15);
      if (rng() < 0.5) return { expr: `${a} + ${b} − ${c}`, ans: a + b - c };
      return { expr: `${a} − ${b} + ${c}`, ans: a - b + c };
    }
    case 8: { // two-digit × one-digit
      const a = ri(12, 49), b = ri(3, 9);
      return { expr: `${a} × ${b}`, ans: a * b };
    }
    case 9: { // three-digit add/sub
      if (rng() < 0.5) {
        const a = ri(120, 880), b = ri(110, 990 - 100);
        return { expr: `${a} + ${b}`, ans: a + b };
      }
      const a = ri(300, 980), b = ri(110, a - 100);
      return { expr: `${a} − ${b}`, ans: a - b };
    }
    case 10: { // exact division or small two-digit × two-digit
      if (rng() < 0.5) {
        const b = ri(3, 12), q = ri(4, 25);
        return { expr: `${b * q} ÷ ${b}`, ans: q };
      }
      const a = ri(11, 25), b = ri(11, 19);
      return { expr: `${a} × ${b}`, ans: a * b };
    }
    case 11: { // three-term mixed with multiplication (standard precedence)
      const a = ri(3, 12), b = ri(3, 12), c = ri(5, 60);
      if (rng() < 0.5) return { expr: `${a} × ${b} + ${c}`, ans: a * b + c };
      return { expr: `${c} − ${a} × ${b}`.replace('−', '−'), ans: c - a * b };
    }
    case 12: { // squares and larger exact division
      if (rng() < 0.5) {
        const a = ri(11, 25);
        return { expr: `${a}²`, ans: a * a };
      }
      const b = ri(12, 24), q = ri(11, 40);
      return { expr: `${b * q} ÷ ${b}`, ans: q };
    }
    case 13: { // percentages of round-ish numbers
      const pcts = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
      const p = pick(pcts);
      const base = ri(2, 48) * 20; // multiples of 20 keep answers integral for these pcts
      return { expr: `${p}% of ${base}`, ans: (p * base) / 100 };
    }
    case 14: { // a×b + c×d
      const a = ri(4, 15), b = ri(4, 15), c = ri(4, 15), d = ri(4, 15);
      return { expr: `${a} × ${b} + ${c} × ${d}`, ans: a * b + c * d };
    }
    case 15: { // multi-step: a×b − c×d, or (a+b)×c
      if (rng() < 0.5) {
        const a = ri(6, 19), b = ri(6, 19), c = ri(4, 15), d = ri(4, 15);
        return { expr: `${a} × ${b} − ${c} × ${d}`, ans: a * b - c * d };
      }
      const a = ri(8, 40), b = ri(8, 40), c = ri(3, 12);
      return { expr: `(${a} + ${b}) × ${c}`, ans: (a + b) * c };
    }
    default:
      throw new Error(`no arithmetic generator for level ${level}`);
  }
}

function buildArithmetic() {
  const PER_LEVEL = 36;
  const out = [];
  for (let level = 1; level <= 15; level++) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER_LEVEL && guard < 5000) {
      guard++;
      const { expr, ans } = arithLevel(level);
      if (seen.has(expr)) continue;
      // negative answers are allowed but typed minus is friction; keep v1 non-negative
      if (ans < 0) continue;
      seen.add(expr);
      out.push({
        bankKey: `nf-arith-L${level}-${seen.size}`,
        category: 'numerical_fluency',
        challengeType: 'arithmetic',
        level,
        rendererType: 'numeric_text_input',
        promptData: { expression: expr },
        answerData: { correctAnswer: ans, acceptedAnswers: [String(ans)] },
        scoringConfig: {
          expectedMedianMs: ARITH_MEDIANS[level],
          slowCorrectFloorScore: 0.45,
          fastCorrectScore: 1.0
        },
        version: 1,
        active: true
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pattern Recognition - numeric sequence completion, levels 1..12
// ---------------------------------------------------------------------------

const SEQ_MEDIANS = {
  1: 4000, 2: 4500, 3: 5500, 4: 6500, 5: 7500, 6: 9000,
  7: 10000, 8: 13000, 9: 15000, 10: 18000, 11: 21000, 12: 25000
};

function seqFrom(start, n, next) {
  const terms = [start];
  for (let i = 1; i < n; i++) terms.push(next(terms[i - 1], i, terms));
  return terms;
}

function seqLevel(level) {
  switch (level) {
    case 1: { // +k, small
      const k = ri(2, 6), s = ri(1, 12);
      const t = seqFrom(s, 5, (p) => p + k);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 2: { // −k
      const k = ri(2, 7), s = ri(40, 90);
      const t = seqFrom(s, 5, (p) => p - k);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 3: { // +k, larger step / two-digit terms
      const k = ri(7, 19), s = ri(5, 40);
      const t = seqFrom(s, 5, (p) => p + k);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 4: { // geometric ×2 / ×3 / ×4 / ×5
      const m = pick([2, 2, 3, 3, 4, 5]); // weight smaller multipliers
      const maxStart = m === 2 ? 12 : m === 3 ? 7 : m === 4 ? 5 : 4;
      const s = ri(1, maxStart);
      const t = seqFrom(s, 5, (p) => p * m);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 5: { // squares with offset: n² + c
      const c = ri(-3, 5), start = ri(1, 4);
      const t = [];
      for (let n = start; n < start + 5; n++) t.push(n * n + c);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 6: { // alternating +a, +b
      const a = ri(2, 9); let b = ri(2, 9);
      if (b === a) b += 1;
      const s = ri(1, 15);
      const t = seqFrom(s, 6, (p, i) => p + (i % 2 === 1 ? a : b));
      return { shown: t.slice(0, 5), ans: t[5] };
    }
    case 7: { // fibonacci-like: sum of previous two
      const a = ri(1, 6); let b = ri(1, 8);
      const t = [a, b];
      while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2]);
      return { shown: t.slice(0, 5), ans: t[5] };
    }
    case 8: { // quadratic: constant second difference
      const d1 = ri(2, 6), d2 = ri(2, 5), s = ri(1, 10);
      const t = [s];
      let step = d1;
      while (t.length < 5) { t.push(t[t.length - 1] + step); step += d2; }
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 9: { // recurrence ×k + c
      const k = 2, c = pick([-3, -2, -1, 1, 2, 3]), s = ri(2, 7);
      const t = seqFrom(s, 5, (p) => p * k + c);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 10: { // two interleaved sequences; answer continues the combined stream
      const a0 = ri(1, 9), ka = ri(2, 6);
      const b0 = ri(20, 60), kb = ri(2, 8);
      const A = seqFrom(a0, 4, (p) => p + ka);
      const B = seqFrom(b0, 3, (p) => p - kb);
      const t = [A[0], B[0], A[1], B[1], A[2], B[2], A[3]];
      return { shown: t.slice(0, 6), ans: t[6] };
    }
    case 11: { // products n·(n+k), optionally with constant offset
      const k = pick([1, 1, 2, 3]);
      const c = pick([0, 0, 0, 1, -1, 2]);
      const start = ri(2, 7);
      const t = [];
      for (let n = start; n < start + 5; n++) t.push(n * (n + k) + c);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    case 12: { // recurrence ×2 − c or ×3 − c, faster growth
      const k = pick([2, 3]), c = ri(1, 5), s = ri(3, 8);
      const t = seqFrom(s, 5, (p) => p * k - c);
      return { shown: t.slice(0, 4), ans: t[4] };
    }
    default:
      throw new Error(`no sequence generator for level ${level}`);
  }
}

function buildSequences() {
  const PER_LEVEL = 32;
  const out = [];
  for (let level = 1; level <= 12; level++) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER_LEVEL && guard < 5000) {
      guard++;
      const { shown, ans } = seqLevel(level);
      const key = shown.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        bankKey: `pr-seq-L${level}-${seen.size}`,
        category: 'pattern_recognition',
        challengeType: 'sequence_completion',
        level,
        rendererType: 'numeric_text_input',
        promptData: { sequence: shown, instruction: 'What number comes next?' },
        answerData: { correctAnswer: ans, acceptedAnswers: [String(ans)] },
        scoringConfig: {
          expectedMedianMs: SEQ_MEDIANS[level],
          slowCorrectFloorScore: 0.45,
          fastCorrectScore: 1.0
        },
        version: 1,
        active: true
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Working Memory - digit span, levels 1..12 (forward 3-8, then reverse 4-7)
// Renderer: memory_recall (timed display, then hidden recall input)
// ---------------------------------------------------------------------------

// span per level; mode flips to reverse for the top four levels
const WM_LEVELS = {
  1:  { span: 3, mode: 'forward' },
  2:  { span: 4, mode: 'forward' },
  3:  { span: 4, mode: 'forward' },
  4:  { span: 5, mode: 'forward' },
  5:  { span: 5, mode: 'forward' },
  6:  { span: 6, mode: 'forward' },
  7:  { span: 7, mode: 'forward' },
  8:  { span: 8, mode: 'forward' },
  9:  { span: 4, mode: 'reverse' },
  10: { span: 5, mode: 'reverse' },
  11: { span: 6, mode: 'reverse' },
  12: { span: 7, mode: 'reverse' }
};

function digitString(span) {
  // digits 1-9, no immediate repeats (classic digit-span constraint)
  const out = [];
  while (out.length < span) {
    const d = ri(1, 9);
    if (out.length > 0 && out[out.length - 1] === d) continue;
    out.push(d);
  }
  return out;
}

function buildWorkingMemory() {
  const PER_LEVEL = 32;
  const out = [];
  for (let level = 1; level <= 12; level++) {
    const { span, mode } = WM_LEVELS[level];
    const displayMs = 600 * span + 600;
    const expectedMedianMs = mode === 'forward' ? span * 320 + 1300 : span * 450 + 1800;
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER_LEVEL && guard < 5000) {
      guard++;
      const digits = digitString(span);
      const key = digits.join('');
      if (seen.has(key)) continue;
      seen.add(key);
      const answer = mode === 'forward' ? key : key.split('').reverse().join('');
      out.push({
        bankKey: `wm-span-L${level}-${seen.size}`,
        category: 'working_memory',
        challengeType: 'digit_span',
        level,
        rendererType: 'memory_recall',
        promptData: {
          digits: digits.join(' '),
          displayMs,
          mode,
          instruction: mode === 'forward'
            ? 'Type the digits in the order shown.'
            : 'Type the digits in REVERSE order.'
        },
        answerData: { correctAnswer: answer, acceptedAnswers: [answer] },
        scoringConfig: {
          expectedMedianMs,
          displayMs, // display time is excluded from response timing on the server
          slowCorrectFloorScore: 0.45,
          fastCorrectScore: 1.0
        },
        version: 1,
        active: true
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Attention Control - count target symbols in a block, levels 1..10
// Renderer: numeric_text_input with a symbol block prompt
// ---------------------------------------------------------------------------

const AC_EASY_SETS = [
  { t: '7', d: ['K', 'M', 'X'] },
  { t: 'Z', d: ['A', 'E', 'U'] },
  { t: 'b', d: ['s', 'v', 'w'] },
  { t: 'O', d: ['T', 'L', 'V'] }
];
const AC_HARD_SETS = [
  { t: '7', d: ['1', '2', '4'] },
  { t: 'b', d: ['d', 'p', 'q'] },
  { t: 'Z', d: ['N', 'S', 'X'] },
  { t: 'O', d: ['Q', 'C', 'G'] }
];

function buildAttentionControl() {
  const PER_LEVEL = 32;
  const out = [];
  for (let level = 1; level <= 10; level++) {
    const rows = 3 + Math.floor((level - 1) / 3);        // 3..6
    const cols = Math.min(8 + (level - 1), 14);          // 8..14
    const cells = rows * cols;
    const sets = level >= 5 ? AC_HARD_SETS : AC_EASY_SETS; // similar distractors from L5
    const expectedMedianMs = cells * 230 + 2500;
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER_LEVEL && guard < 5000) {
      guard++;
      const set = pick(sets);
      const targetCount = ri(3, Math.min(12, Math.floor(cells / 5) + 3));
      // fill grid with distractors, then place targets at random cells
      const grid = Array.from({ length: cells }, () => set.d[ri(0, set.d.length - 1)]);
      const positions = new Set();
      while (positions.size < targetCount) positions.add(ri(0, cells - 1));
      for (const p of positions) grid[p] = set.t;
      const blockRows = [];
      for (let r = 0; r < rows; r++) {
        blockRows.push(grid.slice(r * cols, (r + 1) * cols).join(' '));
      }
      const key = blockRows.join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        bankKey: `ac-count-L${level}-${seen.size}`,
        category: 'attention_control',
        challengeType: 'target_count',
        level,
        rendererType: 'numeric_text_input',
        promptData: {
          block: blockRows,
          target: set.t,
          instruction: `How many ${set.t} are in the block?`
        },
        answerData: { correctAnswer: targetCount, acceptedAnswers: [String(targetCount)] },
        scoringConfig: {
          expectedMedianMs,
          slowCorrectFloorScore: 0.45,
          fastCorrectScore: 1.0
        },
        version: 1,
        active: true
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spatial Reasoning - multiple choice over SVG figures, levels 1..12
//   L1-4  mental rotation: which option is a rotation of the target
//   L5-8  symmetry: which option is the mirror image across a given axis
//   L9-12 odd-one-out: which figure is not a rotation of the others
//
// Figures are described as compact, renderer-agnostic shape specs the client
// draws as SVG. Each shape is an asymmetric polyomino-ish glyph on a grid so
// rotations and reflections are visually distinct.
// renderer_type = 'multiple_choice_svg'
// ---------------------------------------------------------------------------

// A base figure: an L-tromino-like path plus a marker cell, on a 4x4 grid,
// chosen so that all 4 rotations and the mirror are distinguishable.
const SPATIAL_BASE_FIGURES = [
  // each is a list of filled cells [col,row] on a 4x4 grid, with one accent cell
  { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], accent: [0, 0] },
  { cells: [[0, 0], [1, 0], [2, 0], [2, 1]], accent: [0, 0] },
  { cells: [[1, 0], [1, 1], [0, 2], [1, 2]], accent: [1, 0] },
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], accent: [0, 0] },
  { cells: [[0, 1], [1, 1], [2, 1], [2, 0]], accent: [2, 0] },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], accent: [0, 0] }
];

const GRID = 4;
const cellKey = (c) => `${c[0]},${c[1]}`;
function normalizeCells(cells) {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map((c) => [c[0] - minX, c[1] - minY]);
}
function rotate90(cells) {
  // (x,y) -> (y, -x); rotate accent along with body via shared transform
  return cells.map((c) => [c[1], -c[0]]);
}
function mirrorX(cells) {
  return cells.map((c) => [-c[0], c[1]]);
}
function applyN(fn, cells, n) {
  let out = cells;
  for (let i = 0; i < n; i++) out = fn(out);
  return out;
}
function figureToSpec(fig) {
  // returns { cells: [[x,y]...], accent: [x,y] } normalized into 0..GRID-1
  const all = normalizeCells([...fig.cells]);
  // recompute accent index by position within original cells
  const accentIdx = fig.cells.findIndex((c) => c[0] === fig.accent[0] && c[1] === fig.accent[1]);
  return { cells: all, accentIdx: accentIdx < 0 ? 0 : accentIdx };
}
function transformFigure(base, rotations, mirror) {
  let cells = base.cells.map((c) => [...c]);
  if (mirror) cells = mirrorX(cells);
  cells = applyN(rotate90, cells, rotations);
  const accentIdxBefore = base.cells.findIndex((c) => c[0] === base.accent[0] && c[1] === base.accent[1]);
  cells = normalizeCells(cells);
  return { cells, accentIdx: accentIdxBefore < 0 ? 0 : accentIdxBefore };
}
function cellsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(cellKey));
  return b.every((c) => sa.has(cellKey(c)));
}
function sameUpToRotation(a, b) {
  let cur = a.map((c) => [...c]);
  for (let r = 0; r < 4; r++) {
    if (cellsEqual(normalizeCells(cur), normalizeCells(b))) return true;
    cur = rotate90(cur);
  }
  return false;
}

const SPATIAL_MEDIANS = {
  1: 6000, 2: 7000, 3: 8500, 4: 10000, 5: 8000, 6: 9500,
  7: 11000, 8: 13000, 9: 11000, 10: 13000, 11: 15000, 12: 18000
};

function buildSpatial() {
  const PER_LEVEL = 30;
  const out = [];

  for (let level = 1; level <= 12; level++) {
    const seen = new Set();
    let guard = 0;
    const mode = level <= 4 ? 'rotation' : level <= 8 ? 'symmetry' : 'odd_one_out';

    while (seen.size < PER_LEVEL && guard < 6000) {
      guard++;
      const base = pick(SPATIAL_BASE_FIGURES);

      if (mode === 'rotation') {
        // prompt: a figure. options: 4 figures, exactly one is a pure rotation
        // of the prompt; distractors are mirrored-then-rotated (look similar, aren't rotations)
        const promptRot = ri(0, 3);
        const prompt = transformFigure(base, promptRot, false);
        const correctRot = ri(0, 3);
        const correct = transformFigure(base, correctRot, false);
        // distractors: mirror image at various rotations (never a true rotation of prompt)
        const distractors = [];
        const used = new Set();
        let dg = 0;
        while (distractors.length < 3 && dg < 50) {
          dg++;
          const d = transformFigure(base, ri(0, 3), true);
          if (sameUpToRotation(d.cells, prompt.cells)) continue; // safety: skip accidental rotations
          const k = d.cells.map(cellKey).sort().join('|');
          if (used.has(k)) continue;
          used.add(k);
          distractors.push(d);
        }
        if (distractors.length < 3) continue;
        const key = `r${level}-${prompt.cells.map(cellKey).join('')}-${correct.cells.map(cellKey).join('')}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const options = shuffleWithAnswer([correct, ...distractors]);
        out.push(spatialChallenge(level, 'mental_rotation',
          'Which figure is a rotation of the one above?', prompt, options.list, options.answerIndex));

      } else if (mode === 'symmetry') {
        // prompt: a figure + a vertical mirror axis. correct: its mirror image.
        // distractors: rotations of the prompt (not the mirror)
        const promptRot = ri(0, 3);
        const prompt = transformFigure(base, promptRot, false);
        const correct = transformFigure(base, promptRot, true); // mirrored
        if (sameUpToRotation(correct.cells, prompt.cells)) continue; // ambiguous figure, skip
        const distractors = [];
        const used = new Set([correct.cells.map(cellKey).sort().join('|')]);
        let dg = 0;
        while (distractors.length < 3 && dg < 50) {
          dg++;
          const d = transformFigure(base, ri(0, 3), false);
          const k = d.cells.map(cellKey).sort().join('|');
          if (used.has(k)) continue;
          if (cellsEqual(normalizeCells(d.cells), normalizeCells(correct.cells))) continue;
          used.add(k);
          distractors.push(d);
        }
        if (distractors.length < 3) continue;
        const key = `s${level}-${prompt.cells.map(cellKey).join('')}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const options = shuffleWithAnswer([correct, ...distractors]);
        out.push(spatialChallenge(level, 'symmetry',
          'Which figure is the mirror image across the vertical axis?', prompt, options.list, options.answerIndex, true));

      } else {
        // odd-one-out: 4 figures, 3 are rotations of one base, 1 is the mirror (the odd one)
        const baseRotations = [0, 1, 2, 3];
        // pick 3 distinct rotations for the "same" group
        const rots = shuffleArr(baseRotations).slice(0, 3);
        const sameGroup = rots.map((r) => transformFigure(base, r, false));
        const odd = transformFigure(base, ri(0, 3), true);
        // ensure odd really isn't a rotation of the base
        if (sameUpToRotation(odd.cells, sameGroup[0].cells)) continue;
        const key = `o${level}-${base.cells.map(cellKey).join('')}-${rots.join('')}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const options = shuffleWithAnswer([odd, ...sameGroup]);
        out.push(spatialChallenge(level, 'odd_one_out',
          'Which figure is NOT a rotation of the others?', null, options.list, options.answerIndex));
      }
    }
  }
  return out;
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffleWithAnswer(items) {
  // items[0] is the correct answer; shuffle and report its new index
  const tagged = items.map((fig, i) => ({ fig, correct: i === 0 }));
  const shuffled = shuffleArr(tagged);
  return {
    list: shuffled.map((t) => t.fig),
    answerIndex: shuffled.findIndex((t) => t.correct)
  };
}
let _spatialCounter = 0;
function spatialChallenge(level, type, instruction, prompt, options, answerIndex, showAxis = false) {
  _spatialCounter++;
  return {
    bankKey: `sr-${type}-L${level}-${_spatialCounter}`,
    category: 'spatial_reasoning',
    challengeType: type,
    level,
    rendererType: 'multiple_choice_svg',
    promptData: {
      instruction,
      grid: GRID,
      prompt: prompt ? { cells: prompt.cells, accentIdx: prompt.accentIdx } : null,
      showAxis,
      options: options.map((o) => ({ cells: o.cells, accentIdx: o.accentIdx }))
    },
    answerData: { correctAnswer: answerIndex, acceptedAnswers: [String(answerIndex)] },
    scoringConfig: {
      expectedMedianMs: SPATIAL_MEDIANS[level],
      slowCorrectFloorScore: 0.45,
      fastCorrectScore: 1.0
    },
    version: 1,
    active: true
  };
}

// ===========================================================================
// Logical Reasoning - levels 1..12, multiple_choice_text
//   L1-4 syllogisms, L5-8 "what follows" / conditional, L9-12 ordering/deduction
//   Kept language-light: short relational statements, symbolic where possible.
// ===========================================================================
const LOGIC_MEDIANS = { 1:7000,2:8000,3:9000,4:10000,5:11000,6:12000,7:13000,8:14000,9:15000,10:16000,11:18000,12:20000 };

function buildLogical() {
  const PER = 18;
  const out = [];
  const names = ['A','B','C','D','E'];
  let counter = 0;
  for (let level = 1; level <= 12; level++) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER && guard < 6000) {
      guard++;
      let q = null;

      if (level <= 4) {
        // Mix of premise STRUCTURES so the solver must actually parse the logic each
        // time, not pattern-match a single "first beats last" template. Forms:
        //  (a) forward chain  X>Y, Y>Z  => X>Z
        //  (b) converging     X>Y, Z>Y  => indeterminate between X and Z
        //  (c) reversed order Y<X, Z<Y  => X>Z (same truth, harder to read)
        //  (d) diverging      X>Y, X>Z  => indeterminate between Y and Z
        const rel = pick([['taller than','shorter than'],['older than','younger than'],
          ['heavier than','lighter than'],['faster than','slower than'],['stronger than','weaker than']]);
        const [gt, lt] = rel;
        const [a,b,c] = shuffleArr(names).slice(0,3);
        // Deterministic ratio: cycle forms so ~1/3 of items are indeterminate
        // (converging/diverging) and ~2/3 determinate (forward/reversed), holding
        // steady per level regardless of dedup skips.
        const cycle = ['forward','reversed','forward','converging','reversed','diverging'];
        const form = cycle[seen.size % cycle.length];

        if (form === 'forward') {
          q = { instruction: `${a} is ${gt} ${b}. ${b} is ${gt} ${c}. What follows?`,
            correct: `${a} is ${gt} ${c}.`,
            distractors: [`${c} is ${gt} ${a}.`, `${b} is ${gt} ${a}.`, 'Cannot be determined.'] };
        } else if (form === 'reversed') {
          // same chain expressed with the inverse relation, premises in mixed order
          q = { instruction: `${b} is ${lt} ${a}. ${c} is ${lt} ${b}. What follows?`,
            correct: `${a} is ${gt} ${c}.`,
            distractors: [`${c} is ${gt} ${a}.`, `${a} is ${lt} ${c}.`, 'Cannot be determined.'] };
        } else if (form === 'converging') {
          // X>Y and Z>Y: both beat Y, but X vs Z is unknown
          q = { instruction: `${a} is ${gt} ${b}. ${c} is ${gt} ${b}. What follows about ${a} and ${c}?`,
            correct: 'Cannot be determined.',
            distractors: [`${a} is ${gt} ${c}.`, `${c} is ${gt} ${a}.`, `${a} is ${lt} ${c}.`] };
        } else {
          // diverging: X>Y and X>Z: X beats both, but Y vs Z is unknown
          q = { instruction: `${a} is ${gt} ${b}. ${a} is ${gt} ${c}. What follows about ${b} and ${c}?`,
            correct: 'Cannot be determined.',
            distractors: [`${b} is ${gt} ${c}.`, `${c} is ${gt} ${b}.`, `${b} is ${gt} ${a}.`] };
        }
      } else if (level <= 8) {
        // conditional: If P then Q. P. => Q  (with a "cannot determine" trap variant)
        const p = pick(['it rains','the alarm rings','the light is green','the gate is open']);
        const qq = pick(['the ground is wet','people wake','cars go','animals enter']);
        if (rng() < 0.6) {
          const stmt = `If ${p}, then ${qq}. ${p[0].toUpperCase()+p.slice(1)}.`;
          q = { instruction: stmt + ' Therefore?', correct: `${qq[0].toUpperCase()+qq.slice(1)}.`,
            distractors: [`Not ${qq}.`, `${qq[0].toUpperCase()+qq.slice(1)} did not happen.`, 'Cannot be determined.'] };
        } else {
          // affirming consequent trap: If P then Q. Q. => cannot determine P
          const stmt = `If ${p}, then ${qq}. ${qq[0].toUpperCase()+qq.slice(1)}.`;
          q = { instruction: stmt + ' Therefore?', correct: 'Cannot be determined.',
            distractors: [`${p[0].toUpperCase()+p.slice(1)}.`, `Not ${p}.`, `${qq[0].toUpperCase()+qq.slice(1)} caused ${p}.`] };
        }
      } else {
        // ordering deduction: given comparative clues, who is in a position
        const people = shuffleArr(names).slice(0,4);
        // build a true ranking, ask a derived fact
        const ranking = shuffleArr(people);
        const r = (x) => ranking.indexOf(x);
        const clues = [];
        clues.push(`${ranking[0]} ranks above ${ranking[2]}.`);
        clues.push(`${ranking[1]} ranks above ${ranking[3]}.`);
        clues.push(`${ranking[0]} ranks above ${ranking[1]}.`);
        clues.push(`${ranking[2]} ranks above ${ranking[3]}.`);
        const askTop = rng() < 0.5;
        const correct = askTop ? `${ranking[0]} is highest.` : `${ranking[3]} is lowest.`;
        const wrong = shuffleArr(people).filter(p => !correct.includes(p));
        q = { instruction: shuffleArr(clues).join(' ') + (askTop?' Who is highest?':' Who is lowest?'),
          correct, distractors: [`${wrong[0]} is ${askTop?'highest':'lowest'}.`, `${wrong[1]} is ${askTop?'highest':'lowest'}.`, 'Cannot be determined.'] };
      }

      const key = q.instruction;
      if (seen.has(key)) continue;
      seen.add(key);
      counter++;
      const opts = shuffleWithAnswer([{ text: q.correct }, ...q.distractors.map(d => ({ text: d }))]);
      out.push({
        bankKey: `lr-L${level}-${counter}`,
        category: 'logical_reasoning',
        challengeType: level<=4?'syllogism':level<=8?'conditional':'ordering',
        level, rendererType: 'multiple_choice_text',
        promptData: { instruction: q.instruction, options: opts.list.map(o => o.text) },
        answerData: { correctAnswer: opts.answerIndex, acceptedAnswers: [String(opts.answerIndex)] },
        scoringConfig: { expectedMedianMs: LOGIC_MEDIANS[level], slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }

    // Wave 7: two additional families in their OWN key namespace (lrx-*) so the
    // 216 legacy keys stay untouched. 6 quantifier syllogisms + 6 conditional-
    // inference items per level; higher levels get negated and "only if" phrasings.
    const NOUNS = ['cats','dogs','birds','fish','cars','books','trees','stars','artists','doctors','singers','pilots','farmers','robots','islands','rivers'];
    const PAIRS = [['it rains','the match is canceled'],['the alarm rings','Mia wakes up'],['the key turns','the door opens'],['you have a ticket','you may enter'],['the battery is charged','the phone works'],['the bridge is open','ships pass'],['the oven is on','the kitchen is warm'],['the code compiles','the tests run']];
    let extraN = 0;
    let guard2 = 0;
    const seen2 = new Set();
    while (extraN < 12 && guard2 < 8000) {
      guard2++;
      let q = null;
      let ctype = 'syllogism';
      const fam = extraN % 12;
      if (fam < 6) {
        // quantifier syllogisms
        const [X,Y,Z] = shuffleArr(NOUNS).slice(0,3);
        const form = fam % 6;
        const flip = level >= 7; // premise order swapped at high levels
        if (form === 0) q = { instruction: `${flip ? `All ${Y} are ${Z}. All ${X} are ${Y}.` : `All ${X} are ${Y}. All ${Y} are ${Z}.`} What follows?`,
          correct: `All ${X} are ${Z}.`, distractors: [`All ${Z} are ${X}.`, `No ${X} are ${Z}.`, 'Cannot be determined.'] };
        else if (form === 1) q = { instruction: `All ${X} are ${Y}. Some ${Z} are ${X}. What follows?`,
          correct: `Some ${Z} are ${Y}.`, distractors: [`All ${Z} are ${Y}.`, `No ${Z} are ${Y}.`, 'Cannot be determined.'] };
        else if (form === 2) q = { instruction: `All ${X} are ${Y}. Some ${Y} are ${Z}. What follows about ${X} and ${Z}?`,
          correct: 'Cannot be determined.', distractors: [`Some ${X} are ${Z}.`, `All ${X} are ${Z}.`, `No ${X} are ${Z}.`] };
        else if (form === 3) q = { instruction: `${flip ? `All ${Z} are ${X}. No ${X} are ${Y}.` : `No ${X} are ${Y}. All ${Z} are ${X}.`} What follows?`,
          correct: `No ${Z} are ${Y}.`, distractors: [`Some ${Z} are ${Y}.`, `All ${Z} are ${Y}.`, 'Cannot be determined.'] };
        else if (form === 4) q = { instruction: `Some ${X} are ${Y}. Some ${Y} are ${Z}. What follows about ${X} and ${Z}?`,
          correct: 'Cannot be determined.', distractors: [`Some ${X} are ${Z}.`, `No ${X} are ${Z}.`, `All ${X} are ${Z}.`] };
        else q = { instruction: `No ${X} are ${Y}. Some ${Z} are ${X}. What follows?`,
          correct: `Some ${Z} are not ${Y}.`, distractors: [`All ${Z} are ${Y}.`, `Some ${Z} are ${Y}.`, 'Cannot be determined.'] };
      } else {
        // conditional inference
        ctype = 'conditional';
        const [P,Q] = pick(PAIRS);
        const form = fam % 6;
        const onlyIf = level >= 9 && form % 2 === 0;
        const rule = onlyIf ? `${P.charAt(0).toUpperCase()+P.slice(1)} only if ${Q}.` : `If ${P}, then ${Q}.`;
        if (form === 0) q = { instruction: `${rule} It is not the case that ${Q}. What follows?`,
          correct: `It is not the case that ${P}.`, distractors: [`${P.charAt(0).toUpperCase()+P.slice(1)}.`, `${Q.charAt(0).toUpperCase()+Q.slice(1)}.`, 'Cannot be determined.'] };
        else if (form === 1) q = { instruction: `${rule} ${Q.charAt(0).toUpperCase()+Q.slice(1)}. What follows about whether ${P}?`,
          correct: 'Cannot be determined.', distractors: [`${P.charAt(0).toUpperCase()+P.slice(1)}.`, `It is not the case that ${P}.`, `${P.charAt(0).toUpperCase()+P.slice(1)} only sometimes.`] };
        else if (form === 2) q = { instruction: `${rule} It is not the case that ${P}. What follows about whether ${Q}?`,
          correct: 'Cannot be determined.', distractors: [`It is not the case that ${Q}.`, `${Q.charAt(0).toUpperCase()+Q.slice(1)}.`, `${Q.charAt(0).toUpperCase()+Q.slice(1)} is impossible.`] };
        else if (form === 3) q = { instruction: `${rule} ${P.charAt(0).toUpperCase()+P.slice(1)}. What follows?`,
          correct: `${Q.charAt(0).toUpperCase()+Q.slice(1)}.`, distractors: [`It is not the case that ${Q}.`, `It is not the case that ${P}.`, 'Cannot be determined.'] };
        else if (form === 4) q = { instruction: `${rule} Which statement says the same thing?`,
          correct: `If it is not the case that ${Q}, then it is not the case that ${P}.`,
          distractors: [`If it is not the case that ${P}, then it is not the case that ${Q}.`, `If ${Q}, then ${P}.`, `${Q.charAt(0).toUpperCase()+Q.slice(1)} whenever it is not the case that ${P}.`] };
        else q = { instruction: `${rule} Exactly one of these follows from also knowing that ${P}. Which?`,
          correct: `${Q.charAt(0).toUpperCase()+Q.slice(1)}.`, distractors: [`It is not the case that ${Q}.`, `${P.charAt(0).toUpperCase()+P.slice(1)} is false.`, 'Cannot be determined.'] };
      }
      const key2 = q.instruction;
      if (seen2.has(key2)) continue;
      seen2.add(key2);
      extraN++;
      const opts2 = shuffleWithAnswer([{ text: q.correct }, ...q.distractors.map(d => ({ text: d }))]);
      out.push({
        bankKey: `lrx-L${level}-${extraN}`,
        category: 'logical_reasoning',
        challengeType: ctype,
        level, rendererType: 'multiple_choice_text',
        promptData: { instruction: q.instruction, options: opts2.list.map(o => o.text) },
        answerData: { correctAnswer: opts2.answerIndex, acceptedAnswers: [String(opts2.answerIndex)] },
        scoringConfig: { expectedMedianMs: LOGIC_MEDIANS[level], slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }
  }
  return out;
}

// ===========================================================================
// Verbal Reasoning - levels 1..10, multiple_choice_text
//   Per-language decks (English deck here). Synonyms, antonyms, analogies.
//   Tagged with language so pools never mix languages.
// ===========================================================================
const VERBAL_MEDIANS = { 1:5000,2:5500,3:6500,4:7500,5:8500,6:9500,7:11000,8:12000,9:14000,10:16000 };

// compact English item bank: [type, prompt, correct, [distractors]]
const VERBAL_EN = [
  // synonyms (easy->hard)
  [1,'syn','Synonym of BIG','large',['tiny','quiet','round']],
  [1,'syn','Synonym of FAST','quick',['slow','heavy','calm']],
  [2,'syn','Synonym of HAPPY','glad',['angry','tired','empty']],
  [2,'syn','Synonym of BEGIN','start',['finish','close','hide']],
  [3,'syn','Synonym of ANCIENT','old',['modern','bright','loud']],
  [3,'syn','Synonym of RAPID','swift',['gradual','dull','firm']],
  [4,'syn','Synonym of CANDID','frank',['secret','rough','vague']],
  [5,'syn','Synonym of LUCID','clear',['murky','tense','blunt']],
  [6,'syn','Synonym of TERSE','concise',['wordy','gentle','loose']],
  [7,'syn','Synonym of ZEALOUS','eager',['idle','aloof','meek']],
  [8,'syn','Synonym of LACONIC','brief',['verbose','genial','frantic']],
  [9,'syn','Synonym of PERFIDIOUS','treacherous',['loyal','timid','earnest']],
  [10,'syn','Synonym of PELLUCID','transparent',['opaque','austere','viscous']],
  // synonyms - second pass (more depth per level)
  [1,'syn','Synonym of SMALL','little',['huge','wide','heavy']],
  [1,'syn','Synonym of GLAD','happy',['sad','sour','dull']],
  [2,'syn','Synonym of BRAVE','bold',['shy','weak','calm']],
  [2,'syn','Synonym of QUIET','silent',['loud','busy','sharp']],
  [3,'syn','Synonym of HUGE','enormous',['minor','narrow','plain']],
  [3,'syn','Synonym of WEALTHY','rich',['poor','plain','spare']],
  [4,'syn','Synonym of STUBBORN','obstinate',['flexible','gentle','idle']],
  [5,'syn','Synonym of ABUNDANT','plentiful',['sparse','meager','rare']],
  [6,'syn','Synonym of DILIGENT','industrious',['lazy','careless','idle']],
  [7,'syn','Synonym of OBSCURE','vague',['obvious','vivid','plain']],
  [8,'syn','Synonym of PRUDENT','cautious',['reckless','rash','hasty']],
  [9,'syn','Synonym of TACITURN','reserved',['talkative','open','loud']],
  [10,'syn','Synonym of OBDURATE','unyielding',['pliant','docile','meek']],
  // antonyms - second pass
  [1,'ant','Antonym of UP','down',['high','top','over']],
  [1,'ant','Antonym of OPEN','closed',['ajar','wide','clear']],
  [2,'ant','Antonym of FAST','slow',['quick','rapid','swift']],
  [2,'ant','Antonym of LIGHT','dark',['bright','pale','clear']],
  [3,'ant','Antonym of ACCEPT','reject',['take','admit','allow']],
  [4,'ant','Antonym of HUMBLE','arrogant',['modest','meek','plain']],
  [5,'ant','Antonym of RIGID','flexible',['stiff','firm','hard']],
  [6,'ant','Antonym of VICTORY','defeat',['win','triumph','glory']],
  [7,'ant','Antonym of GENUINE','fake',['real','true','honest']],
  [8,'ant','Antonym of LENIENT','strict',['gentle','mild','soft']],
  [9,'ant','Antonym of CANDID','evasive',['frank','open','honest']],
  [10,'ant','Antonym of PROLIFIC','barren',['fertile','fruitful','rich']],
  // analogies - second pass
  [2,'ana','BIRD : NEST :: BEE : ?','hive',['flower','honey','wing']],
  [3,'ana','FISH : SCHOOL :: WOLF : ?','pack',['den','howl','fur']],
  [4,'ana','TEACHER : SCHOOL :: JUDGE : ?','court',['law','gavel','robe']],
  [5,'ana','LION : ROAR :: SNAKE : ?','hiss',['slither','venom','scale']],
  [6,'ana','PAINTER : BRUSH :: SCULPTOR : ?','chisel',['clay','stone','statue']],
  [7,'ana','SECONDS : MINUTE :: MINUTES : ?','hour',['day','clock','time']],
  [8,'ana','LIBRARY : BOOKS :: ARMORY : ?','weapons',['soldiers','war','armor']],
  [9,'ana','THIRSTY : DRINK :: TIRED : ?','sleep',['rest','yawn','weary']],
  // antonyms
  [1,'ant','Antonym of HOT','cold',['warm','dry','red']],
  [2,'ant','Antonym of EARLY','late',['soon','quick','near']],
  [3,'ant','Antonym of EXPAND','contract',['stretch','inflate','widen']],
  [4,'ant','Antonym of GENEROUS','stingy',['kind','wealthy','open']],
  [5,'ant','Antonym of TRANSPARENT','opaque',['clear','fragile','glassy']],
  [6,'ant','Antonym of PRAISE','criticize',['admire','reward','honor']],
  [7,'ant','Antonym of ABUNDANT','scarce',['ample','plenty','dense']],
  [8,'ant','Antonym of FRUGAL','wasteful',['thrifty','careful','sparing']],
  [9,'ant','Antonym of EPHEMERAL','permanent',['fleeting','brief','transient']],
  [10,'ant','Antonym of GARRULOUS','taciturn',['talkative','chatty','verbose']],
  // analogies
  [2,'ana','HAND : GLOVE :: FOOT : ?','sock',['shoe','toe','sole']],
  [3,'ana','PUPPY : DOG :: KITTEN : ?','cat',['mouse','cub','foal']],
  [4,'ana','PEN : WRITE :: KNIFE : ?','cut',['sharp','metal','blade']],
  [5,'ana','HOT : COLD :: UP : ?','down',['high','warm','over']],
  [6,'ana','BIRD : FLOCK :: WOLF : ?','pack',['herd','pride','school']],
  [7,'ana','PAINTER : BRUSH :: SCULPTOR : ?','chisel',['canvas','clay','easel']],
  [8,'ana','LIBRARY : BOOKS :: ARMORY : ?','weapons',['soldiers','keys','walls']],
  [9,'ana','CACOPHONY : SOUND :: GLARE : ?','light',['color','heat','noise']],
  [10,'ana','EPILOGUE : BOOK :: CODA : ?','symphony',['poem','play','dance']],
  // --- expansion: more synonyms ---
  [1,'syn','Synonym of SMALL','little',['huge','wide','tall']],
  [1,'syn','Synonym of EASY','simple',['hard','steep','tense']],
  [2,'syn','Synonym of BRAVE','bold',['timid','weak','calm']],
  [2,'syn','Synonym of CALM','serene',['anxious','loud','harsh']],
  [3,'syn','Synonym of HONEST','truthful',['sly','vague','smug']],
  [3,'syn','Synonym of STRANGE','odd',['plain','usual','clear']],
  [4,'syn','Synonym of ABUNDANT','plentiful',['sparse','scant','rare']],
  [4,'syn','Synonym of PRUDENT','careful',['rash','bold','idle']],
  [5,'syn','Synonym of OBSCURE','unclear',['obvious','plain','vivid']],
  [5,'syn','Synonym of ROBUST','sturdy',['frail','sleek','hollow']],
  [6,'syn','Synonym of AMIABLE','friendly',['hostile','aloof','curt']],
  [6,'syn','Synonym of DILIGENT','industrious',['lazy','idle','sloppy']],
  [7,'syn','Synonym of CRYPTIC','mysterious',['obvious','plain','frank']],
  [7,'syn','Synonym of TENACIOUS','persistent',['fickle','weak','idle']],
  [8,'syn','Synonym of ESOTERIC','arcane',['common','plain','public']],
  [8,'syn','Synonym of MITIGATE','lessen',['worsen','inflame','expand']],
  [9,'syn','Synonym of OBDURATE','stubborn',['yielding','docile','meek']],
  [9,'syn','Synonym of EPHEMERAL','transient',['eternal','lasting','fixed']],
  [10,'syn','Synonym of INELUCTABLE','inevitable',['avoidable','dubious','optional']],
  [10,'syn','Synonym of PERSPICACIOUS','astute',['obtuse','dull','naive']],
  // --- expansion: more antonyms ---
  [1,'ant','Antonym of OPEN','closed',['ajar','wide','clear']],
  [1,'ant','Antonym of LIGHT','dark',['bright','pale','soft']],
  [2,'ant','Antonym of ARRIVE','depart',['reach','enter','land']],
  [2,'ant','Antonym of ACCEPT','reject',['take','admit','allow']],
  [3,'ant','Antonym of INCREASE','decrease',['expand','grow','rise']],
  [3,'ant','Antonym of VICTORY','defeat',['triumph','win','glory']],
  [4,'ant','Antonym of HUMBLE','arrogant',['modest','meek','plain']],
  [4,'ant','Antonym of RIGID','flexible',['stiff','firm','hard']],
  [5,'ant','Antonym of CONCEAL','reveal',['hide','mask','cover']],
  [5,'ant','Antonym of SCATTER','gather',['spread','strew','toss']],
  [6,'ant','Antonym of LENIENT','strict',['mild','soft','gentle']],
  [6,'ant','Antonym of FERTILE','barren',['rich','lush','ripe']],
  [7,'ant','Antonym of CANDID','evasive',['frank','open','blunt']],
  [7,'ant','Antonym of VOLATILE','stable',['erratic','fickle','tense']],
  [8,'ant','Antonym of LUCID','murky',['clear','plain','vivid']],
  [8,'ant','Antonym of AUGMENT','diminish',['expand','boost','swell']],
  [9,'ant','Antonym of GREGARIOUS','solitary',['social','outgoing','affable']],
  [9,'ant','Antonym of OPAQUE','transparent',['cloudy','dense','murky']],
  [10,'ant','Antonym of MAGNANIMOUS','petty',['generous','noble','lavish']],
  [10,'ant','Antonym of NASCENT','mature',['emerging','budding','new']],
  // --- expansion: more analogies ---
  [2,'ana','FISH : SCHOOL :: LION : ?','pride',['pack','herd','flock']],
  [3,'ana','DAY : NIGHT :: SUMMER : ?','winter',['spring','autumn','noon']],
  [4,'ana','DOCTOR : PATIENT :: TEACHER : ?','student',['school','book','class']],
  [5,'ana','WATER : THIRST :: FOOD : ?','hunger',['plate','meal','taste']],
  [6,'ana','CLOCK : TIME :: THERMOMETER : ?','temperature',['heat','weather','mercury']],
  [7,'ana','ARCHITECT : BLUEPRINT :: COMPOSER : ?','score',['piano','melody','stage']],
  [8,'ana','DROUGHT : WATER :: FAMINE : ?','food',['hunger','land','crops']],
  [9,'ana','NOVICE : EXPERT :: SEED : ?','tree',['root','soil','flower']],
  [10,'ana','OVERTURE : OPERA :: PREAMBLE : ?','constitution',['speech','essay','chapter']]
];

function buildVerbal() {
  const out = [];
  let counter = 0;
  const seenPrompts = new Set();
  for (const [level, type, prompt, correct, distractors] of VERBAL_EN) {
    if (seenPrompts.has(prompt)) continue; // skip duplicate questions
    seenPrompts.add(prompt);
    counter++;
    const opts = shuffleWithAnswer([{ text: correct }, ...distractors.map(d => ({ text: d }))]);
    out.push({
      bankKey: `vr-en-L${level}-${counter}`,
      category: 'verbal_reasoning',
      challengeType: type === 'syn' ? 'synonym' : type === 'ant' ? 'antonym' : 'analogy',
      level, rendererType: 'multiple_choice_text', language: 'en',
      promptData: { instruction: prompt, options: opts.list.map(o => o.text), language: 'en' },
      answerData: { correctAnswer: opts.answerIndex, acceptedAnswers: [String(opts.answerIndex)] },
      scoringConfig: { expectedMedianMs: VERBAL_MEDIANS[level] ?? 9000, slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
      version: 1, active: true
    });
  }
  return out;
}

// ===========================================================================
// Processing Speed - levels 1..10, two_choice (same/different, comparisons)
//   Simple judgments meant to be fast; difficulty via subtlety + field size.
// ===========================================================================
const PSPEED_MEDIANS = { 1:1800,2:2000,3:2300,4:2600,5:3000,6:3400,7:3800,8:4300,9:4800,10:5500 };

function buildProcessingSpeed() {
  const PER = 36;
  const out = [];
  let counter = 0;
  for (let level = 1; level <= 10; level++) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER && guard < 6000) {
      guard++;
      let q = null;
      if (level <= 3) {
        // same/different on two short strings
        const len = 3 + level;
        const mk = () => Array.from({length:len},()=>pick('ABXYK7394'.split(''))).join('');
        const a = mk();
        const same = rng() < 0.5;
        let b = a;
        if (!same) { const arr=a.split(''); const i=ri(0,len-1); let c; do{c=pick('ABXYK7394'.split(''));}while(c===arr[i]); arr[i]=c; b=arr.join(''); }
        q = { instruction: 'Are these identical?', stimulus: `${a}   ${b}`, correct: same?'Same':'Different', options: ['Same','Different'] };
      } else if (level <= 6) {
        // greater number
        const mag = [99,999,9999][level-4];
        let x = ri(10, mag), y;
        do { y = ri(10, mag); } while (y === x);
        q = { instruction: 'Which is larger?', stimulus: `${x}     ${y}`, correct: x>y?'Left':'Right', options: ['Left','Right'] };
      } else {
        // parity / rule judgment, fast
        const n = ri(10, 9999);
        const rule = pick([['even','Yes','No',n%2===0],['odd','Yes','No',n%2===1],['> 5000','Yes','No',n>5000]]);
        q = { instruction: `Is ${n} ${rule[0]}?`, stimulus: '', correct: rule[3]?'Yes':'No', options: ['Yes','No'] };
      }
      const key = q.instruction+'|'+q.stimulus;
      if (seen.has(key)) continue;
      seen.add(key);
      counter++;
      const ansIdx = q.options.indexOf(q.correct);
      out.push({
        bankKey: `ps-L${level}-${counter}`,
        category: 'processing_speed',
        challengeType: level<=3?'same_different':level<=6?'comparison':'rule_judgment',
        level, rendererType: 'two_choice',
        promptData: { instruction: q.instruction, stimulus: q.stimulus, options: q.options },
        answerData: { correctAnswer: ansIdx, acceptedAnswers: [String(ansIdx)] },
        scoringConfig: { expectedMedianMs: PSPEED_MEDIANS[level], slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }
  }
  return out;
}

// ===========================================================================
// Estimation - levels 1..10, numeric_text_input, scored on |percent error|
//   ranked against the population's error (set scoringMode = 'error_rank').
//   We DON'T grade tiers of miss; the closer-than-others axis lives server-side.
// ===========================================================================
const ESTIMATE_MEDIANS = { 1:5000,2:5500,3:6500,4:7000,5:8000,6:9000,7:10000,8:11000,9:12000,10:14000 };

function buildEstimation() {
  const PER = 32;
  const out = [];
  let counter = 0;
  for (let level = 1; level <= 10; level++) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER && guard < 6000) {
      guard++;
      let q = null;
      if (level <= 3) {
        // arithmetic estimation (no exact expected; tolerant)
        const a = ri(11, 99)*[1,1,10][level-1], b = ri(11, 99)*[1,1,10][level-1];
        q = { instruction: `Estimate: ${a} \u00d7 ${b}`, answer: a*b };
      } else if (level <= 6) {
        // count estimation: how many dots (we give the count; UI renders a field)
        const n = ri(20, 60*(level-3));
        q = { instruction: `About how many items? (${'\u25cf'.repeat(Math.min(n,40))}${n>40?'\u2026':''})`, answer: n };
      } else {
        // fermi-ish magnitude
        const items = [
          ['Seconds in a day', 86400],
          ['Approx words in a 300-page book', 90000],
          ['Heartbeats in one hour (~70 bpm)', 4200],
          ['Meters in 5 kilometers', 5000],
          ['Minutes in a week', 10080],
          ['Grams in 2.5 kilograms', 2500],
          ['Hours in 6 weeks', 1008],
          ['Days in 7 years (approx)', 2557],
          ['Seconds in an hour', 3600],
          ['Minutes in a full day', 1440],
          ['Hours in a 30-day month', 720],
          ['Centimeters in 4 meters', 400],
          ['Millimeters in 2 meters', 2000],
          ['Pages in 8 books of ~250 pages', 2000],
          ['Heartbeats in a day (~70 bpm)', 100800],
          ['Breaths in an hour (~15/min)', 900],
          ['Seconds in a week', 604800],
          ['Grams in 3 kilograms', 3000],
          ['Days in a decade (approx)', 3652],
          ['Weeks in 3 years', 156],
          ['Liters in 5 cubic meters', 5000],
          ['Steps to walk 3 km (~0.75m each)', 4000],
          ['Letters in a 1000-word essay (~5 each)', 5000],
          ['Seconds in a 90-minute film', 5400],
          ['Hours in a year (approx)', 8760],
          ['Square meters in a 20m by 30m field', 600],
          ['Sheets in 4 reams of paper (500 each)', 2000],
          ['Tiles to cover 12 m2 with 30cm tiles', 133],
          ['Minutes in 100 hours', 6000],
          ['Days in 1 million minutes (approx)', 694]
        ];
        const it = pick(items);
        q = { instruction: `Estimate: ${it[0]}`, answer: it[1] };
      }
      const key = q.instruction;
      if (seen.has(key)) continue;
      seen.add(key);
      counter++;
      out.push({
        bankKey: `es-L${level}-${counter}`,
        category: 'estimation',
        challengeType: level<=3?'arith_estimate':level<=6?'count_estimate':'magnitude_estimate',
        level, rendererType: 'numeric_text_input',
        promptData: { instruction: q.instruction },
        // trueValue drives error scoring; no acceptedAnswers (never "exactly right/wrong")
        answerData: { trueValue: q.answer },
        scoringConfig: { expectedMedianMs: ESTIMATE_MEDIANS[level], scoringMode: 'error_rank', slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }
  }
  return out;
}

const arithmetic = buildArithmetic();
const sequences = buildSequences();
const workingMemory = buildWorkingMemory();
const attentionControl = buildAttentionControl();
const spatial = buildSpatial();
const logical = buildLogical();
// ===========================================================================
// Inhibition (cognitive control) - levels 1..10, two_choice
//   Stroop-style: name the INK COLOR, not the word. Measures suppression of a
//   prepotent reading response. Color words; difficulty via congruency rate +
//   tighter timing. Color names kept to 4 high-contrast options per item.
// ===========================================================================
const INHIBIT_MEDIANS = { 1:1800,2:2000,3:2200,4:2500,5:2800,6:3100,7:3500,8:3900,9:4400,10:5000 };
// Stroop inks must be PROTOTYPICAL, not tasteful: a muted terracotta "red" makes
// hesitation measure color-naming ambiguity instead of inhibition (tester-caught).
// Saturated categorical hues, tuned for legibility on the dark background.
const STROOP_COLORS = [
  ['RED', '#FF3B30'],
  ['BLUE', '#3D7BFF'],
  ['GREEN', '#2FC94E'],
  ['YELLOW', '#FFD21E']
];

function buildInhibition() {
  const PER = 36;
  const out = [];
  let counter = 0;
  for (let level = 1; level <= 10; level++) {
    const seen = new Set();
    let guard = 0;
    // higher levels => more incongruent (harder) trials
    const incongruentRate = 0.3 + (level / 10) * 0.6;
    while (seen.size < PER && guard < 6000) {
      guard++;
      const wordIdx = ri(0, 3);
      const incongruent = rng() < incongruentRate;
      let inkIdx = wordIdx;
      if (incongruent) { do { inkIdx = ri(0, 3); } while (inkIdx === wordIdx); }
      const word = STROOP_COLORS[wordIdx][0];
      const inkName = STROOP_COLORS[inkIdx][0];
      const inkHex = STROOP_COLORS[inkIdx][1];
      // two_choice between the correct ink color and a plausible distractor (the word's color)
      const distractorIdx = incongruent ? wordIdx : (inkIdx + 1) % 4;
      const optionPair = shuffleArr([inkIdx, distractorIdx]);
      const key = `${word}-${inkName}-${optionPair.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counter++;
      const options = optionPair.map((i) => STROOP_COLORS[i][0]);
      const correctIdx = options.indexOf(inkName);
      out.push({
        bankKey: `in-L${level}-${counter}`,
        category: 'inhibition',
        challengeType: incongruent ? 'incongruent' : 'congruent',
        level, rendererType: 'two_choice',
        promptData: {
          instruction: 'Pick the INK COLOR (ignore the word)',
          stimulus: word,
          stimulusColor: inkHex,
          options
        },
        answerData: { correctAnswer: correctIdx, acceptedAnswers: [String(correctIdx)] },
        scoringConfig: { expectedMedianMs: INHIBIT_MEDIANS[level], slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }
  }
  return out;
}

// ===========================================================================
// Task switching (flexibility) - levels 1..10, two_choice
//   A cue selects the rule: judge COLOR or judge SHAPE of the same stimulus.
//   Switching the rule trial-to-trial carries a cost; higher levels switch more.
// ===========================================================================
const SWITCH_MEDIANS = { 1:2500,2:2800,3:3100,4:3500,5:3900,6:4300,7:4800,8:5300,9:5900,10:6500 };

function buildSwitching() {
  const PER = 32;
  const out = [];
  const shapes = ['circle', 'square', 'triangle', 'diamond', 'star'];
  const colors = ['red', 'blue', 'green', 'yellow'];
  let counter = 0;
  for (let level = 1; level <= 10; level++) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < PER && guard < 6000) {
      guard++;
      const rule = rng() < 0.5 ? 'color' : 'shape'; // which dimension to judge
      const shape = pick(shapes);
      const color = pick(colors);
      const ruleLabel = rule === 'color' ? 'COLOR' : 'SHAPE';
      // two-choice: correct value + a plausible alternate from the same dimension
      const correct = rule === 'color' ? color : shape;
      let alt;
      if (rule === 'color') { do { alt = pick(colors); } while (alt === color); }
      else { do { alt = pick(shapes); } while (alt === shape); }
      const options = shuffleArr([correct, alt]);
      const key = `${rule}-${shape}-${color}-${options.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counter++;
      const correctIdx = options.indexOf(correct);
      out.push({
        bankKey: `sw-L${level}-${counter}`,
        category: 'task_switching',
        challengeType: rule === 'color' ? 'judge_color' : 'judge_shape',
        level, rendererType: 'two_choice',
        promptData: {
          instruction: `Rule: judge the ${ruleLabel}`,
          stimulus: `${color} ${shape}`,
          options
        },
        answerData: { correctAnswer: correctIdx, acceptedAnswers: [String(correctIdx)] },
        scoringConfig: { expectedMedianMs: SWITCH_MEDIANS[level], slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }
  }
  return out;
}

// ===========================================================================
// Retrieval fluency - levels 1..8, fluency_list renderer (generate-many).
//   "Name as many X as you can." Scored by count of VALID, non-duplicate answers
//   against a curated accept-list. Touches the Glr retrieval half. Accept-lists
//   are finite for now (note: swap a real dictionary/category API later).
// ===========================================================================
const FLUENCY_TIME_MS = 30000; // 30s to generate

// ---------------------------------------------------------------------------
// Wave 0 (bank expansion): retrieval prompts now derive from the wordlist FILES
// in challenge-bank/wordlists/ - single source of truth, ends the inline/file
// split. Legacy 24 prompts keep their exact positional bankKeys (stats survive);
// their acceptLists are refreshed from files where a richer file exists. Every
// remaining wordlist gains a prompt with a content-stable key (rf-<listKey>).
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync } from 'node:fs';
const WL_DIR = 'challenge-bank/wordlists';
function loadList(key) {
  try {
    return readFileSync(`${WL_DIR}/${key}.en.txt`, 'utf8')
      .toLowerCase().split(/\r?\n/).map(s => s.split('|')[0].trim()).filter(Boolean);
  } catch { return null; }
}
const FILE_KEYS = readdirSync(WL_DIR).filter(f => f.endsWith('.en.txt')).map(f => f.replace('.en.txt',''));
const RF_LABELS = {
  astro: 'ASTRONOMY TERMS', body_parts: 'BODY PARTS', transport_words: 'MEANS OF TRANSPORT',
  farm: 'FARM ANIMALS', household: 'HOUSEHOLD OBJECTS', gems: 'GEMSTONES', jobs2: null,
  units: 'UNITS OF MEASUREMENT', reptiles_amphibians: 'REPTILES AND AMPHIBIANS', nuts_seeds: 'NUTS AND SEEDS', wonders_landmarks: 'FAMOUS LANDMARKS', world_cities: 'MAJOR WORLD CITIES', ice_cream_flavors: 'ICE CREAM FLAVORS', grains_legumes: 'GRAINS AND LEGUMES', file_formats: 'FILE FORMATS', shakespeare_plays: 'SHAKESPEARE PLAYS', chess_openings: 'CHESS OPENINGS', seas_oceans: 'SEAS AND OCEANS', lab_equipment: 'LABORATORY EQUIPMENT', garden_tools: 'GARDEN TOOLS', sewing_items: 'SEWING ITEMS', medical_specialties: 'MEDICAL SPECIALTIES', kitchen: 'KITCHEN ITEMS', instruments: 'MUSICAL INSTRUMENTS'
};
const RF_LEVEL = {
  animals:1, colors:1, fruits:1, food:1, body_parts:1,
  vegetables:2, drinks:2, clothing:2, farm:2, countries:2,
  kitchen:3, furniture:3, household:3, sports:3, weather:3,
  professions:4, tools:4, emotions:4, games:4, instruments:4,
  trees:5, flowers:5, birds:5, fish:5, shapes:5,
  languages:6, rivers:6, metals:6, units:6, transport_words:6, vehicles:6,
  composers:7, philosophers:7, constellations:7, herbs:7, gems:7,
  elements:8, rocks:8, astro:8,
  school_objects:1,
  toys:1,
  breakfast_foods:2,
  desserts:2,
  bathroom_items:2,
  insects:3,
  sea_creatures:3,
  appliances:3,
  hobbies:3,
  tabletop_games:4,
  fabrics:5,
  winter_sports:5,
  spices:5,
  reptiles_amphibians:5,
  capital_cities:6,
  currencies:6,
  programming_languages:6,
  famous_scientists:7,
  painters:7,
  mythological_figures:7,
  mountain_ranges:7,
  ancient_civilizations:7,
  philosophical_concepts:8,
  mathematical_terms:8,
  logical_fallacies:8,
  condiments:2,
  zodiac_signs:2,
  coffee_drinks:3,
  nuts_seeds:3,
  headwear:3,
  mythical_creatures:4,
  computer_parts:4,
  music_genres:4,
  natural_disasters:4,
  landforms:4,
  watercraft:4,
  cooking_methods:4,
  world_cities:5,
  wonders_landmarks:5,
  cheeses:5,
  pasta_types:5,
  dance_styles:5,
  islands:6,
  inventors:6,
  greek_letters:6,
  bones:7,
  explorers:7,
  physics_terms:8,
  art_movements:8,
  roman_emperors:8,
  party_items:1,
  baby_animals:1,
  beach_items:1,
  sandwich_fillings:2,
  ice_cream_flavors:2,
  pizza_toppings:2,
  camping_gear:3,
  gym_exercises:3,
  grains_legumes:3,
  martial_arts:4,
  breads:4,
  dinosaurs:4,
  literary_genres:4,
  sushi_items:5,
  teas:5,
  file_formats:5,
  clouds:6,
  grammar_terms:6,
  shakespeare_plays:7,
  poets:7,
  data_structures:7,
  economics_terms:7,
  chess_openings:8,
  rhetorical_devices:8,
  psychology_terms:8,
  planets:1,
  holidays:2,
  footwear:2,
  garden_tools:3,
  jewelry:3,
  sewing_items:4,
  seas_oceans:5,
  lab_equipment:6,
  deserts:6,
  lakes:6,
  volcanoes:7,
  medical_specialties:7,
  moons:8,
  operas:8,
  phobias:8
};


const RETRIEVAL_PROMPTS = [
  [1, 'Name as many ANIMALS as you can', 'animals'],
  [1, 'Name as many COLORS as you can', 'colors'],
  [2, 'Name as many FRUITS as you can', 'fruits'],
  [2, 'Name as many COUNTRIES as you can', 'countries'],
  [3, 'Name as many BODY PARTS as you can', 'body_parts'],
  [3, 'Name as many KITCHEN ITEMS as you can', 'kitchen'],
  [4, 'Name as many MUSICAL INSTRUMENTS as you can', 'instruments'],
  [4, 'Name as many SPORTS as you can', 'sports'],
  [5, 'Name as many METALS as you can', 'metals'],
  [5, 'Name as many PROFESSIONS as you can', 'professions'],
  [6, 'Name as many TREES as you can', 'trees'],
  [6, 'Name as many VEGETABLES as you can', 'vegetables'],
  [7, 'Name as many BIRDS as you can', 'birds'],
  [7, 'Name as many CHEMICAL ELEMENTS as you can', 'elements'],
  [8, 'Name as many PLANETS or MOONS as you can', 'astro'],
  [8, 'Name as many GEMSTONES as you can', 'gems'],
  // second pass - more categories per level so prompts vary session to session
  [1, 'Name as many FARM ANIMALS as you can', 'farm'],
  [2, 'Name as many DRINKS as you can', 'drinks'],
  [3, 'Name as many ITEMS OF CLOTHING as you can', 'clothing'],
  [4, 'Name as many BOARD or CARD GAMES as you can', 'games'],
  [5, 'Name as many SHAPES as you can', 'shapes'],
  [6, 'Name as many FLOWERS as you can', 'flowers'],
  [7, 'Name as many LANGUAGES as you can', 'languages'],
  [8, 'Name as many UNITS OF MEASUREMENT as you can', 'units']
];

const RETRIEVAL_LISTS = {
  animals: ['dog','cat','horse','cow','sheep','goat','pig','lion','tiger','bear','wolf','fox','deer','rabbit','mouse','rat','elephant','giraffe','zebra','monkey','gorilla','kangaroo','koala','panda','leopard','cheetah','hyena','otter','beaver','squirrel','hedgehog','bat','whale','dolphin','seal','walrus','camel','donkey','mule','buffalo','bison','moose','elk','antelope','rhino','hippo','crocodile','alligator','snake','lizard','frog','toad','turtle','tortoise','shark','octopus'],
  colors: ['red','blue','green','yellow','orange','purple','pink','brown','black','white','gray','grey','violet','indigo','cyan','magenta','turquoise','teal','maroon','navy','beige','gold','silver','crimson','scarlet','amber','lime','olive','coral','salmon'],
  fruits: ['apple','banana','orange','grape','pear','peach','plum','cherry','strawberry','blueberry','raspberry','blackberry','mango','pineapple','watermelon','melon','kiwi','lemon','lime','grapefruit','apricot','fig','date','pomegranate','papaya','guava','lychee','coconut','avocado','cranberry','currant','nectarine'],
  countries: ['france','germany','spain','italy','croatia','serbia','japan','china','india','brazil','canada','mexico','egypt','kenya','nigeria','russia','poland','sweden','norway','finland','denmark','portugal','greece','turkey','iran','iraq','peru','chile','argentina','austria','hungary','ireland','scotland','wales','england','australia','indonesia','thailand','vietnam','korea'],
  body_parts: ['head','neck','shoulder','arm','elbow','wrist','hand','finger','thumb','chest','back','stomach','hip','leg','knee','ankle','foot','toe','eye','ear','nose','mouth','lip','tongue','tooth','cheek','chin','forehead','brain','heart','lung','liver','kidney','spine','rib','skull'],
  kitchen: ['knife','fork','spoon','plate','bowl','cup','mug','glass','pot','pan','kettle','toaster','oven','stove','fridge','microwave','blender','whisk','spatula','ladle','colander','grater','peeler','cutting board','sieve','tray','jug','teapot'],
  instruments: ['piano','guitar','violin','cello','drum','flute','clarinet','trumpet','trombone','saxophone','harp','accordion','banjo','mandolin','oboe','bassoon','tuba','harmonica','xylophone','organ','viola','ukulele','bagpipes','tambourine'],
  sports: ['football','soccer','basketball','baseball','tennis','golf','hockey','cricket','rugby','volleyball','swimming','running','cycling','boxing','wrestling','skiing','snowboarding','surfing','skating','rowing','sailing','archery','fencing','judo','karate','badminton','squash','handball','climbing','gymnastics'],
  metals: ['iron','gold','silver','copper','aluminum','aluminium','zinc','lead','tin','nickel','platinum','titanium','steel','bronze','brass','mercury','tungsten','cobalt','chromium','magnesium','sodium','potassium','calcium','uranium','manganese'],
  professions: ['doctor','nurse','teacher','lawyer','engineer','plumber','electrician','carpenter','chef','baker','farmer','pilot','driver','mechanic','painter','writer','journalist','scientist','accountant','architect','dentist','surgeon','soldier','police','firefighter','programmer','designer','musician','actor','tailor'],
  trees: ['oak','pine','maple','birch','willow','elm','ash','beech','cedar','spruce','fir','cypress','redwood','sycamore','chestnut','walnut','poplar','aspen','linden','hazel','olive','palm','baobab','mahogany','teak','eucalyptus','magnolia','cherry','apple','pear'],
  vegetables: ['carrot','potato','tomato','onion','garlic','pepper','cucumber','lettuce','cabbage','broccoli','cauliflower','spinach','celery','pea','bean','corn','pumpkin','squash','zucchini','eggplant','aubergine','radish','beet','turnip','leek','asparagus','artichoke','kale','parsnip'],
  birds: ['eagle','hawk','falcon','owl','sparrow','robin','crow','raven','pigeon','dove','seagull','duck','goose','swan','chicken','rooster','turkey','peacock','parrot','penguin','ostrich','flamingo','heron','stork','crane','woodpecker','kingfisher','swallow','finch','canary','magpie','pelican'],
  elements: ['hydrogen','helium','lithium','carbon','nitrogen','oxygen','fluorine','neon','sodium','magnesium','aluminum','silicon','phosphorus','sulfur','chlorine','argon','potassium','calcium','iron','copper','zinc','silver','gold','mercury','lead','uranium','tin','nickel','cobalt','helium'],
  astro: ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','luna','titan','europa','ganymede','callisto','io','phobos','deimos','triton','enceladus','sun','ceres'],
  gems: ['diamond','ruby','emerald','sapphire','opal','topaz','amethyst','garnet','jade','pearl','turquoise','aquamarine','peridot','citrine','onyx','agate','quartz','jasper','tanzanite','zircon','tourmaline','lapis'],
  farm: ['cow','pig','sheep','goat','horse','chicken','rooster','hen','duck','goose','turkey','donkey','mule','ox','bull','calf','lamb','piglet','foal','rabbit','dog','cat','llama','alpaca'],
  drinks: ['water','milk','juice','coffee','tea','soda','cola','lemonade','beer','wine','whiskey','vodka','rum','gin','cider','cocoa','smoothie','milkshake','espresso','cappuccino','latte','champagne','brandy','sake','punch'],
  clothing: ['shirt','trousers','pants','jeans','dress','skirt','jacket','coat','sweater','jumper','hoodie','sock','shoe','boot','hat','cap','scarf','glove','belt','tie','suit','blouse','shorts','vest','pajamas','underwear','sandal','slipper'],
  games: ['chess','checkers','draughts','monopoly','scrabble','poker','bridge','solitaire','backgammon','dominoes','clue','cluedo','risk','battleship','sorry','uno','blackjack','hearts','spades','rummy','mahjong','go','ludo','snakes and ladders'],
  shapes: ['circle','square','triangle','rectangle','oval','ellipse','pentagon','hexagon','heptagon','octagon','rhombus','diamond','trapezoid','parallelogram','star','heart','crescent','cube','sphere','cylinder','cone','pyramid','prism','semicircle'],
  flowers: ['rose','tulip','daisy','lily','sunflower','daffodil','orchid','carnation','iris','violet','poppy','peony','marigold','jasmine','lavender','lotus','dahlia','chrysanthemum','hyacinth','geranium','petunia','pansy','begonia','lilac','magnolia'],
  languages: ['english','spanish','french','german','italian','portuguese','russian','chinese','mandarin','japanese','korean','arabic','hindi','bengali','croatian','serbian','polish','dutch','greek','turkish','swedish','norwegian','danish','finnish','hungarian','czech','romanian','vietnamese','thai','hebrew'],
  units: ['meter','metre','kilometer','centimeter','millimeter','mile','yard','foot','inch','gram','kilogram','milligram','pound','ounce','ton','liter','litre','milliliter','gallon','pint','quart','second','minute','hour','celsius','fahrenheit','kelvin','watt','volt','ampere','joule','newton']
};

function buildRetrievalFluency() {
  const out = [];
  let counter = 0;
  const covered = new Set();
  for (const [level, prompt, listKey] of RETRIEVAL_PROMPTS) {
    counter++;
    covered.add(listKey);
    const fileList = loadList(listKey);
    const acceptList = fileList && fileList.length >= (RETRIEVAL_LISTS[listKey]?.length ?? 0)
      ? fileList : RETRIEVAL_LISTS[listKey];
    out.push({
      bankKey: `rf-L${level}-${counter}`,
      category: 'retrieval_fluency',
      challengeType: 'category_fluency',
      level, rendererType: 'fluency_list',
      promptData: { instruction: prompt, timeMs: FLUENCY_TIME_MS, listKey },
      answerData: { acceptList, scoringMode: 'fluency_count' },
      scoringConfig: { expectedMedianMs: FLUENCY_TIME_MS, fluency: true },
      version: 1, active: true
    });
  }
  for (const key of FILE_KEYS) {
    if (covered.has(key)) continue;
    if (RF_LABELS[key] === null) continue; // deliberate skip (duplicate of another list)
    const acceptList = loadList(key);
    if (!acceptList || acceptList.length < 8) continue;
    const label = RF_LABELS[key] ?? key.replace(/_/g, ' ').toUpperCase();
    const level = RF_LEVEL[key] ?? 5;
    out.push({
      bankKey: `rf-${key}`,
      category: 'retrieval_fluency',
      challengeType: 'category_fluency',
      level, rendererType: 'fluency_list',
      promptData: { instruction: `Name as many ${label} as you can`, timeMs: FLUENCY_TIME_MS, listKey: key },
      answerData: { acceptList, scoringMode: 'fluency_count' },
      scoringConfig: { expectedMedianMs: FLUENCY_TIME_MS, fluency: true },
      version: 1, active: true
    });
  }
  return out;
}


// ===========================================================================
// Verbal fluency - levels 1..8, fluency_list renderer.
//   Constrained word generation ("words starting with ST"). Scored by valid
//   unique words against a curated word list per constraint.
// ===========================================================================
const VERBAL_FLUENCY = [
  [1, "Words starting with 'S'", 's', ['sun','sea','sand','sing','song','sock','soap','star','stop','sit','sad','set','six','say','see','sky','sleep','small','smile','snow','soft','some','soup','speak','spider','spoon','spring','square','street','strong','study','sugar','summer','sweet','swim','school','science','second','seven','share','sharp','shoe','shop','short','shout','sister','slow','snake','space']],
  [2, "Words starting with 'TR'", 'tr', ['tree','train','track','trade','trail','train','trap','tray','treat','tribe','trick','trip','trophy','trouble','truck','true','trust','truth','try','trace','trade','traffic','tragic','trend','trial','tribe','trim','troop','tropical','trout','trunk','trumpet']],
  [3, "Words starting with 'BL'", 'bl', ['black','blade','blame','blank','blast','blaze','bleed','blend','bless','blind','blink','block','blond','blood','bloom','blow','blue','blunt','blur','blush','blanket','blizzard','bloom','blossom','blouse']],
  [4, "Words ending in 'ING'", 'ing', ['running','singing','jumping','reading','writing','cooking','walking','talking','playing','working','sleeping','eating','drinking','thinking','swimming','dancing','laughing','crying','building','painting','driving','flying','growing','helping','learning','meeting','moving','opening','sitting','standing']],
  [5, "Words starting with 'CH'", 'ch', ['chair','chalk','champion','chance','change','chaos','charge','charm','chart','chase','cheap','cheat','check','cheek','cheer','cheese','chef','cherry','chess','chest','chicken','chief','child','chill','chimney','chin','chip','chocolate','choice','choose','chop','chorus','church']],
  [6, "Words starting with 'GR'", 'gr', ['grab','grace','grade','grain','grand','grant','grape','grass','grave','gray','great','greed','green','greet','grey','grid','grief','grill','grin','grind','grip','groan','ground','group','grow','growl','grumpy','grand','granite','grateful','gravity']],
  [7, "Words ending in 'TION'", 'tion', ['nation','station','action','section','motion','option','caption','fiction','fraction','function','mention','mission','notion','passion','portion','position','question','reaction','relation','solution','vacation','attention','condition','creation','direction','education','emotion','location','operation','population']],
  [8, "Words starting with 'PH'", 'ph', ['phone','photo','phrase','physics','phase','pharmacy','phantom','pharaoh','pheasant','phenomenon','philosophy','phobia','phoenix','phonics','phosphate','photograph','physical','physician','physique']],
  // second pass - more starting-letter/pattern prompts so each level has variety
  [1, "Words starting with 'B'", 'b', ['ball','bat','bed','big','bird','blue','boat','book','box','boy','bread','bridge','bright','brother','brown','bus','butter','baby','back','bag','bake','band','bank','bath','beach','bean','bear','beat','bell','best','black','block','blood','bloom','blow','board','body','bone','born','both','bowl','brain','branch','brave','break','brick']],
  [2, "Words starting with 'CL'", 'cl', ['clap','class','claw','clay','clean','clear','clever','click','cliff','climb','clinic','clip','clock','close','cloth','cloud','clown','club','clue','clumsy','cluster','clutch','climate','classic']],
  [3, "Words starting with 'FR'", 'fr', ['free','fresh','friend','frog','front','frost','fruit','fry','frame','france','frank','freeze','french','frequent','friction','fridge','fright','fringe','frozen','frugal','frantic','fraction','fragment','fragrance']],
  [4, "Words ending in 'LY'", 'ly', ['quickly','slowly','badly','gladly','sadly','happily','quietly','loudly','softly','clearly','nearly','really','finally','simply','barely','rarely','lonely','lovely','lively','friendly','daily','early','only','fully','hardly','kindly','likely','mostly','partly','rapidly']],
  [5, "Words starting with 'SP'", 'sp', ['space','spare','spark','speak','spear','special','speech','speed','spell','spend','spice','spider','spill','spin','spine','spirit','spit','splash','split','spoil','sponge','spoon','sport','spot','spray','spread','spring','sprint','spy']],
  [6, "Words starting with 'DR'", 'dr', ['draft','drag','dragon','drain','drama','draw','dream','dress','drift','drill','drink','drip','drive','drop','drove','drown','drum','dry','dragon','drawer','dreadful','drench','drizzle','drought']],
  [7, "Words ending in 'NESS'", 'ness', ['kindness','darkness','sadness','happiness','illness','weakness','sickness','softness','sharpness','brightness','fitness','witness','business','madness','goodness','greatness','sweetness','blindness','boldness','calmness','coldness','fairness','fondness','freshness','harness','loudness','redness','richness','smoothness','tenderness']],
  [8, "Words starting with 'SC'", 'sc', ['scale','scan','scar','scare','scarf','scatter','scene','scent','school','science','scissors','scold','scoop','scope','score','scorn','scout','scram','scrap','scratch','scream','screen','screw','script','scroll','scrub','sculpt','scuba']]
];

import { mintConstraintFluency } from './gen-verbal-fluency.mjs';
function buildVerbalFluency() {
  const out = [];
  let counter = 0;
  for (const [level, prompt, key, words] of VERBAL_FLUENCY) {
    counter++;
    // dedupe the curated list
    const uniq = Array.from(new Set(words));
    out.push({
      bankKey: `vf-L${level}-${counter}`,
      category: 'verbal_fluency',
      challengeType: 'word_fluency',
      level, rendererType: 'fluency_list',
      promptData: { instruction: prompt, timeMs: FLUENCY_TIME_MS, constraint: key },
      answerData: { acceptList: uniq, constraint: key, scoringMode: 'fluency_count' },
      scoringConfig: { expectedMedianMs: FLUENCY_TIME_MS, fluency: true },
      version: 1, active: true
    });
  }
  // Wave 4: constraint-minted prompts (starts-with / ends-with against the big
  // lexicon) join the curated 16. Content-stable keys (vfc-<type>-<pattern>),
  // deduped against legacy constraints so no prompt appears twice.
  const legacyConstraints = new Set(out.map((c) => String(c.answerData.constraint).toLowerCase()));
  for (const c of mintConstraintFluency(25)) {
    if (legacyConstraints.has(String(c.answerData.constraint).toLowerCase())) continue;
    out.push(c);
  }
  return out;
}

// ===========================================================================
// Visual processing (depth) - levels 1..10, multiple_choice_svg.
//   Beyond rotation: figure CLOSURE (which complete shape matches a partial one)
//   and visual MATCHING (find the identical figure). Reuses SpatialFigure.
// ===========================================================================
const VISUAL_MEDIANS = { 1:4000,2:4500,3:5000,4:5500,5:6000,6:6800,7:7600,8:8500,9:9500,10:11000 };

function randomCells(grid, fill) {
  const cells = [];
  const total = grid * grid;
  const idxs = shuffleArr(Array.from({ length: total }, (_, i) => i)).slice(0, fill);
  for (let r = 0; r < grid; r++) {
    const row = [];
    for (let c = 0; c < grid; c++) row.push(idxs.includes(r * grid + c) ? 1 : 0);
    cells.push(row);
  }
  return cells;
}

function buildVisualProcessing() {
  const PER = 32;
  const out = [];
  let counter = 0;
  for (let level = 1; level <= 10; level++) {
    const seen = new Set();
    let guard = 0;
    const grid = level <= 4 ? 3 : level <= 8 ? 4 : 5;
    const fill = Math.max(2, Math.floor((grid * grid) * (0.3 + level * 0.02)));
    while (seen.size < PER && guard < 8000) {
      guard++;
      const isMatching = rng() < 0.5;
      const target = randomCells(grid, fill);
      const key = JSON.stringify(target) + (isMatching ? 'm' : 'c') + level;
      if (seen.has(key)) continue;

      // build 4 options: one correct (== target), three perturbed
      const options = [{ cells: target, accentIdx: -1 }];
      let attempts2 = 0;
      while (options.length < 4 && attempts2 < 50) {
        attempts2++;
        const variant = randomCells(grid, fill);
        if (!options.some((o) => cellsEqual(o.cells, variant))) {
          options.push({ cells: variant, accentIdx: -1 });
        }
      }
      if (options.length < 4) continue;
      seen.add(key);
      counter++;

      const shuffled = shuffleWithAnswer(options);
      const instruction = isMatching
        ? 'Which figure exactly matches the one above?'
        : 'Which figure completes the pattern above?';
      out.push({
        bankKey: `vp-L${level}-${counter}`,
        category: 'visual_processing',
        challengeType: isMatching ? 'visual_match' : 'figure_closure',
        level, rendererType: 'multiple_choice_svg',
        promptData: {
          instruction,
          grid,
          prompt: { cells: target, accentIdx: -1 },
          options: shuffled.list
        },
        answerData: { correctAnswer: shuffled.answerIndex, acceptedAnswers: [String(shuffled.answerIndex)] },
        scoringConfig: { expectedMedianMs: VISUAL_MEDIANS[level], slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 },
        version: 1, active: true
      });
    }
  }
  return out;
}

const verbal = buildVerbal();
const processingSpeed = buildProcessingSpeed();
const estimation = buildEstimation();
const inhibition = buildInhibition();
const switching = buildSwitching();
const retrievalFluency = buildRetrievalFluency();
const verbalFluency = buildVerbalFluency();
const visualProcessing = buildVisualProcessing();



mkdirSync(join(ROOT, 'challenge-bank/numerical-fluency'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/pattern-recognition'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/working-memory'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/attention-control'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/spatial-reasoning'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/logical-reasoning'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/verbal-reasoning'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/processing-speed'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/estimation'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/inhibition'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/task-switching'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/retrieval-fluency'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/verbal-fluency'), { recursive: true });
mkdirSync(join(ROOT, 'challenge-bank/visual-processing'), { recursive: true });

writeFileSync(
  join(ROOT, 'challenge-bank/numerical-fluency/arithmetic.levels.json'),
  JSON.stringify(arithmetic, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/pattern-recognition/sequence.levels.json'),
  JSON.stringify(sequences, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/working-memory/digit-span.levels.json'),
  JSON.stringify(workingMemory, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/attention-control/target-count.levels.json'),
  JSON.stringify(attentionControl, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/spatial-reasoning/figures.levels.json'),
  JSON.stringify(spatial, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/logical-reasoning/logic.levels.json'),
  JSON.stringify(logical, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/verbal-reasoning/verbal.en.levels.json'),
  JSON.stringify(verbal, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/processing-speed/speed.levels.json'),
  JSON.stringify(processingSpeed, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/estimation/estimate.levels.json'),
  JSON.stringify(estimation, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/inhibition/stroop.levels.json'),
  JSON.stringify(inhibition, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/task-switching/switch.levels.json'),
  JSON.stringify(switching, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/retrieval-fluency/retrieval.levels.json'),
  JSON.stringify(retrievalFluency, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/verbal-fluency/verbal-fluency.levels.json'),
  JSON.stringify(verbalFluency, null, 2)
);
writeFileSync(
  join(ROOT, 'challenge-bank/visual-processing/visual.levels.json'),
  JSON.stringify(visualProcessing, null, 2)
);

console.log(`arithmetic:        ${arithmetic.length} challenges across 15 levels`);
console.log(`sequences:         ${sequences.length} challenges across 12 levels`);
console.log(`working memory:    ${workingMemory.length} challenges across 12 levels`);
console.log(`attention control: ${attentionControl.length} challenges across 10 levels`);
console.log(`spatial reasoning: ${spatial.length} challenges across 12 levels`);
console.log(`logical reasoning: ${logical.length} challenges across 12 levels`);
console.log(`verbal reasoning:  ${verbal.length} challenges (en deck)`);
console.log(`processing speed:  ${processingSpeed.length} challenges across 10 levels`);
console.log(`estimation:        ${estimation.length} challenges across 10 levels`);
console.log(`inhibition:        ${inhibition.length} challenges across 10 levels`);
console.log(`task switching:    ${switching.length} challenges across 10 levels`);
console.log(`retrieval fluency: ${retrievalFluency.length} prompts`);
console.log(`verbal fluency:    ${verbalFluency.length} prompts`);
console.log(`visual processing: ${visualProcessing.length} challenges across 10 levels`);
