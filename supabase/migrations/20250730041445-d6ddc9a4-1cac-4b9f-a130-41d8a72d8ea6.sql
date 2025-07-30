-- Create invited_guests table to store who can register
CREATE TABLE public.invited_guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  max_guests INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create registrations table to store actual registrations
CREATE TABLE public.registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invited_guest_id UUID NOT NULL REFERENCES public.invited_guests(id),
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guest_registrations table to store guest details
CREATE TABLE public.guest_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.registrations(id),
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.invited_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is an event registration site)
CREATE POLICY "Allow public read access to invited guests" 
ON public.invited_guests 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to registrations" 
ON public.registrations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public read access to registrations" 
ON public.registrations 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to guest registrations" 
ON public.guest_registrations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public read access to guest registrations" 
ON public.guest_registrations 
FOR SELECT 
USING (true);

-- Insert sample data
INSERT INTO public.invited_guests (email, name, max_guests) VALUES
  ('john@example.com', 'John Smith', 2),
  ('mary@example.com', 'Mary Johnson', 1),
  ('bob@example.com', 'Bob Wilson', 0),
  ('alice@example.com', 'Alice Brown', 3);