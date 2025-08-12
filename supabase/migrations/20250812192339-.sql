-- Fix the function search path security issue
DROP FUNCTION IF EXISTS public.update_rsvp_settings_updated_at();

CREATE OR REPLACE FUNCTION public.update_rsvp_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';