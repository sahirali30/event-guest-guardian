-- Fix the function search path issue
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;