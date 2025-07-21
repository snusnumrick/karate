-- Fix RLS policy for profiles to allow admins to view all profiles
-- This fixes the issue where admins couldn't see family members for push notifications

-- Drop the existing policy
DROP POLICY IF EXISTS "Profiles viewable by user, admin, or instructor" ON public.profiles;

-- Create the corrected policy
CREATE POLICY "Profiles viewable by user, admin, or instructor" ON public.profiles
    FOR SELECT USING (
    auth.uid() = id -- Can view own profile
        OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'instructor')) -- Admins and instructors can view all profiles
    );

-- Verify the policy was created
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles' 
  AND policyname = 'Profiles viewable by user, admin, or instructor';