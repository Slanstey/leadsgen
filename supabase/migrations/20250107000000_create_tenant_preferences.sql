-- Create tenant_preferences table to store all tenant settings
CREATE TABLE IF NOT EXISTS tenant_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- General Lead Generation Preferences
    target_industry TEXT,
    company_size TEXT,
    geographic_region TEXT,
    target_roles TEXT,
    revenue_range TEXT,
    keywords TEXT,
    notes TEXT,
    
    -- LinkedIn Search Preferences
    linkedin_locations TEXT,
    linkedin_positions TEXT,
    linkedin_experience_operator TEXT CHECK (linkedin_experience_operator IN ('>', '<', '=')) DEFAULT '=',
    linkedin_experience_years INTEGER CHECK (linkedin_experience_years >= 0 AND linkedin_experience_years <= 30) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one preference record per tenant
    UNIQUE(tenant_id)
);

-- Create index on tenant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_preferences_tenant_id ON tenant_preferences(tenant_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_preferences_updated_at
    BEFORE UPDATE ON tenant_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_preferences_updated_at();

-- Enable RLS
ALTER TABLE tenant_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own tenant's preferences
CREATE POLICY "Users can read their own tenant preferences"
    ON tenant_preferences
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- RLS Policy: Users can update their own tenant's preferences
CREATE POLICY "Users can update their own tenant preferences"
    ON tenant_preferences
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- RLS Policy: Users can insert preferences for their own tenant
CREATE POLICY "Users can insert their own tenant preferences"
    ON tenant_preferences
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

