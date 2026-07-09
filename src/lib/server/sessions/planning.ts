// Validate a "number path" planning answer: replay the typed operations from the start and check
// whether they reach the target. Returns whether it's correct and how many moves were used (so the
// caller can score efficiency vs the known optimum). Pure + tested.

const OP_FNS = {
  '+1': (n) => n + 1,
  '+2': (n) => n + 2,
  '+3': (n) => n + 3,
  '-1': (n) => n - 1,
  '-2': (n) => n - 2,
  '*2': (n) => n * 2,
  '*3': (n) => n * 3
};

// normalize a typed token: strip spaces, accept ×/x for *, unicode minus for -, "1+" -> "+1" is NOT
// done (we keep it simple and explicit), but we accept "x2" / "X2" / "·2" for "*2".
export function normalizeOp(raw: string): string | null {
  let t = raw.trim().toLowerCase();
  if (!t) return null;
  t = t
    .replace(/[×x·]/g, '*')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s+/g, '');
  // allow "2*" -> "*2", "2+" not handled; allow leading op forms only
  if (/^[*][23]$/.test(t)) return t;
  if (/^[+\-][123]$/.test(t)) return t;
  // accept reversed like "2*" or "2+"
  const m = t.match(/^(\d)([*+\-])$/);
  if (m) {
    const op = `${m[2]}${m[1]}`;
    if (OP_FNS[op]) return op;
  }
  return OP_FNS[t] ? t : null;
}

export interface PlanResult {
  correct: boolean;
  moves: number;
  reached: number | null;
  invalidOp: string | null;   // first unrecognised/disallowed token, if any
}

export function gradePlan(
  answer: string,
  spec: { start: number; target: number; allowed: string[] }
): PlanResult {
  const allowed = new Set(spec.allowed);
  // split on commas, arrows, whitespace, or "then"
  const tokens = answer
    .split(/[,;\n]|->|→|then/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  let value = spec.start;
  let moves = 0;
  for (const tok of tokens) {
    const op = normalizeOp(tok);
    if (op == null) return { correct: false, moves, reached: null, invalidOp: tok };
    if (!allowed.has(op)) return { correct: false, moves, reached: value, invalidOp: tok };
    value = OP_FNS[op](value);
    moves += 1;
  }
  return { correct: value === spec.target && moves > 0, moves, reached: value, invalidOp: null };
}

// ---------------------------------------------------------------------------
// Verbal planning: step ordering (v1.3.0)
// The prompt shows lettered steps of a real-world procedure in scrambled order;
// the answer is the correct sequence of letters. Single defensible order by
// construction (each step causally requires the previous). All-or-nothing.
// ---------------------------------------------------------------------------
export interface OrderResult {
  correct: boolean;
  given: string;        // normalized letters actually parsed, e.g. "CADB"
}

export function gradeStepOrder(answer: string, spec: { correctOrder: string }): OrderResult {
  // accept "CADB", "c a d b", "c,a,d,b", "c->a->d->b", with any case/separators
  const given = (answer.toUpperCase().match(/[A-Z]/g) ?? []).join('');
  const want = spec.correctOrder.toUpperCase();
  // must use each letter exactly once - a longer/shorter guess is wrong, not partial
  return { correct: given === want, given };
}

// ---------------------------------------------------------------------------
// Visual planning: grid path (v1.3.0)
// The prompt shows a small grid (S start, T target, # walls, · floor); the
// answer is a sequence of moves. Replayed like the number path: any legal path
// that reaches T is correct; efficiency vs the known optimum is what scores.
// ---------------------------------------------------------------------------
const MOVES: Record<string, [number, number]> = {
  U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1]
};

export function normalizeMove(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!t) return null;
  if (t === 'U' || t === 'UP' || t === '↑' || t === '^') return 'U';
  if (t === 'D' || t === 'DOWN' || t === '↓' || t === 'V') return 'D';
  if (t === 'L' || t === 'LEFT' || t === '←' || t === '<') return 'L';
  if (t === 'R' || t === 'RIGHT' || t === '→' || t === '>') return 'R';
  return null;
}

export interface PathResult {
  correct: boolean;
  moves: number;
  invalidMove: string | null;  // first unparseable token
  hitWall: boolean;
  endedAt: [number, number] | null;
}

export function gradeGridPath(
  answer: string,
  spec: { rows: string[] }
): PathResult {
  const rows = spec.rows;
  let pos: [number, number] | null = null;
  let target: [number, number] | null = null;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === 'S') pos = [r, c];
      if (rows[r][c] === 'T') target = [r, c];
    }
  }
  if (!pos || !target) return { correct: false, moves: 0, invalidMove: null, hitWall: false, endedAt: null };

  // split on whitespace/commas/semicolons ONLY - arrows are MOVES here, not separators
  const rawTokens = answer.split(/[\s,;]+/).filter(Boolean);
  const tokens: string[] = [];
  for (const rt of rawTokens) {
    if (/^[udlrUDLR^v<>↑↓←→]+$/.test(rt) && rt.length > 1 && !/^(UP|DOWN|LEFT|RIGHT)$/i.test(rt)) {
      for (const ch of rt) tokens.push(ch);
    } else {
      tokens.push(rt);
    }
  }

  let moves = 0;
  for (const tok of tokens) {
    const m = normalizeMove(tok);
    if (!m) return { correct: false, moves, invalidMove: tok, hitWall: false, endedAt: pos };
    const [dr, dc] = MOVES[m];
    const nr = pos[0] + dr, nc = pos[1] + dc;
    if (nr < 0 || nr >= rows.length || nc < 0 || nc >= rows[nr].length || rows[nr][nc] === '#') {
      return { correct: false, moves, invalidMove: null, hitWall: true, endedAt: pos };
    }
    pos = [nr, nc];
    moves += 1;
  }
  const correct = pos[0] === target[0] && pos[1] === target[1] && moves > 0;
  return { correct, moves, invalidMove: null, hitWall: false, endedAt: pos };
}
