-- Remove temporary public access policies and implement secure guest data access
-- This fixes the security vulnerabilities while maintaining functionality

-- Remove temporary public access policies that expose guest data
DROP POLICY IF EXISTS "Temporary public access for registration flow" ON public.guest_registrations;
DROP POLICY IF EXISTS "Temporary public access for guest lookup" ON public.invited_guests;
DROP POLICY IF EXISTS "Allow public read access to registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public insert to registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public update to registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public read access to RSVP settings" ON public.rsvp_settings;
DROP POLICY IF EXISTS "Allow public update to RSVP settings" ON public.rsvp_settings;

-- Create function to check if an email matches invited guest or admin
CREATE OR REPLACE FUNCTION public.is_valid_guest_or_admin(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invited_guests WHERE email = lower(trim(check_email))
    UNION
    SELECT 1 FROM public.admin_users WHERE email = lower(trim(check_email))
  );
$$;

-- Create secure policies for invited_guests table
-- Allow guest lookup only for valid guests and admins
CREATE POLICY "Allow valid guest and admin access to invited guests"
ON public.invited_guests
FOR SELECT
USING (
  email = lower(trim(current_setting('app.current_user_email', true)))
  OR 
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Allow admin management of invited guests
CREATE POLICY "Allow admin management of invited guests"
ON public.invited_guests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Create secure policies for registrations table
-- Allow guests to manage only their own registrations
CREATE POLICY "Allow guest access to own registrations"
ON public.registrations
FOR ALL
USING (
  invited_guest_id IN (
    SELECT id FROM public.invited_guests 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  invited_guest_id IN (
    SELECT id FROM public.invited_guests 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Allow admin access to all registrations
CREATE POLICY "Allow admin access to all registrations"
ON public.registrations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Create secure policies for guest_registrations table
-- Allow guests to manage only their own guest registrations
CREATE POLICY "Allow guest access to own guest registrations"
ON public.guest_registrations
FOR ALL
USING (
  registration_id IN (
    SELECT r.id FROM public.registrations r
    JOIN public.invited_guests ig ON r.invited_guest_id = ig.id
    WHERE ig.email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  registration_id IN (
    SELECT r.id FROM public.registrations r
    JOIN public.invited_guests ig ON r.invited_guest_id = ig.id
    WHERE ig.email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Allow admin access to all guest registrations
CREATE POLICY "Allow admin access to all guest registrations"
ON public.guest_registrations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Create secure policies for RSVP settings
-- Allow read access to valid guests and admins
CREATE POLICY "Allow guest and admin read access to RSVP settings"
ON public.rsvp_settings
FOR SELECT
USING (
  public.is_valid_guest_or_admin(current_setting('app.current_user_email', true))
);

-- Allow only admin updates to RSVP settings
CREATE POLICY "Allow admin update to RSVP settings"
ON public.rsvp_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

-- Secure table configurations and seat assignments (admin only)
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow public access to seat assignments" ON public.seat_assignments;
DROP POLICY IF EXISTS "Allow public access to table configurations" ON public.table_configurations;

-- Create admin-only policies for table management
CREATE POLICY "Allow admin access to table configurations"
ON public.table_configurations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);

CREATE POLICY "Allow admin access to seat assignments"
ON public.seat_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('app.current_user_email', true)))
  )
);