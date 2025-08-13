-- Fix function search path security warning
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