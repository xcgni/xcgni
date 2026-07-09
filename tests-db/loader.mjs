// Node resolve hook mapping SvelteKit aliases for the DB integration tests (v1.4.0):
//   $lib/x                  -> src/lib/x(.ts|/index.ts)
//   $env/dynamic/private    -> tests-db/shims/env.mjs (process.env)
// Runs together with --experimental-strip-types, which handles the .ts parsing.
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_LIB = join(HERE, '..', 'src', 'lib');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '$env/dynamic/private') {
    return { url: pathToFileURL(join(HERE, 'shims', 'env.mjs')).href, shortCircuit: true };
  }
  if (specifier.startsWith('$lib/')) {
    const rest = specifier.slice('$lib/'.length);
    for (const cand of [`${rest}.ts`, join(rest, 'index.ts'), rest]) {
      const p = join(SRC_LIB, cand);
      if (existsSync(p)) return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    throw new Error(`loader: cannot resolve ${specifier}`);
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.includes('/src/lib/')) {
    const base = dirname(fileURLToPath(context.parentURL));
    for (const cand of [`${specifier}.ts`, join(specifier, 'index.ts')]) {
      const p = join(base, cand);
      if (existsSync(p)) return { url: pathToFileURL(p).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
