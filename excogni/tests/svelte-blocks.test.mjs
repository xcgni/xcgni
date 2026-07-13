// Svelte block-structure parser (27th suite): counting is not parsing. A stack walk over
// every template's {#if/#each/#key/#await ... {:else ... {/...} tokens; any orphan,
// mismatch, or leftover open block fails with file and line. Born from a shipped
// {:else}-outside-block build failure that global tag COUNTS could not see.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
let pass = 0, fail = 0;
function files(dir){let o=[];for(const f of readdirSync(dir)){const p=join(dir,f);const s=statSync(p);
 if(s.isDirectory())o=o.concat(files(p));else if(f.endsWith('.svelte'))o.push(p);}return o;}
const OPEN=/^\{#(if|each|key|await)\b/, MID=/^\{:(else|then|catch)\b/, CLOSE=/^\{\/(if|each|key|await)\}/;
for (const f of [...files('src/routes'), ...files('src/lib/components')]) {
  const src = readFileSync(f, 'utf8');
  // strip script/style so JS braces don't confuse the walk
  const tpl = src.replace(/<script[\s\S]*?<\/script>/g, m => m.replace(/[^\n]/g, ' '))
                 .replace(/<style[\s\S]*?<\/style>/g, m => m.replace(/[^\n]/g, ' '));
  const stack = []; let ok = true; let msg = '';
  const line = (i) => tpl.slice(0, i).split('\n').length;
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] !== '{') continue;
    const rest = tpl.slice(i, i + 12);
    let m;
    if ((m = OPEN.exec(rest))) stack.push({ kind: m[1], line: line(i) });
    else if ((m = MID.exec(rest))) {
      if (!stack.length) { ok = false; msg = `{:${m[1]}} outside any block at line ${line(i)}`; break; }
    } else if ((m = CLOSE.exec(rest))) {
      const top = stack.pop();
      if (!top || top.kind !== m[1]) { ok = false; msg = `{/${m[1]}} mismatch at line ${line(i)} (open was ${top ? top.kind + '@' + top.line : 'none'})`; break; }
    }
  }
  if (ok && stack.length) { ok = false; msg = `unclosed {#${stack[stack.length-1].kind}} from line ${stack[stack.length-1].line}`; }
  if (ok) pass++; else { fail++; console.log('  FAIL:', f, '-', msg); }
}
console.log(`\nsvelte-blocks: ${pass} files clean, ${fail} broken`);
console.log(fail === 0 ? 'ALL SVELTE-BLOCK TESTS PASSED' : 'SVELTE-BLOCK TESTS FAILED');
if (fail > 0) process.exit(1);
