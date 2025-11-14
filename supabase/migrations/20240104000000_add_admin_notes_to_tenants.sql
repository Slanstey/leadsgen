-- Add admin_notes field to tenants table for storing additional notes from admin dashboard
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add comment to admin_notes column
COMMENT ON COLUMN tenants.admin_notes IS 'Additional notes from admin dashboard to help with lead generation context';

