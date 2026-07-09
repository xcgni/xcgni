// Idempotent seed. Safe to run on every boot.
//   - categories: upserted always
//   - challenge bank: upserted by bank_key always
//   - simulated users:   only when ENABLE_SIMULATED_USERS=true
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });

const flag = (name) => (process.env[name] || '').toLowerCase() === 'true';

// deterministic PRNG so simulated populations are reproducible
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ABOUT = {
  numerical_fluency: "Numerical fluency is how quickly and accurately your mind handles numbers without reaching for a calculator. It underlies everyday estimation, budgeting, and any work with quantities. It is one of the most trainable faculties - speed here comes largely from practice and retrieval, and it is among the first things people outsource to devices, which is exactly why keeping it sharp matters.",
  pattern_recognition: "Pattern recognition is the mind's hunt for hidden structure - the rule behind a sequence, the regularity in noise. It sits at the heart of fluid reasoning and prediction, from spotting a trend in data to anticipating what comes next. It is one of the purest measures of on-the-spot reasoning because it leans on logic, not learned knowledge.",
  working_memory: "Working memory is your mental workspace - how much you can hold and manipulate at once. It limits everything from following a complex argument to doing arithmetic in your head. It is strongly linked to general reasoning ability and tends to be the bottleneck when tasks feel overwhelming. Unlike stored knowledge, it is about live capacity right now.",
  attention_control: "Attention control is the ability to stay locked on what matters and filter out the rest. It governs focus under distraction, sustained concentration, and resisting the pull of the irrelevant. In an age of constant interruption it may be the most quietly valuable faculty of all - and one of the most erodible.",
  spatial_reasoning: "Spatial reasoning is thinking in shapes and space - rotating, folding, and comparing forms in the mind's eye. It powers navigation, design, engineering, and any task where you picture how things fit or move. It is a distinct ability that does not always track verbal or numerical skill, which is why it deserves its own measure.",
  logical_reasoning: "Logical reasoning is following premises to a sound conclusion - deduction, conditionals, ordering. It is the backbone of clear thinking, argument, and debugging your own assumptions. Because it relies on form rather than facts, it is a clean window onto reasoning ability independent of what you happen to know.",
  verbal_reasoning: "Verbal reasoning is precision with meaning - grasping relationships between words, analogies, opposites. It reflects both reasoning and accumulated language knowledge, so it is read carefully alongside your native language. It predicts comprehension, communication, and how finely you can express a thought.",
  processing_speed: "Processing speed is how fast you make simple, accurate decisions. It is the tempo underneath all cognition - faster processing frees up capacity for harder thinking. It declines earliest with fatigue and age, making it a sensitive early signal of cognitive state.",
  estimation: "Estimation is calibrated guessing - landing close when you cannot compute exactly. It blends number sense with judgment under uncertainty, the everyday skill behind 'is this roughly right?'. It is scored not by exactness but by how close you come compared with everyone else, because good estimation is about being usefully approximate, fast.",
  inhibition: "Inhibition is the brake on your automatic responses - overriding the obvious answer to give the correct one. It is core executive function, the faculty behind self-control, resisting impulse, and not blurting the first thing that comes to mind. The Stroop task measures it by pitting reading against color naming.",
  task_switching: "Task switching is mental flexibility - shifting between rules or goals without getting stuck. It carries a real cost (the 'switch cost') that the task measures, and it underlies multitasking, adapting to change, and juggling priorities. It is a distinct executive skill from raw focus.",
  retention: "Retention is whether what you learn actually sticks over days and weeks, not just seconds. Most cognitive tasks measure the moment; this one measures durability, using spaced repetition to test recall exactly when forgetting would set in. It trains and measures at once - and only scores you when a card is genuinely due, never for forgetting something you just saw.",
  retrieval_fluency: "Retrieval fluency is how readily you pull items from long-term memory on demand - naming many things in a category, fast. It reflects the health of your memory's search-and-retrieve machinery, distinct from how much you have stored. Clinicians use exactly this kind of generate-many task as a sensitive probe of cognitive function.",
  verbal_fluency: "Verbal fluency is rapid, constrained word generation - producing words to a rule under time pressure. It taps the speed and organization of your mental lexicon and is a classic, sensitive measure of executive and language function. The constraint (a letter, an ending) forces a real search rather than free association.",
  visual_processing: "Visual processing is making sense of what you see - matching figures, completing partial shapes, searching a field for a target. It is a distinct intelligence from verbal or numerical skill, central to recognition, reading diagrams, and interpreting the visual world at a glance.",
  reaction_time: "Reaction time is the raw speed of response - how fast your nervous system turns a signal into an action. It is the most basic measure of processing speed and a sensitive marker of alertness and fatigue. Because screens and input devices add delay we cannot fully know, we report it honestly as a range, never a single number that would be partly fiction."
};

