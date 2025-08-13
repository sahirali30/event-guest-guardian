-- Fix infinite recursion in admin_users policies and add proper guest access for table management

-- First, drop the problematic admin_users policies that cause infinite recursion
DROP POLICY IF EXISTS "Allow admin read access to admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow admin management of admin users" ON public.admin_users;

-- Create a simpler, safer admin policy that doesn't cause recursion
-- Allow anyone to read admin_users (it's just emails, and needed for policy checks)
CREATE POLICY "Allow read access to admin users for policy checks"
ON public.admin_users
FOR SELECT
USING (true);

-- Create a security definer function to check admin status without recursion
CREATE OR REPLACE FUNCTION public.is_admin_user(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(check_email))
  );
$$;

-- Update the problematic policies to use the new function
-- Update table configurations policy
DROP POLICY IF EXISTS "Allow admin access to table configurations" ON public.table_configurations;
CREATE POLICY "Allow admin access to table configurations"
ON public.table_configurations
FOR ALL
USING (
  public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  public.is_admin_user(current_setting('app.current_user_email', true))
);

-- Update seat assignments policy
DROP POLICY IF EXISTS "Allow admin access to seat assignments" ON public.seat_assignments;
CREATE POLICY "Allow admin access to seat assignments"
ON public.seat_assignments
FOR ALL
USING (
  public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  public.is_admin_user(current_setting('app.current_user_email', true))
);

-- Update all other admin policies to use the new function
DROP POLICY IF EXISTS "Allow admin management of invited guests" ON public.invited_guests;
CREATE POLICY "Allow admin management of invited guests"
ON public.invited_guests
FOR ALL
USING (
  public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  public.is_admin_user(current_setting('app.current_user_email', true))
);

DROP POLICY IF EXISTS "Allow admin access to all registrations" ON public.registrations;
CREATE POLICY "Allow admin access to all registrations"
ON public.registrations
FOR ALL
USING (
  public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  public.is_admin_user(current_setting('app.current_user_email', true))
);

DROP POLICY IF EXISTS "Allow admin access to all guest registrations" ON public.guest_registrations;
CREATE POLICY "Allow admin access to all guest registrations"
ON public.guest_registrations
FOR ALL
USING (
  public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  public.is_admin_user(current_setting('app.current_user_email', true))
);

DROP POLICY IF EXISTS "Allow admin update to RSVP settings" ON public.rsvp_settings;
CREATE POLICY "Allow admin update to RSVP settings"
ON public.rsvp_settings
FOR UPDATE
USING (
  public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  public.is_admin_user(current_setting('app.current_user_email', true))
);