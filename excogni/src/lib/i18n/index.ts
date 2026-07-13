/**
 * i18n (v1.13.0) - hand-rolled by design. A dependency-free typed catalog: no compiler,
 * no runtime library, fully greppable, testable with bare node - the house pattern.
 * UI language is deliberately SEPARATE from content language: a Croatian interface can
 * honestly serve the English challenge banks until native banks exist. Missing keys fall
 * back to English silently, so partially translated surfaces degrade gracefully.
 */
import { en, type Messages } from './en.ts';
import { hr } from './hr.ts';
import { de } from './de.ts';

export const LOCALES = ['en', 'hr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', hr: 'Hrvatski', de: 'Deutsch' };

const CATALOGS: Record<Locale, Partial<Messages>> = { en, hr, de };

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
}

/** Server-side: cookie wins, then Accept-Language, then English. */
export function pickLocale(cookieVal: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieVal)) return cookieVal;
  const al = (acceptLanguage ?? '').toLowerCase();
  for (const cand of al.split(',').map((s) => s.split(';')[0].trim())) {
    const base = cand.split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** Translate a key for a locale, English fallback, {param} interpolation. */
export function translate(locale: Locale, key: keyof Messages, params?: Record<string, string | number>): string {
  const raw = (CATALOGS[locale][key] ?? en[key]) as string;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, p) => (params[p] != null ? String(params[p]) : `{${p}}`));
}
