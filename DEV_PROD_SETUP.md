# Development and Production Environment Setup

This guide explains how to use environment-based table prefixing for your Supabase database.

## Overview

The system automatically prefixes table names with `dev_` when running in development mode, and uses regular table names in production. This allows you to:
- Test changes locally without affecting production data
- Run development and production environments against the same Supabase instance
- Safely develop features without risking production data corruption

## How It Works

### Environment Variable
Both frontend and backend use an `ENVIRONMENT` variable:
- **Development**: `ENVIRONMENT=development` or `VITE_ENVIRONMENT=development`
  - Tables will be prefixed: `dev_leads`, `dev_companies`, etc.
- **Production**: `ENVIRONMENT=production` or `VITE_ENVIRONMENT=production`
  - Tables will use regular names: `leads`, `companies`, etc.

### Utility Functions
- **Frontend**: `src/lib/supabaseUtils.ts` provides `getTableName()` and `Tables` constants
- **Backend**: `backend/utils/supabase_utils.py` provides `get_table_name()` and `Tables` class

## Setup Instructions

### 1. Environment Configuration

#### Local Development (.env files)
Already configured in both `.env` files:
```bash
# Frontend (.env)
VITE_ENVIRONMENT=development

# Backend (backend/.env)
ENVIRONMENT=development
```

#### Production (Vercel)
In your Vercel project settings, add:
```
VITE_ENVIRONMENT=production
ENVIRONMENT=production
```

### 2. Create Dev Tables in Supabase

You need to create dev versions of all your tables. Here's the SQL to run in Supabase:

```sql
-- Create dev tables as copies of production tables (structure only)
CREATE TABLE dev_tenants (LIKE tenants INCLUDING ALL);
CREATE TABLE dev_user_profiles (LIKE user_profiles INCLUDING ALL);
CREATE TABLE dev_leads (LIKE leads INCLUDING ALL);
CREATE TABLE dev_tenant_preferences (LIKE tenant_preferences INCLUDING ALL);
CREATE TABLE dev_companies (LIKE companies INCLUDING ALL);
CREATE TABLE dev_comments (LIKE comments INCLUDING ALL);
CREATE TABLE dev_executives (LIKE executives INCLUDING ALL);

-- Copy any foreign key constraints, indexes, etc. as needed
-- Note: You'll need to recreate foreign keys to point to dev_ tables

-- Example: If you have RLS (Row Level Security) policies, recreate them for dev tables
-- Enable RLS on dev tables
ALTER TABLE dev_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_tenant_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_executives ENABLE ROW LEVEL SECURITY;

-- Copy RLS policies from production tables to dev tables
-- (You'll need to recreate these based on your existing policies)
```

### 3. Update Frontend Code

The backend is already updated. For the frontend, you need to replace hardcoded table names with the `Tables` constants.

#### Before:
```typescript
const { data, error } = await supabase
  .from("leads")
  .select("*")
  .eq("tenant_id", profile.tenant_id);
```

#### After:
```typescript
import { Tables } from "@/lib/supabaseUtils";

const { data, error } = await supabase
  .from(Tables.LEADS)
  .select("*")
  .eq("tenant_id", profile.tenant_id);
```

#### Available Constants:
```typescript
Tables.TENANTS
Tables.USER_PROFILES
Tables.LEADS
Tables.TENANT_PREFERENCES
Tables.COMPANIES
Tables.COMMENTS
Tables.EXECUTIVES
```

### 4. Files That Need Updating

The following frontend files have hardcoded table references that should be updated:

1. `src/pages/Index.tsx` (lines 48, 96, 112, 130, 206, 236, 271)
2. `src/contexts/AuthContext.tsx` (line 59)
3. `src/pages/AdminDashboard.tsx` (multiple lines)
4. `src/pages/AdminTenantDetail.tsx` (multiple lines)
5. `src/components/CsvUploadDialog.tsx` (multiple lines)
6. `src/pages/CompanyDetail.tsx` (lines 45, 55, 72)
7. `src/pages/Settings.tsx` (lines 84, 117, 219)
8. `src/components/EmailDialog.tsx` (line 50)

### Example Migration

Here's a complete example of updating a file:

```typescript
// At the top of the file, add the import
import { Tables } from "@/lib/supabaseUtils";

// Find all instances of .from("table_name") and replace with Tables constant

// Before:
await supabase.from("leads").select("*")
await supabase.from("companies").select("*")
await supabase.from("comments").insert({...})

// After:
await supabase.from(Tables.LEADS).select("*")
await supabase.from(Tables.COMPANIES).select("*")
await supabase.from(Tables.COMMENTS).insert({...})
```

## Testing

### Testing Development Mode
1. Ensure `.env` has `VITE_ENVIRONMENT=development`
2. Run your app locally: `npm run dev`
3. Verify it's using `dev_` tables by checking Supabase dashboard
4. Make some changes and verify they only affect dev tables

### Testing Production Mode
1. In Vercel, set `VITE_ENVIRONMENT=production`
2. Deploy to Vercel
3. Verify it's using production tables (without `dev_` prefix)

## Migration Strategy

I recommend migrating the frontend code gradually:

1. **Start with one file** (e.g., `src/pages/Index.tsx`)
   - Add the import
   - Replace table names with constants
   - Test thoroughly

2. **Move to other pages** one at a time
   - This allows you to catch any issues early

3. **Test each file** as you migrate
   - Verify all CRUD operations still work

## Rollback Plan

If you need to rollback:
1. Set `VITE_ENVIRONMENT=production` in your `.env` file
2. This will make your local environment use production tables (no prefix)
3. Or simply remove the import and revert to hardcoded table names

## Benefits

✅ **Safe development**: Never risk production data
✅ **Easy testing**: Test migrations and schema changes on dev tables first
✅ **Simple deployment**: Just change one environment variable
✅ **Same database**: No need to maintain separate Supabase projects
✅ **Cost effective**: Use one Supabase project for both environments

## Notes

- The backend is already fully migrated and ready to use
- Frontend needs manual migration (recommended to do incrementally)
- Always test locally with `VITE_ENVIRONMENT=development` before deploying
- In production (Vercel), set `VITE_ENVIRONMENT=production`
