-- Add columns to track registration modifications and attendance status
ALTER TABLE registrations 
ADD COLUMN will_attend boolean DEFAULT true,
ADD COLUMN modified_after_initial boolean DEFAULT false,
ADD COLUMN last_modified_at timestamp with time zone DEFAULT now();

-- Create trigger to update last_modified_at when registration is updated
CREATE OR REPLACE FUNCTION update_registration_modified_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified_at = now();
    -- Mark as modified if this is an update (not initial insert)
    IF TG_OP = 'UPDATE' THEN
        NEW.modified_after_initial = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_registrations_modified_at
    BEFORE UPDATE ON registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_registration_modified_at();

-- Add RLS policies for update operations
CREATE POLICY "Allow public update to registrations" 
ON registrations 
FOR UPDATE 
USING (true) 
WITH CHECK (true);