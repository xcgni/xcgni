/** English - the canonical catalog. Every key exists here; other locales may omit keys
 * (English fallback) but may never add keys that do not exist here (parity test). */
export const en = {
  // nav & layout
  'nav.practice': 'Practice',
  'nav.stats': 'Stats',
  'nav.experimental': 'Experimental',
  'nav.review': 'Review',
  'nav.settings': 'Settings',
  'nav.account': 'Account',
  'nav.anonymous': 'Anonymous',
  'nav.login': 'Log in / register',
  'nav.logout': 'Log out',
  'nav.language': 'Language',

  // landing
  'landing.tagline': 'A cognitive gym that measures honestly.',
  'landing.start': 'Proceed without account',
  'landing.login': 'Log in',
  'landing.learnMore': 'Learn more →',

  // practice hub
  'hub.practice': 'Practice',
  'hub.startMixed': 'Start mixed practice',
  'hub.dailyPulse': 'Daily pulse',
  'hub.pulseTitle': 'Ninety seconds, three items - the daily ritual',

  // pulse
  'pulse.title': 'Daily pulse',
  'pulse.subtitle': 'Ninety seconds. Three items.',
  'pulse.daysPracticed': 'days practiced',
  'pulse.countNote': 'A count, not a streak. Missing a day breaks nothing - every day you show up is one more point in your stream.',
  'pulse.todayDone': "Today's pulse is done. Come back tomorrow, or take a full session.",
  'pulse.seeStream': 'See your stream',
  'pulse.fullSession': 'Full session',
  'pulse.start': "Start today's pulse",
  'pulse.startNote': 'Three adaptive items from your faculties. No timer pressure beyond the tasks themselves.',

  // run page core
  'run.level': 'level',
  'run.next': 'Next →',
  'run.finish': 'Finish session →',
  'run.levelUp': 'Level-up question →',
  'run.submit': 'Submit',
  'run.skip': 'Skip',
  'run.gotIt': 'Got it',
  'run.undo': 'Undo',
  'run.reset': 'Reset',
  'run.moves': 'moves',
  'run.sessionComplete': 'Regular session complete',
  'run.done': 'done',
  'run.sessionCompleteNote': "That's a focused set. You can keep going, review what you just did, or stop here - all of it counts.",
  'run.keepPracticing': 'Keep practicing',
  'run.seeSummary': 'See summary',
  'run.stats': 'Stats',
  'run.pulseComplete': 'Pulse complete',
  'run.pulseNote': 'Ninety seconds, measured and counted. Every day you show up adds a point to your stream - there is no chain to break.',

  // scoring chips (server-rendered)
  'scoring.deliberate': 'no clock · quality of solution scored',
  'scoring.fluency': 'valid answers counted · fixed time window',
  'scoring.errorRank': 'closeness scored · pace noted',
  'scoring.default': 'accuracy scored · pace scored, no visible clock',
  'scoring.tooltip': 'Every item states how it is scored - nothing is measured silently. Formulas: /methodology',

  // first-encounter intros
  'intro.numeric': 'Type the answer as a number. Pace matters on timed items, but there is no visible clock - work at your natural speed.',
  'intro.twoChoice': 'Two options - pick the one the instruction asks for. Keyboard 1 and 2 work.',
  'intro.mcText': 'Pick the correct option. Keyboard digits work.',
  'intro.mcSvg': 'Pick the figure the instruction asks for. Keyboard digits work.',
  'intro.recall': 'Digits appear briefly, then disappear - type them from memory once the field shows.',
  'intro.fluency': 'Type as many valid answers as you can, one per entry, before the window ends. Variants and near-misses of the SAME answer count once.',
  'intro.numberPath': 'Plan a route from the start number to the target using the allowed steps. No clock - shorter plans score higher.',
  'intro.stepOrder': 'Put the lettered steps into a workable order - each step must be possible after the ones before it. Tap the steps or type the letters. No clock.',
  'intro.gridPath': 'Plan a route from S to T around the walls. Tap the direction chips or type moves. No clock - shorter routes score higher.',
  'intro.hanoi': 'Move the whole tower to peg C. Tap a peg to lift its top disk, tap another to place it - never a larger disk on a smaller one. No clock - fewer moves score higher.'
} as const;

export type Messages = { [K in keyof typeof en]: string };
