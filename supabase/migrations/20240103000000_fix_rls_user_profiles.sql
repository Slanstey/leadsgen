-- Ensure service role can access user_profiles table
-- This migration ensures that RLS policies don't block service role access

-- First, check if RLS is enabled and create policies if needed
-- Service role should bypass RLS, but we'll ensure policies exist for authenticated users

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Service role can read all user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can insert user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Service role can update user_profiles" ON user_profiles;

-- Note: Service role (using service_role key) bypasses RLS by default
-- These policies are for when using the anon key with authenticated users

-- Allow authenticated users to read their own profile
CREATE POLICY "Users can read their own profile"
ON user_profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow service role to read all profiles (though it bypasses RLS anyway)
-- This is explicit for clarity
CREATE POLICY "Service role can read all user_profiles"
ON user_profiles
FOR SELECT
USING (true);

-- Allow service role to insert profiles
CREATE POLICY "Service role can insert user_profiles"
ON user_profiles
FOR INSERT
WITH CHECK (true);

-- Allow service role to update profiles
CREATE POLICY "Service role can update user_profiles"
ON user_profiles
FOR UPDATE
USING (true)
WITH CHECK (true);

