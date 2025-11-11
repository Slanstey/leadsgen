-- Add LinkedIn integration columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS linkedin_access_token TEXT,
ADD COLUMN IF NOT EXISTS linkedin_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS linkedin_profile_id TEXT,
ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_first_name TEXT,
ADD COLUMN IF NOT EXISTS linkedin_last_name TEXT,
ADD COLUMN IF NOT EXISTS linkedin_headline TEXT,
ADD COLUMN IF NOT EXISTS linkedin_connected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS linkedin_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index on linkedin_profile_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_linkedin_profile_id 
ON user_profiles(linkedin_profile_id) 
WHERE linkedin_profile_id IS NOT NULL;

-- Add comment to columns for documentation
COMMENT ON COLUMN user_profiles.linkedin_access_token IS 'LinkedIn OAuth access token (encrypted)';
COMMENT ON COLUMN user_profiles.linkedin_refresh_token IS 'LinkedIn OAuth refresh token (encrypted)';
COMMENT ON COLUMN user_profiles.linkedin_profile_id IS 'LinkedIn user profile ID';
COMMENT ON COLUMN user_profiles.linkedin_profile_url IS 'LinkedIn profile URL';
COMMENT ON COLUMN user_profiles.linkedin_first_name IS 'LinkedIn first name';
COMMENT ON COLUMN user_profiles.linkedin_last_name IS 'LinkedIn last name';
COMMENT ON COLUMN user_profiles.linkedin_headline IS 'LinkedIn profile headline';
COMMENT ON COLUMN user_profiles.linkedin_connected_at IS 'Timestamp when LinkedIn account was connected';
COMMENT ON COLUMN user_profiles.linkedin_token_expires_at IS 'Timestamp when LinkedIn access token expires';

