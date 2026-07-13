// i18n (v1.13.0): catalog parity + fallback + interpolation. Bare node, no deps.
//   node --experimental-strip-types tests/i18n.test.mjs
import { en } from '../src/lib/i18n/en.ts';
import { hr } from '../src/lib/i18n/hr.ts';
import { de } from '../src/lib/i18n/de.ts';
import { translate, pickLocale } from '../src/lib/i18n/index.ts';

let pass = 0, fail = 0;
const ok = (name, cond, d = '') => { if (cond) pass++; else { fail++; console.log('  FAIL:', name, d); } };

const enKeys = new Set(Object.keys(en));
for (const [name, cat] of [['hr', hr], ['de', de]]) {
  const ghost = Object.keys(cat).filter((k) => !enKeys.has(k));
  ok(`${name}: no keys outside the canonical set`, ghost.length === 0, ghost.join(','));
  const coverage = Object.keys(cat).length / enKeys.size;
  ok(`${name}: full coverage of Phase A keys`, coverage === 1, `${Math.round(coverage * 100)}%`);
  const empty = Object.entries(cat).filter(([, v]) => !String(v).trim()).map(([k]) => k);
  ok(`${name}: no empty translations`, empty.length === 0, empty.join(','));
}

// house rule holds in every language: no em/en dashes
for (const [name, cat] of [['en', en], ['hr', hr], ['de', de]]) {
  const bad = Object.entries(cat).filter(([, v]) => /[\u2013\u2014]/.test(String(v))).map(([k]) => k);
  ok(`${name}: no em/en dashes`, bad.length === 0, bad.join(','));
}

ok('fallback: unknown-locale-key falls to en', translate('hr', 'nav.practice') === 'Vježbanje' && translate('de', 'nav.stats') === 'Statistik');
ok('translate en baseline', translate('en', 'run.next') === 'Next →');
ok('pickLocale: cookie wins', pickLocale('hr', 'de-DE,de;q=0.9') === 'hr');
ok('pickLocale: accept-language parsed', pickLocale(undefined, 'de-AT,de;q=0.9,en;q=0.5') === 'de');
ok('pickLocale: default en', pickLocale(undefined, 'fr-FR') === 'en');
ok('pickLocale: garbage cookie ignored', pickLocale('xx', 'hr') === 'hr');

console.log(`\ni18n tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL I18N TESTS PASSED' : 'I18N TESTS FAILED');
if (fail > 0) process.exit(1);
