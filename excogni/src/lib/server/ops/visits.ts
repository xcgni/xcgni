import { pg } from '$lib/server/db';

// Record one first-visit. Host already normalised by the caller ('direct' / a hostname /
// 'unknown'). Never linked to a user. Best-effort.
export async function recordVisit(referrerHost: string | null, landingPath: string): Promise<void> {
  await pg`
    INSERT INTO visit_events (referrer_host, landing_path)
    VALUES (${referrerHost}, ${landingPath})
  `;
}

export interface ReferrerCount {
  host: string;
  n: number;
}

// Top referrers over a window (days). Aggregate counts only.
export async function topReferrers(days = 30, limit = 15): Promise<ReferrerCount[]> {
  const rows = await pg`
    SELECT COALESCE(referrer_host, 'unknown') AS host, count(*)::int AS n
    FROM visit_events
    WHERE created_at > now() - (${days} || ' days')::interval
    GROUP BY referrer_host
    ORDER BY n DESC
    LIMIT ${limit}
  `;
  return rows as ReferrerCount[];
}

export interface VisitTotals {
  visitsLast24h: number;
  visitsLast7d: number;
  visitsLast30d: number;
}

export async function visitTotals(): Promise<VisitTotals> {
  const r = await pg`
    SELECT
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS d1,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int  AS d7,
      count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS d30
    FROM visit_events
  `;
  const row = (r as { d1: number; d7: number; d30: number }[])[0];
  return {
    visitsLast24h: row?.d1 ?? 0,
    visitsLast7d: row?.d7 ?? 0,
    visitsLast30d: row?.d30 ?? 0
  };
}
