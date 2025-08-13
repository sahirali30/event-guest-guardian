-- Allow public read access to RSVP settings so everyone can see if registration is open/closed
DROP POLICY IF EXISTS "RSVP settings are viewable by valid guests and admins" ON public.rsvp_settings;

-- Create new public read policy
CREATE POLICY "RSVP settings are publicly viewable" 
ON public.rsvp_settings 
FOR SELECT 
USING (true);

-- Keep the existing update policy (admin only)
-- No changes needed to the update policy as it should remain admin-only