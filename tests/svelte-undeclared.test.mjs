// The v0.64.26 spinner bug pinned as a permanent check: an assignment to an identifier that is
// never declared throws ReferenceError in strict-mode ESM, killing hydration before any
// try/catch. This scans every <script> block in every .svelte file for that class of failure.
//
// Aware of: multi-declarations (const a=1, b=2), TS type/interface aliases, destructuring,
// imports, function/arrow/catch params, Svelte reactive declarations ($: x = ...), for-of/in.
// Strings, template literals and comments are stripped first. The scanner is deliberately
// conservative: template-literal interpolations are stripped too, so an assignment hidden
// inside `${...}` escapes it - fail-safe in the false-positive direction, which is what a
// blocking check must be.
//
// Dependency-free, like the other suites: node tests/svelte-undeclared.test.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const KEYWORDS = new Set([
  'if', 'else', 'while', 'for', 'return', 'typeof', 'in', 'of', 'new', 'case', 'switch',
  'break', 'continue', 'do', 'try', 'catch', 'finally', 'throw', 'void', 'delete', 'instanceof',
  'this', 'super', 'null', 'true', 'false', 'undefined', 'default', 'export', 'import', 'async',
  'await', 'yield', 'static', 'get', 'set'
]);
const GLOBALS = new Set([
  'window', 'document', 'location', 'globalThis', 'navigator', 'history', 'console',
  'localStorage', 'sessionStorage', 'requestAnimationFrame', 'cancelAnimationFrame'
]);

function stripStringsAndComments(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') {
      const j = s.indexOf('\n', i);
      i = j < 0 ? n : j;
    } else if (c === '/' && s[i + 1] === '*') {
      const j = s.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2;
      out += ' ';
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c;
      let j = i + 1;
      while (j < n) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === q) break;
        j++;
      }
      out += q + q;
      i = j + 1;
    } else {
      out += c;
      // preserve line count for reporting
      i++;
    }
  }
  return out;
}

const IDENT = /[A-Za-z_$][\w$]*/g;

function collectDeclared(code) {
  const declared = new Set();
  const grab = (text) => {
    for (const m of text.matchAll(IDENT)) declared.add(m[0]);
  };
  // let/const/var - runs to the end of the statement so multi-declarations
  // (const a = 1, b = 2) and destructuring are fully covered. Grabbing every identifier in
  // the statement over-declares (RHS names too), which only makes the check MORE conservative.
  for (const m of code.matchAll(/\b(?:let|const|var)\b([^;\n]*)/g)) grab(m[1]);
  // TS type aliases and interfaces (not runtime, but harmless to declare)
  for (const m of code.matchAll(/\b(?:type|interface)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // function declarations + their params
  for (const m of code.matchAll(/\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) {
    if (m[1]) declared.add(m[1]);
    grab(m[2]);
  }
  // arrow params: (a, b = x) =>  and  a =>
  for (const m of code.matchAll(/\(([^()]*)\)\s*(?::[^=]*)?=>/g)) grab(m[1]);
  for (const m of code.matchAll(/(?<![\w$.)])([A-Za-z_$][\w$]*)\s*=>/g)) declared.add(m[1]);
  // catch (e)
  for (const m of code.matchAll(/\bcatch\s*\(\s*([^)]*)\)/g)) grab(m[1]);
  // imports
  for (const m of code.matchAll(/\bimport\s+([^'"]+?)\s+from\b/g)) grab(m[1]);
  // Svelte reactive declarations: $: x = ... declares x
  for (const m of code.matchAll(/\$:\s*([A-Za-z_$][\w$]*)\s*=(?![=>])/g)) declared.add(m[1]);
  // class names
  for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  return declared;
}

export function findUndeclaredAssignments(source, file = '<inline>') {
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const code = stripStringsAndComments(scripts.join('\n'));
  const declared = collectDeclared(code);
  const issues = [];
  for (const m of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?:=|\+=|-=|\*=|\/=|\|\|=|&&=|\?\?=)(?![=>])/g)) {
    const name = m[1];
    if (declared.has(name) || KEYWORDS.has(name) || GLOBALS.has(name)) continue;
    const line = code.slice(0, m.index).split('\n').length;
    issues.push({ file, name, line });
  }
  return issues;
}

// ---- self-test: the scanner must catch the exact v0.64.26 failure shape ----
let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}`); }
}

const buggy = `<script>
  let phase = 'loading';
  async function fetchNext() {
    excludedJustNow = null; // assignment survives, declaration was deleted (v0.64.26)
    phase = 'ready';
  }
</script>`;
ok(findUndeclaredAssignments(buggy).some((i) => i.name === 'excludedJustNow'),
  'catches assignment to a deleted declaration (the v0.64.26 class)');
ok(!findUndeclaredAssignments(buggy).some((i) => i.name === 'phase'),
  'declared variables pass');

const clean = `<script lang="ts">
  type Figure = { cells: number[][] };
  const padX = 48, headerH = 96, legendH = 30;
  let items: Figure[] = [];
  $: total = items.length;
  const fn = (a, b = 2) => { let c = a + b; c += 1; return c; };
  try { items = []; } catch (e) { console.log(e); }
  for (const it of items) { void it; }
  const s = \`template \${padX} literal\`;
</script>`;
ok(findUndeclaredAssignments(clean).length === 0,
  'multi-declarations, type aliases, $:, params, catch, template literals all pass');

// ---- the real scan: every .svelte in src must be clean ----
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, 'src'));
let repoIssues = [];
for (const f of files) {
  repoIssues = repoIssues.concat(findUndeclaredAssignments(readFileSync(f, 'utf8'), f));
}
for (const i of repoIssues) console.log(`FAIL ${i.file}:${i.line} assignment to undeclared '${i.name}'`);
ok(repoIssues.length === 0, `repo scan clean (${files.length} .svelte files)`);

console.log(fail === 0 ? '\nALL UNDECLARED-SCAN TESTS PASSED' : `\n${fail} FAILURES`);
if (fail > 0) process.exit(1);
