-- The age band values lost their en-dash (–) in favour of a plain hyphen (-) for visual
-- consistency. age_band is a stored key, so convert any existing rows to match the new values.
-- Safe and idempotent (no-op if there are none / already converted).
UPDATE user_attributes
SET age_band = replace(age_band, '–', '-')
WHERE age_band LIKE '%–%';
