import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';

// The public, indexable pages. Auth, admin, api and per-user views stay out by design.
const PAGES = ['', '/about', '/methodology', '/statistics', '/support', '/contributions', '/contribute', '/changelog', '/privacy'];

export const GET: RequestHandler = async () => {
  // Per-faculty explainers (/about/<slug>) are public, no-account pages - the site's most
  // indexable content. Pulled from the DB so a new category joins the sitemap automatically
  // (the category->page mapping is data, same ethos as the radar).
  let aboutPages: string[] = [];
  try {
    const rows = await pg`SELECT slug FROM categories WHERE active ORDER BY sort`;
    aboutPages = rows.map((r) => `/about/${r.slug}`);
  } catch {
    // best-effort: a DB hiccup should degrade to the static list, not 500 the sitemap
  }
  const urls = [...PAGES, ...aboutPages].map(
    (p) => `  <url><loc>https://xcgni.com${p}</loc><changefreq>weekly</changefreq></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
};
