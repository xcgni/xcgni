// Generate capacitor.config.ts for a given variant.
//   node scripts/make-variant.mjs serious     (default)
//   node scripts/make-variant.mjs playful
//   node scripts/make-variant.mjs kids
//
// Variants share ONE backend; they differ in id, name, theme, and feature flags. This
// writes capacitor.config.ts for the chosen variant, then you run the normal cap commands.
// To make several apps you generate one, `cap add`/`cap sync`/build, then generate the next.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// load variants.config.ts without a TS loader: read + strip the type bits we don't need by
// evaluating the exported object via a tiny regex-free approach - simplest is to keep a JSON
// mirror. To avoid drift, we parse the VARIANTS object out of the TS source.
const src = readFileSync(join(root, 'variants.config.ts'), 'utf8');

// crude but dependency-free: pull the VARIANTS literal and eval it in a sandboxed Function.
const match = src.match(/export const VARIANTS[^=]*=\s*(\{[\s\S]*?\n\});/);
if (!match) {
  console.error('Could not find VARIANTS in variants.config.ts');
  process.exit(1);
}
// strip TS type annotations inside the object literal (": '...'" stays; "as const" etc. removed)
const literal = match[1].replace(/\sas\s+\w+/g, '');
let VARIANTS;
try {
  VARIANTS = new Function(`return (${literal});`)();
} catch (e) {
  console.error('Failed to parse VARIANTS literal:', e.message);
  process.exit(1);
}

const key = process.argv[2] || 'serious';
const v = VARIANTS[key];
if (!v) {
  console.error(`Unknown variant "${key}". Known: ${Object.keys(VARIANTS).join(', ')}`);
  process.exit(1);
}

const urlWithVariant = v.variantParam
  ? `${v.serverUrl}${v.serverUrl.includes('?') ? '&' : '?'}variant=${v.variantParam}`
  : v.serverUrl;

const host = (() => {
  try { return new URL(v.serverUrl).host; } catch { return 'xcgni.com'; }
})();

const config = `import type { CapacitorConfig } from '@capacitor/cli';

// GENERATED for variant "${v.key}" by scripts/make-variant.mjs - do not edit by hand.
// Re-run \`node scripts/make-variant.mjs ${v.key}\` to regenerate.
const config: CapacitorConfig = {
  appId: '${v.appId}',
  appName: '${v.appName}',
  webDir: 'capacitor-shell',
  server: {
    errorPath: 'error.html',
    url: '${urlWithVariant}',
    allowNavigation: ['${host}', '*.${host}']
  },
  backgroundColor: '${v.theme.bg}',
  ios: { backgroundColor: '${v.theme.bg}' },
  android: { backgroundColor: '${v.theme.bg}' },
  plugins: {
    SplashScreen: { backgroundColor: '${v.theme.bg}', showSpinner: false, launchAutoHide: true },
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#E2A33B' },
    StatusBar: { style: '${v.theme.statusBarStyle}', backgroundColor: '${v.theme.bg}' }
  }
};

export default config;
`;

writeFileSync(join(root, 'capacitor.config.ts'), config);
console.log(`capacitor.config.ts written for variant "${v.key}" (${v.appName}, ${v.appId})`);
console.log(`  server: ${urlWithVariant}`);
console.log(`  features: ${Object.entries(v.features).filter(([, on]) => on).map(([k]) => k).join(', ') || 'none'}`);
console.log('');
console.log('Next: npx cap sync   (or, first time: npx cap add android / ios)');
