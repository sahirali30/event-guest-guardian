-- Create tables for storing table configurations
CREATE TABLE public.table_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  seat_count INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing seat assignments
CREATE TABLE public.seat_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_configuration_id UUID NOT NULL REFERENCES public.table_configurations(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL,
  seat_angle NUMERIC NOT NULL,
  guest_name TEXT,
  tag TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.table_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is admin-only behind password protection)
CREATE POLICY "Allow public access to table configurations" 
ON public.table_configurations 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public access to seat assignments" 
ON public.seat_assignments 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_table_configurations_number ON public.table_configurations(table_number);
CREATE INDEX idx_seat_assignments_table_id ON public.seat_assignments(table_configuration_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_table_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_table_configurations_updated_at
BEFORE UPDATE ON public.table_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_table_config_updated_at();

CREATE TRIGGER update_seat_assignments_updated_at
BEFORE UPDATE ON public.seat_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_table_config_updated_at();