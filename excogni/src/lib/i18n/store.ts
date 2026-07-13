// Client-side locale store + t helper. The layout seeds it from server data; the
// switcher writes the cookie and reloads data so server-rendered strings follow.
import { writable, derived } from 'svelte/store';
import { translate, type Locale } from './index.ts';
import type { Messages } from './en.ts';

export const locale = writable<Locale>('en');

export const t = derived(locale, (l) =>
  (key: keyof Messages, params?: Record<string, string | number>) => translate(l, key, params)
);
