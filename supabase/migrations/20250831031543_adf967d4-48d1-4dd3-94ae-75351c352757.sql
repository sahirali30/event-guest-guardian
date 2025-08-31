-- Clean up duplicate guest registrations by removing older entries
-- This will keep only the most recent entry for each duplicate set

DELETE FROM guest_registrations 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY guest_name, guest_email, registration_id ORDER BY created_at ASC) as rn
    FROM guest_registrations
    WHERE registration_id IN (
      SELECT registration_id FROM guest_registrations 
      GROUP BY guest_name, guest_email, registration_id 
      HAVING COUNT(*) > 1
    )
  ) ranked 
  WHERE rn = 1  -- Delete the older entries (first created)
);