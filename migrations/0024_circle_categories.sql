-- A circle's shared practice focus: the subset of categories its creator chose. Stored as a jsonb
-- array of category slugs. Empty/absent = no specific focus (all categories). This is a SUGGESTED
-- focus members can practise with one tap - not enforced, in keeping with the no-coercion stance.
ALTER TABLE circles ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]'::jsonb;
