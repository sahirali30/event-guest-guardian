-- Remove duplicate seat assignments
-- Keep only the most recent entry for each unique table_configuration_id + seat_index combination
DELETE FROM seat_assignments 
WHERE id NOT IN (
  SELECT DISTINCT ON (table_configuration_id, seat_index) id
  FROM seat_assignments
  ORDER BY table_configuration_id, seat_index, created_at DESC
);