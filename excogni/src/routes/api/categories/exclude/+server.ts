import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { excludeCategory } from '$lib/server/sessions';

// POST { slug } - exclude this category from future practice. Mirrors the practice-page toggles
// (writes the same enabled-categories preference), so opting out mid-challenge sticks everywhere.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'not signed in');
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!slug) throw error(400, 'missing slug');
  const enabled = await excludeCategory(locals.user.id, slug);
  return json({ ok: true, enabled });
};
