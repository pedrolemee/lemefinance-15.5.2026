-- Trigger types regeneration
ALTER TABLE banks ADD COLUMN IF NOT EXISTS temp_column_2 TEXT DEFAULT NULL;
ALTER TABLE banks DROP COLUMN IF EXISTS temp_column_2;