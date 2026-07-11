-- Content-language groundwork (v1.13.0): challenges carry a language. All existing
-- content is English; the picker filters on it. UI language is a separate, per-user
-- concern - a Croatian interface honestly serving English banks is a supported state.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_challenges_lang ON challenges(lang, category_slug, level) WHERE active;
