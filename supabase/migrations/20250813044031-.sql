-- Create a function to set configuration values for RLS policies
CREATE OR REPLACE FUNCTION public.set_config(
  setting_name text,
  setting_value text
)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT set_config(setting_name, setting_value, false);
$$;