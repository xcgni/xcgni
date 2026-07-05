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
