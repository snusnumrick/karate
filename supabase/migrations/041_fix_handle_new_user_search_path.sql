-- Migration 041: Security hardening — add SET search_path to handle_new_user()
--
-- Problem:
--   handle_new_user() was defined with SECURITY DEFINER but WITHOUT a fixed search_path.
--   Per Supabase security guidelines, any SECURITY DEFINER function without SET search_path
--   is vulnerable: an attacker who controls search_path could redirect table/function lookups
--   to a malicious schema. This is especially dangerous on auth.users triggers since they
--   run with elevated privileges.
--
-- Fix:
--   Redeclare handle_new_user() with SET search_path = public at the function level.
--   This locks schema resolution regardless of the calling session's search_path.
--
-- Note on the trigger itself:
--   CREATE TRIGGER on_auth_user_created on auth.users requires superuser/postgres role.
--   Migration files cannot create it — apply via Supabase Dashboard SQL editor if needed:
--
--     CREATE TRIGGER on_auth_user_created
--         AFTER INSERT ON auth.users
--         FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--
--   If the trigger already exists (from supabase-setup.sql), this migration just updates
--   the underlying function — no trigger recreation needed.

CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public          -- Locks schema resolution; prevents search_path attacks
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        'user'  -- Default role for all new users
    )
    ON CONFLICT (id) DO NOTHING;     -- Idempotent: no error if profile already exists

    RETURN NEW;
END;
$$;

-- Update function comment to reflect the security fix
COMMENT ON FUNCTION public.handle_new_user() IS
'Creates a basic profile entry for new auth.users. '
'Security hardened: SECURITY DEFINER with SET search_path = public to prevent '
'search_path manipulation attacks. Migration 041.';

-- Verification query: confirm the function has the expected security properties
-- (can be run manually to verify after applying migration)
-- SELECT
--     proname,
--     prosecdef AS security_definer,
--     proconfig  AS config   -- should contain 'search_path=public'
-- FROM pg_proc
-- WHERE proname = 'handle_new_user'
--   AND pronamespace = 'public'::regnamespace;
