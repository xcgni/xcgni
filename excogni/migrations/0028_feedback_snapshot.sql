-- Inconsistency reports: capture a structured state snapshot (and an optional best-effort image)
-- alongside the feedback message, so a tester can flag "this challenge looks wrong" with the exact
-- context attached. snapshot holds challenge id/prompt/answer/level/methodology/viewport/UA as JSON;
-- image holds an optional data-URL screenshot (best-effort, may be absent or imperfect on some
-- browsers). Both nullable - ordinary feedback rows leave them empty.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS snapshot jsonb;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS image text;
