-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Allow guest and admin read access to RSVP settings" ON public.rsvp_settings;

-- Create a truly public read policy for RSVP settings
CREATE POLICY "RSVP settings are publicly viewable" 
ON public.rsvp_settings 
FOR SELECT 
USING (true);