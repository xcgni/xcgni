// i18n residue guard (v1.13.4): (1) no known-English literals in localized surfaces;
// (2) every $t('key') used in svelte exists in the EN catalog.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/lib/i18n/en.ts';
let pass=0, fail=0; const ok=(n,c,d='')=>{c?pass++:(fail++,console.log('  FAIL:',n,d));};
const DENY=['Your stats','just getting started','Save as image','you (now)','everyone (median)','Solid amber',
 'Regular session complete','Keep practicing','Ambient sound','in the zone','or press Enter','✓ Correct','✗ Incorrect',
 'Before you start','Hours slept','Caffeine today','Just woke','Prefer not to say','About you','Native language',
 'A gym for the mind','Start practicing','Back to practice','Still learning this one','Wait for amber',
 'Free &amp; open','Built by <a','days practiced</','Daily pulse<','Start mixed practice','stepping down to find','holding level','quick and right','A few optional questions','Why we ask'];
function files(dir){let o=[];for(const f of readdirSync(dir)){const p=join(dir,f);const s=statSync(p);
 if(s.isDirectory()&&!p.includes('admin')&&!p.includes('/about')&&!p.includes('/methodology')&&!p.includes('/privacy'))o=o.concat(files(p));else if(f.endsWith('.svelte'))o.push(p);}return o;}
const all=[...files('src/routes'),...files('src/lib/components')];
let hits=[];
for(const f of all){const s=readFileSync(f,'utf8');const noComments=s.split('\n').filter(l=>!l.trim().startsWith('//')&&!l.includes('<meta')&&!l.trim().startsWith('<!--')).join('\n');for(const d of DENY)if(noComments.includes(d))hits.push(f.split('src/')[1]+': '+d);}
ok('no denylisted English literals remain', hits.length===0, '\n    '+hits.join('\n    '));
let missing=[];
for(const f of all){const s=readFileSync(f,'utf8');
 for(const m of s.matchAll(/\$t\('([a-zA-Z0-9_.]+)'/g)) if(!(m[1] in en)) missing.push(f.split('src/')[1]+': '+m[1]);}
ok('every $t key used exists in EN catalog', missing.length===0, '\n    '+missing.join('\n    '));

// pin: the questionnaire quick row may only reference live vocabulary slugs
{
  const form = readFileSync('src/lib/components/SessionContextForm.svelte','utf8');
  const m = form.match(/QUICK_PICKS = \[([^\]]+)\]/);
  const picks = m ? [...m[1].matchAll(/'([a-z-]+)'/g)].map(x=>x[1]) : [];
  const tagsSrc = readFileSync('src/lib/tags.ts','utf8');
  const bad = picks.filter(p => !tagsSrc.includes("'" + p + "'"));
  if (m !== null && picks.length >= 6 && bad.length === 0) { pass++; }
  else { fail++; console.log('  FAIL: quick-row picks exist in vocabulary', bad.join(',')); }
}

console.log(`\ni18n-residue: ${pass} passed, ${fail} failed`);
console.log(fail===0?'ALL I18N-RESIDUE TESTS PASSED':'I18N-RESIDUE TESTS FAILED');
if(fail>0)process.exit(1);
