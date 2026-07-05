-- External-criterion capture for validity work. Optional, consented, used only
-- to correlate Excogni ratings against an outside reference — the only way to
-- move from "consistent" to "valid". Never shown to others.
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS ext_test_type text;   -- e.g. 'iq', 'sat', 'gre', 'none'
ALTER TABLE user_attributes ADD COLUMN IF NOT EXISTS ext_test_score integer; -- self-reported, optional
