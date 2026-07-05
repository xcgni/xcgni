import { pg } from '$lib/server/db';
import { DOMAIN_LABELS } from '$lib/server/stats';

export interface CircleMemberDomains {
  displayName: string;
  isYou: boolean;
  domains: { domain: string; rating: number | null }[];
}
export interface CircleStats {
  domainLabels: { domain: string; label: string }[];
  median: { domain: string; median: number | null }[];   // circle median per domain (reference shape)
  members: CircleMemberDomains[];                          // each sharing member's shape (for overlay/compare)
  youPercentiles: { domain: string; label: string; rank: number | null; of: number }[]; // your place in the circle
  superlatives: { label: string; who: string; detail: string }[];
}

// Rich circle stats: per-domain ratings for members who share ratings, the circle median (used as
// the radar reference, just like the population anchor on the personal radar), the viewer's rank
// within the circle per domain, and a few human "superlatives". Only members who opted to share
// ratings appear in the rating shapes; activity-only members still feed superlatives where allowed.
export async function circleStats(userId: string, circleId: string): Promise<CircleStats | null> {
  const isMember = await pg`SELECT 1 FROM circle_members WHERE circle_id = ${circleId} AND user_id = ${userId} LIMIT 1`;
  if (isMember.length === 0) return null;

  // members and their sharing prefs + display names
  const memberRows = await pg`
    SELECT cm.user_id AS "userId", cm.display_name AS "displayName",
           cm.share_ratings AS "shareRatings", cm.share_activity AS "shareActivity"
    FROM circle_members cm WHERE cm.circle_id = ${circleId} ORDER BY cm.joined_at
  `;
  const members = memberRows as { userId: string; displayName: string; shareRatings: boolean; shareActivity: boolean }[];

  // per-domain ratings for every member (we filter by sharing below, but compute once)
  const ratingRows = await pg`
    SELECT s.user_id AS "userId", c.domain AS domain, round(avg(s.rating))::int AS rating
    FROM circle_members cm
    JOIN user_category_state s ON s.user_id = cm.user_id AND s.attempts_count >= 10 AND s.rating > 0
    JOIN categories c ON c.slug = s.category_slug AND c.active AND c.domain IS NOT NULL
    WHERE cm.circle_id = ${circleId}
    GROUP BY s.user_id, c.domain
  `;
  const byUserDomain = new Map<string, Map<string, number>>();
  const domainsSeen = new Set<string>();
  for (const r of ratingRows as { userId: string; domain: string; rating: number }[]) {
    if (!byUserDomain.has(r.userId)) byUserDomain.set(r.userId, new Map());
    byUserDomain.get(r.userId)!.set(r.domain, r.rating);
    domainsSeen.add(r.domain);
  }
  const domains = [...domainsSeen];
  const domainLabels = domains.map((d) => ({ domain: d, label: DOMAIN_LABELS[d] ?? d }));

  // member shapes: only those who share ratings (or you, who always sees yourself)
  const memberShapes: CircleMemberDomains[] = members
    .filter((m) => m.shareRatings || m.userId === userId)
    .map((m) => ({
      displayName: m.displayName || 'Member',
      isYou: m.userId === userId,
      domains: domains.map((d) => ({ domain: d, rating: byUserDomain.get(m.userId)?.get(d) ?? null }))
    }));

  // circle median per domain across members who share ratings
  const sharingUsers = members.filter((m) => m.shareRatings).map((m) => m.userId);
  const median = domains.map((d) => {
    const vals = sharingUsers
      .map((u) => byUserDomain.get(u)?.get(d))
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b);
    if (vals.length === 0) return { domain: d, median: null };
    const mid = Math.floor(vals.length / 2);
    const med = vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
    return { domain: d, median: med };
  });

  // your rank within the circle per domain (1 = highest), among members who share ratings + you
  const youDomains = byUserDomain.get(userId) ?? new Map();
  const rankPool = [...new Set([...sharingUsers, userId])];
  const youPercentiles = domains.map((d) => {
    const mine = youDomains.get(d);
    if (mine == null) return { domain: d, label: DOMAIN_LABELS[d] ?? d, rank: null, of: rankPool.length };
    const others = rankPool.map((u) => byUserDomain.get(u)?.get(d)).filter((v): v is number => typeof v === 'number');
    const rank = 1 + others.filter((v) => v > mine).length;
    return { domain: d, label: DOMAIN_LABELS[d] ?? d, rank, of: others.length };
  });

  // superlatives - small, human, honest. Only over members who share the relevant dimension.
  const superlatives: { label: string; who: string; detail: string }[] = [];
  // strongest in each of up to 2 domains (rating sharers only)
  for (const d of domains.slice(0, 2)) {
    let best: { name: string; v: number } | null = null;
    for (const m of members) {
      if (!m.shareRatings && m.userId !== userId) continue;
      const v = byUserDomain.get(m.userId)?.get(d);
      if (v != null && (!best || v > best.v)) best = { name: m.userId === userId ? 'You' : (m.displayName || 'Member'), v };
    }
    if (best) superlatives.push({ label: `${DOMAIN_LABELS[d] ?? d} lead`, who: best.name, detail: `rating ${best.v}` });
  }
  // most consistent (activity sharers): most distinct active days in last 30
  const actRows = await pg`
    SELECT cm.user_id AS "userId", cm.display_name AS "displayName", cm.share_activity AS "shareActivity",
           (SELECT count(DISTINCT to_char(a.served_at,'YYYY-MM-DD')) FROM attempts a
              WHERE a.user_id = cm.user_id AND a.status='answered' AND a.served_at > now() - interval '30 days')::int AS days
    FROM circle_members cm WHERE cm.circle_id = ${circleId}
  `;
  let mostConsistent: { name: string; days: number } | null = null;
  for (const r of actRows as { userId: string; displayName: string; shareActivity: boolean; days: number }[]) {
    if (!r.shareActivity && r.userId !== userId) continue;
    if (r.days > 0 && (!mostConsistent || r.days > mostConsistent.days)) {
      mostConsistent = { name: r.userId === userId ? 'You' : (r.displayName || 'Member'), days: r.days };
    }
  }
  if (mostConsistent) superlatives.push({ label: 'Most consistent', who: mostConsistent.name, detail: `${mostConsistent.days} days in 30` });

  return { domainLabels, median, members: memberShapes, youPercentiles, superlatives };
}

