import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import { resolveAllFlags, setRuntimeFlag, clearRuntimeFlag, type RuntimeFlagKey } from '$lib/server/runtime-flags';
import { pg } from '$lib/server/db';

export const load: PageServerLoad = async ({ cookies }) => {
  if (!(await isAdmin(cookies))) return { flags: [], simCount: 0 };
  const flags = await resolveAllFlags();
  // how many simulated users currently exist (so admin knows what "mock data" means right now)
  const rows = await pg`SELECT count(*)::int AS n FROM users WHERE is_simulated = true`;
  const simCount = (rows as { n: number }[])[0]?.n ?? 0;
  return { flags, simCount };
};

export const actions: Actions = {
  set: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const key = String(f.get('key') ?? '') as RuntimeFlagKey;
    const value = f.get('value') === 'true';
    try {
      await setRuntimeFlag(key, value, 'admin');
      return { saved: key };
    } catch {
      return fail(400, { error: 'Unknown flag.' });
    }
  },

  reset: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const key = String(f.get('key') ?? '') as RuntimeFlagKey;
    await clearRuntimeFlag(key);
    return { reset: key };
  }
};
