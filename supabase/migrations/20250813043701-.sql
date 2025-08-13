-- Fix RLS security warning for admin_users table
-- Add proper RLS policies for the admin_users table

-- Allow admins to read admin_users table (for their own access verification)
CREATE POLICY "Allow admin read access to admin users"
ON public.admin_users
FOR SELECT
USING (
  email = lower(trim(current_setting('request.jwt.claims', true)::json->>'email'))
);

-- Allow admins to manage other admin users (for admin management)
CREATE POLICY "Allow admin management of admin users"
ON public.admin_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('request.jwt.claims', true)::json->>'email'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = lower(trim(current_setting('request.jwt.claims', true)::json->>'email'))
  )
);