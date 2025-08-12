-- Create a table to store RSVP settings
CREATE TABLE public.rsvp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rsvp_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to RSVP settings" 
ON public.rsvp_settings 
FOR SELECT 
USING (true);

-- Create policies for public update access (for admin toggle)
CREATE POLICY "Allow public update to RSVP settings" 
ON public.rsvp_settings 
FOR UPDATE 
USING (true);

-- Insert initial record with RSVP open
INSERT INTO public.rsvp_settings (is_open) VALUES (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_rsvp_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rsvp_settings_updated_at
BEFORE UPDATE ON public.rsvp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_rsvp_settings_updated_at();