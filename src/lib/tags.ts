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
    tags: [
      { slug: 'poor-sleep', label: 'Poor sleep' },
      { slug: 'good-sleep', label: 'Good sleep' },
      { slug: 'short-sleep', label: 'Short sleep' },
      { slug: 'long-sleep', label: 'Long sleep' },
      { slug: 'interrupted-sleep', label: 'Interrupted sleep' },
      { slug: 'nap', label: 'Napped today' }
    ]
  },
  {
    key: 'intake',
    label: 'Food & drink',
    tags: [
      { slug: 'coffee', label: 'Coffee' },
      { slug: 'high-caffeine', label: 'High caffeine' },
      { slug: 'energy-drink', label: 'Energy drink' },
      { slug: 'alcohol-yesterday', label: 'Alcohol yesterday' },
      { slug: 'fasting', label: 'Fasting' },
      { slug: 'large-meal', label: 'Large meal' },
      { slug: 'hungry', label: 'Hungry' },
      { slug: 'hydrated', label: 'Well hydrated' },
      { slug: 'dehydrated', label: 'Dehydrated' }
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
      { slug: 'happy', label: 'Happy' },
      { slug: 'calm', label: 'Calm' },
      { slug: 'motivated', label: 'Motivated' },
      { slug: 'tired', label: 'Tired' },
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
      { slug: 'first-today', label: 'First session today' },
      { slug: 'marathon', label: 'Marathon session' }
    ]
  }
];

// Flat set of valid slugs for server-side validation.
export const VALID_TAG_SLUGS = new Set(TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.slug)));

// Map slug -> label for display (e.g. on best/worst day chips).
export const TAG_LABELS: Record<string, string> =
  Object.fromEntries(TAG_GROUPS.flatMap((g) => g.tags.map((t) => [t.slug, t.label])));
