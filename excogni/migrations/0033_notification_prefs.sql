-- Notification preferences for the Android shell (and any future client). Per the product's
-- anti-nag philosophy, everything defaults OFF: the user opts in.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_time text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS conditional_enabled boolean NOT NULL DEFAULT false;
