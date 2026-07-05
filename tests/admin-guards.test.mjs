// Admin-guard regression checks (v0.66.0). Two rules, both static, both born from a real
// hole: when isAdmin() became async (DB-backed sessions), ten call sites kept calling it
// without await - and a Promise is always truthy, so every one of those checks silently
// passed for everyone. Layout guards do NOT cover form actions or +server.ts endpoints,
// so each must carry its own awaited check.
//   node tests/admin-guards.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); } }

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.ts') || f.endsWith('.svelte')) out.push(p);
  }
  return out;
}

// Rule 1: every isAdmin( call anywhere in src is awaited (or is the definition/export).
const srcFiles = walk(join(ROOT, 'src'));
let unawaited = [];
for (const f of srcFiles) {
  const txt = readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('isAdmin(')) return;
    if (/await\s+isAdmin\(/.test(line)) return;
    if (/function isAdmin\(/.test(line)) return; // the definition
    if (/import .*isAdmin/.test(line)) return;
    unawaited.push(`${f}:${i + 1}`);
  });
}
for (const u of unawaited) console.log('  un-awaited isAdmin:', u);
ok('every isAdmin() call site is awaited', unawaited.length === 0);

// Rule 2: every server file under /admin (except login/logout and the layout itself)
// contains its own isAdmin reference - layout redirects do not protect actions or
// GET/POST handlers in +server.ts.
const adminDir = join(ROOT, 'src', 'routes', 'admin');
const adminServer = walk(adminDir).filter((f) =>
  (f.endsWith('+page.server.ts') || f.endsWith('+server.ts')) &&
  !f.includes('/login/') && !f.includes('/logout/') &&
  !f.endsWith('+layout.server.ts'));
let unguarded = [];
for (const f of adminServer) {
  const txt = readFileSync(f, 'utf8');
  if (!txt.includes('isAdmin')) unguarded.push(f);
}
for (const u of unguarded) console.log('  admin server file without its own guard:', u);
ok(`every admin server file carries its own guard (${adminServer.length} files)`, unguarded.length === 0);

// Rule 3: raw bearer tokens never go to the DB - inserts into auth_sessions/magic_links
// must pass through tokenHash().
const auth = readFileSync(join(ROOT, 'src', 'lib', 'server', 'auth', 'index.ts'), 'utf8');
ok('session insert stores tokenHash', /insert\(authSessions\)\.values\(\{[^}]*token:\s*tokenHash\(/s.test(auth));
ok('magic link insert stores tokenHash', /insert\(magicLinks\)\.values\(\{[^}]*token:\s*tokenHash\(/s.test(auth));
ok('session lookup hashes the cookie', /eq\(authSessions\.token,\s*tokenHash\(/.test(auth));
ok('magic link consume hashes the token', /token\s*=\s*\$\{tokenHash\(/.test(auth));

console.log(`\nAdmin-guard tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL ADMIN-GUARD TESTS PASSED' : 'ADMIN-GUARD TESTS FAILED');
if (fail > 0) process.exit(1);
