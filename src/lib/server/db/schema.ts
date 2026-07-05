import {
  pgTable, uuid, text, boolean, integer, real, timestamp, jsonb, primaryKey
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),           // legacy plaintext (no EMAIL_INDEX_KEY); nulled once hashed
  emailHash: text('email_hash').unique(),  // blind index: HMAC-SHA256(email, EMAIL_INDEX_KEY)
  emailHint: text('email_hint'),           // masked display form ("b…@g….com")
  username: text('username').unique(),
  passwordHash: text('password_hash'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  isTest: boolean('is_test').notNull().default(false),
  isSimulated: boolean('is_simulated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),                    // legacy plaintext mode only
  emailHash: text('email_hash'),
  emailHint: text('email_hint'),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const categories = pgTable('categories', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  implemented: boolean('implemented').notNull().default(false),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
  domain: text('domain'),
  about: text('about')
});

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  categorySlug: text('category_slug').notNull().references(() => categories.slug),
  challengeType: text('challenge_type').notNull(),
  level: integer('level').notNull(),
  rendererType: text('renderer_type').notNull(),
  promptData: jsonb('prompt_data').notNull(),
  answerData: jsonb('answer_data').notNull(),
  scoringConfig: jsonb('scoring_config').notNull(),
  version: integer('version').notNull().default(1),
  active: boolean('active').notNull().default(true),
  tier: text('tier').notNull().default('canonical'),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  observedMedianMs: integer('observed_median_ms'),
  bankKey: text('bank_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const practiceSessions = pgTable('practice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  timezone: text('timezone'),
  tzOffsetMin: integer('tz_offset_min'),
  // When the mixed run last handed off to a dedicated module (retention/reaction). Used to space
  // module bursts out, since those modules don't write to the attempts table.
  lastModuleAt: timestamp('last_module_at', { withTimezone: true }),
  // How many module hand-offs this session has had; each counts as one step of session progress.
  moduleHandoffs: integer('module_handoffs').notNull().default(0),
  // per-session category mutes; the generator subtracts these for the session's remainder
  skippedCategories: text('skipped_categories').array().notNull().default([]),
  // Which modules this session included (e.g. ['retention','reaction']), for the summary's story.
  modulesUsed: text('modules_used').array().notNull().default([])
});

export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => practiceSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  categorySlug: text('category_slug').notNull(),
  level: integer('level').notNull(),
  status: text('status').notNull().default('pending'),
  servedAt: timestamp('served_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  clientElapsedMs: integer('client_elapsed_ms'),
  serverElapsedMs: integer('server_elapsed_ms'),
  effectiveMs: integer('effective_ms'),
  answer: text('answer'),
  correct: boolean('correct'),
  score: real('score'),
  speedClass: text('speed_class'),
  ratingBefore: integer('rating_before'),
  ratingAfter: integer('rating_after'),
  estError: real('est_error'),
  localHour: integer('local_hour'),
  localDow: integer('local_dow'),
  localMonth: integer('local_month'),
  localDay: integer('local_day'),
  localWeek: integer('local_week'),
  localYear: integer('local_year'),
  // Phase A micro-signals (data-resolution plan): hesitation, edit trace, per-word fluency timing
  firstInputMs: integer('first_input_ms'),
  editsCount: integer('edits_count'),
  firstAnswerChanged: boolean('first_answer_changed'),
  wordTimes: jsonb('word_times'),
  rtFastMs: integer('rt_fast_ms'),
  rtSlowMs: integer('rt_slow_ms'),
  scoringModelVersion: integer('scoring_model_version').notNull().default(1),
  challengeVersion: integer('challenge_version'),
  sessionPosition: integer('session_position'),
  qualityFlags: text('quality_flags').array().notNull().default([]),
  inputMethod: text('input_method'),
  methodologyVersion: text('methodology_version')
});

