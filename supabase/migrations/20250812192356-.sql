-- Drop the trigger first, then recreate the function with proper search path
DROP TRIGGER IF EXISTS update_rsvp_settings_updated_at ON public.rsvp_settings;
DROP FUNCTION IF EXISTS public.update_rsvp_settings_updated_at();

-- Recreate function with proper security settings
CREATE OR REPLACE FUNCTION public.update_rsvp_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Recreate the trigger
CREATE TRIGGER update_rsvp_settings_updated_at
BEFORE UPDATE ON public.rsvp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_rsvp_settings_updated_at();