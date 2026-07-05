import type { RequestHandler } from './$types';
import { isAdmin } from '$lib/server/admin/auth';
import { adminConfig } from '$lib/server/flags';
import { pg } from '$lib/server/db';

// Consented, anonymized, suppression-gated CSV. One row per consented user:
// coarse attributes (age bucketed to a decade band) + per-category ratings.
// No identifiers, no localized timestamps, no free text. Released only if the
// consented set clears the suppression floor.
export const GET: RequestHandler = async ({ cookies }) => {
  if (!(await isAdmin(cookies))) return new Response('forbidden', { status: 403 });
  const minCell = adminConfig.minCell();

  const consented = await pg`SELECT count(*)::int AS n FROM user_attributes WHERE consented_stats = true`;
  if ((consented[0]?.n ?? 0) < minCell) {
    return new Response('Consented set below suppression floor; export withheld.', { status: 409 });
  }

  const perUser = await pg`
    SELECT u.id::text AS uid,
      COALESCE(at.age_band, 'unknown') AS age_band,
      at.country, at.gender, at.education, at.native_language, at.handedness
    FROM user_attributes at JOIN users u ON u.id = at.user_id
    WHERE at.consented_stats = true AND u.is_anonymous = false AND u.is_test = false
    ORDER BY u.id
  `;
  const ratingRows = await pg`
    SELECT u.id::text AS uid, cs.category_slug, cs.rating
    FROM user_category_state cs
    JOIN users u ON u.id = cs.user_id
    JOIN user_attributes at ON at.user_id = u.id AND at.consented_stats = true
    WHERE cs.attempts_count >= 10 AND cs.rating > 0
  `;

  const cats = [
    'numerical_fluency', 'pattern_recognition', 'working_memory', 'attention_control',
    'spatial_reasoning', 'logical_reasoning', 'verbal_reasoning', 'processing_speed', 'estimation'
  ];
  const ratingsByUser: Record<string, Record<string, number>> = {};
  for (const r of ratingRows as { uid: string; category_slug: string; rating: number }[]) {
    (ratingsByUser[r.uid] ??= {})[r.category_slug] = r.rating;
  }

  // k-ANONYMITY on the full quasi-identifier combination. Per-field suppression
  // is insufficient - a rare COMBINATION (50s + small country + rare language)
  // can be unique even if each field clears the floor. We coarsen geography to a
  // broad region, build the QI signature per row, count signatures, and suppress
  // (drop) any row whose signature appears fewer than minCell times.
  const REGION: Record<string, string> = {
    // a light coarsening map; unknown countries fall back to 'other'
    croatia: 'SE Europe', serbia: 'SE Europe', slovenia: 'SE Europe', bosnia: 'SE Europe',
    germany: 'W Europe', france: 'W Europe', netherlands: 'W Europe', belgium: 'W Europe', austria: 'W Europe',
    spain: 'S Europe', italy: 'S Europe', portugal: 'S Europe', greece: 'S Europe',
    uk: 'W Europe', ireland: 'W Europe', 'united kingdom': 'W Europe',
    usa: 'N America', 'united states': 'N America', canada: 'N America', mexico: 'N America',
    sweden: 'N Europe', norway: 'N Europe', finland: 'N Europe', denmark: 'N Europe',
    poland: 'E Europe', ukraine: 'E Europe', russia: 'E Europe', romania: 'E Europe',
    india: 'S Asia', china: 'E Asia', japan: 'E Asia', korea: 'E Asia',
    australia: 'Oceania', 'new zealand': 'Oceania', brazil: 'S America', argentina: 'S America'
  };
  const regionOf = (c: unknown) => {
    const k = String(c ?? '').trim().toLowerCase();
    return k ? (REGION[k] ?? 'other') : '';
  };

  type Row = Record<string, unknown>;
  const enriched = (perUser as Row[]).map((u) => {
    const ageBand = u.age_band != null ? `${Number(u.age_band) * 10}s` : '';
    const region = regionOf(u.country);
    // quasi-identifiers: age band, region, gender, education, native language, handedness
    const qi = [ageBand, region, u.gender, u.education, u.native_language, u.handedness]
      .map((v) => String(v ?? '')).join('|');
    return { u, ageBand, region, qi };
  });
  const qiCounts: Record<string, number> = {};
  for (const e of enriched) qiCounts[e.qi] = (qiCounts[e.qi] ?? 0) + 1;
  const kept = enriched.filter((e) => qiCounts[e.qi] >= minCell);

  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ['subject', 'age_band', 'region', 'gender', 'education', 'native_language', 'handedness', ...cats];
  const lines = [header.join(',')];
  let n = 0;
  for (const e of kept) {
    n += 1;
    const uid = e.u.uid as string;
    const ratings = cats.map((c) => ratingsByUser[uid]?.[c] ?? '');
    lines.push([
      `s${n}`, e.ageBand, esc(e.region),
      esc(e.u.gender), esc(e.u.education), esc(e.u.native_language), esc(e.u.handedness),
      ...ratings
    ].join(','));
  }

  const suppressedCount = enriched.length - kept.length;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="excogni-consented-${stamp}.csv"`,
      'x-rows-suppressed': String(suppressedCount)
    }
  });
};