const CATEGORIES = [
  { slug: 'working_memory',     name: 'Working Memory',     description: 'Holding a few things in mind while you use them, like a phone number while dialing. Tasks: remember and manipulate short spans.', implemented: true,  sort: 1, domain: 'memory' },
  { slug: 'numerical_fluency',  name: 'Numerical Fluency',  description: 'Everyday mental math: splitting a bill, scaling a recipe. Tasks: fast, exact arithmetic.', implemented: true,  sort: 2, domain: 'quantitative' },
  { slug: 'pattern_recognition',name: 'Pattern Recognition',description: 'Spotting the rule behind what you see, what comes next and why. Tasks: sequences and structured forms.', implemented: true,  sort: 3, domain: 'fluid_reasoning' },
  { slug: 'attention_control',  name: 'Attention Control',  description: 'Staying locked on one thing while the rest of the screen tries to pull you away. Tasks: sustained focus under distraction.', implemented: true,  sort: 4, domain: 'processing_speed' },
  { slug: 'spatial_reasoning',  name: 'Spatial Reasoning',  description: 'Turning shapes in your head, the skill behind parking, packing and maps. Tasks: rotate, mirror and compare figures.', implemented: true,  sort: 5, domain: 'fluid_reasoning' },
  { slug: 'logical_reasoning',  name: 'Logical Reasoning',  description: 'Careful if-then thinking: what actually follows from the given facts. Tasks: deduction and ordering from premises.', implemented: true,  sort: 6, domain: 'fluid_reasoning' },
  { slug: 'verbal_reasoning',   name: 'Verbal Reasoning',   description: 'Feeling for what words mean and how they relate. Tasks: synonyms, antonyms and analogies (English deck).', implemented: true,  sort: 7, domain: 'verbal' },
  { slug: 'processing_speed',   name: 'Processing Speed',   description: 'How quickly you make simple calls: same or different, bigger or smaller. Tasks: rapid comparison judgments.', implemented: true,  sort: 8, domain: 'processing_speed' },
  { slug: 'estimation',         name: 'Estimation',         description: 'Gut feel for quantities: roughly how many, how far, how much. Scored on how close you land vs others.', implemented: true,  sort: 9, domain: 'quantitative' },
  { slug: 'inhibition',         name: 'Inhibition',         description: 'Not blurting the automatic answer. Tasks: name the ink colour, not the word it spells.', implemented: true,  sort: 10, domain: 'executive_function' },
  { slug: 'task_switching',     name: 'Task Switching',     description: 'Changing rules mid-stream without stumbling: judge colour, then shape, then colour again.', implemented: true,  sort: 11, domain: 'executive_function' },
  { slug: 'retention',          name: 'Retention',          description: 'Whether what you learn actually sticks over days, not minutes. Spaced repetition with honest scoring.', implemented: true,  sort: 12, domain: 'retention' },
  { slug: 'retrieval_fluency',  name: 'Retrieval Fluency',  description: 'Pulling things out of memory on demand: name as many animals, rivers, tools as you can.', implemented: true,  sort: 13, domain: 'retrieval' },
  { slug: 'verbal_fluency',     name: 'Verbal Fluency',     description: 'Producing words fast under a constraint: starts with P, ends in -ing, fits a category.', implemented: true,  sort: 14, domain: 'verbal' },
  { slug: 'visual_processing',  name: 'Visual Processing',  description: 'Seeing fine differences fast: which figure is identical, what completes the picture.', implemented: true,  sort: 15, domain: 'visual' },
  { slug: 'reaction_time',      name: 'Reaction Time',      description: 'Raw response speed, reported honestly as a range that accounts for your hardware\'s delay.', implemented: true,  sort: 16, domain: 'reaction' },
  { slug: 'strategic_planning', name: 'Strategic Planning',  description: 'Thinking several moves ahead before acting. No clock: scored on how good your plan is, not how fast.', implemented: true, sort: 17, domain: 'strategic_planning' }
];

