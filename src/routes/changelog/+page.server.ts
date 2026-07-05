import type { PageServerLoad } from './$types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The public changelog - the same file that ships in the repo, rendered as-is. It is the
// notification channel the privacy page promises, so it is not curated for the site.
// Parsed once per process (the file only changes with a deploy).

type Entry = { version: string; title: string; body: string };
let parsed: Entry[] | null = null;

function loadEntries(): Entry[] {
  if (parsed) return parsed;
  let raw = '';
  try {
    raw = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8');
  } catch {
    return (parsed = []);
  }
  const entries: Entry[] = [];
  const re = /^## (v[\d.]+)\s*-\s*(.*)$/gm;
  const matches = [...raw.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    entries.push({ version: m[1], title: m[2].trim(), body: raw.slice(start, end).trim() });
  }
  return (parsed = entries);
}

const DEFAULT_COUNT = 25;

export const load: PageServerLoad = async ({ url }) => {
  const all = url.searchParams.get('all') === '1';
  const entries = loadEntries();
  return {
    entries: all ? entries : entries.slice(0, DEFAULT_COUNT),
    total: entries.length,
    showingAll: all || entries.length <= DEFAULT_COUNT
  };
};
