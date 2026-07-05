-- High-value context additions (locked in before first users so early data isn't fragmented).
-- Chosen for predictive value at low questionnaire friction; deliberately NOT special-category.

-- Restedness: subjective recovery, separate from sleep HOURS. Predicts performance better than
-- hours alone ("slept 8h but wrecked" vs "slept 6h, sharp"). Asked once per local day, with sleep.
--   values: 'poor' | 'ok' | 'good'
ALTER TABLE session_context ADD COLUMN IF NOT EXISTS rested text;

-- Hours awake: a circadian variable relative to the person's own rhythm (better than clock time;
-- a night worker at 3am isn't the same as a day person at 3am). Rough integer, asked once per day.
ALTER TABLE session_context ADD COLUMN IF NOT EXISTS hours_awake integer;

-- Other stimulant present: captures nicotine / energy drink / medication etc. WITHOUT asking which
-- (no substance list - privacy-respecting). Boolean, asked per session like caffeine.
ALTER TABLE session_context ADD COLUMN IF NOT EXISTS other_stimulant boolean;

-- Optional city on the user (like country): enables regional analysis and weather derivation.
-- OPTIONAL, never required - same privacy posture as the other demographics.
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS city text;