async function seedCategories() {
  for (const c of CATEGORIES) {
    await sql`
      INSERT INTO categories (slug, name, description, implemented, active, sort, domain, about)
      VALUES (${c.slug}, ${c.name}, ${c.description}, ${c.implemented}, true, ${c.sort}, ${c.domain}, ${ABOUT[c.slug] ?? null})
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description,
            implemented = EXCLUDED.implemented, sort = EXCLUDED.sort, domain = EXCLUDED.domain, about = EXCLUDED.about
    `;
  }
  console.log(`categories: ${CATEGORIES.length} upserted`);
}

// To add a new challenge bank file: drop the JSON in challenge-bank/ and list it here.
const BANK_FILES = [
  'challenge-bank/numerical-fluency/arithmetic.levels.json',
  'challenge-bank/pattern-recognition/sequence.levels.json',
  'challenge-bank/working-memory/digit-span.levels.json',
  'challenge-bank/attention-control/target-count.levels.json',
  'challenge-bank/spatial-reasoning/figures.levels.json',
  'challenge-bank/logical-reasoning/logic.levels.json',
  'challenge-bank/verbal-reasoning/verbal.en.levels.json',
  'challenge-bank/processing-speed/speed.levels.json',
  'challenge-bank/estimation/estimate.levels.json',
  'challenge-bank/inhibition/stroop.levels.json',
  'challenge-bank/task-switching/switch.levels.json',
  'challenge-bank/retrieval-fluency/retrieval.levels.json',
  'challenge-bank/verbal-fluency/verbal-fluency.levels.json',
  'challenge-bank/visual-processing/visual.levels.json',
  'challenge-bank/strategic-planning/number-path.levels.json'
];

async function seedChallenges() {
  let total = 0;
  for (const rel of BANK_FILES) {
    const items = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
    for (const it of items) {
      await sql`
        INSERT INTO challenges
          (category_slug, challenge_type, level, renderer_type,
           prompt_data, answer_data, scoring_config, version, active, bank_key)
        VALUES
          (${it.category}, ${it.challengeType}, ${it.level}, ${it.rendererType},
           ${sql.json(it.promptData)}, ${sql.json(it.answerData)}, ${sql.json(it.scoringConfig)},
           ${it.version}, ${it.active}, ${it.bankKey})
        ON CONFLICT (bank_key) DO UPDATE
          SET prompt_data = EXCLUDED.prompt_data,
              answer_data = EXCLUDED.answer_data,
              scoring_config = EXCLUDED.scoring_config,
              version = EXCLUDED.version,
              active = EXCLUDED.active,
              updated_at = now()
      `;
      total++;
    }
    console.log(`bank: ${rel} -> ${items.length} upserted`);
  }
  return total;
}

