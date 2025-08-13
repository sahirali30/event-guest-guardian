-- Fix function search path security warning by recreating the function properly
-- First drop the policy that depends on the function
DROP POLICY IF EXISTS "Allow guest and admin read access to RSVP settings" ON public.rsvp_settings;

-- Now drop and recreate the function with proper search path
DROP FUNCTION IF EXISTS public.is_valid_guest_or_admin(TEXT);

CREATE OR REPLACE FUNCTION public.is_valid_guest_or_admin(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invited_guests WHERE email = lower(trim(check_email))
    UNION
    SELECT 1 FROM public.admin_users WHERE email = lower(trim(check_email))
  );
$$;

-- Recreate the policy that uses the function
CREATE POLICY "Allow guest and admin read access to RSVP settings"
ON public.rsvp_settings
FOR SELECT
USING (
  public.is_valid_guest_or_admin(current_setting('app.current_user_email', true))
);