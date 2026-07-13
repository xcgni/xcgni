// Curated session tags, grouped to avoid choice-overload (a flat list of 70 kills logging). These
// are PRIVATE self-tracking labels - used only for the user's own "how do I do on X days" analysis,
// never in cross-user aggregates. Trimmed from a larger list to remove near-duplicates and keep each
// tag distinct and high-signal. Slugs are stable; labels are what the user sees.

export interface TagGroup {
  key: string;
  label: string;
  tags: { slug: string; label: string }[];
}

export const TAG_GROUPS: TagGroup[] = [
  {
    key: 'sleep',
    label: 'Sleep',
    // hours + nap live in the questionnaire (asked, not tagged); only the QUALITY
    // dimension the numbers cannot carry stays here
    tags: [
      { slug: 'interrupted-sleep', label: 'Interrupted sleep' }
    ]
  },
  {
    key: 'intake',
    label: 'Food & drink',
    tags: [
      // caffeine amount lives in the questionnaire ordinal; these carry what it cannot
      { slug: 'alcohol-yesterday', label: 'Alcohol yesterday' },
      { slug: 'fasting', label: 'Fasting' },
      { slug: 'large-meal', label: 'Large meal' }
    ]
  },
  {
    key: 'body',
    label: 'Body',
    tags: [
      { slug: 'exercise', label: 'Exercise' },
      { slug: 'strength', label: 'Strength training' },
      { slug: 'cardio', label: 'Cardio' },
      { slug: 'physically-tired', label: 'Physically exhausted' },
      { slug: 'sick', label: 'Sick' },
      { slug: 'headache', label: 'Headache' },
      { slug: 'pain', label: 'Pain / injury' },
      { slug: 'medication', label: 'Medication' }
    ]
  },
  {
    key: 'mind',
    label: 'Mind',
    tags: [
      { slug: 'calm', label: 'Calm' },
      { slug: 'motivated', label: 'Motivated' },
      { slug: 'stressed', label: 'Stressed' },
      { slug: 'anxious', label: 'Anxious' },
      { slug: 'irritable', label: 'Irritable' },
      { slug: 'burned-out', label: 'Burned out' },
      { slug: 'distracted', label: 'Distracted' }
    ]
  },
  {
    key: 'context',
    label: 'Day & setting',
    tags: [
      { slug: 'music', label: 'Music playing' },
      { slug: 'after-work', label: 'Right after work' },
      { slug: 'after-conversation', label: 'After a long conversation' },
      { slug: 'deep-work', label: 'Deep work' },
      { slug: 'busy-day', label: 'Busy workday' },
      { slug: 'studying', label: 'Studying' },
      { slug: 'deadline', label: 'Deadline / exam' },
      { slug: 'day-off', label: 'Day off' },
      { slug: 'traveling', label: 'Traveling' },
      { slug: 'quiet', label: 'Quiet' },
      { slug: 'noisy', label: 'Noisy' },
      { slug: 'outdoors', label: 'Outdoors' }
    ]
  },
  {
    key: 'intent',
    label: 'This session',
    tags: [
      { slug: 'just-woke', label: 'Right after waking' },
      { slug: 'before-bed', label: 'Before bed' },
      { slug: 'warm-up', label: 'Warm-up' },
      { slug: 'pushing', label: 'Challenging myself' },
      { slug: 'new-strategy', label: 'Testing a strategy' },
      { slug: 'marathon', label: 'Marathon session' }
    ]
  }
];

// Retired from the UI (they duplicated questionnaire dimensions - sleep hours, the
// caffeine ordinal, alertness, or derivable facts like first-session-of-day). Historical
// rows keep them valid and labeled; new sessions can no longer select them. Slugs are
// never reused for new meanings.
export const LEGACY_TAGS: { slug: string; label: string }[] = [
  { slug: 'poor-sleep', label: 'Poor sleep' },
  { slug: 'good-sleep', label: 'Good sleep' },
  { slug: 'short-sleep', label: 'Short sleep' },
  { slug: 'long-sleep', label: 'Long sleep' },
  { slug: 'nap', label: 'Napped today' },
  { slug: 'coffee', label: 'Coffee' },
  { slug: 'high-caffeine', label: 'High caffeine' },
  { slug: 'energy-drink', label: 'Energy drink' },
  { slug: 'hungry', label: 'Hungry' },
  { slug: 'hydrated', label: 'Well hydrated' },
  { slug: 'dehydrated', label: 'Dehydrated' },
  { slug: 'tired', label: 'Tired' },
  { slug: 'happy', label: 'Happy' },
  { slug: 'first-today', label: 'First session today' }
];

// Flat set of valid slugs for server-side validation (current + legacy).
export const VALID_TAG_SLUGS = new Set([
  ...TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.slug)),
  ...LEGACY_TAGS.map((t) => t.slug)
]);

// Map slug -> label for display (e.g. on best/worst day chips), legacy included.
export const TAG_LABELS: Record<string, string> = Object.fromEntries([
  ...TAG_GROUPS.flatMap((g) => g.tags.map((t) => [t.slug, t.label])),
  ...LEGACY_TAGS.map((t) => [t.slug, t.label])
]);
