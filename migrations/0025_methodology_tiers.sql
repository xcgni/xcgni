-- Methodology versioning + challenge tiers.
--
-- Every scored attempt and every rating snapshot is stamped with the methodology version it was
-- computed under, so a score is always interpretable/reproducible and a formula change doesn't
-- silently rewrite the meaning of past data.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS methodology_version text;
ALTER TABLE rating_history ADD COLUMN IF NOT EXISTS methodology_version text;

-- Challenge tier: 'canonical' challenges contribute to official scores; 'experimental' ones collect
-- data (so new paradigms can be trialled on real users) but do NOT affect official ratings until
-- they graduate. This is the "proving ground vs canonical battery" split.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'canonical';

-- index to filter canonical attempts fast when computing official ratings
CREATE INDEX IF NOT EXISTS idx_challenges_tier ON challenges(tier);