export interface CircleMember {
  displayName: string;
  isYou: boolean;
  shareActivity: boolean;
  shareRatings: boolean;
  // only populated if the member opted to share that dimension:
  daysLast30: number | null;
  currentRun: number | null;
  attempts: number | null;
  rating: number | null;
}

export interface CircleView {
  id: string;
  code: string;
  name: string;
  categories: string[];      // the circle's suggested practice focus (category slugs)
  isAdmin: boolean;          // is the viewer the circle's creator?
  members: CircleMember[];
  totalAttempts: number;     // the circle's combined practice volume (always shown - it's collective)
}

// short, unambiguous join code (no easily-confused chars)
function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function createCircle(userId: string, name: string, displayName: string, categories: string[] = []): Promise<string> {
  const clean = (name || 'Practice circle').slice(0, 60);
  const dn = (displayName || 'Member').slice(0, 40);
  const cats = await validCategorySlugs(categories);
  // retry on the rare code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const existing = await pg`SELECT 1 FROM circles WHERE code = ${code} LIMIT 1`;
    if (existing.length > 0) continue;
    const rows = await pg`
      INSERT INTO circles (code, name, created_by, categories)
      VALUES (${code}, ${clean}, ${userId}, ${JSON.stringify(cats)}::jsonb)
      RETURNING id
    `;
    const circleId = (rows as { id: string }[])[0].id;
    await pg`
      INSERT INTO circle_members (circle_id, user_id, display_name)
      VALUES (${circleId}, ${userId}, ${dn})
      ON CONFLICT DO NOTHING
    `;
    return code;
  }
  throw new Error('could not allocate a circle code, please try again');
}

// keep only real implemented category slugs (ignore anything injected)
async function validCategorySlugs(slugs: string[]): Promise<string[]> {
  if (!Array.isArray(slugs) || slugs.length === 0) return [];
  const valid = new Set(
    (await pg`SELECT slug FROM categories WHERE implemented AND active`).map((r: { slug: string }) => r.slug)
  );
  return [...new Set(slugs.filter((s) => typeof s === 'string' && valid.has(s)))];
}

// Only the circle's creator may change its focus.
export async function setCircleCategories(userId: string, circleId: string, categories: string[]): Promise<boolean> {
  const owner = await pg`SELECT 1 FROM circles WHERE id = ${circleId} AND created_by = ${userId} LIMIT 1`;
  if (owner.length === 0) return false;
  const cats = await validCategorySlugs(categories);
  await pg`UPDATE circles SET categories = ${JSON.stringify(cats)}::jsonb WHERE id = ${circleId}`;
  return true;
}

// Join by code. Returns the circle id, or null if the code is unknown.
export async function joinCircle(userId: string, code: string, displayName: string): Promise<string | null> {
  const normalized = (code || '').trim().toUpperCase().slice(0, 12);
  const rows = await pg`SELECT id FROM circles WHERE code = ${normalized} LIMIT 1`;
  if (rows.length === 0) return null;
  const circleId = (rows as { id: string }[])[0].id;
  const dn = (displayName || 'Member').slice(0, 40);
  await pg`
    INSERT INTO circle_members (circle_id, user_id, display_name)
    VALUES (${circleId}, ${userId}, ${dn})
    ON CONFLICT (circle_id, user_id) DO NOTHING
  `;
  return circleId;
}

