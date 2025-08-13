-- Step 1: Migrate seat assignments from duplicate table configurations to the most recent one
-- For each table number, find the most recent configuration and migrate all seats to it
WITH latest_configs AS (
  SELECT DISTINCT ON (table_number) 
    id as latest_id, 
    table_number,
    created_at
  FROM table_configurations 
  ORDER BY table_number, created_at DESC
),
duplicate_configs AS (
  SELECT tc.id as old_id, lc.latest_id
  FROM table_configurations tc
  JOIN latest_configs lc ON tc.table_number = lc.table_number
  WHERE tc.id != lc.latest_id
)
UPDATE seat_assignments 
SET table_configuration_id = dc.latest_id
FROM duplicate_configs dc
WHERE seat_assignments.table_configuration_id = dc.old_id;

-- Step 2: Remove duplicate table configurations (keep only the most recent for each table number)
DELETE FROM table_configurations 
WHERE id NOT IN (
  SELECT DISTINCT ON (table_number) id
  FROM table_configurations
  ORDER BY table_number, created_at DESC
);

-- Step 3: Remove any remaining duplicate seat assignments after migration
DELETE FROM seat_assignments 
WHERE id NOT IN (
  SELECT DISTINCT ON (table_configuration_id, seat_index) id
  FROM seat_assignments
  ORDER BY table_configuration_id, seat_index, created_at DESC
);

-- Step 4: Add unique constraint to prevent future duplicate table numbers
ALTER TABLE table_configurations 
ADD CONSTRAINT unique_table_number UNIQUE (table_number);