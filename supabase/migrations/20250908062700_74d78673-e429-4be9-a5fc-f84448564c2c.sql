-- Create guest check-ins table for tracking event day attendance
CREATE TABLE public.guest_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  table_number INTEGER NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  checked_in_by TEXT NOT NULL,
  checked_out_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.guest_checkins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access only
CREATE POLICY "Allow admin access to guest checkins" 
ON public.guest_checkins 
FOR ALL 
USING (
  (current_setting('app.current_user_email'::text, true) = 'admincode@modivc.com'::text) 
  OR is_admin_user(current_setting('app.current_user_email'::text, true))
);