export const userCategoryState = pgTable('user_category_state', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categorySlug: text('category_slug').notNull().references(() => categories.slug),
  currentLevel: integer('current_level').notNull().default(1),
  stableLevel: integer('stable_level').notNull().default(1),
  rating: integer('rating').notNull().default(0),
  attemptsCount: integer('attempts_count').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  peakRating: integer('peak_rating'),
  peakRatingAt: timestamp('peak_rating_at', { withTimezone: true }),
  maxLevel: integer('max_level'),
  maxLevelAt: timestamp('max_level_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.categorySlug] })
}));

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  enabledCategories: jsonb('enabled_categories').notNull().default([]),
  disabledCategories: jsonb('disabled_categories').notNull().default([]),
  sessionLength: integer('session_length').notNull().default(10),
  seenIntro: boolean('seen_intro').notNull().default(false),
  // App notification prefs (Android shell). All opt-in: Excogni does not nag by default.
  reminderEnabled: boolean('reminder_enabled').notNull().default(false),
  reminderTime: text('reminder_time').notNull().default('18:00'),
  conditionalEnabled: boolean('conditional_enabled').notNull().default(false),
  // Preferred retention decks (empty = all). Set at onboarding, editable in Settings.
  preferredDecks: text('preferred_decks').array().notNull().default([]),
  // Opt-in embeddable badge (default OFF: it makes rating+percentile publicly URL-reachable)
  publicBadge: boolean('public_badge').notNull().default(false),
  // "show less often": picker downweights these to ~35% frequency; restorable in Settings
  reducedCategories: text('reduced_categories').array().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// Immutable baselines: rating at first calibration per category. Write-once (ON CONFLICT DO
// NOTHING); the foundation of the baseline-vs-now split and the improvement distribution.
// Per-run reaction series (the band's raw material), for variance and fatigue-slope insights.
export const reactionRuns = pgTable('reaction_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  measuredMs: integer('measured_ms').array().notNull(),
  floorMs: integer('floor_ms'),
  bandFastMs: integer('band_fast_ms'),
  bandSlowMs: integer('band_slow_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const userCategoryBaseline = pgTable('user_category_baseline', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categorySlug: text('category_slug').notNull(),
  rating: integer('rating').notNull(),
  attemptsCount: integer('attempts_count').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.categorySlug] }) }));

export const userAttributes = pgTable('user_attributes', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  birthYear: integer('birth_year'),
  country: text('country'),
  city: text('city'),
  gender: text('gender'),
  education: text('education'),
  nativeLanguage: text('native_language'),
  handedness: text('handedness'),
  extTestType: text('ext_test_type'),
  extTestScore: integer('ext_test_score'),
  consentedStats: boolean('consented_stats').notNull().default(false),
  consentedData: boolean('consented_data').notNull().default(false),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  consentVersion: integer('consent_version'),
  ageBand: text('age_band'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const retentionCards = pgTable('retention_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deck: text('deck').notNull(),
  deckLabel: text('deck_label').notNull(),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull(),
  accepted: jsonb('accepted').notNull().default([]),
  note: text('note'),
  level: integer('level').notNull().default(1),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const userCardState = pgTable('user_card_state', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => retentionCards.id, { onDelete: 'cascade' }),
  ease: real('ease').notNull().default(2.5),
  intervalDays: real('interval_days').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  dueReviews: integer('due_reviews').notNull().default(0),
  dueHits: integer('due_hits').notNull().default(0)
});

export const userRtCalibration = pgTable('user_rt_calibration', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  floorMs: integer('floor_ms').notNull(),
  uncertaintyMs: integer('uncertainty_ms').notNull(),
  refreshHz: integer('refresh_hz'),
  samples: integer('samples').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const errorLog = pgTable('error_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  route: text('route'),
  message: text('message').notNull(),
  stack: text('stack'),
  status: integer('status'),
  userKind: text('user_kind'),
  seen: boolean('seen').notNull().default(false)
});

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  route: text('route'),
  kind: text('kind'),
  message: text('message').notNull(),
  resolved: boolean('resolved').notNull().default(false)
});

export const sessionContext = pgTable('session_context', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  localDate: text('local_date'),
  sleepHours: real('sleep_hours'),
  napped: boolean('napped'),
  rested: text('rested'),
  hoursAwake: integer('hours_awake'),
  caffeine: text('caffeine'),
  otherStimulant: boolean('other_stimulant'),
  alertness: text('alertness'),
  mood: text('mood'),
  deviceKind: text('device_kind'),
  // Optional self-tracking (migration 0029). Private to the user, never in aggregates.
  tags: text('tags').array(),
  note: text('note')
});

// A note attached retroactively to a specific local day - e.g. annotating a flagged best/worst
// performing day from the statistics page. Keyed by user + date (one note per day, upsert).
export const dayNote = pgTable('day_note', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // NB: the underlying column is Postgres `date`; declared as text here because all access is via
  // raw pg`` SQL (Postgres casts the 'YYYY-MM-DD' string automatically), not the Drizzle query
  // builder. Kept as text to avoid Drizzle's date<->Date coercion, which nothing needs.
  localDate: text('local_date').notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
