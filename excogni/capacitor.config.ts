import type { CapacitorConfig } from '@capacitor/cli';

// GENERATED for variant "serious" by scripts/make-variant.mjs - do not edit by hand.
// Re-run `node scripts/make-variant.mjs serious` to regenerate.
const config: CapacitorConfig = {
  appId: 'dev.initsix.excogni',
  appName: 'Excogni',
  webDir: 'capacitor-shell',
  server: {
    errorPath: 'error.html',
    url: 'https://xcgni.com?variant=serious',
    allowNavigation: ['xcgni.com', '*.xcgni.com']
  },
  backgroundColor: '#0A0C10',
  ios: { backgroundColor: '#0A0C10' },
  android: { backgroundColor: '#0A0C10' },
  plugins: {
    SplashScreen: { backgroundColor: '#0A0C10', showSpinner: false, launchAutoHide: true },
    StatusBar: { style: 'DARK', backgroundColor: '#0A0C10' }
  }
};

export default config;