export async function leaveCircle(userId: string, circleId: string): Promise<void> {
  await pg`DELETE FROM circle_members WHERE circle_id = ${circleId} AND user_id = ${userId}`;
}

export async function setSharing(
  userId: string,
  circleId: string,
  shareActivity: boolean,
  shareRatings: boolean
): Promise<void> {
  await pg`
    UPDATE circle_members SET share_activity = ${shareActivity}, share_ratings = ${shareRatings}
    WHERE circle_id = ${circleId} AND user_id = ${userId}
  `;
}

// The circles a user belongs to (id, code, name, member count).
export async function userCircles(userId: string): Promise<{ id: string; code: string; name: string; members: number }[]> {
  const rows = await pg`
    SELECT c.id, c.code, c.name, count(cm2.user_id)::int AS members
    FROM circle_members cm
    JOIN circles c ON c.id = cm.circle_id
    JOIN circle_members cm2 ON cm2.circle_id = c.id
    WHERE cm.user_id = ${userId}
    GROUP BY c.id, c.code, c.name
    ORDER BY c.created_at DESC
  `;
  return rows as { id: string; code: string; name: string; members: number }[];
}

// Full view of one circle, respecting each member's sharing prefs. The viewer must be a member.
export async function circleView(userId: string, circleId: string): Promise<CircleView | null> {
  const isMember = await pg`SELECT 1 FROM circle_members WHERE circle_id = ${circleId} AND user_id = ${userId} LIMIT 1`;
  if (isMember.length === 0) return null;

  const circle = await pg`SELECT id, code, name, categories, created_by AS "createdBy" FROM circles WHERE id = ${circleId} LIMIT 1`;
  if (circle.length === 0) return null;
  const c = (circle as { id: string; code: string; name: string; categories: string[]; createdBy: string | null }[])[0];

  const memberRows = await pg`
    SELECT cm.user_id AS "userId", cm.display_name AS "displayName",
           cm.share_activity AS "shareActivity", cm.share_ratings AS "shareRatings",
           -- activity: distinct active days in last 30, attempts
           (SELECT count(DISTINCT to_char(a.served_at, 'YYYY-MM-DD'))
              FROM attempts a WHERE a.user_id = cm.user_id AND a.status = 'answered'
                AND a.served_at > now() - interval '30 days')::int AS "daysLast30",
           (SELECT count(*) FROM attempts a WHERE a.user_id = cm.user_id AND a.status = 'answered')::int AS attempts,
           -- a simple global rating proxy: average of category ratings with enough attempts
           (SELECT round(avg(s.rating))::int FROM user_category_state s
              WHERE s.user_id = cm.user_id AND s.attempts_count >= 10 AND s.rating > 0) AS rating
    FROM circle_members cm
    WHERE cm.circle_id = ${circleId}
    ORDER BY cm.joined_at
  `;

  // current run (consecutive days ending today/yesterday) computed per member in JS for clarity
  const dayMs = 864e5;
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

  const members: CircleMember[] = [];
  let totalAttempts = 0;
  for (const m of memberRows as {
    userId: string; displayName: string; shareActivity: boolean; shareRatings: boolean;
    daysLast30: number; attempts: number; rating: number | null;
  }[]) {
    totalAttempts += m.attempts ?? 0;
    const isYou = m.userId === userId;

    // current run
    let currentRun: number | null = null;
    if (m.shareActivity || isYou) {
      const days = await pg`
        SELECT DISTINCT to_char(served_at, 'YYYY-MM-DD') AS day
        FROM attempts WHERE user_id = ${m.userId} AND status = 'answered'
        ORDER BY day DESC LIMIT 60
      `;
      const set = new Set((days as { day: string }[]).map((d) => d.day));
      let run = 0;
      const start = set.has(today.toISOString().slice(0, 10)) ? 0 : 1;
      for (let i = start; i < 400; i++) {
        const d = new Date(today.getTime() - i * dayMs).toISOString().slice(0, 10);
        if (set.has(d)) run++;
        else if (i >= start) break;
      }
      currentRun = run;
    }

    const showActivity = m.shareActivity || isYou;
    const showRatings = m.shareRatings || isYou;
    members.push({
      displayName: m.displayName || 'Member',
      isYou,
      shareActivity: m.shareActivity,
      shareRatings: m.shareRatings,
      daysLast30: showActivity ? m.daysLast30 : null,
      currentRun: showActivity ? currentRun : null,
      attempts: showActivity ? m.attempts : null,
      rating: showRatings ? m.rating : null
    });
  }

  return {
    id: c.id, code: c.code, name: c.name,
    categories: Array.isArray(c.categories) ? c.categories : [],
    isAdmin: c.createdBy === userId,
    members, totalAttempts
  };
}
