-- Engaging "about" text per category: what the faculty is, where it matters.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS about text;
