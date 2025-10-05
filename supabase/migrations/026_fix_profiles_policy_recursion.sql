-- Fix infinite recursion in profiles RLS policy
-- The previous policy was querying profiles table within a profiles policy, causing recursion

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Profiles viewable by user, admin, or instructor" ON public.profiles;

-- Create a helper function that uses SECURITY DEFINER to bypass RLS when checking roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS profile_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id LIMIT 1;
$$;

-- Recreate the policy using the helper function to avoid recursion
CREATE POLICY "Profiles viewable by user, admin, or instructor" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id -- Can view own profile
        OR
        public.get_user_role(auth.uid()) IN ('admin'::profile_role, 'instructor'::profile_role) -- Admins and instructors can view all profiles
    );
