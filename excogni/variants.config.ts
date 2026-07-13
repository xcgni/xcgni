// App variants - define each flavor here, in ONE place. To add a new app, add an entry
// and run `node scripts/make-variant.mjs <key>` (see scripts/make-variant.mjs). All variants
// share the SAME backend (server.url); they differ only in identity, theme, and which
// features are on. This is positioning/packaging, not separate codebases.
//
// IMPORTANT (kids): the 'kids' variant is conservative by default - no questionnaire, no
// consent prompts, no data sharing, no account/social. The scaffold gives you the switches;
// real child-safety / COPPA / GDPR-K compliance is a separate, deliberate effort before any
// kids app ships. Do not treat the flag as making the app compliant on its own.

export interface AppVariant {
  key: string;            // short id, used for folder/build names
  appId: string;          // reverse-DNS bundle id (must be unique per app in the stores)
  appName: string;        // display name on the device
  serverUrl: string;      // the shared backend origin (same for all variants)
  theme: {
    bg: string;           // splash + status bar background
    statusBarStyle: 'DARK' | 'LIGHT';
  };
  features: {
    questionnaire: boolean;   // per-session state capture
    consentPrompts: boolean;  // research/data consent UI
    ambientSound: boolean;
    haptics: boolean;
    publicStats: boolean;     // link to the population statistics
    account: boolean;         // login / magic-link
  };
  // optional query string appended to serverUrl so the SAME backend can render a themed
  // skin per variant (e.g. ?variant=playful). The web app can read this to adjust tone.
  variantParam?: string;
}

export const VARIANTS: Record<string, AppVariant> = {
  // the default, serious instrument
  serious: {
    key: 'serious',
    appId: 'dev.initsix.excogni',
    appName: 'Excogni',
    serverUrl: 'https://xcgni.com',
    theme: { bg: '#0A0C10', statusBarStyle: 'DARK' },
    features: { questionnaire: true, consentPrompts: true, ambientSound: true, haptics: true, publicStats: true, account: true },
    variantParam: 'serious'
  },

  // a friendlier, lighter-touch flavor - same measurement, warmer presentation
  playful: {
    key: 'playful',
    appId: 'dev.initsix.excogni.play',
    appName: 'Mind Gym',
    serverUrl: 'https://xcgni.com',
    theme: { bg: '#12131A', statusBarStyle: 'DARK' },
    features: { questionnaire: true, consentPrompts: true, ambientSound: true, haptics: true, publicStats: true, account: true },
    variantParam: 'playful'
  },

  // conservative by default - see the warning at the top of this file
  kids: {
    key: 'kids',
    appId: 'dev.initsix.excogni.kids',
    appName: 'Brain Quest',
    serverUrl: 'https://xcgni.com',
    theme: { bg: '#1A1530', statusBarStyle: 'LIGHT' },
    features: { questionnaire: false, consentPrompts: false, ambientSound: true, haptics: true, publicStats: false, account: false },
    variantParam: 'kids'
  }
};

export function getVariant(key: string): AppVariant {
  const v = VARIANTS[key];
  if (!v) throw new Error(`Unknown variant "${key}". Known: ${Object.keys(VARIANTS).join(', ')}`);
  return v;
}
