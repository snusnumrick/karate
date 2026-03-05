-- Migration: Fix missing profiles and ensure they're created during registration
-- This ensures every auth.users entry has a corresponding profiles entry
-- Note: Can't create triggers on auth.users without superuser, so we rely on the RPC function

-- 1. Create function to handle new user creation (for potential future use)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        'user' -- Default role
    )
    ON CONFLICT (id) DO NOTHING; -- Prevent duplicates

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Note: Trigger creation on auth.users requires superuser permissions
-- Instead, we ensure profiles are created in the complete_new_user_registration function
-- If you have access to Supabase dashboard, you can create this trigger manually:
--
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION public.handle_new_user();
--
-- For now, the RPC function below will handle profile creation

-- 3. Backfill missing profiles for existing users
INSERT INTO public.profiles (id, email, role)
SELECT
    au.id,
    au.email,
    'user' as role
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Add a check to log how many profiles were created
DO $$
DECLARE
    backfill_count integer;
    total_users integer;
    profiles_created integer;
BEGIN
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO profiles_created FROM public.profiles;

    SELECT COUNT(*)
    INTO backfill_count
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL;

    RAISE NOTICE 'Migration 033 Summary:';
    RAISE NOTICE '  Total auth.users: %', total_users;
    RAISE NOTICE '  Total profiles: %', profiles_created;

    IF backfill_count = 0 THEN
        RAISE NOTICE '  ✓ All auth.users have corresponding profiles';
    ELSE
        RAISE WARNING '  ✗ Found % auth.users without profiles', backfill_count;
        RAISE NOTICE '  Note: Profiles will be created automatically during registration via complete_new_user_registration()';
    END IF;
END $$;

-- 5. Update the complete_new_user_registration function to handle missing profiles gracefully
CREATE OR REPLACE FUNCTION public.complete_new_user_registration(
    p_user_id uuid,
    p_family_name text,
    p_postal_code character varying(10),
    p_primary_phone character varying(20),
    p_user_email text,
    p_address text DEFAULT NULL,
    p_city text DEFAULT NULL,
    p_province text DEFAULT NULL,
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
)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
AS
$$
DECLARE
    new_family_id uuid;
    profile_exists boolean;
BEGIN
    SET LOCAL search_path = public, extensions;

    -- Ensure profile exists (should be created by trigger, but double-check)
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id)
    INTO profile_exists;

    IF NOT profile_exists THEN
        -- Create profile if it doesn't exist (shouldn't happen with trigger, but safety net)
        -- We need to get the email from auth.users
        INSERT INTO public.profiles (id, email, role)
        SELECT p_user_id, au.email, 'user'
        FROM auth.users au
        WHERE au.id = p_user_id
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Created missing profile for user %', p_user_id;
    END IF;

    -- 1. Create the family record
    INSERT INTO public.families (name, address, city, province, postal_code, primary_phone, email,
                                  referral_source, referral_name, emergency_contact, health_info)
    VALUES (p_family_name, p_address, p_city, p_province, p_postal_code, p_primary_phone, p_user_email,
            p_referral_source, p_referral_name, p_emergency_contact, p_health_info)
    RETURNING id
        INTO new_family_id;

    -- 2. Update the user's profile with the new family_id and their first/last name
    UPDATE public.profiles
    SET family_id  = new_family_id,
        first_name = p_contact1_first_name,
        last_name  = p_contact1_last_name
    WHERE id = p_user_id;

    -- 3. Create the primary guardian record
    INSERT INTO public.guardians (family_id, first_name, last_name, relationship, home_phone, work_phone, cell_phone, email)
    VALUES (new_family_id, p_contact1_first_name, p_contact1_last_name, p_contact1_type,
            p_contact1_home_phone, p_contact1_work_phone, p_contact1_cell_phone, p_user_email);

    RETURN new_family_id;
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_new_user_registration(
    uuid, text, character varying(10), character varying(20), text,
    text, text, text, text, text, text, text, text, text, text, character varying(20), character varying(20), character varying(20)
) TO authenticated;

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS
'Creates a basic profile entry for new auth.users. To be used with a trigger if superuser access is available.';

COMMENT ON FUNCTION public.complete_new_user_registration IS
'Completes user registration by creating family, updating profile, and creating guardian. Ensures profile exists before proceeding. Migration 033.';
