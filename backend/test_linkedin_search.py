"""
Test script for LinkedIn Search Service
Tests the service with Motion Ads tenant criteria
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
import logging
from services.linkedin_search import LinkedInSearchService

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()

def get_motion_ads_tenant_and_preferences():
    """Get Motion Ads tenant and preferences from database"""
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("Supabase credentials not found in environment variables")
    
    supabase: Client = create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        )
    )
    
    # Search for Motion Ads tenant (case-insensitive)
    tenant_result = supabase.table("tenants").select("*").ilike("name", "%motion ads%").execute()
    
    if not tenant_result.data or len(tenant_result.data) == 0:
        logger.error("Motion Ads tenant not found in database")
        return None, None
    
    tenant = tenant_result.data[0]
    tenant_id = tenant['id']
    logger.info(f"Found tenant: {tenant['name']} (ID: {tenant_id})")
    
    # Get tenant preferences
    prefs_result = supabase.table("tenant_preferences").select("*").eq("tenant_id", tenant_id).execute()
    
    preferences = prefs_result.data[0] if prefs_result.data and len(prefs_result.data) > 0 else {}
    
    return tenant, preferences

def test_linkedin_search():
    """Test LinkedIn search service with Motion Ads tenant"""
    # Get API credentials
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY_ForSearchLinkedIn")
    GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
    
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY_ForSearchLinkedIn environment variable is required")
    
    if not GOOGLE_CSE_ID:
        raise ValueError("GOOGLE_CSE_ID environment variable is required")
    
    # Initialize service
    linkedin_service = LinkedInSearchService(GOOGLE_API_KEY, GOOGLE_CSE_ID)
    logger.info("LinkedIn Search Service initialized")
    
    # Get Motion Ads tenant and preferences
    tenant, preferences = get_motion_ads_tenant_and_preferences()
    if not tenant:
        logger.error("Cannot proceed without Motion Ads tenant")
        return
    
    # Extract LinkedIn search criteria from tenant_preferences
    locations_str = preferences.get("locations", "") if preferences else ""
    positions_str = preferences.get("target_positions", "") if preferences else ""
    experience_operator = preferences.get("experience_operator", "=") if preferences else "="
    experience_years = preferences.get("experience_years", 0) if preferences else 0
    
    logger.info(f"\n=== Motion Ads Tenant LinkedIn Search Criteria ===")
    logger.info(f"Locations: {locations_str if locations_str else '(empty)'}")
    logger.info(f"Positions: {positions_str if positions_str else '(empty)'}")
    logger.info(f"Experience: {experience_operator} {experience_years} years")
    logger.info("=" * 50)
    
    # Parse locations and positions
    if not locations_str or locations_str.strip() == "":
        logger.warning("No locations specified for Motion Ads tenant - using default")
        locations = ["United States"]  # Default
    else:
        locations = [loc.strip() for loc in locations_str.split(",") if loc.strip()]
        logger.info(f"Parsed {len(locations)} location(s): {locations}")
    
    if not positions_str or positions_str.strip() == "":
        logger.warning("No positions specified for Motion Ads tenant - using default")
        positions = ["CEO", "CTO"]  # Default
    else:
        positions = [pos.strip() for pos in positions_str.split(",") if pos.strip()]
        logger.info(f"Parsed {len(positions)} position(s): {positions}")
    
    # Test search
    logger.info(f"\nStarting LinkedIn search...")
    logger.info(f"Searching for: {positions}")
    logger.info(f"In locations: {locations}")
    logger.info(f"With experience: {experience_operator} {experience_years} years\n")
    
    try:
        profiles = linkedin_service.search_profiles(
            locations=locations,
            positions=positions,
            experience_operator=experience_operator,
            experience_years=experience_years or 0,
            limit=10
        )
        
        logger.info(f"\n=== Search Results ===")
        logger.info(f"Found {len(profiles)} profiles\n")
        
        for i, profile in enumerate(profiles, 1):
            logger.info(f"Profile {i}:")
            logger.info(f"  Name: {profile['name']}")
            logger.info(f"  Company: {profile['company']}")
            logger.info(f"  Role: {profile['role']}")
            logger.info(f"  URL: {profile['url']}")
            logger.info(f"  Snippet: {profile['snippet'][:100]}...")
            logger.info("")
        
        if len(profiles) == 0:
            logger.warning("No profiles found. This could mean:")
            logger.warning("1. The search criteria are too specific")
            logger.warning("2. There are no LinkedIn profiles matching the criteria")
            logger.warning("3. The Google Custom Search API configuration needs adjustment")
        
        return profiles
        
    except Exception as e:
        logger.error(f"Error during LinkedIn search: {e}", exc_info=True)
        return []

if __name__ == "__main__":
    try:
        profiles = test_linkedin_search()
        sys.exit(0 if profiles else 1)
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        sys.exit(1)

