import { pg } from '$lib/server/db';

/**
 * Grouped error intelligence for the admin (v1.1.0), Sentry-lite:
 * - Events group by a SIGNATURE computed in SQL: the message with digit runs collapsed
 *   (so "user 123 not found" and "user 456 not found" are one group) plus the top stack
 *   frame (so identical messages from different code paths stay distinct).
 * - Per group: sample of the LATEST event, total count, first/last seen, distinct routes.
 * - Triage status lives in error_groups; a resolved group with events NEWER than the
 *   status change is REGRESSED (computed here, never stored).
 * Grouping is query-time only: no schema change to error_log, old rows group fine.
 * House pattern: composed pg`` fragments, never pg.unsafe with raw strings.
 */

// The signature expression as a composable fragment (references alias e).
function sigExpr() {
  return pg`md5(
    regexp_replace(coalesce(e.message,''), '[0-9]+', '#', 'g')
    || '|' ||
    coalesce(split_part(coalesce(e.stack,''), E'\n', 2), '')
  )`;
}

export type ErrorGroup = {
  signature: string;
  message: string;
  route: string | null;
  status: number | null;
  count: number;
  routes: number;
  firstSeen: string;
  lastSeen: string;
  triage: 'open' | 'resolved' | 'ignored';
  regressed: boolean;
};

export type ErrorOccurrence = {
  occurredAt: string;
  route: string | null;
  message: string;
  stack: string | null;
  status: number | null;
  userKind: string | null;
};

export async function errorGroups(opts: {
  q?: string | null;
  filter?: 'active' | 'resolved' | 'ignored' | 'all';
  limit?: number;
}): Promise<ErrorGroup[]> {
  const q = (opts.q ?? '').trim();
  const filter = opts.filter ?? 'active';
  const limit = Math.min(opts.limit ?? 50, 200);
  const like = `%${q}%`;

  const searchClause = q ? pg`WHERE e.message ILIKE ${like} OR e.route ILIKE ${like}` : pg``;

  const filterClause =
    filter === 'active'
      ? pg`WHERE coalesce(eg.status,'open') = 'open'
             OR (coalesce(eg.status,'open') = 'resolved' AND g.last_seen > eg.status_changed_at)`
      : filter === 'resolved'
        ? pg`WHERE coalesce(eg.status,'open') = 'resolved' AND g.last_seen <= eg.status_changed_at`
        : filter === 'ignored'
          ? pg`WHERE coalesce(eg.status,'open') = 'ignored'`
          : pg``;

  const rows = await pg`
    WITH grouped AS (
      SELECT ${sigExpr()} AS signature,
             count(*)::int                    AS count,
             count(DISTINCT e.route)::int     AS routes,
             min(e.occurred_at)               AS first_seen,
             max(e.occurred_at)               AS last_seen,
             (array_agg(e.message ORDER BY e.occurred_at DESC))[1] AS message,
             (array_agg(e.route   ORDER BY e.occurred_at DESC))[1] AS route,
             (array_agg(e.status  ORDER BY e.occurred_at DESC))[1] AS status
      FROM error_log e
      ${searchClause}
      GROUP BY 1
    )
    SELECT g.*,
           coalesce(eg.status, 'open') AS triage,
           (coalesce(eg.status,'open') = 'resolved' AND g.last_seen > eg.status_changed_at) AS regressed
    FROM grouped g
    LEFT JOIN error_groups eg ON eg.signature = g.signature
    ${filterClause}
    ORDER BY g.last_seen DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    signature: r.signature as string,
    message: r.message as string,
    route: (r.route as string) ?? null,
    status: (r.status as number) ?? null,
    count: r.count as number,
    routes: r.routes as number,
    firstSeen: (r.first_seen as Date).toISOString(),
    lastSeen: (r.last_seen as Date).toISOString(),
    triage: r.triage as ErrorGroup['triage'],
    regressed: (r.regressed as boolean) ?? false
  }));
}

export async function errorOccurrences(signature: string, limit = 20): Promise<ErrorOccurrence[]> {
  const rows = await pg`
    SELECT e.occurred_at, e.route, e.message, e.stack, e.status, e.user_kind
    FROM error_log e
    WHERE ${sigExpr()} = ${signature}
    ORDER BY e.occurred_at DESC
    LIMIT ${Math.min(limit, 100)}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    occurredAt: (r.occurred_at as Date).toISOString(),
    route: (r.route as string) ?? null,
    message: r.message as string,
    stack: (r.stack as string) ?? null,
    status: (r.status as number) ?? null,
    userKind: (r.user_kind as string) ?? null
  }));
}

export async function setErrorGroupStatus(
  signature: string,
  status: 'open' | 'resolved' | 'ignored'
): Promise<void> {
  await pg`
    INSERT INTO error_groups (signature, status, status_changed_at)
    VALUES (${signature}, ${status}, now())
    ON CONFLICT (signature)
    DO UPDATE SET status = ${status}, status_changed_at = now()
  `;
}
