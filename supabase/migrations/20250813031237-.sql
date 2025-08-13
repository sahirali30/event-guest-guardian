-- Fix the security warning by updating the function with proper search_path
CREATE OR REPLACE FUNCTION public.update_table_config_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;