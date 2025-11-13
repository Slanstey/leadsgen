-- Create a default tenant for new users without matching tenant domains
-- This tenant is hidden from the admin dashboard
-- This ensures referential integrity while allowing users without assigned tenants
INSERT INTO tenants (id, name, slug, created_at, updated_at)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Default New Users',
  'default-new-users',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Add a domain column to tenants table to match users by email domain
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS domain TEXT;

-- Create index on domain for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;

-- Add comment to domain column
COMMENT ON COLUMN tenants.domain IS 'Email domain (e.g., example.com) used to automatically assign users to this tenant';

-- Update all admin users to use the default tenant
UPDATE user_profiles
SET tenant_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
WHERE is_admin = true;

