import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import {
  challengeOverview, listChallenges, setChallengeActive, setCategoryActive,
  setChallengeTier, updateChallenge, addChallenge, parseJsonFields, RENDERER_TYPES
} from '$lib/server/admin/challenges';
import { implementedCategories } from '$lib/server/challenges';

export const load: PageServerLoad = async ({ url, cookies }) => {
  // the /admin layout already gates access, but double-check for safety on this write-capable page
  if (!(await isAdmin(cookies))) return { overview: [], categories: [], renderers: RENDERER_TYPES, selected: null, list: null };

  const overview = await challengeOverview();
  const categories = await implementedCategories();
  const selected = url.searchParams.get('cat');
  const level = url.searchParams.get('level');
  const activeOnly = url.searchParams.get('active') === '1';
  const search = url.searchParams.get('q');
  const page = Math.max(0, parseInt(url.searchParams.get('p') ?? '0', 10) || 0);
  const pageSize = 50;

  let list = null;
  if (selected) {
    const res = await listChallenges({
      category: selected,
      level: level ? parseInt(level, 10) : null,
      activeOnly,
      search,
      limit: pageSize,
      offset: page * pageSize
    });
    list = { ...res, page, pageSize, level: level ? parseInt(level, 10) : null, activeOnly, search: search ?? '' };
  }

  return { overview, categories, renderers: RENDERER_TYPES, selected, list };
};



export const actions: Actions = {
  toggle: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const id = String(f.get('id') ?? '');
    const active = f.get('active') === 'true';
    if (!id) return fail(400, { error: 'Missing id.' });
    await setChallengeActive(id, active);
    return { toggled: true };
  },

  bulkToggle: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const category = String(f.get('category') ?? '');
    const active = f.get('active') === 'true';
    const levelRaw = String(f.get('level') ?? '');
    const level = levelRaw ? parseInt(levelRaw, 10) : null;
    if (!category) return fail(400, { error: 'Missing category.' });
    const n = await setCategoryActive(category, active, level);
    return { bulkToggled: n };
  },

  tier: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const id = String(f.get('id') ?? '');
    const tier = String(f.get('tier') ?? '');
    if (!id || (tier !== 'canonical' && tier !== 'experimental')) return fail(400, { error: 'Bad tier request.' });
    await setChallengeTier(id, tier);
    return { tierSet: true };
  },

  edit: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const id = String(f.get('id') ?? '');
    const challengeType = String(f.get('challengeType') ?? '').trim();
    const level = parseInt(String(f.get('level') ?? ''), 10);
    const rendererType = String(f.get('rendererType') ?? '').trim();
    if (!id || !challengeType || !rendererType || !Number.isFinite(level)) {
      return fail(400, { error: 'All of id, challengeType, level, rendererType are required.', editId: id });
    }
    if (!RENDERER_TYPES.includes(rendererType)) {
      return fail(400, { error: `Unknown renderer "${rendererType}". The practice page can't draw it.`, editId: id });
    }
    const parsed = parseJsonFields({
      promptData: String(f.get('promptData') ?? ''),
      answerData: String(f.get('answerData') ?? ''),
      scoringConfig: String(f.get('scoringConfig') ?? '')
    });
    if (!parsed.ok) return fail(400, { error: parsed.error, editId: id });
    await updateChallenge(id, {
      challengeType, level, rendererType,
      promptData: parsed.promptData, answerData: parsed.answerData, scoringConfig: parsed.scoringConfig
    });
    return { edited: id };
  },

  add: async ({ request, cookies }) => {
    if (!(await isAdmin(cookies))) return fail(401, { error: 'Not authorised.' });
    const f = await request.formData();
    const categorySlug = String(f.get('categorySlug') ?? '').trim();
    const challengeType = String(f.get('challengeType') ?? '').trim();
    const level = parseInt(String(f.get('level') ?? ''), 10);
    const rendererType = String(f.get('rendererType') ?? '').trim();
    if (!categorySlug || !challengeType || !rendererType || !Number.isFinite(level)) {
      return fail(400, { error: 'Category, type, level and renderer are all required.', addOpen: true });
    }
    if (!RENDERER_TYPES.includes(rendererType)) {
      return fail(400, { error: `Unknown renderer "${rendererType}".`, addOpen: true });
    }
    if (level < 1 || level > 20) return fail(400, { error: 'Level must be 1-20.', addOpen: true });
    const parsed = parseJsonFields({
      promptData: String(f.get('promptData') ?? ''),
      answerData: String(f.get('answerData') ?? ''),
      scoringConfig: String(f.get('scoringConfig') ?? '')
    });
    if (!parsed.ok) return fail(400, { error: parsed.error, addOpen: true });
    const id = await addChallenge({
      categorySlug, challengeType, level, rendererType,
      promptData: parsed.promptData, answerData: parsed.answerData, scoringConfig: parsed.scoringConfig
    });
    return { added: id };
  }
};
