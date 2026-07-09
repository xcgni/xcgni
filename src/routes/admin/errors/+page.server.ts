import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import { errorGroups, errorOccurrences, setErrorGroupStatus } from '$lib/server/ops/error-groups';

// Grouped error triage (v1.1.0). Guarded like every admin surface: awaited isAdmin
// in the load AND in each action - defense in depth, the layout guard is not enough.

export const load: PageServerLoad = async ({ cookies, url }) => {
  if (!(await isAdmin(cookies))) throw error(404, 'Not found');

  const q = url.searchParams.get('q');
  const filterParam = url.searchParams.get('filter');
  const filter = (['active', 'resolved', 'ignored', 'all'] as const).includes(
    filterParam as 'active'
  )
    ? (filterParam as 'active' | 'resolved' | 'ignored' | 'all')
    : 'active';
  const sig = url.searchParams.get('sig');

  return {
    q: q ?? '',
    filter,
    sig,
    groups: await errorGroups({ q, filter }),
    occurrences: sig ? await errorOccurrences(sig) : null
  };
};

export const actions: Actions = {
  setStatus: async ({ cookies, request }) => {
    if (!(await isAdmin(cookies))) throw error(404, 'Not found');
    const form = await request.formData();
    const signature = String(form.get('signature') ?? '');
    const status = String(form.get('status') ?? '');
    if (!signature || !['open', 'resolved', 'ignored'].includes(status)) {
      return fail(400, { error: 'bad request' });
    }
    await setErrorGroupStatus(signature, status as 'open' | 'resolved' | 'ignored');
    return { ok: true };
  }
};
