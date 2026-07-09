/**
 * Commons findings core (v1.6.0) - population-level gating, pure and unit-tested.
 * Same philosophy as the personal findings-core, harder bars:
 * - Every compared group must clear the PUBLIC anonymity floor (min-cell, default 50
 *   distinct users) - below it the whole finding is WITHHELD and says so.
 * - Effect bar d >= 0.2 at population scale (large n makes tiny effects "significant";
 *   the bar keeps the page saying only things worth saying).
 * - Null results are published as null results.
 * - Anchored to pool size, never to dates (house rule: no dates in public surfaces).
 */
// Local copy of cohensD (mirrors findings-core) so this module stays dependency-free and
// directly loadable by the bare-node test suites - the house pattern for pure modules.
function cohensD(m1: number, sd1: number, n1: number, m2: number, sd2: number, n2: number): number {
  const pooled = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / Math.max(n1 + n2 - 2, 1));
  if (pooled === 0) return Math.abs(m1 - m2) >= 0.05 ? Math.sign(m1 - m2) * 0.5 : 0;
  return (m1 - m2) / pooled;
}

export interface CommonsFinding {
  id: string;
  title: string;
  status: 'published' | 'null' | 'withheld';
  sentence: string;
  detail: string;
  nUsers: number | null;   // pool anchor for the computation
}

const MIN_D_POP = 0.2;

export type PopBand = { band: string; nUsers: number; nAttempts: number; mean: number; sd: number };

export function gatePopulationBands(
  id: string,
  title: string,
  noun: string,               // "time of day" / "session position"
  bands: PopBand[],
  floor: number
): CommonsFinding {
  const eligible = bands.filter((b) => b.nUsers >= floor);
  if (eligible.length < 2) {
    return {
      id, title, status: 'withheld', nUsers: null,
      sentence: `Withheld: fewer than ${floor} consented users per compared group.`,
      detail: `The anonymity floor applies to every group in a comparison. This unlocks as the pool grows - and a withheld finding is shown as withheld, never silently omitted.`
    };
  }
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.nAttempts, worst.mean, worst.sd, worst.nAttempts);
  const nUsers = eligible.reduce((s, b) => s + b.nUsers, 0);
  if (Math.abs(d) < MIN_D_POP) {
    return {
      id, title, status: 'null', nUsers,
      sentence: `No reliable ${noun} pattern in the pool: group means are statistically indistinguishable.`,
      detail: `Compared ${eligible.map((b) => `${b.band} (${b.nUsers} users, ${b.nAttempts} attempts)`).join(' vs ')}; |d| < ${MIN_D_POP}. Published anyway - a null result is a result.`
    };
  }
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  return {
    id, title, status: 'published', nUsers,
    sentence: `Pool-wide, ${best.band} scores run ${rel >= 0 ? '+' : ''}${Math.round(rel * 100)}% above ${worst.band} scores.`,
    detail: `${best.band}: mean ${best.mean.toFixed(2)} across ${best.nUsers} users (${best.nAttempts} attempts) vs ${worst.band}: ${worst.mean.toFixed(2)} across ${worst.nUsers} users (${worst.nAttempts}), d=${d.toFixed(2)}. Association across a self-selected pool - collection conditions and confounds are stated on the methodology page.`
  };
}

export type UserGain = { nUsers: number; medianGain: number | null; q1: number | null; q3: number | null };

export function gatePopulationLearning(g: UserGain, floor: number): CommonsFinding {
  const id = 'pool_learning', title = 'Practice, pool-wide';
  if (g.nUsers < floor || g.medianGain == null) {
    return {
      id, title, status: 'withheld', nUsers: null,
      sentence: `Withheld: fewer than ${floor} consented users with enough history (20+ answered items).`,
      detail: 'Unlocks as the pool accumulates practice history.'
    };
  }
  const pct = Math.round(g.medianGain * 100);
  if (Math.abs(pct) < 3) {
    return {
      id, title, status: 'null', nUsers: g.nUsers,
      sentence: 'The median user scores about the same late in practice as early - no pool-wide practice effect above the bar.',
      detail: `Median early-to-late change ${pct}% across ${g.nUsers} users (IQR ${Math.round((g.q1 ?? 0) * 100)}% to ${Math.round((g.q3 ?? 0) * 100)}%).`
    };
  }
  return {
    id, title, status: 'published', nUsers: g.nUsers,
    sentence: `The median user's scores run ${pct >= 0 ? '+' : ''}${pct}% higher in late practice than in their first sessions.`,
    detail: `Across ${g.nUsers} users with 20+ answered items; IQR ${Math.round((g.q1 ?? 0) * 100)}% to ${Math.round((g.q3 ?? 0) * 100)}%. This is the practice effect the methodology names: familiarity and ability improving together, inseparable in this design. Survivors bias rides along - users who stay differ from users who leave.`
  };
}
