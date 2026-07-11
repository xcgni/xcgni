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

import { translate as tr, type Locale } from '../../i18n/index.ts';
type TrKey = Parameters<typeof tr>[1];

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
  noun: string,
  bands: PopBand[],
  floor: number,
  locale: Locale = 'en'
): CommonsFinding {
  const B = (b: string) => {
    const k = ('band.' + b.replace(/ /g, '_')) as TrKey;
    const v = tr(locale, k);
    return v === undefined || v.startsWith('band.') ? b : v;
  };
  const eligible = bands.filter((b) => b.nUsers >= floor);
  if (eligible.length < 2) {
    return {
      id, title, status: 'withheld', nUsers: null,
      sentence: tr(locale, 'commons.withheld', { floor }),
      detail: tr(locale, 'commons.withheldDetail')
    };
  }
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.nAttempts, worst.mean, worst.sd, worst.nAttempts);
  const nUsers = eligible.reduce((s, b) => s + b.nUsers, 0);
  if (Math.abs(d) < MIN_D_POP) {
    return {
      id, title, status: 'null', nUsers,
      sentence: tr(locale, 'commons.null', { noun }),
      detail: tr(locale, 'commons.nullDetail', { compared: eligible.map((b) => `${B(b.band)} (${b.nUsers}/${b.nAttempts})`).join(' vs '), minD: MIN_D_POP })
    };
  }
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  return {
    id, title, status: 'published', nUsers,
    sentence: tr(locale, 'commons.hit', { best: B(best.band), worst: B(worst.band), pct: `${rel >= 0 ? '+' : ''}${Math.round(rel * 100)}%` }),
    detail: tr(locale, 'commons.hitDetail', { best: B(best.band), bm: best.mean.toFixed(2), bu: best.nUsers, ba: best.nAttempts, worst: B(worst.band), wm: worst.mean.toFixed(2), wu: worst.nUsers, wa: worst.nAttempts, d: d.toFixed(2) })
  };
}

export type UserGain = { nUsers: number; medianGain: number | null; q1: number | null; q3: number | null };

export function gatePopulationLearning(g: UserGain, floor: number, locale: Locale = 'en'): CommonsFinding {
  const id = 'pool_learning', title = tr(locale, 'commons.learning.title');
  if (g.nUsers < floor || g.medianGain == null) {
    return {
      id, title, status: 'withheld', nUsers: null,
      sentence: tr(locale, 'commons.learning.withheld', { floor }),
      detail: tr(locale, 'commons.learning.withheldDetail')
    };
  }
  const pctV = Math.round(g.medianGain * 100);
  const iqr = `${Math.round((g.q1 ?? 0) * 100)}% .. ${Math.round((g.q3 ?? 0) * 100)}%`;
  if (Math.abs(pctV) < 3) {
    return {
      id, title, status: 'null', nUsers: g.nUsers,
      sentence: tr(locale, 'commons.learning.null'),
      detail: tr(locale, 'commons.learning.nullDetail', { pct: pctV, n: g.nUsers, iqr })
    };
  }
  return {
    id, title, status: 'published', nUsers: g.nUsers,
    sentence: tr(locale, 'commons.learning.hit', { pct: `${pctV >= 0 ? '+' : ''}${pctV}` }),
    detail: tr(locale, 'commons.learning.hitDetail', { n: g.nUsers, iqr })
  };
}
