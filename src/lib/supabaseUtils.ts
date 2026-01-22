/**
 * Supabase Utilities
 * Provides environment-aware table name resolution
 */

/**
 * Get the table name with appropriate prefix based on environment
 * @param tableName - The base table name (e.g., "leads", "companies")
 * @returns The prefixed table name for the current environment
 */
export function getTableName(tableName: string): string {
  const env = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development';

  // In development or when explicitly set, use dev_ prefix
  if (env === 'development' || env === 'dev') {
    return `dev_${tableName}`;
  }

  // In production, use the table name without prefix
  return tableName;
}

/**
 * Type-safe table name constants
 */
export const Tables = {
  TENANTS: getTableName('tenants'),
  USER_PROFILES: getTableName('user_profiles'),
  LEADS: getTableName('leads'),
  TENANT_PREFERENCES: getTableName('tenant_preferences'),
  COMPANIES: getTableName('companies'),
  COMMENTS: getTableName('comments'),
  EXECUTIVES: getTableName('executives'),
  ACTIVITY_LOGS: getTableName('activity_logs'),
} as const;
