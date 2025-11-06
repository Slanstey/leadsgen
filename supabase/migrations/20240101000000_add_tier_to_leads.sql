-- Add tier column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS tier INTEGER CHECK (tier >= 1 AND tier <= 4) DEFAULT 1;

-- Create an index on tier for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier);

-- Populate existing leads with random tier values (1-4)
-- This will assign a random tier between 1 and 4 to all existing leads
-- Since the default is 1, all existing leads will have tier = 1, so we update all of them
UPDATE leads 
SET tier = (FLOOR(RANDOM() * 4) + 1)::INTEGER;

