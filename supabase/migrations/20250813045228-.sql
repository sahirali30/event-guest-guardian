-- Check and fix RLS policies for proper save functionality
-- The issue might be that the policies are not working correctly for inserts/updates

-- First, let's ensure the admin user context is properly accessible
-- Create a more permissive policy for table operations during testing
DROP POLICY IF EXISTS "Allow admin access to table configurations" ON public.table_configurations;
CREATE POLICY "Allow admin access to table configurations"
ON public.table_configurations
FOR ALL
USING (
  current_setting('app.current_user_email', true) = 'admincode@modivc.com'
  OR public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  current_setting('app.current_user_email', true) = 'admincode@modivc.com'
  OR public.is_admin_user(current_setting('app.current_user_email', true))
);

-- Same for seat assignments
DROP POLICY IF EXISTS "Allow admin access to seat assignments" ON public.seat_assignments;
CREATE POLICY "Allow admin access to seat assignments"
ON public.seat_assignments
FOR ALL
USING (
  current_setting('app.current_user_email', true) = 'admincode@modivc.com'
  OR public.is_admin_user(current_setting('app.current_user_email', true))
)
WITH CHECK (
  current_setting('app.current_user_email', true) = 'admincode@modivc.com'
  OR public.is_admin_user(current_setting('app.current_user_email', true))
);