-- Add LinkedIn search fields to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS linkedin_locations TEXT,
ADD COLUMN IF NOT EXISTS linkedin_positions TEXT,
ADD COLUMN IF NOT EXISTS linkedin_experience_operator TEXT CHECK (linkedin_experience_operator IN ('>', '<', '=')) DEFAULT '=',
ADD COLUMN IF NOT EXISTS linkedin_experience_years INTEGER CHECK (linkedin_experience_years >= 0 AND linkedin_experience_years <= 30) DEFAULT 0;

