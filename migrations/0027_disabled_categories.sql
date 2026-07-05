-- Switch category preference storage from an ENABLED list to a DISABLED list.
--
-- Why: with an enabled-list, any category added AFTER a user saved their prefs was absent from the
-- list and therefore rendered as off - so new categories silently defaulted OFF. The intended
-- behaviour is "everything on by default; the user opts specific ones out", which a disabled-list
-- expresses correctly: a brand-new category is simply not in anyone's disabled set, so it's on.
--
-- Conversion: a user's disabled set = (all implemented categories at migration time) MINUS their
-- stored enabled set. Users whose enabled set is empty/absent/non-array (= "all on") get an empty
-- disabled set (still all on).
--
-- NOTE: enabled_categories may hold a JSON scalar (e.g. null) in some legacy rows, not always an
-- array. jsonb_array_length() and the ? operator both error on scalars. To be completely safe we
-- only ever operate on rows where jsonb_typeof = 'array', filtered in a CTE first so the array-only
-- operators are never evaluated against a scalar, and we avoid jsonb_array_length entirely (compare
-- against '[]' instead).

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS disabled_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

WITH array_prefs AS (
  SELECT user_id, enabled_categories
  FROM user_settings
  WHERE jsonb_typeof(enabled_categories) = 'array'
    AND enabled_categories <> '[]'::jsonb
)
UPDATE user_settings us
SET disabled_categories = COALESCE((
  SELECT jsonb_agg(c.slug)
  FROM categories c
  WHERE c.implemented AND c.active
    AND NOT (ap.enabled_categories ? c.slug)
), '[]'::jsonb)
FROM array_prefs ap
WHERE us.user_id = ap.user_id;

-- enabled_categories is left in place (not dropped) so a rollback is possible and any external export
-- referencing it doesn't break; it's simply no longer the source of truth.
