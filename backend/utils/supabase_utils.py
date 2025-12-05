"""
Supabase Utilities
Provides environment-aware table name resolution
"""
import os
from typing import Final
from dotenv import load_dotenv

# Load environment variables to ensure they're available
load_dotenv()


def get_table_name(table_name: str) -> str:
    """
    Get the table name with appropriate prefix based on environment

    Args:
        table_name: The base table name (e.g., "leads", "companies")

    Returns:
        The prefixed table name for the current environment
    """
    env = os.getenv('ENVIRONMENT', 'development')

    # In development or when explicitly set, use dev_ prefix
    if env in ('development', 'dev'):
        return f'dev_{table_name}'

    # In production, use the table name without prefix
    return table_name


# Type-safe table name constants
class Tables:
    """Table name constants that respect environment prefix"""
    TENANTS: Final[str] = get_table_name('tenants')
    USER_PROFILES: Final[str] = get_table_name('user_profiles')
    LEADS: Final[str] = get_table_name('leads')
    TENANT_PREFERENCES: Final[str] = get_table_name('tenant_preferences')
    COMPANIES: Final[str] = get_table_name('companies')
    COMMENTS: Final[str] = get_table_name('comments')
    EXECUTIVES: Final[str] = get_table_name('executives')