async function seedSimulatedUsers() {
  if (!flag('ENABLE_SIMULATED_USERS')) { console.log('simulated users: skipped (ENABLE_SIMULATED_USERS != true)'); return; }

  const rng = mulberry32(987654321);
  // crude normal via sum of uniforms
  const normal = (mean, sd) => {
    let s = 0; for (let i = 0; i < 6; i++) s += rng();
    return mean + (s - 3) * sd;
  };
  const cats = ['numerical_fluency', 'pattern_recognition', 'working_memory', 'attention_control', 'spatial_reasoning', 'logical_reasoning', 'verbal_reasoning', 'processing_speed', 'estimation', 'inhibition', 'task_switching', 'visual_processing'];
  for (let i = 1; i <= 120; i++) {
    const username = `sim_${String(i).padStart(3, '0')}`;
    let rows = await sql`
      INSERT INTO users (username, is_simulated)
      VALUES (${username}, true)
      ON CONFLICT (username) DO NOTHING
      RETURNING id
    `;
    if (rows.length === 0) {
      // user already exists (e.g. previous seed run) - backfill any missing categories
      rows = await sql`SELECT id FROM users WHERE username = ${username}`;
    }
    const userId = rows[0].id;

    // Consent + varied demographics so the public /statistics preview can demo the page
    // (and the per-attribute admin slices). Simulated users are excluded from the REAL
    // public page regardless; this only matters in preview mode.
    const countries = ['Croatia', 'Germany', 'United States', 'Japan', 'Brazil', 'India'];
    const langs = ['Croatian', 'German', 'English', 'Japanese', 'Portuguese', 'Hindi'];
    const edus = ['secondary', 'vocational', 'bachelor', 'master', 'doctorate'];
    const hands = ['right', 'right', 'right', 'left', 'ambidextrous'];
    const bands = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    const ci = Math.floor(rng() * countries.length);
    await sql`
      INSERT INTO user_attributes
        (user_id, age_band, country, education, native_language, handedness, consented_stats, consented_data, updated_at)
      VALUES (
        ${userId}, ${bands[Math.floor(rng() * bands.length)]}, ${countries[ci]}, ${edus[Math.floor(rng() * edus.length)]},
        ${langs[ci]}, ${hands[Math.floor(rng() * hands.length)]}, true, ${rng() > 0.3}, now()
      )
      ON CONFLICT (user_id) DO UPDATE SET consented_stats = true, age_band = EXCLUDED.age_band
    `;

    for (const cat of cats) {
      const rating = Math.max(650, Math.min(1750, Math.round(normal(1050, 165))));
      const stable = Math.max(1, Math.min(15, Math.round((rating - 700) / 75)));
      const attempts = 30 + Math.floor(rng() * 220);
      const correct = Math.floor(attempts * (0.55 + rng() * 0.35));
      await sql`
        INSERT INTO user_category_state
          (user_id, category_slug, current_level, stable_level, rating, attempts_count, correct_count)
        VALUES (${userId}, ${cat}, ${stable}, ${stable}, ${rating}, ${attempts}, ${correct})
        ON CONFLICT (user_id, category_slug) DO NOTHING
      `;
    }
  }
  console.log('simulated users: 120 ensured across all categories');
  const consentedCount = await sql`
    SELECT count(*)::int AS n FROM user_attributes ua
    JOIN users u ON u.id = ua.user_id
    WHERE u.is_simulated = true AND ua.consented_stats = true
  `;
  console.log(`simulated users with consent: ${consentedCount[0].n} (these populate /statistics in preview mode)`);
}

async function seedRetentionCards() {
  const decksPath = join(ROOT, 'challenge-bank/retention/decks.json');
  const retentionDecks = JSON.parse(readFileSync(decksPath, 'utf8'));
  // Extended trivia decks (broad general knowledge, quiz-show style) live in a separate
  // file so the base deck set stays small and the quiz bank can grow independently.
  const quizPath = join(ROOT, 'challenge-bank/retention/quiz-decks.json');
  const quizDecks = JSON.parse(readFileSync(quizPath, 'utf8'));
  const allDecks = [...retentionDecks, ...quizDecks];
  let total = 0;
  for (const deck of allDecks) {
    for (const [prompt, answer, accepted, note] of deck.cards) {
      await sql`
        INSERT INTO retention_cards (deck, deck_label, prompt, answer, accepted, note, level)
        VALUES (${deck.deck}, ${deck.label}, ${prompt}, ${answer}, ${JSON.stringify(accepted ?? [])}::jsonb, ${note ?? null}, 1)
        ON CONFLICT (deck, prompt) DO UPDATE SET answer = EXCLUDED.answer, accepted = EXCLUDED.accepted, note = EXCLUDED.note, deck_label = EXCLUDED.deck_label
      `;
      total++;
    }
  }
  console.log(`retention cards: ${total} ensured across ${allDecks.length} decks`);
}

const main = async () => {
  await seedCategories();
  const n = await seedChallenges();
  console.log(`challenges: ${n} total upserted`);
  await seedRetentionCards();
  await seedSimulatedUsers();
  await sql.end();
  console.log('seed complete');
};

main().catch((e) => { console.error(e); process.exit(1); });
