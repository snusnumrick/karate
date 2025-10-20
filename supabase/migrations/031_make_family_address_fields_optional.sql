-- Migration: Make family address fields optional for event-only registrations
-- This allows users to register with minimal information for events,
-- then complete their profile when enrolling in classes.

-- 1. Make address fields nullable in families table
ALTER TABLE public.families
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN province DROP NOT NULL;

-- 2. Update the complete_new_user_registration RPC function to accept NULL values
-- Note: Required parameters must come before optional ones in PostgreSQL
CREATE OR REPLACE FUNCTION public.complete_new_user_registration(
    p_user_id uuid,
    p_family_name text,
    p_postal_code character varying(10),
    p_primary_phone character varying(20),
    p_user_email text, -- email of the user, for family record
    p_address text DEFAULT NULL,  -- Now optional
    p_city text DEFAULT NULL,      -- Now optional
    p_province text DEFAULT NULL,  -- Now optional
    p_referral_source text DEFAULT NULL,
    p_referral_name text DEFAULT NULL,
    p_emergency_contact text DEFAULT NULL,
    p_health_info text DEFAULT NULL,
    p_contact1_first_name text DEFAULT NULL,
    p_contact1_last_name text DEFAULT NULL,
    p_contact1_type text DEFAULT NULL,
    p_contact1_home_phone character varying(20) DEFAULT NULL,
    p_contact1_work_phone character varying(20) DEFAULT NULL,
    p_contact1_cell_phone character varying(20) DEFAULT NULL
    -- p_contact1_email is user_email
)
    RETURNS uuid -- Returns the new family_id
    LANGUAGE plpgsql
    SECURITY DEFINER
AS
$$
DECLARE
    new_family_id uuid;
BEGIN
    -- Ensure operations run with expected schema context
    SET LOCAL search_path = public, extensions;

    -- 1. Create the family record
    INSERT INTO public.families (name, address, city, province, postal_code, primary_phone, email,
                                  referral_source, referral_name, emergency_contact, health_info)
    VALUES (p_family_name, p_address, p_city, p_province, p_postal_code, p_primary_phone, p_user_email,
            p_referral_source, p_referral_name, p_emergency_contact, p_health_info)
    RETURNING id
        INTO new_family_id;

    -- 2. Update the user's profile with the new family_id and their first/last name
    -- The profile record is created by the on_auth_user_created trigger.
    UPDATE public.profiles
    SET family_id  = new_family_id,
        first_name = p_contact1_first_name,
        last_name  = p_contact1_last_name
    -- role is already defaulted to 'user' in the table definition and by the trigger's insert.
    WHERE id = p_user_id;

    -- 3. Create the primary guardian record
    INSERT INTO public.guardians (family_id, first_name, last_name, relationship, home_phone, work_phone, cell_phone, email)
    VALUES (new_family_id, p_contact1_first_name, p_contact1_last_name, p_contact1_type,
            p_contact1_home_phone, p_contact1_work_phone, p_contact1_cell_phone, p_user_email);

    RETURN new_family_id;
END;
$$;

-- Re-grant execute permission (function signature changed)
-- Parameters: p_user_id, p_family_name, p_postal_code, p_primary_phone, p_user_email, then all optional params
GRANT EXECUTE ON FUNCTION public.complete_new_user_registration(
    uuid, text, character varying(10), character varying(20), text,
    text, text, text, text, text, text, text, text, text, text, character varying(20), character varying(20), character varying(20)
) TO authenticated;

-- Note: The province check constraint will allow NULL values automatically
-- since constraint checks are only enforced on non-NULL values
