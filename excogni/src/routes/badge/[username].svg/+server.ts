import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';
import { METHODOLOGY_VERSION } from '$lib/methodology';

/**
 * Embeddable badge: a compact SVG with the user's global rating and percentile, in the
 * instrument's own visual language. STRICTLY OPT-IN (user_settings.public_badge, default off):
 * this endpoint makes exactly two numbers publicly reachable by username, nothing else.
 * 404 for everyone who hasn't chosen it. Cached one hour.
 */
export const GET: RequestHandler = async ({ params, request }) => {
  const username = (params.username ?? '').toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(username)) return new Response('Not found', { status: 404 });

  const rows = await pg`
    SELECT u.id
    FROM users u
    JOIN user_settings s ON s.user_id = u.id AND s.public_badge = true
    WHERE lower(u.username) = ${username} AND u.is_anonymous = false AND u.is_test = false
    LIMIT 1
  `;
  if (rows.length === 0) return new Response('Not found', { status: 404 });
  const uid = rows[0].id;

  const me = await pg`
    SELECT avg(rating)::int AS r, count(*)::int AS n
    FROM user_category_state WHERE user_id = ${uid} AND attempts_count >= 10
  `;
  const rating = me[0]?.r ?? null;
  const cats = me[0]?.n ?? 0;
  // The pool is always real users only - a PUBLIC, shareable artifact never carries simulated
  // percentiles. Below the minimum pool it says so, with progress, instead of going mute.
  const pool = await pg`
    SELECT avg(s.rating)::int AS rating
    FROM user_category_state s
    JOIN users u ON u.id = s.user_id
    WHERE s.attempts_count >= 10 AND u.is_anonymous = false AND u.is_test = false AND u.is_simulated = false
    GROUP BY u.id
    HAVING count(*) >= 4
  `;
  let pctText: string;
  if (rating != null && cats >= 4 && pool.length >= 5) {
    const above = pool.filter((p: { rating: number }) => p.rating > rating).length;
    const pct = Math.round(((pool.length - above) / pool.length) * 100);
    pctText = `${pct}th percentile of ${pool.length} rated users`;
  } else if (rating != null && cats >= 4) {
    pctText = `percentile calibrating · pool ${pool.length}/5`;
  } else {
    pctText = `rating calibrating · ${cats}/4 domains rated`;
  }

  const ratingText = rating != null && cats >= 4 ? String(rating) : '···';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="64" role="img" aria-label="Excogni rating">
  <rect width="260" height="64" rx="3" fill="#0A0C10" stroke="#202733"/>
  <text x="14" y="24" font-family="ui-monospace,monospace" font-size="11" letter-spacing="3" fill="#E6E8EC">EXCOGNI</text>
  <text x="14" y="42" font-family="system-ui,sans-serif" font-size="9" fill="#8A93A6">${pctText}</text>
  <text x="14" y="55" font-family="system-ui,sans-serif" font-size="7" fill="#8A93A6">methodology ${METHODOLOGY_VERSION} · xcgni.com</text>
  <text x="246" y="40" text-anchor="end" font-family="ui-monospace,monospace" font-size="26" font-weight="600" fill="#E2A33B">${ratingText}</text>
</svg>`;
  // Content negotiation: an <img> asks for image/*, a person navigating asks for text/html.
  // Same URL serves both: the raw SVG for embeds, a small presentable page for humans.
  const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html');
  if (wantsHtml) {
    const esc = username.replace(/[^a-z0-9-]/g, '');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Excogni badge · ${esc}</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:#0A0C10;color:#8A93A6;font:14px system-ui,sans-serif}
img{width:min(390px,92vw);height:auto}code{display:block;max-width:92vw;overflow-wrap:anywhere;background:#11151C;border:1px solid #202733;border-radius:3px;padding:10px;font:11px ui-monospace,monospace;color:#8A93A6}
a{color:#E2A33B;text-decoration:none}a:hover{text-decoration:underline}</style></head>
<body>
<img src="/badge/${esc}.svg" alt="Excogni rating badge for ${esc}">
<code>&lt;img src="https://xcgni.com/badge/${esc}.svg" alt="Excogni rating" /&gt;</code>
<p>a live, self-updating badge · <a href="https://xcgni.com">xcgni.com</a></p>
</body></html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Vary': 'Accept' }
    });
  }
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600', 'Vary': 'Accept' }
  });
};
