import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import {
  createCircle, joinCircle, leaveCircle, setSharing, setCircleCategories, userCircles, circleView, circleStats
} from '$lib/server/circles';
import { flags } from '$lib/server/flags';
import { implementedCategories } from '$lib/server/challenges';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!flags.circlesEnabled()) return { enabled: false, signedIn: false, circles: [], view: null, allCategories: [] };
  if (!locals.user) return { enabled: true, signedIn: false, circles: [], view: null, allCategories: [] };

  const circles = await userCircles(locals.user.id);
  const viewId = url.searchParams.get('c');
  const view = viewId ? await circleView(locals.user.id, viewId) : null;
  const stats = viewId ? await circleStats(locals.user.id, viewId) : null;
  const cats = (await implementedCategories()).map((c) => ({ slug: c.slug, name: c.name }));
  return { enabled: true, signedIn: true, circles, view, stats, allCategories: cats };
};

function guard() {
  if (!flags.circlesEnabled()) throw redirect(303, '/');
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    guard();
    if (!locals.user) return fail(401, { error: 'Sign in to create a circle.' });
    const f = await request.formData();
    const name = String(f.get('name') ?? '').trim();
    const displayName = String(f.get('display_name') ?? '').trim();
    const categories = f.getAll('categories').map(String);
    if (!displayName) return fail(400, { error: 'Pick a name others will see.' });
    try {
      const code = await createCircle(locals.user.id, name, displayName, categories);
      return { created: code };
    } catch {
      return fail(500, { error: 'Could not create the circle, please retry.' });
    }
  },

  join: async ({ request, locals }) => {
    guard();
    if (!locals.user) return fail(401, { error: 'Sign in to join a circle.' });
    const f = await request.formData();
    const code = String(f.get('code') ?? '').trim();
    const displayName = String(f.get('display_name') ?? '').trim();
    const agreed = f.get('agree') === 'on';
    if (!code) return fail(400, { error: 'Enter a circle code.' });
    if (!displayName) return fail(400, { error: 'Pick a name others will see.' });
    if (!agreed) return fail(400, { error: 'Please agree to join so you know what is shared.' });
    const id = await joinCircle(locals.user.id, code, displayName);
    if (!id) return fail(404, { error: 'No circle with that code.' });
    return { joined: true };
  },

  categories: async ({ request, locals }) => {
    guard();
    if (!locals.user) return fail(401, { error: 'Not signed in.' });
    const f = await request.formData();
    const circleId = String(f.get('circle_id') ?? '');
    const categories = f.getAll('categories').map(String);
    const ok = circleId ? await setCircleCategories(locals.user.id, circleId, categories) : false;
    if (!ok) return fail(403, { error: 'Only the circle creator can change its focus.' });
    return { focusSaved: true };
  },

  leave: async ({ request, locals }) => {
    guard();
    if (!locals.user) return fail(401, { error: 'Not signed in.' });
    const f = await request.formData();
    const circleId = String(f.get('circle_id') ?? '');
    if (circleId) await leaveCircle(locals.user.id, circleId);
    return { left: true };
  },

  sharing: async ({ request, locals }) => {
    guard();
    if (!locals.user) return fail(401, { error: 'Not signed in.' });
    const f = await request.formData();
    const circleId = String(f.get('circle_id') ?? '');
    const shareActivity = f.get('share_activity') === 'on';
    const shareRatings = f.get('share_ratings') === 'on';
    if (circleId) await setSharing(locals.user.id, circleId, shareActivity, shareRatings);
    return { sharingSaved: true };
  }
};
