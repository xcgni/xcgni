// Native capability bridge. These calls only do something when the app is running inside
// the Capacitor native shell; on the plain web they no-op (and the imports are dynamic so
// the web build never needs the Capacitor packages installed).
//
// Keeping native features real (haptics, share, status bar) is also what makes the app a
// legitimate app for store review, not a bare webview wrapper.

export {}; // ensure this is treated as an ES module (the rest is dynamic-import based)

let isNativePromise: Promise<boolean> | null = null;

export async function isNative(): Promise<boolean> {
  if (!isNativePromise) {
    isNativePromise = (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor.isNativePlatform();
      } catch {
        return false; // web build, package not present
      }
    })();
  }
  return isNativePromise;
}

// subtle haptic on answer feedback (optional, restrained, on-brand)
export async function tapFeedback(ok: boolean): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ok ? ImpactStyle.Light : ImpactStyle.Medium });
  } catch {
    /* no-op */
  }
}

// native share sheet for the profile PNG (falls back to web share / nothing)
export async function shareImage(title: string, url: string): Promise<void> {
  if (await isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, url });
      return;
    } catch {
      /* fall through */
    }
  }
  // web fallback
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (d: unknown) => Promise<void> }).share({ title, url });
    } catch {
      /* user cancelled */
    }
  }
}

// hide the splash once the app is interactive
export async function hideSplash(): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* no-op */
  }
}

/** Android back button: go back in history when possible, otherwise minimise (never hard-exit). */
export async function registerBackButton(): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) window.history.back();
      else App.minimizeApp();
    });
  } catch { /* plugin absent on web builds - fine */ }
}

/** Keep the screen awake during timing-sensitive interactions (reaction trials). Uses the
 *  standard Wake Lock API (supported by the Android WebView), so no plugin is needed and the
 *  same call quietly works in desktop Chrome too. Always release when done. */
let wakeLock: { release: () => Promise<void> } | null = null;
export async function keepScreenAwake(on: boolean): Promise<void> {
  try {
    if (on) {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl && !wakeLock) wakeLock = await wl.request('screen');
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* unsupported or denied - the measurement still works, the screen may just dim */ }
}

/** Schedule the app's local notifications from the server's plan (see /api/notify/plan):
 *  one repeating daily reminder plus any one-shot conditionals. Cancels everything first so the
 *  schedule always mirrors the latest plan; caps are enforced server-side. No-op on the web. */
export async function syncNotificationSchedule(plan: {
  reminder: { enabled: boolean; time: string };
  conditionals: { id: number; at: string; title: string; body: string }[];
}): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return; // the user said no - respect it, no retries
    }
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);

    const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
    if (plan.reminder.enabled) {
      const [h, m] = plan.reminder.time.split(':').map((x) => parseInt(x, 10));
      toSchedule.push({
        id: 1,
        title: 'Excogni',
        body: 'Time to practice.',
        schedule: { on: { hour: h || 18, minute: m || 0 }, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon'
      });
    }
    for (const c of plan.conditionals ?? []) {
      const at = new Date(c.at);
      if (at.getTime() <= Date.now()) continue;
      toSchedule.push({ id: c.id, title: c.title, body: c.body, schedule: { at, allowWhileIdle: true }, smallIcon: 'ic_stat_icon' });
    }
    if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule });
  } catch { /* plugin absent (web) or blocked - never break the page over notifications */ }
}
