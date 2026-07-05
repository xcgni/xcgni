// Runs every .sql file in /migrations in filename order, recording applied ones.
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }

const sql = postgres(url, { max: 1, onnotice: () => {} });

const main = async () => {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const applied = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));
  const files = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (applied.has(f)) { console.log(`skip   ${f}`); continue; }
    const body = readFileSync(join(ROOT, 'migrations', f), 'utf8');
    // each migration runs in its own transaction: if any statement fails the whole file rolls back,
    // so a migration is never left half-applied (and isn't recorded as applied).
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO _migrations (name) VALUES (${f})`;
    });
    console.log(`apply  ${f}`);
  }
  await sql.end();
};

main().catch((e) => { console.error(e); process.exit(1); });
